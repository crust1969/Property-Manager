import type { FastifyInstance } from 'fastify';
import { TenantService } from './tenant.service.js';
import { createTenantSchema, updateTenantSchema } from './tenant.validators.js';

export async function tenantRoutes(app: FastifyInstance) {
  const tenantService = new TenantService(app);

  // GET /api/v1/tenants — List all tenants for authenticated user, optionally filtered by propertyId
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { propertyId } = request.query as { propertyId?: string };
    return tenantService.listTenants(userId, propertyId);
  });

  // POST /api/v1/tenants — Create a new tenant
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createTenantSchema.parse(request.body);
    const tenant = tenantService.createTenant(userId, body);
    return reply.status(201).send(tenant);
  });

  // GET /api/v1/tenants/:id — Get a single tenant by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return tenantService.getTenant(id, userId);
  });

  // PUT /api/v1/tenants/:id — Update a tenant
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = updateTenantSchema.parse(request.body);
    return tenantService.updateTenant(id, userId, body);
  });

  // DELETE /api/v1/tenants/:id — Delete a tenant
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    tenantService.deleteTenant(id, userId);
    return reply.status(204).send();
  });
}
