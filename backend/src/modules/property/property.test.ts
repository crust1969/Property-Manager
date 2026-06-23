import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let app: FastifyInstance;
let accessToken: string;
let tmpDir: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'test@example.com') {
  // Try to register
  const registerRes = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password123', name: 'Test User' },
  });

  if (registerRes.statusCode === 201) {
    const body = JSON.parse(registerRes.body);
    return body.accessToken as string;
  }

  // If registration fails (user already exists), login instead
  const loginRes = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'password123' },
  });
  const body = JSON.parse(loginRes.body);
  return body.accessToken as string;
}

function validPropertyPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Testobjekt',
    street: 'Musterstraße 1',
    zip_code: '12345',
    city: 'Berlin',
    property_type: 'Wohnung',
    living_area_sqm: 75,
    ...overrides,
  };
}

describe('Property CRUD', () => {
  beforeAll(async () => {
    // Use a fresh temp database for isolation
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'property-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();
    accessToken = await registerAndLogin(app);
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/properties', () => {
    it('should create a property', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe('Testobjekt');
      expect(body.street).toBe('Musterstraße 1');
      expect(body.zip_code).toBe('12345');
      expect(body.city).toBe('Berlin');
      expect(body.property_type).toBe('Wohnung');
      expect(body.living_area_sqm).toBe(75);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        payload: validPropertyPayload(),
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject invalid zip_code (not 5 digits)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ zip_code: '1234' }),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.details).toBeDefined();
      expect(body.details.some((d: { field: string }) => d.field === 'zip_code')).toBe(true);
    });

    it('should reject invalid property_type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ property_type: 'Villa' }),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.details).toBeDefined();
      expect(body.details.some((d: { field: string }) => d.field === 'property_type')).toBe(true);
    });

    it('should reject name exceeding 100 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'x'.repeat(101) }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: '' }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject living_area_sqm of 0', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ living_area_sqm: 0 }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject living_area_sqm over 99999', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ living_area_sqm: 100000 }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject street exceeding 150 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ street: 'x'.repeat(151) }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject city exceeding 100 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ city: 'x'.repeat(101) }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('should accept all valid property types', async () => {
      const types = ['Wohnung', 'Haus', 'Gewerbe', 'Garage', 'Grundstück'];
      for (const type of types) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/properties',
          headers: { authorization: `Bearer ${accessToken}` },
          payload: validPropertyPayload({ name: `Objekt ${type}`, property_type: type }),
        });
        expect(res.statusCode).toBe(201);
      }
    });
  });

  describe('GET /api/v1/properties', () => {
    it('should list properties for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should not list properties of other users', async () => {
      const otherToken = await registerAndLogin(app, 'other@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.length).toBe(0);
    });
  });

  describe('GET /api/v1/properties/:id', () => {
    it('should get a single property', async () => {
      // Create a property first
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'Einzelobjekt' }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/properties/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Einzelobjekt');
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/properties/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should not allow accessing another user\'s property', async () => {
      // Create a property with the main user
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'Private Objekt' }),
      });
      const created = JSON.parse(createRes.body);

      // Try to access with another user
      const otherToken = await registerAndLogin(app, 'intruder@example.com');
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/properties/${created.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/properties/:id', () => {
    it('should update a property', async () => {
      // Create a property first
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'Alt' }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'Neu' }),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Neu');
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/properties/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload(),
      });

      expect(res.statusCode).toBe(404);
    });

    it('should validate fields on update', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'Validierung' }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ zip_code: 'ABCDE' }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/properties/:id', () => {
    it('should delete a property without linked entities', async () => {
      // Create a property
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'Zum Löschen' }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/properties/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/properties/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/properties/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when property has bookings', async () => {
      // Create a property
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'Mit Buchung' }),
      });
      const created = JSON.parse(createRes.body);

      // Manually insert a booking to simulate linked data
      const now = new Date().toISOString();
      app.db
        .prepare(
          `INSERT INTO bookings (id, property_id, user_id, type, booking_date, total_amount, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('booking-del-1', created.id, created.user_id, 'income', '2024-01-01', 50000, now, now);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/properties/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Buchungen');
    });

    it('should return 409 when property has leases', async () => {
      // Create a property and a tenant, then a lease
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validPropertyPayload({ name: 'Mit Vertrag' }),
      });
      const created = JSON.parse(createRes.body);

      const now = new Date().toISOString();
      // Insert a tenant
      app.db
        .prepare(
          `INSERT INTO tenants (id, property_id, first_name, last_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run('tenant-1', created.id, 'Max', 'Mustermann', now, now);

      // Insert a lease
      app.db
        .prepare(
          `INSERT INTO leases (id, property_id, tenant_id, start_date, cold_rent, due_day, rent_model, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('lease-1', created.id, 'tenant-1', '2024-01-01', 80000, 1, 'konstant', 'aktiv', now, now);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/properties/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Mietverträge');
    });
  });

  describe('Limit 100 properties per user', () => {
    it('should return 409 when exceeding 100 properties', async () => {
      // Build a fresh app with its own temp db for this test
      closeDatabase();
      const limitTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'property-limit-test-'));
      process.env.DATABASE_PATH = path.join(limitTmpDir, 'test.db');
      const freshApp = await buildApp();
      await freshApp.ready();

      const token = await registerAndLogin(freshApp, 'limit-test@example.com');

      // Decode token to get userId
      const decoded = freshApp.jwt.decode<{ userId: string }>(token);
      const testUserId = decoded!.userId;

      // Insert 100 properties directly into DB
      const insertStmt = freshApp.db.prepare(
        `INSERT INTO properties (id, user_id, name, street, zip_code, city, property_type, living_area_sqm, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const now = new Date().toISOString();
      for (let i = 0; i < 100; i++) {
        insertStmt.run(`prop-${i}`, testUserId, `Objekt ${i}`, 'Str 1', '10115', 'Berlin', 'Wohnung', 50, now, now);
      }

      // Try to create the 101st
      const res = await freshApp.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${token}` },
        payload: validPropertyPayload({ name: 'Objekt 101' }),
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('100');

      await freshApp.close();
      fs.rmSync(limitTmpDir, { recursive: true, force: true });
    });
  });
});
