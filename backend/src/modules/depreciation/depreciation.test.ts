import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  calculateAnnualAfa,
  calculateFirstYearAfa,
  generateAfaPlan,
} from './afa.calculator.js';

let app: FastifyInstance;
let accessToken: string;
let propertyId: string;
let tmpDir: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'afa-test@example.com') {
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

describe('AfA Calculator (Pure Functions)', () => {
  describe('calculateAnnualAfa', () => {
    it('should calculate full year AfA correctly', () => {
      // 200,000.00 EUR basis * 2% rate = 4,000.00 EUR
      const result = calculateAnnualAfa(20000000, 0.02);
      expect(result).toBe(400000);
    });

    it('should round to nearest cent', () => {
      // 333,333 cents * 0.03 = 9999.99 cents
      const result = calculateAnnualAfa(333333, 0.03);
      expect(result).toBe(10000); // rounds to 10000
    });

    it('should handle small basis and rate', () => {
      // 100 cents * 0.0001 = 0.01 cents -> rounds to 0
      const result = calculateAnnualAfa(100, 0.0001);
      expect(result).toBe(0);
    });

    it('should handle 100% rate', () => {
      const result = calculateAnnualAfa(50000000, 1.0);
      expect(result).toBe(50000000);
    });
  });

  describe('calculateFirstYearAfa', () => {
    it('should return full amount when starting in January', () => {
      const result = calculateFirstYearAfa(400000, 1);
      expect(result).toBe(400000); // 12/12
    });

    it('should calculate pro rata for June start (7 months)', () => {
      // Start month June -> remaining months = 12 - 6 + 1 = 7
      const result = calculateFirstYearAfa(400000, 6);
      expect(result).toBe(Math.round(400000 * 7 / 12)); // 233333
    });

    it('should calculate pro rata for December start (1 month)', () => {
      // Start month December -> remaining months = 12 - 12 + 1 = 1
      const result = calculateFirstYearAfa(400000, 12);
      expect(result).toBe(Math.round(400000 * 1 / 12)); // 33333
    });

    it('should calculate pro rata for July start (6 months)', () => {
      // Start month July -> remaining months = 12 - 7 + 1 = 6
      const result = calculateFirstYearAfa(400000, 7);
      expect(result).toBe(Math.round(400000 * 6 / 12)); // 200000
    });
  });

  describe('generateAfaPlan', () => {
    it('should generate plan where sum of all entries equals basis', () => {
      const basis = 20000000; // 200,000.00 EUR
      const rate = 0.02;     // 2%
      const plan = generateAfaPlan(basis, rate, '2023-01-01');

      const totalDepreciated = plan.reduce((sum, entry) => sum + entry.annualAmount, 0);
      expect(totalDepreciated).toBe(basis);
    });

    it('should have strictly decreasing residual values', () => {
      const plan = generateAfaPlan(20000000, 0.02, '2023-01-01');

      for (let i = 1; i < plan.length; i++) {
        expect(plan[i].residualValue).toBeLessThan(plan[i - 1].residualValue);
      }
    });

    it('should end with residual value of 0', () => {
      const plan = generateAfaPlan(20000000, 0.02, '2023-01-01');

      const lastEntry = plan[plan.length - 1];
      expect(lastEntry.residualValue).toBe(0);
    });

    it('should have strictly increasing cumulative amounts', () => {
      const plan = generateAfaPlan(20000000, 0.02, '2023-01-01');

      for (let i = 1; i < plan.length; i++) {
        expect(plan[i].cumulativeAmount).toBeGreaterThan(plan[i - 1].cumulativeAmount);
      }
    });

    it('should handle pro rata first year correctly', () => {
      const basis = 20000000;
      const rate = 0.02;
      // Start in June -> 7 remaining months
      const plan = generateAfaPlan(basis, rate, '2023-06-01');

      const annualAmount = calculateAnnualAfa(basis, rate); // 400000
      const expectedFirstYear = calculateFirstYearAfa(annualAmount, 6); // round(400000 * 7/12) = 233333

      expect(plan[0].year).toBe(2023);
      expect(plan[0].annualAmount).toBe(expectedFirstYear);
      expect(plan[0].residualValue).toBe(basis - expectedFirstYear);
    });

    it('should handle full first year (January start)', () => {
      const basis = 20000000;
      const rate = 0.02;
      const plan = generateAfaPlan(basis, rate, '2023-01-01');

      expect(plan[0].year).toBe(2023);
      expect(plan[0].annualAmount).toBe(400000);
    });

    it('should cap final year to remaining amount', () => {
      const basis = 20000000;
      const rate = 0.02;
      const plan = generateAfaPlan(basis, rate, '2023-01-01');

      // With 2% rate on 200k, full years = 50 years
      // Last entry should complete the total
      const lastEntry = plan[plan.length - 1];
      expect(lastEntry.residualValue).toBe(0);

      // All entries before last should have full annual amount
      for (let i = 0; i < plan.length - 1; i++) {
        expect(plan[i].annualAmount).toBe(400000);
      }
    });

    it('should generate correct plan with pro rata and sum to basis', () => {
      const basis = 23639700; // from test data
      const rate = 0.02;
      const plan = generateAfaPlan(basis, rate, '2023-07-01');

      const totalDepreciated = plan.reduce((sum, entry) => sum + entry.annualAmount, 0);
      expect(totalDepreciated).toBe(basis);
      expect(plan[plan.length - 1].residualValue).toBe(0);
    });
  });
});

describe('Depreciation API', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'depreciation-test-'));
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
        name: 'AfA Testwohnung',
        street: 'Teststraße 1',
        zip_code: '10115',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 80,
      },
    });
    propertyId = JSON.parse(propRes.body).id;

    // Create acquisition data with AfA parameters
    await app.inject({
      method: 'PUT',
      url: `/api/v1/properties/${propertyId}/acquisition`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        purchase_price: 30000000,
        purchase_date: '2023-06-15',
        transfer_date: '2023-07-01',
        notary_cost: 600000,
        transfer_tax: 1950000,
        land_registry_cost: 150000,
        broker_cost: 1071000,
        building_share: 21000000,
        land_share: 9000000,
        afa_rate: 0.02,
        afa_start_date: '2023-07-01',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/depreciation/:propertyId', () => {
    it('should return AfA parameters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.property_id).toBe(propertyId);
      expect(body.afa_basis).toBe(23639700);
      expect(body.afa_rate).toBe(0.02);
      expect(body.afa_start_date).toBe('2023-07-01');
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/depreciation/non-existent',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${propertyId}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 404 for property without acquisition data', async () => {
      // Create a property without acquisition data
      const propRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Ohne Daten',
          street: 'Leerstr. 1',
          zip_code: '10115',
          city: 'Berlin',
          property_type: 'Wohnung',
          living_area_sqm: 50,
        },
      });
      const emptyPropertyId = JSON.parse(propRes.body).id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${emptyPropertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/depreciation/:propertyId', () => {
    it('should update AfA parameters', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/depreciation/${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          afa_rate: 0.025,
          afa_start_date: '2024-01-01',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.afa_rate).toBe(0.025);
      expect(body.afa_start_date).toBe('2024-01-01');
    });

    it('should reject rate below minimum', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/depreciation/${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          afa_rate: 0.00001, // below 0.0001
          afa_start_date: '2024-01-01',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject rate above maximum', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/depreciation/${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          afa_rate: 1.5, // above 1.0
          afa_start_date: '2024-01-01',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid date format', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/depreciation/${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          afa_rate: 0.02,
          afa_start_date: '01.07.2023', // wrong format
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/depreciation/non-existent',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          afa_rate: 0.02,
          afa_start_date: '2024-01-01',
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/depreciation/:propertyId/plan', () => {
    beforeAll(async () => {
      // Reset parameters for plan test
      await app.inject({
        method: 'PUT',
        url: `/api/v1/depreciation/${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          afa_rate: 0.02,
          afa_start_date: '2023-07-01',
        },
      });
    });

    it('should generate a valid AfA plan', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${propertyId}/plan`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.parameters).toBeDefined();
      expect(body.plan).toBeDefined();
      expect(Array.isArray(body.plan)).toBe(true);
      expect(body.plan.length).toBeGreaterThan(0);
    });

    it('should have plan entries that sum to basis', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${propertyId}/plan`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(res.body);
      const totalDepreciated = body.plan.reduce(
        (sum: number, entry: { annualAmount: number }) => sum + entry.annualAmount,
        0
      );
      expect(totalDepreciated).toBe(body.parameters.afa_basis);
    });

    it('should have strictly decreasing residual values', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${propertyId}/plan`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(res.body);
      for (let i = 1; i < body.plan.length; i++) {
        expect(body.plan[i].residualValue).toBeLessThan(body.plan[i - 1].residualValue);
      }
    });

    it('should end with residual value of 0', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${propertyId}/plan`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(res.body);
      const lastEntry = body.plan[body.plan.length - 1];
      expect(lastEntry.residualValue).toBe(0);
    });

    it('should return 404 for property without acquisition data', async () => {
      const propRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Kein AfA',
          street: 'Leerstr. 2',
          zip_code: '10115',
          city: 'Berlin',
          property_type: 'Wohnung',
          living_area_sqm: 45,
        },
      });
      const noAcqPropertyId = JSON.parse(propRes.body).id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${noAcqPropertyId}/plan`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 when AfA parameters are not set', async () => {
      // Create property with acquisition but no AfA rate/start_date
      const propRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Ohne AfA Params',
          street: 'Paramstr. 1',
          zip_code: '10115',
          city: 'Berlin',
          property_type: 'Wohnung',
          living_area_sqm: 60,
        },
      });
      const noParamsPropertyId = JSON.parse(propRes.body).id;

      // Create acquisition without AfA params
      await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${noParamsPropertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          purchase_price: 20000000,
          purchase_date: '2023-01-01',
          notary_cost: 0,
          transfer_tax: 0,
          land_registry_cost: 0,
          broker_cost: 0,
          building_share: 14000000,
          land_share: 6000000,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/depreciation/${noParamsPropertyId}/plan`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
