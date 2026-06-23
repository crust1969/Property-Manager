import type { FastifyInstance } from 'fastify';
import { DashboardService } from './dashboard.service.js';
import { z } from 'zod';

const dashboardQuerySchema = z.object({
  propertyId: z.string().optional(),
});

export async function dashboardRoutes(app: FastifyInstance) {
  const dashboardService = new DashboardService(app);

  // GET /api/v1/dashboard?propertyId= — Aggregated KPIs for current year
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const query = dashboardQuerySchema.parse(request.query);
    return dashboardService.getDashboardKPIs(userId, query.propertyId);
  });
}
