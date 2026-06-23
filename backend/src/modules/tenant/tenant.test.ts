import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let app: FastifyInstance;
let accessToken: string;
let testPropertyId: string;
let tmpDir: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'tenant-test@example.com') {
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

async function createProperty(appInstance: FastifyInstance, token: string, name = 'Testobjekt') {
  const res = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/properties',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name,
      street: 'Musterstraße 1',
      zip_code: '12345',
      city: 'Berlin',
      property_type: 'Wohnung',
      living_area_sqm: 75,
    },
  });
  return JSON.parse(res.body);
}

function validTenantPayload(propertyId: string, overrides: Record<string, unknown> = {}) {
  return {
    property_id: propertyId,
    first_name: 'Max',
    last_name: 'Mustermann',
    email: 'max@example.com',
    phone: '+49 170 1234567',
    address: 'Musterweg 5, 10115 Berlin',
    ...overrides,
  };
}

describe('Tenant CRUD', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();
    accessToken = await registerAndLogin(app);
    const property = await createProperty(app, accessToken);
    testPropertyId = property.id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/tenants', () => {
    it('should create a tenant', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.first_name).toBe('Max');
      expect(body.last_name).toBe('Mustermann');
      expect(body.email).toBe('max@example.com');
      expect(body.phone).toBe('+49 170 1234567');
      expect(body.address).toBe('Musterweg 5, 10115 Berlin');
      expect(body.property_id).toBe(testPropertyId);
    });

    it('should create a tenant with only required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: testPropertyId,
          first_name: 'Anna',
          last_name: 'Schmidt',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.first_name).toBe('Anna');
      expect(body.last_name).toBe('Schmidt');
      expect(body.email).toBeNull();
      expect(body.phone).toBeNull();
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        payload: validTenantPayload(testPropertyId),
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject empty first_name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: '' }),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.details).toBeDefined();
      expect(body.details.some((d: { field: string }) => d.field === 'first_name')).toBe(true);
    });

    it('should reject empty last_name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { last_name: '' }),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.details).toBeDefined();
      expect(body.details.some((d: { field: string }) => d.field === 'last_name')).toBe(true);
    });

    it('should reject first_name exceeding 50 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: 'x'.repeat(51) }),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.details.some((d: { field: string }) => d.field === 'first_name')).toBe(true);
    });

    it('should reject last_name exceeding 50 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { last_name: 'x'.repeat(51) }),
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.details.some((d: { field: string }) => d.field === 'last_name')).toBe(true);
    });

    it('should reject invalid property_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload('non-existent-property'),
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject property_id belonging to another user', async () => {
      const otherToken = await registerAndLogin(app, 'other-tenant@example.com');
      const otherProperty = await createProperty(app, otherToken, 'Anderes Objekt');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(otherProperty.id),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/tenants', () => {
    it('should list tenants for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should filter tenants by propertyId', async () => {
      // Create a second property and a tenant on it
      const property2 = await createProperty(app, accessToken, 'Zweites Objekt');
      await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(property2.id, { first_name: 'Filtered' }),
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants?propertyId=${property2.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.length).toBe(1);
      expect(body[0].first_name).toBe('Filtered');
      expect(body[0].property_id).toBe(property2.id);
    });

    it('should not list tenants of other users', async () => {
      const otherToken = await registerAndLogin(app, 'no-tenants@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.length).toBe(0);
    });
  });

  describe('GET /api/v1/tenants/:id', () => {
    it('should get a single tenant', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: 'Einzeln' }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.first_name).toBe('Einzeln');
    });

    it('should return 404 for non-existent tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should not allow accessing another user\'s tenant', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: 'Private' }),
      });
      const created = JSON.parse(createRes.body);

      const otherToken = await registerAndLogin(app, 'intruder-tenant@example.com');
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/${created.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/tenants/:id', () => {
    it('should update a tenant', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: 'Alt' }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/tenants/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          first_name: 'Neu',
          last_name: 'Nachname',
          email: 'neu@example.com',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.first_name).toBe('Neu');
      expect(body.last_name).toBe('Nachname');
      expect(body.email).toBe('neu@example.com');
    });

    it('should return 404 for non-existent tenant', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/tenants/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { first_name: 'Test', last_name: 'Test' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should validate fields on update', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: 'Validierung' }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/tenants/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { first_name: '', last_name: 'Test' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/tenants/:id', () => {
    it('should delete a tenant without active lease', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: 'ZumLöschen' }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenants/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 for non-existent tenant', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/tenants/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when tenant has an active lease', async () => {
      // Create a tenant
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: 'MitVertrag' }),
      });
      const created = JSON.parse(createRes.body);

      // Insert an active lease for this tenant
      const now = new Date().toISOString();
      app.db
        .prepare(
          `INSERT INTO leases (id, property_id, tenant_id, start_date, cold_rent, due_day, rent_model, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('lease-tenant-test', testPropertyId, created.id, '2024-01-01', 80000, 1, 'konstant', 'aktiv', now, now);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenants/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('aktiver Mietvertrag');
    });

    it('should allow deletion when lease is ended (not active)', async () => {
      // Create a tenant
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validTenantPayload(testPropertyId, { first_name: 'Beendet' }),
      });
      const created = JSON.parse(createRes.body);

      // Insert an ended lease for this tenant
      const now = new Date().toISOString();
      app.db
        .prepare(
          `INSERT INTO leases (id, property_id, tenant_id, start_date, end_date, cold_rent, due_day, rent_model, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('lease-ended-test', testPropertyId, created.id, '2023-01-01', '2023-12-31', 80000, 1, 'konstant', 'beendet', now, now);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenants/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);
    });
  });
});
