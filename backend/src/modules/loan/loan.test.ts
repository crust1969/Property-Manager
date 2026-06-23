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

async function registerAndLogin(appInstance: FastifyInstance, email = 'loan-test@example.com') {
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

function validLoanPayload(overrides: Record<string, unknown> = {}) {
  return {
    property_id: propertyId,
    lender: 'Sparkasse Berlin',
    contract_number: 'KR-2024-001',
    loan_amount: 30000000, // 300,000.00 EUR
    interest_rate: 3.5,
    repayment_rate: 2.0,
    start_date: '2024-01-01',
    end_date: '2034-01-01',
    fixed_interest_months: 120,
    ...overrides,
  };
}

function validPaymentPayload(overrides: Record<string, unknown> = {}) {
  return {
    payment_date: '2024-02-01',
    interest_amount: 87500, // 875.00 EUR
    repayment_amount: 50000, // 500.00 EUR
    fee_amount: 0,
    extra_repayment: 0,
    ...overrides,
  };
}

describe('Loan CRUD', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loan-test-'));
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
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/loans', () => {
    it('should create a loan', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.property_id).toBe(propertyId);
      expect(body.lender).toBe('Sparkasse Berlin');
      expect(body.contract_number).toBe('KR-2024-001');
      expect(body.loan_amount).toBe(30000000);
      expect(body.interest_rate).toBe(3.5);
      expect(body.repayment_rate).toBe(2.0);
      expect(body.start_date).toBe('2024-01-01');
      expect(body.end_date).toBe('2034-01-01');
      expect(body.fixed_interest_months).toBe(120);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        payload: validLoanPayload(),
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject end_date before start_date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ start_date: '2024-06-01', end_date: '2024-01-01' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject end_date equal to start_date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ start_date: '2024-01-01', end_date: '2024-01-01' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject missing lender', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ lender: '' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject lender exceeding 100 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ lender: 'A'.repeat(101) }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject loan_amount of 0', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ loan_amount: 0 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject loan_amount exceeding max', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ loan_amount: 10000000000 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject interest_rate exceeding 99.99', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ interest_rate: 100 }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject non-existent property', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ property_id: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should allow contract_number to be null', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ contract_number: null }),
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.contract_number).toBeNull();
    });
  });

  describe('GET /api/v1/loans', () => {
    it('should list loans', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/loans',
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
        url: `/api/v1/loans?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const loan of body) {
        expect(loan.property_id).toBe(propertyId);
      }
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/loans',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/loans/:id', () => {
    it('should get a single loan', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/loans/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(created.id);
      expect(body.lender).toBe('Sparkasse Berlin');
    });

    it('should return 404 for non-existent loan', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/loans/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/loans/:id', () => {
    it('should update a loan', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/loans/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ lender: 'Deutsche Bank', interest_rate: 4.0 }),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.lender).toBe('Deutsche Bank');
      expect(body.interest_rate).toBe(4.0);
    });

    it('should return 404 for non-existent loan', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/loans/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload(),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject end_date before start_date on update', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/loans/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ start_date: '2024-06-01', end_date: '2024-01-01' }),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/loans/:id', () => {
    it('should delete a loan', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/loans/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/loans/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 for non-existent loan', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/loans/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Payments', () => {
    let loanId: string;

    beforeAll(async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ loan_amount: 10000000 }), // 100,000.00 EUR
      });
      loanId = JSON.parse(createRes.body).id;
    });

    describe('POST /api/v1/loans/:id/payments', () => {
      it('should record a payment', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/loans/${loanId}/payments`,
          headers: { authorization: `Bearer ${accessToken}` },
          payload: validPaymentPayload(),
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.id).toBeDefined();
        expect(body.loan_id).toBe(loanId);
        expect(body.payment_date).toBe('2024-02-01');
        expect(body.interest_amount).toBe(87500);
        expect(body.repayment_amount).toBe(50000);
        expect(body.fee_amount).toBe(0);
        expect(body.extra_repayment).toBe(0);
        expect(body.total_payment).toBe(137500);
      });

      it('should classify interest + fees as tax deductible', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/loans/${loanId}/payments`,
          headers: { authorization: `Bearer ${accessToken}` },
          payload: validPaymentPayload({
            interest_amount: 50000,
            repayment_amount: 30000,
            fee_amount: 5000,
            extra_repayment: 10000,
          }),
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        // interest + fees = Werbungskosten (tax deductible)
        expect(body.tax_deductible).toBe(55000); // 50000 + 5000
        // repayment + extra = not deductible
        expect(body.not_tax_deductible).toBe(40000); // 30000 + 10000
      });

      it('should reject missing payment_date', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/loans/${loanId}/payments`,
          headers: { authorization: `Bearer ${accessToken}` },
          payload: validPaymentPayload({ payment_date: '' }),
        });
        expect(res.statusCode).toBe(400);
      });

      it('should reject negative interest_amount', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/loans/${loanId}/payments`,
          headers: { authorization: `Bearer ${accessToken}` },
          payload: validPaymentPayload({ interest_amount: -1 }),
        });
        expect(res.statusCode).toBe(400);
      });

      it('should reject for non-existent loan', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/loans/non-existent-id/payments',
          headers: { authorization: `Bearer ${accessToken}` },
          payload: validPaymentPayload(),
        });
        expect(res.statusCode).toBe(404);
      });

      it('should reject without authentication', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/loans/${loanId}/payments`,
          payload: validPaymentPayload(),
        });
        expect(res.statusCode).toBe(401);
      });
    });

    describe('GET /api/v1/loans/:id/payments', () => {
      it('should list payments for a loan', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/loans/${loanId}/payments`,
          headers: { authorization: `Bearer ${accessToken}` },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThan(0);
      });

      it('should return 404 for non-existent loan', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/loans/non-existent-id/payments',
          headers: { authorization: `Bearer ${accessToken}` },
        });
        expect(res.statusCode).toBe(404);
      });
    });
  });

  describe('Balance', () => {
    let loanId: string;

    beforeAll(async () => {
      // Create a loan with 100,000 EUR
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validLoanPayload({ loan_amount: 10000000 }), // 100,000.00 EUR in cents
      });
      loanId = JSON.parse(createRes.body).id;

      // Add two payments with repayments
      await app.inject({
        method: 'POST',
        url: `/api/v1/loans/${loanId}/payments`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          payment_date: '2024-02-01',
          interest_amount: 29167, // ~291.67 EUR
          repayment_amount: 16667, // ~166.67 EUR
          fee_amount: 0,
          extra_repayment: 0,
        },
      });

      await app.inject({
        method: 'POST',
        url: `/api/v1/loans/${loanId}/payments`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          payment_date: '2024-03-01',
          interest_amount: 29100,
          repayment_amount: 16700,
          fee_amount: 500,
          extra_repayment: 100000, // 1000.00 EUR extra repayment
        },
      });
    });

    describe('GET /api/v1/loans/:id/balance', () => {
      it('should return correct remaining balance', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/loans/${loanId}/balance`,
          headers: { authorization: `Bearer ${accessToken}` },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.loan_amount).toBe(10000000);
        // total_repaid = 16667 + 16700 + 100000 = 133367
        expect(body.total_repaid).toBe(133367);
        // remaining_balance = 10000000 - 133367 = 9866633
        expect(body.remaining_balance).toBe(9866633);
      });

      it('should return balance history with running balance', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/loans/${loanId}/balance`,
          headers: { authorization: `Bearer ${accessToken}` },
        });

        const body = JSON.parse(res.body);
        expect(body.history.length).toBe(2);

        // First payment: balance = 10000000 - 16667 = 9983333
        expect(body.history[0].remaining_balance).toBe(9983333);
        expect(body.history[0].payment_date).toBe('2024-02-01');

        // Second payment: balance = 9983333 - 16700 - 100000 = 9866633
        expect(body.history[1].remaining_balance).toBe(9866633);
        expect(body.history[1].payment_date).toBe('2024-03-01');
      });

      it('should return 404 for non-existent loan', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/loans/non-existent-id/balance',
          headers: { authorization: `Bearer ${accessToken}` },
        });
        expect(res.statusCode).toBe(404);
      });
    });
  });
});
