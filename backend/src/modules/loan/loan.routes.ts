import type { FastifyInstance } from 'fastify';
import { LoanService } from './loan.service.js';
import {
  createLoanSchema,
  updateLoanSchema,
  createPaymentSchema,
  loanQuerySchema,
} from './loan.validators.js';

export async function loanRoutes(app: FastifyInstance) {
  const loanService = new LoanService(app);

  // GET /api/v1/loans — List loans (optional filter: propertyId)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const query = loanQuerySchema.parse(request.query);
    return loanService.listLoans(userId, query.propertyId);
  });

  // POST /api/v1/loans — Create a loan
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createLoanSchema.parse(request.body);
    const loan = loanService.createLoan(userId, body);
    return reply.status(201).send(loan);
  });

  // GET /api/v1/loans/:id — Get loan details
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return loanService.getLoan(id, userId);
  });

  // PUT /api/v1/loans/:id — Update a loan
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = updateLoanSchema.parse(request.body);
    return loanService.updateLoan(id, userId, body);
  });

  // DELETE /api/v1/loans/:id — Delete a loan
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    loanService.deleteLoan(id, userId);
    return reply.status(204).send();
  });

  // POST /api/v1/loans/:id/payments — Record a payment
  app.post('/:id/payments', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = createPaymentSchema.parse(request.body);
    const payment = loanService.createPayment(id, userId, body);
    return reply.status(201).send(payment);
  });

  // GET /api/v1/loans/:id/payments — List payments for a loan
  app.get('/:id/payments', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return loanService.listPayments(id, userId);
  });

  // GET /api/v1/loans/:id/balance — Get remaining balance history
  app.get('/:id/balance', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return loanService.getBalance(id, userId);
  });

  // GET /api/v1/loans/:id/schedule — Get calculated annuity repayment schedule
  app.get('/:id/schedule', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return loanService.getSchedule(id, userId);
  });
}
