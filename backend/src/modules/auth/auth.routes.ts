import type { FastifyInstance } from 'fastify';
import { AuthService } from './auth.service.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.validators.js';

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app);

  // POST /register
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const tokens = await authService.register(body);

    return reply.status(201).send(tokens);
  });

  // POST /login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const tokens = await authService.login(body);

    return reply.status(200).send(tokens);
  });

  // POST /refresh
  app.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const result = await authService.refresh(body.refreshToken);

    return reply.status(200).send(result);
  });
}
