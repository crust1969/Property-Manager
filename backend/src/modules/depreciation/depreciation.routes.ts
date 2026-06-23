import type { FastifyInstance } from 'fastify';
import { DepreciationService } from './depreciation.service.js';
import { z } from 'zod';
import { createPositionSchema, updatePositionSchema } from './depreciation.validators.js';

const updateAfaParamsSchema = z.object({
  afa_rate: z.number().min(0.0001).max(1.0),
  afa_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function depreciationRoutes(app: FastifyInstance) {
  const depreciationService = new DepreciationService(app);

  // All depreciation routes require authentication
  app.addHook('preHandler', app.authenticate);

  // --- Legacy endpoints (backward compatibility) ---

  // GET /api/v1/depreciation/:propertyId — get AfA parameters
  app.get('/:propertyId', async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const userId = request.user.userId;

    const params = depreciationService.getAfaParameters(propertyId, userId);
    return reply.status(200).send(params);
  });

  // PUT /api/v1/depreciation/:propertyId — update AfA parameters (rate, start_date)
  app.put('/:propertyId', async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const userId = request.user.userId;

    const body = updateAfaParamsSchema.parse(request.body);
    const params = depreciationService.updateAfaParameters(propertyId, userId, body);
    return reply.status(200).send(params);
  });

  // GET /api/v1/depreciation/:propertyId/plan — generate and return the full AfA plan
  app.get('/:propertyId/plan', async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const userId = request.user.userId;

    const result = depreciationService.getAfaPlan(propertyId, userId);
    return reply.status(200).send(result);
  });

  // --- New multi-position endpoints ---

  // GET /api/v1/depreciation/:propertyId/positions — list all positions
  app.get('/:propertyId/positions', async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const userId = request.user.userId;

    const positions = depreciationService.listPositions(propertyId, userId);
    return reply.status(200).send(positions);
  });

  // POST /api/v1/depreciation/:propertyId/positions — create position
  app.post('/:propertyId/positions', async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const userId = request.user.userId;

    const body = createPositionSchema.parse(request.body);
    const position = depreciationService.createPosition(propertyId, userId, body);
    return reply.status(201).send(position);
  });

  // PUT /api/v1/depreciation/:propertyId/positions/:positionId — update position
  app.put('/:propertyId/positions/:positionId', async (request, reply) => {
    const { positionId } = request.params as { propertyId: string; positionId: string };
    const userId = request.user.userId;

    const body = updatePositionSchema.parse(request.body);
    const position = depreciationService.updatePosition(positionId, userId, body);
    return reply.status(200).send(position);
  });

  // DELETE /api/v1/depreciation/:propertyId/positions/:positionId — delete position
  app.delete('/:propertyId/positions/:positionId', async (request, reply) => {
    const { positionId } = request.params as { propertyId: string; positionId: string };
    const userId = request.user.userId;

    depreciationService.deletePosition(positionId, userId);
    return reply.status(204).send();
  });

  // GET /api/v1/depreciation/:propertyId/positions/:positionId/plan — plan for single position
  app.get('/:propertyId/positions/:positionId/plan', async (request, reply) => {
    const { positionId } = request.params as { propertyId: string; positionId: string };
    const userId = request.user.userId;

    const result = depreciationService.getPositionPlan(positionId, userId);
    return reply.status(200).send(result);
  });

  // GET /api/v1/depreciation/:propertyId/combined — combined yearly overview
  app.get('/:propertyId/combined', async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const userId = request.user.userId;

    const overview = depreciationService.getCombinedOverview(propertyId, userId);
    return reply.status(200).send(overview);
  });
}
