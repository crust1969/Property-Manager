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

async function registerAndLogin(appInstance: FastifyInstance, email = 'deposit-test@example.com') {
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

function validDepositPayload(overrides: Record<string, unknown> = {}) {
  return {
    lease_id: leaseId,
    amount: 300000, // 3000.00 EUR in cents
    received_date: '2024-01-15',
    account_reference: 'DE89370400440532013000',
    ...overrides,
  };
}

describe('Deposit CRUD', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deposit-test-'));
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

    // Create a tenant
    const now = new Date().toISOString();
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
        heating_cost_advance: 8000,
        due_day: 1,
        rent_model: 'konstant',
      },
    });
    leaseId = JSON.parse(leaseRes.body).id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/deposits', () => {
    it('should create a deposit with status hinterlegt', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.lease_id).toBe(leaseId);
      expect(body.property_id).toBe(propertyId);
      expect(body.amount).toBe(300000);
      expect(body.status).toBe('hinterlegt');
      expect(body.refunded_amount).toBe(0);
      expect(body.received_date).toBe('2024-01-15');
      expect(body.account_reference).toBe('DE89370400440532013000');
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        payload: validDepositPayload(),
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject amount of 0', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ amount: 0 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject amount exceeding 99999999', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ amount: 100000000 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject missing received_date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ received_date: '' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject account_reference longer than 34 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ account_reference: 'A'.repeat(35) }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject non-existent lease_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ lease_id: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/deposits?leaseId=', () => {
    it('should list deposits for a lease', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/deposits?leaseId=${leaseId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      for (const deposit of body) {
        expect(deposit.lease_id).toBe(leaseId);
      }
    });

    it('should return all deposits when no leaseId is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/deposits?leaseId=${leaseId}`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/deposits/:id', () => {
    it('should get a single deposit', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/deposits/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(created.id);
      expect(body.amount).toBe(300000);
    });

    it('should return 404 for non-existent deposit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/deposits/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/deposits/:id/refund — State Transitions', () => {
    it('should transition hinterlegt → teilweise_zurueckgezahlt (partial refund)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ amount: 300000 }),
      });
      const deposit = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 100000, refund_date: '2024-06-01' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('teilweise_zurueckgezahlt');
      expect(body.refunded_amount).toBe(100000);
    });

    it('should transition hinterlegt → vollstaendig_zurueckgezahlt (full refund)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ amount: 300000 }),
      });
      const deposit = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 300000, refund_date: '2024-06-01' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('vollstaendig_zurueckgezahlt');
      expect(body.refunded_amount).toBe(300000);
    });

    it('should transition teilweise_zurueckgezahlt → vollstaendig_zurueckgezahlt', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ amount: 300000 }),
      });
      const deposit = JSON.parse(createRes.body);

      // First partial refund
      await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 100000, refund_date: '2024-06-01' },
      });

      // Second refund completing the deposit
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 200000, refund_date: '2024-07-01' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('vollstaendig_zurueckgezahlt');
      expect(body.refunded_amount).toBe(300000);
    });

    it('should reject refund on vollstaendig_zurueckgezahlt deposit (invalid transition)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ amount: 300000 }),
      });
      const deposit = JSON.parse(createRes.body);

      // Full refund
      await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 300000, refund_date: '2024-06-01' },
      });

      // Try another refund — should fail
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 1, refund_date: '2024-07-01' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject refund exceeding remaining balance', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ amount: 300000 }),
      });
      const deposit = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 400000, refund_date: '2024-06-01' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should correctly calculate remaining balance after multiple refunds', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload({ amount: 500000 }),
      });
      const deposit = JSON.parse(createRes.body);

      // First partial refund: 150000
      const refund1 = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 150000, refund_date: '2024-06-01' },
      });
      const body1 = JSON.parse(refund1.body);
      expect(body1.refunded_amount).toBe(150000);
      // Remaining: 500000 - 150000 = 350000

      // Second partial refund: 200000
      const refund2 = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 200000, refund_date: '2024-07-01' },
      });
      const body2 = JSON.parse(refund2.body);
      expect(body2.refunded_amount).toBe(350000);
      // Remaining: 500000 - 350000 = 150000

      // Try to refund more than remaining
      const refund3 = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 200000, refund_date: '2024-08-01' },
      });
      expect(refund3.statusCode).toBe(400);

      // Refund exactly remaining
      const refund4 = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 150000, refund_date: '2024-08-01' },
      });
      const body4 = JSON.parse(refund4.body);
      expect(body4.status).toBe('vollstaendig_zurueckgezahlt');
      expect(body4.refunded_amount).toBe(500000);
    });

    it('should reject refund without authentication', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload(),
      });
      const deposit = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        payload: { refund_amount: 100000, refund_date: '2024-06-01' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject refund with missing refund_date', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload(),
      });
      const deposit = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 100000 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject refund with amount of 0', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deposits',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validDepositPayload(),
      });
      const deposit = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deposits/${deposit.id}/refund`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refund_amount: 0, refund_date: '2024-06-01' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
