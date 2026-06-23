import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('Settings Module', () => {
  let app: FastifyInstance;
  let tmpDir: string;
  let accessToken: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();

    // Register a test user
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'settings@example.com',
        password: 'password123',
        name: 'Settings User',
      },
    });

    // Login to get access token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'settings@example.com',
        password: 'password123',
      },
    });

    const loginBody = JSON.parse(loginRes.body);
    accessToken = loginBody.accessToken;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/settings/profile', () => {
    it('should return user profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/profile',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Settings User');
      expect(body.email).toBe('settings@example.com');
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/profile',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/settings/profile', () => {
    it('should update name and email', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Updated Name',
          email: 'updated@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Updated Name');
      expect(body.email).toBe('updated@example.com');
      expect(body.message).toBe('Profil erfolgreich aktualisiert');
    });

    it('should reject name longer than 100 characters', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'A'.repeat(101),
          email: 'updated@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Name');
    });

    it('should reject empty name', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: '',
          email: 'updated@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Updated Name',
          email: 'not-an-email',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('E-Mail');
    });

    it('should reject email already used by another user', async () => {
      // Register another user
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User',
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Updated Name',
          email: 'other@example.com',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('bereits');
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/profile',
        payload: {
          name: 'Updated Name',
          email: 'updated@example.com',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/settings/password', () => {
    it('should change password with correct current password', async () => {
      // First update email back so we can login with known credentials
      await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Settings User',
          email: 'settings@example.com',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          currentPassword: 'password123',
          newPassword: 'newpassword456',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Passwort erfolgreich geändert');

      // Verify login works with new password
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'settings@example.com',
          password: 'newpassword456',
        },
      });
      expect(loginRes.statusCode).toBe(200);
    });

    it('should reject incorrect current password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          currentPassword: 'wrongpassword',
          newPassword: 'anotherpassword',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Aktuelles Passwort');
    });

    it('should reject new password shorter than 8 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          currentPassword: 'newpassword456',
          newPassword: '1234567',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('mindestens 8 Zeichen');
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/password',
        payload: {
          currentPassword: 'password123',
          newPassword: 'newpassword456',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
