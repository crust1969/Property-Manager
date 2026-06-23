import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  calculateMonthlyCashflow,
  calculateGrossYield,
  calculateNetYield,
} from './cashflow.calculator.js';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// ─── Pure Calculator Tests ───────────────────────────────────────────────────

describe('Cashflow Calculator', () => {
  describe('calculateMonthlyCashflow', () => {
    it('should calculate cashflow correctly with positive values', () => {
      const result = calculateMonthlyCashflow(100000, 30000, 20000);
      expect(result.beforeRepayment).toBe(70000);
      expect(result.afterRepayment).toBe(50000);
    });

    it('should handle zero income', () => {
      const result = calculateMonthlyCashflow(0, 30000, 20000);
      expect(result.beforeRepayment).toBe(-30000);
      expect(result.afterRepayment).toBe(-50000);
    });

    it('should handle zero expenses and repayment', () => {
      const result = calculateMonthlyCashflow(80000, 0, 0);
      expect(result.beforeRepayment).toBe(80000);
      expect(result.afterRepayment).toBe(80000);
    });

    it('should handle negative cashflow', () => {
      const result = calculateMonthlyCashflow(50000, 60000, 10000);
      expect(result.beforeRepayment).toBe(-10000);
      expect(result.afterRepayment).toBe(-20000);
    });
  });

  describe('calculateGrossYield', () => {
    it('should calculate gross yield correctly', () => {
      // 12000€ rent / 200000€ investment = 6%
      const result = calculateGrossYield(1200000, 20000000);
      expect(result).toBe(6.00);
    });

    it('should round to 2 decimal places', () => {
      // 10000€ rent / 150000€ investment = 6.666...%
      const result = calculateGrossYield(1000000, 15000000);
      expect(result).toBe(6.67);
    });

    it('should return null when totalInvestment is 0', () => {
      const result = calculateGrossYield(1200000, 0);
      expect(result).toBeNull();
    });

    it('should return null when totalInvestment is negative', () => {
      const result = calculateGrossYield(1200000, -100);
      expect(result).toBeNull();
    });

    it('should return 0 when annualRent is 0', () => {
      const result = calculateGrossYield(0, 20000000);
      expect(result).toBe(0);
    });
  });

  describe('calculateNetYield', () => {
    it('should calculate net yield correctly', () => {
      // (12000€ - 2000€) / 200000€ = 5%
      const result = calculateNetYield(1200000, 200000, 20000000);
      expect(result).toBe(5.00);
    });

    it('should round to 2 decimal places', () => {
      // (10000€ - 1500€) / 150000€ = 5.666...%
      const result = calculateNetYield(1000000, 150000, 15000000);
      expect(result).toBe(5.67);
    });

    it('should return null when totalInvestment is 0', () => {
      const result = calculateNetYield(1200000, 200000, 0);
      expect(result).toBeNull();
    });

    it('should handle case where costs exceed rent (negative yield)', () => {
      // (5000€ - 8000€) / 200000€ = -1.5%
      const result = calculateNetYield(500000, 800000, 20000000);
      expect(result).toBe(-1.50);
    });
  });
});

// ─── API Integration Tests ───────────────────────────────────────────────────

describe('Cashflow API', () => {
  let app: FastifyInstance;
  let authToken: string;
  let propertyId: string;
  let tmpDir: string;

  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cashflow-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();

    // Register a user
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'cashflow-test@example.com',
        password: 'TestPass123!',
        name: 'Cashflow Tester',
      },
    });
    const registerBody = JSON.parse(registerRes.body);
    authToken = registerBody.accessToken;

    // Create a property
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Testwohnung',
        street: 'Teststr. 1',
        zip_code: '12345',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 65,
      },
    });
    const propBody = JSON.parse(propRes.body);
    propertyId = propBody.id;

    // Create acquisition data
    await app.inject({
      method: 'PUT',
      url: `/api/v1/properties/${propertyId}/acquisition`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        purchase_price: 20000000, // 200,000€
        purchase_date: '2023-01-15',
        notary_cost: 300000,      // 3,000€
        transfer_tax: 1200000,    // 12,000€
        land_registry_cost: 100000, // 1,000€
        broker_cost: 700000,      // 7,000€
        building_share: 16000000, // 160,000€
        land_share: 4000000,      // 40,000€
      },
    });

    // Create a tenant
    const tenantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        property_id: propertyId,
        first_name: 'Max',
        last_name: 'Mustermann',
      },
    });
    const tenantBody = JSON.parse(tenantRes.body);

    // Create a lease (active) with 800€ cold rent
    await app.inject({
      method: 'POST',
      url: '/api/v1/leases',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        property_id: propertyId,
        tenant_id: tenantBody.id,
        start_date: '2023-02-01',
        cold_rent: 80000, // 800€
        operating_cost_advance: 15000,
        heating_cost_advance: 10000,
        due_day: 1,
        rent_model: 'konstant',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/cashflow', () => {
    it('should require authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/cashflow?propertyId=test&year=2024',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return cashflow data for a property and year', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/cashflow?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.year).toBe(2024);
      expect(body.monthly).toHaveLength(12);
      expect(body.monthly[0]).toHaveProperty('month', 1);
      expect(body.monthly[0]).toHaveProperty('incomeTotal');
      expect(body.monthly[0]).toHaveProperty('expensesWithoutRepayment');
      expect(body.monthly[0]).toHaveProperty('repaymentTotal');
      expect(body.monthly[0]).toHaveProperty('cashflowBeforeRepayment');
      expect(body.monthly[0]).toHaveProperty('cashflowAfterRepayment');
      expect(body).toHaveProperty('annualIncomeTotal');
      expect(body).toHaveProperty('annualExpensesWithoutRepayment');
      expect(body).toHaveProperty('annualRepaymentTotal');
      expect(body).toHaveProperty('annualCashflowBeforeRepayment');
      expect(body).toHaveProperty('annualCashflowAfterRepayment');
    });

    it('should validate query parameters — missing propertyId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/cashflow?year=2024',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should validate query parameters — missing year', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/cashflow?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-owned property', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/cashflow?propertyId=non-existent-id&year=2024',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/yield', () => {
    it('should require authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/yield?propertyId=test',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return yield data with correct calculations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/yield?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('grossYield');
      expect(body).toHaveProperty('netYield');
      expect(body).toHaveProperty('annualColdRent');
      expect(body).toHaveProperty('totalInvestment');
      expect(body).toHaveProperty('annualNonAllocableCosts');

      // Total investment: 200000 + 3000 + 12000 + 1000 + 7000 = 223000€ = 22300000 cents
      expect(body.totalInvestment).toBe(22300000);
      // Annual cold rent: 800€ * 12 = 9600€ = 960000 cents
      expect(body.annualColdRent).toBe(960000);
      // Gross yield: (960000 / 22300000) * 100 = 4.30%
      expect(body.grossYield).toBe(4.30);
    });

    it('should return hint when no acquisition data exists', async () => {
      // Create a property without acquisition data
      const propRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Wohnung ohne Kauf',
          street: 'Musterstr. 2',
          zip_code: '10115',
          city: 'Berlin',
          property_type: 'Wohnung',
          living_area_sqm: 50,
        },
      });
      const noAcqPropertyId = JSON.parse(propRes.body).id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/yield?propertyId=${noAcqPropertyId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.grossYield).toBeNull();
      expect(body.netYield).toBeNull();
      expect(body.hint).toBeDefined();
      expect(body.hint).toContain('Anschaffungsdaten');
    });

    it('should return 404 for non-owned property', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/yield?propertyId=non-existent-id',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
