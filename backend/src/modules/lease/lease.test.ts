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
let propertyId: string;
let tenantId: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'lease-test@example.com') {
  const registerRes = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password123', name: 'Test User' },
  });

  if (registerRes.statusCode === 201) {
    const body = JSON.parse(registerRes.body);
    return body.accessToken as string;
  }

  const loginRes = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'password123' },
  });
  const body = JSON.parse(loginRes.body);
  return body.accessToken as string;
}

function validLeasePayload(overrides: Record<string, unknown> = {}) {
  return {
    property_id: propertyId,
    tenant_id: tenantId,
    start_date: '2024-01-01',
    cold_rent: 80000, // 800.00 EUR in cents
    operating_cost_advance: 15000, // 150.00 EUR
    heating_cost_advance: 8000, // 80.00 EUR
    due_day: 1,
    rent_model: 'konstant',
    ...overrides,
  };
}

describe('Lease CRUD', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lease-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();
    accessToken = await registerAndLogin(app);

    // Create a property
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Testwohnung',
        street: 'Teststraße 1',
        zip_code: '10115',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 75,
      },
    });
    propertyId = JSON.parse(propRes.body).id;

    // Create a tenant directly in DB (since tenant module may not exist yet)
    const now = new Date().toISOString();
    const { v4: uuidv4 } = await import('uuid');
    tenantId = uuidv4();
    app.db
      .prepare(
        `INSERT INTO tenants (id, property_id, first_name, last_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(tenantId, propertyId, 'Max', 'Mustermann', now, now);
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/leases', () => {
    it('should create a lease', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.property_id).toBe(propertyId);
      expect(body.tenant_id).toBe(tenantId);
      expect(body.cold_rent).toBe(80000);
      expect(body.status).toBe('aktiv');
      expect(body.rent_model).toBe('konstant');
      expect(body.due_day).toBe(1);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        payload: validLeasePayload(),
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject cold_rent of 0', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ cold_rent: 0 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject cold_rent exceeding 9999999', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ cold_rent: 10000000 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject due_day of 0', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ due_day: 0 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject due_day of 29', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ due_day: 29 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid rent_model', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ rent_model: 'invalid' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject non-existent property', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ property_id: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject non-existent tenant', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ tenant_id: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should accept all valid rent models', async () => {
      for (const model of ['konstant', 'staffel', 'index', 'manuell']) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/leases',
          headers: { authorization: `Bearer ${accessToken}` },
          payload: validLeasePayload({ rent_model: model }),
        });
        expect(res.statusCode).toBe(201);
      }
    });
  });

  describe('GET /api/v1/leases', () => {
    it('should list leases for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should filter by propertyId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/leases?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      for (const lease of body) {
        expect(lease.property_id).toBe(propertyId);
      }
    });
  });

  describe('GET /api/v1/leases/:id', () => {
    it('should get a single lease', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(created.id);
    });

    it('should return 404 for non-existent lease', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/leases/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/leases/:id', () => {
    it('should update a lease', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ cold_rent: 50000 }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/leases/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ cold_rent: 90000 }),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cold_rent).toBe(90000);
    });

    it('should return 404 for non-existent lease', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/leases/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/leases/:id/terminate', () => {
    it('should terminate an active lease', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/leases/${created.id}/terminate`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { end_date: '2024-06-30' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('beendet');
      expect(body.end_date).toBe('2024-06-30');
    });

    it('should reject terminating an already terminated lease', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload(),
      });
      const created = JSON.parse(createRes.body);

      // Terminate once
      await app.inject({
        method: 'POST',
        url: `/api/v1/leases/${created.id}/terminate`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { end_date: '2024-06-30' },
      });

      // Try again
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/leases/${created.id}/terminate`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { end_date: '2024-07-31' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should cancel receivables after end_date on termination', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ start_date: '2024-01-01' }),
      });
      const created = JSON.parse(createRes.body);

      // Terminate with end_date in the past relative to some receivables
      await app.inject({
        method: 'POST',
        url: `/api/v1/leases/${created.id}/terminate`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { end_date: '2024-02-15' },
      });

      // Check receivables
      const recRes = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${created.id}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const receivables = JSON.parse(recRes.body);
      for (const r of receivables) {
        if (r.due_date > '2024-02-15') {
          expect(r.status).toBe('storniert');
        }
      }
    });
  });

  describe('GET /api/v1/leases/:id/receivables', () => {
    it('should list receivables for a lease', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${created.id}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      // Should have generated receivables
      expect(body.length).toBeGreaterThan(0);
    });

    it('should have correct total_amount (cold_rent + operating + heating)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({
          cold_rent: 50000,
          operating_cost_advance: 10000,
          heating_cost_advance: 5000,
        }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${created.id}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(res.body);
      for (const r of body) {
        expect(r.total_amount).toBe(65000); // 50000 + 10000 + 5000
        expect(r.cold_rent).toBe(50000);
        expect(r.operating_cost).toBe(10000);
        expect(r.heating_cost).toBe(5000);
      }
    });

    it('should return 404 for non-existent lease', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/leases/non-existent-id/receivables',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/leases/:id — terminated lease', () => {
    it('should reject updating a terminated lease', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leases',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload(),
      });
      const created = JSON.parse(createRes.body);

      // Terminate
      await app.inject({
        method: 'POST',
        url: `/api/v1/leases/${created.id}/terminate`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { end_date: '2024-06-30' },
      });

      // Try to update
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/leases/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLeasePayload({ cold_rent: 99000 }),
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
