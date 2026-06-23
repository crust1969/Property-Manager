import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';

describe('App', () => {
  it('should build the Fastify app', async () => {
    const app = await buildApp();
    expect(app).toBeDefined();
    await app.close();
  });

  it('should respond to health check', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    await app.close();
  });
});
