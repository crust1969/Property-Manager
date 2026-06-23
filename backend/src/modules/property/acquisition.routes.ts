import type { FastifyInstance } from 'fastify';
import { AcquisitionService } from './acquisition.service.js';
import { putAcquisitionSchema } from './acquisition.validators.js';

export async function acquisitionRoutes(app: FastifyInstance) {
  const acquisitionService = new AcquisitionService(app);

  // GET /api/v1/properties/:id/acquisition — Get acquisition data for a property
  app.get('/:id/acquisition', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const acquisition = acquisitionService.getAcquisition(id, userId);

    if (!acquisition) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Keine Anschaffungsdaten für dieses Objekt vorhanden',
      });
    }

    return acquisition;
  });

  // PUT /api/v1/properties/:id/acquisition — Create or update acquisition data
  app.put('/:id/acquisition', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = putAcquisitionSchema.parse(request.body);
    return acquisitionService.putAcquisition(id, userId, body);
  });
}
