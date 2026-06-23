import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let app: FastifyInstance;
let accessToken: string;
let propertyId: string;
let tmpDir: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'acq-test@example.com') {
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

function validAcquisitionPayload(overrides: Record<string, unknown> = {}) {
  return {
    purchase_price: 30000000, // 300,000.00 EUR
    purchase_date: '2023-06-15',
    transfer_date: '2023-07-01',
    notary_cost: 600000, // 6,000.00 EUR
    transfer_tax: 1950000, // 19,500.00 EUR
    land_registry_cost: 150000, // 1,500.00 EUR
    broker_cost: 1071000, // 10,710.00 EUR
    building_share: 21000000, // 210,000.00 EUR (70%)
    land_share: 9000000, // 90,000.00 EUR (30%)
    afa_rate: 0.02,
    afa_start_date: '2023-07-01',
    ...overrides,
  };
}

describe('Acquisition API', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acquisition-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();
    accessToken = await registerAndLogin(app);

    // Create a property to attach acquisition data to
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Testwohnung',
        street: 'Musterstraße 1',
        zip_code: '12345',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 75,
      },
    });
    const body = JSON.parse(res.body);
    propertyId = body.id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/properties/:id/acquisition', () => {
    it('should return 404 when no acquisition data exists', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/properties/non-existent/acquisition',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/properties/${propertyId}/acquisition`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/properties/:id/acquisition', () => {
    it('should create acquisition data with correct AfA basis', async () => {
      const payload = validAcquisitionPayload();
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.property_id).toBe(propertyId);
      expect(body.purchase_price).toBe(30000000);
      expect(body.building_share).toBe(21000000);
      expect(body.land_share).toBe(9000000);

      // AfA basis = building_share + building portion of ancillary costs
      // Building ratio = 21000000 / 30000000 = 0.7
      // Building notary = round(600000 * 0.7) = 420000
      // Building transfer_tax = round(1950000 * 0.7) = 1365000
      // Building land_registry = round(150000 * 0.7) = 105000
      // Building broker = round(1071000 * 0.7) = 749700
      // AfA basis = 21000000 + 420000 + 1365000 + 105000 + 749700 = 23639700
      expect(body.afa_basis).toBe(23639700);
      expect(body.afa_rate).toBe(0.02);
      expect(body.afa_start_date).toBe('2023-07-01');
    });

    it('should update existing acquisition data', async () => {
      const payload = validAcquisitionPayload({
        purchase_price: 40000000,
        building_share: 28000000,
        land_share: 12000000,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.purchase_price).toBe(40000000);
      expect(body.building_share).toBe(28000000);
      expect(body.land_share).toBe(12000000);
    });

    it('should reject when building_share + land_share != purchase_price', async () => {
      const payload = validAcquisitionPayload({
        purchase_price: 30000000,
        building_share: 20000000,
        land_share: 9000000, // Sum = 29000000, not 30000000
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.details).toBeDefined();
      expect(body.details.some((d: { field: string }) => d.field === 'building_share')).toBe(true);
    });

    it('should reject purchase_price below minimum (0 cents)', async () => {
      const payload = validAcquisitionPayload({
        purchase_price: 0,
        building_share: 0,
        land_share: 0,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject purchase_price above maximum', async () => {
      const payload = validAcquisitionPayload({
        purchase_price: 10000000000, // 100,000,000.00 EUR (exceeds max)
        building_share: 7000000000,
        land_share: 3000000000,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject negative ancillary costs', async () => {
      const payload = validAcquisitionPayload({
        notary_cost: -100,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject ancillary costs above maximum', async () => {
      const payload = validAcquisitionPayload({
        notary_cost: 10000000000,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid date format', async () => {
      const payload = validAcquisitionPayload({
        purchase_date: '15.06.2023', // Wrong format
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/properties/non-existent/acquisition',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validAcquisitionPayload(),
      });

      expect(res.statusCode).toBe(404);
    });

    it('should not allow access to other user property', async () => {
      const otherToken = await registerAndLogin(app, 'other-acq@example.com');
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: validAcquisitionPayload(),
      });

      expect(res.statusCode).toBe(404);
    });

    it('should accept zero ancillary costs', async () => {
      const payload = validAcquisitionPayload({
        notary_cost: 0,
        transfer_tax: 0,
        land_registry_cost: 0,
        broker_cost: 0,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // AfA basis with zero ancillary costs = just building_share
      expect(body.afa_basis).toBe(21000000);
    });

    it('should accept optional transfer_date as null', async () => {
      const payload = validAcquisitionPayload({
        transfer_date: null,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.transfer_date).toBeNull();
    });

    it('should handle 100% building share (no land)', async () => {
      const payload = validAcquisitionPayload({
        purchase_price: 20000000,
        building_share: 20000000,
        land_share: 0,
        notary_cost: 500000,
        transfer_tax: 1000000,
        land_registry_cost: 100000,
        broker_cost: 714000,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // 100% building ratio, so all ancillary costs go to building
      // AfA basis = 20000000 + 500000 + 1000000 + 100000 + 714000 = 22314000
      expect(body.afa_basis).toBe(22314000);
    });

    it('should reject non-integer purchase price', async () => {
      const payload = validAcquisitionPayload({
        purchase_price: 30000000.5,
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${propertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET after PUT', () => {
    it('should retrieve the acquisition data after creation', async () => {
      // Create fresh property
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Zweites Objekt',
          street: 'Andere Str 2',
          zip_code: '10115',
          city: 'Berlin',
          property_type: 'Haus',
          living_area_sqm: 120,
        },
      });
      const newPropertyId = JSON.parse(createRes.body).id;

      // PUT acquisition
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/properties/${newPropertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validAcquisitionPayload(),
      });
      expect(putRes.statusCode).toBe(200);

      // GET acquisition
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/properties/${newPropertyId}/acquisition`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(getRes.statusCode).toBe(200);
      const body = JSON.parse(getRes.body);
      expect(body.purchase_price).toBe(30000000);
      expect(body.building_share).toBe(21000000);
      expect(body.land_share).toBe(9000000);
      expect(body.purchase_date).toBe('2023-06-15');
    });
  });
});
