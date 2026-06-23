import type { FastifyInstance } from 'fastify';
import { DepositService } from './deposit.service.js';
import { createDepositSchema, refundDepositSchema } from './deposit.validators.js';

export async function depositRoutes(app: FastifyInstance) {
  const depositService = new DepositService(app);

  // GET /api/v1/deposits?leaseId= — List deposits (optionally filtered by lease)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { leaseId } = request.query as { leaseId?: string };
    if (leaseId) {
      return depositService.listDeposits(userId, leaseId);
    }
    // Return all deposits for this user
    return depositService.listAllDeposits(userId);
  });

  // POST /api/v1/deposits — Create a deposit
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createDepositSchema.parse(request.body);
    const deposit = depositService.createDeposit(userId, body);
    return reply.status(201).send(deposit);
  });

  // GET /api/v1/deposits/:id — Get deposit details
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return depositService.getDeposit(id, userId);
  });

  // POST /api/v1/deposits/:id/refund — Process a refund (partial or full)
  app.post('/:id/refund', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = refundDepositSchema.parse(request.body);
    return depositService.processRefund(id, userId, body);
  });

  // DELETE /api/v1/deposits/:id — Delete a deposit
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    
    const deposit = depositService.getDeposit(id, userId);
    if (!deposit) {
      const error = new Error('Kaution nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    app.db.prepare('DELETE FROM deposits WHERE id = ?').run(id);
    return reply.status(204).send();
  });
}
