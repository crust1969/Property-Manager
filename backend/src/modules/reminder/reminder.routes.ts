import type { FastifyInstance } from 'fastify';
import { ReminderService } from './reminder.service.js';
import { createReminderSchema, updateReminderSchema, postponeReminderSchema } from './reminder.validators.js';

export async function reminderRoutes(app: FastifyInstance) {
  const reminderService = new ReminderService(app);

  // GET /api/v1/reminders?propertyId=&status= — List reminders
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { propertyId, status } = request.query as { propertyId?: string; status?: string };
    return reminderService.listReminders(userId, { propertyId, status });
  });

  // POST /api/v1/reminders — Create reminder
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createReminderSchema.parse(request.body);
    const reminder = reminderService.createReminder(userId, body);
    return reply.status(201).send(reminder);
  });

  // PUT /api/v1/reminders/:id — Update reminder
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = updateReminderSchema.parse(request.body);
    return reminderService.updateReminder(id, userId, body);
  });

  // POST /api/v1/reminders/:id/complete — Mark as done
  app.post('/:id/complete', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return reminderService.completeReminder(id, userId);
  });

  // POST /api/v1/reminders/:id/postpone — Postpone (requires new due date)
  app.post('/:id/postpone', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = postponeReminderSchema.parse(request.body);
    return reminderService.postponeReminder(id, userId, body);
  });
}
