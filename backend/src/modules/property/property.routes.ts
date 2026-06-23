import type { FastifyInstance } from 'fastify';
import { PropertyService } from './property.service.js';
import { createPropertySchema, updatePropertySchema } from './property.validators.js';

export async function propertyRoutes(app: FastifyInstance) {
  const propertyService = new PropertyService(app);

  // GET /api/v1/properties — List all properties for authenticated user
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    return propertyService.listProperties(userId);
  });

  // POST /api/v1/properties — Create a new property
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createPropertySchema.parse(request.body);
    const property = propertyService.createProperty(userId, body);
    return reply.status(201).send(property);
  });

  // GET /api/v1/properties/:id — Get a single property by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return propertyService.getProperty(id, userId);
  });

  // PUT /api/v1/properties/:id — Update a property
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = updatePropertySchema.parse(request.body);
    return propertyService.updateProperty(id, userId, body);
  });

  // DELETE /api/v1/properties/:id — Delete a property
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    propertyService.deleteProperty(id, userId);
    return reply.status(204).send();
  });
}
