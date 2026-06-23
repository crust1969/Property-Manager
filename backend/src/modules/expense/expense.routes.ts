import type { FastifyInstance } from 'fastify';
import { ExpenseService } from './expense.service.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  splitExpenseSchema,
  getExpensesQuerySchema,
} from './expense.validators.js';

export async function expenseRoutes(app: FastifyInstance) {
  const expenseService = new ExpenseService(app);

  // All expense routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /api/v1/expenses?propertyId=&year=&categoryId=&flags=
  app.get('/', async (request, reply) => {
    const query = getExpensesQuerySchema.parse(request.query);
    const userId = request.user.userId;

    const expenses = expenseService.list(query.propertyId ?? '', userId, {
      year: query.year,
      categoryId: query.categoryId,
      flags: query.flags,
    });
    return reply.status(200).send(expenses);
  });

  // POST /api/v1/expenses
  app.post('/', async (request, reply) => {
    const body = createExpenseSchema.parse(request.body);
    const userId = request.user.userId;

    const expense = expenseService.create(body, userId);
    return reply.status(201).send(expense);
  });

  // GET /api/v1/expenses/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const expense = expenseService.getById(id, userId);
    return reply.status(200).send(expense);
  });

  // PUT /api/v1/expenses/:id
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateExpenseSchema.parse(request.body);
    const userId = request.user.userId;

    const expense = expenseService.update(id, body, userId);
    return reply.status(200).send(expense);
  });

  // DELETE /api/v1/expenses/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    expenseService.delete(id, userId);
    return reply.status(200).send({ message: 'Ausgabe gelöscht' });
  });

  // POST /api/v1/expenses/:id/split — create/replace split bookings
  app.post('/:id/split', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = splitExpenseSchema.parse(request.body);
    const userId = request.user.userId;

    const expense = expenseService.createOrReplaceSplits(id, body.splits, userId);
    return reply.status(200).send(expense);
  });

  // PUT /api/v1/expenses/:id/split — update split bookings
  app.put('/:id/split', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = splitExpenseSchema.parse(request.body);
    const userId = request.user.userId;

    const expense = expenseService.updateSplits(id, body.splits, userId);
    return reply.status(200).send(expense);
  });
}
