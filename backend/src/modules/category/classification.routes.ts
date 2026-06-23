import type { FastifyInstance } from 'fastify';
import { ClassificationService } from './classification.service.js';
import { overrideFlagSchema, getAuditLogQuerySchema } from './classification.validators.js';

export async function classificationRoutes(app: FastifyInstance) {
  const classificationService = new ClassificationService(app);

  // All classification routes require authentication
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /api/v1/categories/:categoryId/defaults
   * Get the default classification flags for a category.
   * Used when assigning a category to a booking split.
   */
  app.get('/:categoryId/defaults', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string };
    const defaults = classificationService.getDefaultsFromCategory(categoryId);
    return reply.status(200).send(defaults);
  });

  /**
   * POST /api/v1/booking-splits/:id/override-flag
   * Override a single classification flag on a booking split.
   * Creates an audit log entry atomically.
   */
  app.post('/booking-splits/:id/override-flag', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = overrideFlagSchema.parse(request.body);
    const userId = request.user.userId;

    const result = classificationService.overrideFlag(
      {
        booking_split_id: id,
        flag: body.flag as Parameters<typeof classificationService.overrideFlag>[0]['flag'],
        new_value: body.new_value,
        reason: body.reason,
      },
      userId
    );

    return reply.status(200).send(result);
  });

  /**
   * GET /api/v1/audit-log
   * Get audit log entries with optional filtering and pagination.
   */
  app.get('/audit-log', async (request, reply) => {
    const query = getAuditLogQuerySchema.parse(request.query);

    const result = classificationService.getAuditLog({
      bookingSplitId: query.bookingSplitId,
      bookingId: query.bookingId,
      from: query.from,
      to: query.to,
      type: query.type,
      page: query.page,
      limit: query.limit,
    });

    return reply.status(200).send(result);
  });
}
