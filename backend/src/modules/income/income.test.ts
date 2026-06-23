import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';

let app: FastifyInstance;
let accessToken: string;
let tmpDir: string;
let propertyId: string;
let tenantId: string;
let leaseId: string;
let categoryId: string;
let receivableId: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'income-test@example.com') {
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

function validIncomePayload(overrides: Record<string, unknown> = {}) {
  return {
    property_id: propertyId,
    booking_date: '2024-03-01',
    total_amount: 80000, // 800.00 EUR in cents
    counterparty: 'Mieter Mustermann',
    category_id: categoryId,
    ...overrides,
  };
}

describe('Income CRUD', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'income-test-'));
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

    // Create a category for income
    const now = new Date().toISOString();
    categoryId = uuidv4();
    app.db
      .prepare(
        `INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
         VALUES (?, ?, NULL, ?, 'income', 0, 1, 0, 0, 1, 1)`
      )
      .run(categoryId, null, 'Mieteinnahmen');

    // Create a tenant
    tenantId = uuidv4();
    app.db
      .prepare(
        `INSERT INTO tenants (id, property_id, first_name, last_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(tenantId, propertyId, 'Max', 'Mustermann', now, now);

    // Create a lease
    const leaseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/leases',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: '2024-01-01',
        cold_rent: 80000,
        operating_cost_advance: 15000,
        heating_cost_advance: 5000,
        due_day: 1,
        rent_model: 'konstant',
      },
    });
    leaseId = JSON.parse(leaseRes.body).id;

    // Get a receivable for this lease
    const recRes = await app.inject({
      method: 'GET',
      url: `/api/v1/leases/${leaseId}/receivables`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const receivables = JSON.parse(recRes.body);
    receivableId = receivables[0]?.id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/income', () => {
    it('should create an income booking', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.property_id).toBe(propertyId);
      expect(body.type).toBe('income');
      expect(body.total_amount).toBe(80000);
      expect(body.counterparty).toBe('Mieter Mustermann');
      expect(body.booking_date).toBe('2024-03-01');
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        payload: validIncomePayload(),
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject missing booking_date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ booking_date: '' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject amount of 0', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ total_amount: 0 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject amount exceeding max', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ total_amount: 100000000 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject counterparty exceeding 100 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ counterparty: 'A'.repeat(101) }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject empty counterparty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ counterparty: '' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid category_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ category_id: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject non-existent property', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ property_id: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should create income linked to a receivable', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ receivable_id: receivableId, total_amount: 50000 }),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.receivable_id).toBe(receivableId);
    });
  });

  describe('GET /api/v1/income', () => {
    it('should list income bookings', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/income',
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
        url: `/api/v1/income?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const booking of body) {
        expect(booking.property_id).toBe(propertyId);
      }
    });

    it('should filter by year and month', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/income?year=2024&month=3',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const booking of body) {
        expect(booking.booking_date.startsWith('2024-03')).toBe(true);
      }
    });
  });

  describe('GET /api/v1/income/:id', () => {
    it('should get a single income booking', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/income/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(created.id);
    });

    it('should return 404 for non-existent income', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/income/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/income/:id', () => {
    it('should update an income booking', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ total_amount: 60000 }),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/income/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({ total_amount: 95000 }),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total_amount).toBe(95000);
    });

    it('should return 404 for non-existent income', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/income/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/income/:id', () => {
    it('should delete an income booking', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/income/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/income/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 for non-existent income', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/income/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Receivable paid_amount update', () => {
    it('should update receivable paid_amount when income is linked', async () => {
      // Find a fresh receivable that is not yet paid
      const recRes = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${leaseId}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const receivables = JSON.parse(recRes.body);
      const freshReceivable = receivables.find((r: { status: string }) => r.status === 'offen');

      if (!freshReceivable) return; // skip if no fresh receivable available

      // Create income linked to this receivable
      await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({
          receivable_id: freshReceivable.id,
          total_amount: 50000,
        }),
      });

      // Check receivable status
      const updatedRecRes = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${leaseId}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const updatedReceivables = JSON.parse(updatedRecRes.body);
      const updated = updatedReceivables.find((r: { id: string }) => r.id === freshReceivable.id);
      expect(updated.paid_amount).toBe(50000);
      expect(updated.status).toBe('teilbezahlt');
    });

    it('should set receivable to bezahlt when fully paid', async () => {
      // Find a fresh receivable
      const recRes = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${leaseId}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const receivables = JSON.parse(recRes.body);
      const freshReceivable = receivables.find((r: { status: string }) => r.status === 'offen');

      if (!freshReceivable) return;

      // Pay full amount (cold_rent + operating + heating = 80000 + 15000 + 5000 = 100000)
      await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({
          receivable_id: freshReceivable.id,
          total_amount: freshReceivable.total_amount,
        }),
      });

      // Check receivable status
      const updatedRecRes = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${leaseId}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const updatedReceivables = JSON.parse(updatedRecRes.body);
      const updated = updatedReceivables.find((r: { id: string }) => r.id === freshReceivable.id);
      expect(updated.paid_amount).toBe(freshReceivable.total_amount);
      expect(updated.status).toBe('bezahlt');
    });

    it('should reset receivable paid_amount when income is deleted', async () => {
      // Find a fresh receivable
      const recRes = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${leaseId}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const receivables = JSON.parse(recRes.body);
      const freshReceivable = receivables.find((r: { status: string }) => r.status === 'offen');

      if (!freshReceivable) return;

      // Create income linked to receivable
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/income',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validIncomePayload({
          receivable_id: freshReceivable.id,
          total_amount: 40000,
        }),
      });
      const created = JSON.parse(createRes.body);

      // Delete income
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/income/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // Check receivable status reset
      const updatedRecRes = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${leaseId}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const updatedReceivables = JSON.parse(updatedRecRes.body);
      const updated = updatedReceivables.find((r: { id: string }) => r.id === freshReceivable.id);
      expect(updated.paid_amount).toBe(0);
      expect(updated.status).toBe('offen');
    });
  });

  describe('GET /api/v1/income/comparison', () => {
    it('should return Soll/Ist comparison for a lease and month', async () => {
      // Find a receivable for this month and year
      const recRes = await app.inject({
        method: 'GET',
        url: `/api/v1/leases/${leaseId}/receivables`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const receivables = JSON.parse(recRes.body);
      const firstRec = receivables[0];
      const dueDate = new Date(firstRec.due_date);
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth() + 1;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/income/comparison?leaseId=${leaseId}&year=${year}&month=${month}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.soll).toBeDefined();
      expect(body.ist).toBeDefined();
      expect(body.differenz).toBeDefined();
      expect(body.differenz).toBe(body.soll - body.ist);
      expect(Array.isArray(body.receivables)).toBe(true);
    });

    it('should return 404 for non-existent lease', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/income/comparison?leaseId=00000000-0000-0000-0000-000000000000&year=2024&month=3',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject missing query parameters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/income/comparison',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
