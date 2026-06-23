import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CashflowService } from './cashflow.service.js';

const cashflowQuerySchema = z.object({
  propertyId: z.string().min(1, 'propertyId ist erforderlich'),
  year: z.coerce.number().int().min(1900).max(2200),
});

const yieldQuerySchema = z.object({
  propertyId: z.string().min(1, 'propertyId ist erforderlich'),
});

export async function cashflowRoutes(app: FastifyInstance) {
  const cashflowService = new CashflowService(app);

  // GET /api/v1/cashflow?propertyId=&year= — Monthly + annual cashflow
  app.get('/cashflow', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const query = cashflowQuerySchema.parse(request.query);
    return cashflowService.getCashflow(query.propertyId, userId, query.year);
  });

  // GET /api/v1/yield?propertyId= — Gross and net yield
  app.get('/yield', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const query = yieldQuerySchema.parse(request.query);
    return cashflowService.getYield(query.propertyId, userId);
  });
}
