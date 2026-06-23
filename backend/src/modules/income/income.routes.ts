import type { FastifyInstance } from 'fastify';
import { IncomeService } from './income.service.js';
import {
  createIncomeSchema,
  updateIncomeSchema,
  incomeQuerySchema,
  comparisonQuerySchema,
} from './income.validators.js';

export async function incomeRoutes(app: FastifyInstance) {
  const incomeService = new IncomeService(app);

  // GET /api/v1/income — List income bookings (optional filters: propertyId, year, month)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const query = incomeQuerySchema.parse(request.query);
    return incomeService.listIncome(userId, query.propertyId, query.year, query.month);
  });

  // GET /api/v1/income/comparison — Soll/Ist comparison for a lease+month
  // Must be registered BEFORE /:id to avoid route conflict
  app.get('/comparison', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const query = comparisonQuerySchema.parse(request.query);
    return incomeService.getComparison(userId, query.leaseId, query.year, query.month);
  });

  // POST /api/v1/income — Create income booking
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createIncomeSchema.parse(request.body);
    const income = incomeService.createIncome(userId, body);
    return reply.status(201).send(income);
  });

  // GET /api/v1/income/:id — Get single income booking
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return incomeService.getIncome(id, userId);
  });

  // PUT /api/v1/income/:id — Update income booking
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = updateIncomeSchema.parse(request.body);
    return incomeService.updateIncome(id, userId, body);
  });

  // DELETE /api/v1/income/:id — Delete income booking
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    incomeService.deleteIncome(id, userId);
    return reply.status(204).send();
  });
}
