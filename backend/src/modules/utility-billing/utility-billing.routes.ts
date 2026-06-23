import type { FastifyInstance } from 'fastify';
import { UtilityBillingService } from './utility-billing.service.js';
import { z } from 'zod';

const allocationKeySchema = z.enum(['fläche', 'personen', 'verbrauch', 'direkt', 'manuell']);

const allocationParamsSchema = z.object({
  tenant_area: z.number().optional(),
  total_area: z.number().optional(),
  tenant_persons: z.number().int().optional(),
  total_persons: z.number().int().optional(),
  tenant_consumption: z.number().optional(),
  total_consumption: z.number().optional(),
  manual_percentage: z.number().min(0.01).max(100).optional(),
});

const itemSchema = z.object({
  category_id: z.string().min(1),
  total_cost: z.number().int().min(1),
  allocation_key: allocationKeySchema,
  allocation_params: allocationParamsSchema.optional(),
  // Also support flat params for backward compat
  tenant_area: z.number().optional(),
  total_area: z.number().optional(),
  tenant_persons: z.number().int().optional(),
  total_persons: z.number().int().optional(),
  tenant_consumption: z.number().optional(),
  total_consumption: z.number().optional(),
  manual_percentage: z.number().min(0.01).max(100).optional(),
});

const createBillingSchema = z.object({
  property_id: z.string().min(1),
  lease_id: z.string().min(1),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  items: z.array(itemSchema).min(1),
});

export async function utilityBillingRoutes(app: FastifyInstance) {
  const service = new UtilityBillingService(app);

  // POST /api/v1/utility-billing — Create a billing
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createBillingSchema.parse(request.body);

    // Transform items with allocation_params to flat cost_positions for the service
    const cost_positions = body.items.map(item => {
      const params = item.allocation_params ?? {};
      return {
        category_id: item.category_id,
        total_cost: item.total_cost,
        allocation_key: item.allocation_key,
        tenant_area: params.tenant_area ?? item.tenant_area,
        total_area: params.total_area ?? item.total_area,
        tenant_persons: params.tenant_persons ?? item.tenant_persons,
        total_persons: params.total_persons ?? item.total_persons,
        tenant_consumption: params.tenant_consumption ?? item.tenant_consumption,
        total_consumption: params.total_consumption ?? item.total_consumption,
        manual_percentage: params.manual_percentage ?? item.manual_percentage,
      };
    });

    const result = service.create({
      property_id: body.property_id,
      lease_id: body.lease_id,
      period_start: body.period_start,
      period_end: body.period_end,
      cost_positions,
    }, userId);
    return reply.status(201).send(result);
  });

  // GET /api/v1/utility-billing/:id — Get billing details
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return service.getById(id, userId);
  });

  // GET /api/v1/utility-billing/:id/pdf — Export as PDF
  app.get('/:id/pdf', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const pdfBuffer = await service.generatePdf(id, userId);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="nebenkostenabrechnung-${id}.pdf"`)
      .send(pdfBuffer);
  });
}
