import type { FastifyInstance } from 'fastify';
import { SettingsService } from './settings.service.js';

export async function settingsRoutes(app: FastifyInstance) {
  const settingsService = new SettingsService(app);

  // GET /api/v1/settings/profile — Get user profile
  app.get('/profile', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    return settingsService.getProfile(userId);
  });

  // PUT /api/v1/settings/profile — Update user profile
  app.put('/profile', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { name, email } = request.body as { name: string; email: string };
    const profile = settingsService.updateProfile(userId, { name, email });
    return { ...profile, message: 'Profil erfolgreich aktualisiert' };
  });

  // POST /api/v1/settings/password — Change password
  app.post('/password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    await settingsService.changePassword(userId, { currentPassword, newPassword });
    return reply.status(200).send({ message: 'Passwort erfolgreich geändert' });
  });
}
