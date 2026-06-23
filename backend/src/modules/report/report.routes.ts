import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReportService, type ReportType } from './report.service.js';
import { reportToCsv } from './report.csv.js';
import { reportToPdf } from './report.pdf.js';
import { SimulationService } from './simulation.service.js';

const VALID_TYPES: ReportType[] = ['steuerlich', 'werbungskosten', 'afa-plan', 'zins-tilgung', 'mieteingaenge', 'belegvollstaendigkeit'];
const VALID_FORMATS = ['json', 'csv', 'pdf'] as const;

const reportQuerySchema = z.object({
  propertyId: z.string().min(1, 'propertyId ist erforderlich'),
  year: z.coerce.number().int().min(1900).max(2100),
  format: z.enum(VALID_FORMATS).optional().default('json'),
});

const simulationBodySchema = z.object({
  propertyId: z.string().min(1, 'propertyId ist erforderlich'),
  taxRate: z.number().min(0).max(1),
  annualNonAllocableCosts: z.number().int().min(0),
  years: z.number().int().min(1).max(30).optional().default(10),
  rentIncreasePercent: z.number().min(0).max(1).optional().default(0),
  rentIncreaseEveryYears: z.number().int().min(0).max(30).optional().default(0),
});

const profitabilityBodySchema = z.object({
  propertyId: z.string().min(1, 'propertyId ist erforderlich'),
  equityInvested: z.number().int().min(0),
  purchasePrice: z.number().int().min(0),
  annualAppreciationRates: z.array(z.number().min(-1).max(1)).min(1).max(20),
  years: z.number().int().min(1).max(30),
  totalCashflow: z.number().int(),
  remainingLoanBalance: z.number().int().min(0),
});

export async function reportRoutes(app: FastifyInstance) {
  const reportService = new ReportService(app);
  const simulationService = new SimulationService(app);

  // POST /api/v1/reports/simulation — Cashflow-Simulation
  app.post('/simulation', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const body = simulationBodySchema.parse(request.body);
    return simulationService.simulate(body, userId);
  });

  // POST /api/v1/reports/profitability — Rentabilitätsanalyse
  app.post('/profitability', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const body = profitabilityBodySchema.parse(request.body);
    return simulationService.calculateProfitability(body, userId);
  });

  // GET /api/v1/reports/:type?propertyId=&year=&format=
  app.get('/:type', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { type } = request.params as { type: string };

    // Validate report type
    if (!VALID_TYPES.includes(type as ReportType)) {
      const error = new Error(
        `Ungültiger Berichtstyp: '${type}'. Erlaubt: ${VALID_TYPES.join(', ')}`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Parse and validate query
    const query = reportQuerySchema.parse(request.query);

    // Generate report
    const report = reportService.generateReport(type as ReportType, {
      propertyId: query.propertyId,
      year: query.year,
    }, userId);

    // Return in requested format
    switch (query.format) {
      case 'csv': {
        const csv = reportToCsv(report);
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="bericht-${type}-${query.year}.csv"`)
          .send(csv);
      }
      case 'pdf': {
        const pdfBuffer = await reportToPdf(report);
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="bericht-${type}-${query.year}.pdf"`)
          .send(pdfBuffer);
      }
      case 'json':
      default:
        return report;
    }
  });
}
