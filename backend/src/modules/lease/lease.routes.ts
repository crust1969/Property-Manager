import type { FastifyInstance } from 'fastify';
import { LeaseService } from './lease.service.js';
import { createLeaseSchema, updateLeaseSchema, terminateLeaseSchema } from './lease.validators.js';

export async function leaseRoutes(app: FastifyInstance) {
  const leaseService = new LeaseService(app);

  // GET /api/v1/leases — List all leases for authenticated user (optional ?propertyId= filter)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { propertyId } = request.query as { propertyId?: string };
    return leaseService.listLeases(userId, propertyId);
  });

  // POST /api/v1/leases — Create a new lease
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createLeaseSchema.parse(request.body);
    const lease = leaseService.createLease(userId, body);
    return reply.status(201).send(lease);
  });

  // GET /api/v1/leases/:id — Get a single lease by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return leaseService.getLease(id, userId);
  });

  // PUT /api/v1/leases/:id — Update a lease
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = updateLeaseSchema.parse(request.body);
    return leaseService.updateLease(id, userId, body);
  });

  // POST /api/v1/leases/:id/terminate — Terminate a lease
  app.post('/:id/terminate', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = terminateLeaseSchema.parse(request.body);
    return leaseService.terminateLease(id, userId, body);
  });

  // DELETE /api/v1/leases/:id — Delete a lease
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    
    // Verify lease exists and belongs to user
    const lease = leaseService.getLease(id, userId);
    if (!lease) {
      const error = new Error('Mietvertrag nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    
    // Delete the lease and its receivables
    app.db.prepare('DELETE FROM receivables WHERE lease_id = ?').run(id);
    app.db.prepare('DELETE FROM leases WHERE id = ?').run(id);
    
    return reply.status(204).send();
  });

  // GET /api/v1/leases/:id/receivables — Get receivables for a lease
  app.get('/:id/receivables', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return leaseService.getReceivables(id, userId);
  });
}
