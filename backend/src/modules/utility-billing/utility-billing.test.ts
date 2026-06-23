import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { calculateTenantShare, calculateSaldo } from './utility-billing.service.js';

let app: FastifyInstance;
let accessToken: string;
let tmpDir: string;
let propertyId: string;
let tenantId: string;
let leaseId: string;
let categoryId: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'utility-billing-test@example.com') {
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

describe('Utility Billing (Nebenkostenabrechnung)', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'utility-billing-test-'));
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

    // Create a lease with operating cost advance
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

    // Create a category (umlagefähig)
    categoryId = uuidv4();
    app.db
      .prepare(
        `INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(categoryId, propertyId, 'Hausgeld', 'expense', 1, 1, 0, 0, 0, 1);
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('calculateTenantShare (unit tests)', () => {
    it('should calculate tenant share by fläche (area)', () => {
      const result = calculateTenantShare(120000, 'fläche', {
        tenant_area: 75,
        total_area: 300,
      });
      // 120000 * (75/300) = 30000
      expect(result.share).toBe(30000);
      expect(result.isComplete).toBe(true);
    });

    it('should calculate tenant share by personen (persons)', () => {
      const result = calculateTenantShare(60000, 'personen', {
        tenant_persons: 2,
        total_persons: 8,
      });
      // 60000 * (2/8) = 15000
      expect(result.share).toBe(15000);
      expect(result.isComplete).toBe(true);
    });

    it('should calculate tenant share by verbrauch (consumption)', () => {
      const result = calculateTenantShare(100000, 'verbrauch', {
        tenant_consumption: 150,
        total_consumption: 1000,
      });
      // 100000 * (150/1000) = 15000
      expect(result.share).toBe(15000);
      expect(result.isComplete).toBe(true);
    });

    it('should calculate tenant share for direkt (direct)', () => {
      const result = calculateTenantShare(50000, 'direkt', {});
      expect(result.share).toBe(50000);
      expect(result.isComplete).toBe(true);
    });

    it('should calculate tenant share for manuell (manual percentage)', () => {
      const result = calculateTenantShare(200000, 'manuell', {
        manual_percentage: 25,
      });
      // 200000 * (25/100) = 50000
      expect(result.share).toBe(50000);
      expect(result.isComplete).toBe(true);
    });

    it('should mark as incomplete when total_area is 0 for fläche', () => {
      const result = calculateTenantShare(120000, 'fläche', {
        tenant_area: 75,
        total_area: 0,
      });
      expect(result.share).toBe(0);
      expect(result.isComplete).toBe(false);
    });

    it('should mark as incomplete when total_persons is 0 for personen', () => {
      const result = calculateTenantShare(60000, 'personen', {
        tenant_persons: 2,
        total_persons: 0,
      });
      expect(result.share).toBe(0);
      expect(result.isComplete).toBe(false);
    });

    it('should mark as incomplete when total_consumption is 0 for verbrauch', () => {
      const result = calculateTenantShare(100000, 'verbrauch', {
        tenant_consumption: 150,
        total_consumption: 0,
      });
      expect(result.share).toBe(0);
      expect(result.isComplete).toBe(false);
    });

    it('should mark as incomplete when manual_percentage is 0 for manuell', () => {
      const result = calculateTenantShare(200000, 'manuell', {
        manual_percentage: 0,
      });
      expect(result.share).toBe(0);
      expect(result.isComplete).toBe(false);
    });

    it('should round to nearest cent for fläche', () => {
      // 100000 * (1/3) = 33333.333... → should round to 33333
      const result = calculateTenantShare(100000, 'fläche', {
        tenant_area: 1,
        total_area: 3,
      });
      expect(result.share).toBe(33333);
      expect(result.isComplete).toBe(true);
    });
  });

  describe('calculateSaldo', () => {
    it('should return positive balance (Nachzahlung) when tenant share > prepayments', () => {
      expect(calculateSaldo(50000, 30000)).toBe(20000);
    });

    it('should return negative balance (Guthaben) when prepayments > tenant share', () => {
      expect(calculateSaldo(30000, 50000)).toBe(-20000);
    });

    it('should return 0 when tenant share equals prepayments', () => {
      expect(calculateSaldo(50000, 50000)).toBe(0);
    });
  });

  describe('POST /api/v1/utility-billing', () => {
    it('should create a billing with items and allocation_params', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.property_id).toBe(propertyId);
      expect(body.lease_id).toBe(leaseId);
      expect(body.period_start).toBe('2024-01-01');
      expect(body.period_end).toBe('2024-12-31');
      expect(body.total_allocable_costs).toBe(120000);
      // 120000 * (75/300) = 30000
      expect(body.tenant_share).toBe(30000);
      expect(body.status).toBe('entwurf');
      expect(body.items).toHaveLength(1);
      expect(body.items[0].allocation_key).toBe('fläche');
      expect(body.items[0].tenant_share).toBe(30000);
      expect(body.items[0].is_complete).toBe(true);
    });

    it('should create a billing with direkt allocation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 50000,
              allocation_key: 'direkt',
              allocation_params: {},
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.tenant_share).toBe(50000);
      expect(body.items[0].tenant_share).toBe(50000);
      expect(body.items[0].is_complete).toBe(true);
    });

    it('should create a billing with manuell allocation (percentage)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 200000,
              allocation_key: 'manuell',
              allocation_params: { manual_percentage: 25 },
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      // 200000 * (25/100) = 50000
      expect(body.tenant_share).toBe(50000);
    });

    it('should mark position as incomplete when verbrauch data is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 80000,
              allocation_key: 'verbrauch',
              allocation_params: { tenant_consumption: 0, total_consumption: 0 },
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.items[0].is_complete).toBe(false);
      expect(body.warnings.length).toBeGreaterThan(0);
      expect(body.warnings[0]).toContain('unvollständig');
    });

    it('should add warning when no prepayments are recorded', async () => {
      // Use a period where no receivables exist
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2023-01-01',
          period_end: '2023-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      const prepaymentWarning = body.warnings.find((w: string) => w.includes('Vorauszahlungen'));
      expect(prepaymentWarning).toBeDefined();
      expect(body.prepayments).toBe(0);
    });

    it('should calculate correct saldo (Nachzahlung when tenant share > prepayments)', async () => {
      // Use a period where no receivables exist so prepayments = 0
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2023-01-01',
          period_end: '2023-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      // tenant_share = 30000, prepayments = 0 → balance = 30000 (Nachzahlung)
      expect(body.balance).toBe(30000);
      expect(body.balance).toBeGreaterThan(0); // Nachzahlung
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject invalid property_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: 'non-existent-id',
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject invalid lease_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: 'non-existent-lease',
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject period exceeding 12 months', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2025-02-01',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject period where end is before start', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-12-31',
          period_end: '2024-01-01',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject empty items array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should handle multiple cost positions', async () => {
      const category2Id = uuidv4();
      app.db
        .prepare(
          `INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(category2Id, propertyId, 'Wasserkosten', 'expense', 1, 1, 0, 0, 0, 1);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
            {
              category_id: category2Id,
              total_cost: 60000,
              allocation_key: 'personen',
              allocation_params: { tenant_persons: 2, total_persons: 10 },
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.items).toHaveLength(2);
      // 120000 * (75/300) = 30000
      // 60000 * (2/10) = 12000
      expect(body.total_allocable_costs).toBe(180000);
      expect(body.tenant_share).toBe(42000);
    });
  });

  describe('GET /api/v1/utility-billing/:id', () => {
    it('should get billing details by ID', async () => {
      // Create a billing first
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/utility-billing/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(created.id);
      expect(body.property_id).toBe(propertyId);
      expect(body.lease_id).toBe(leaseId);
      expect(body.items).toHaveLength(1);
      expect(body.tenant_share).toBe(30000);
    });

    it('should return 404 for non-existent billing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/utility-billing/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/utility-billing/some-id',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/utility-billing/:id/pdf', () => {
    it('should export billing as PDF', async () => {
      // Create a billing first
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/utility-billing',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          lease_id: leaseId,
          period_start: '2024-01-01',
          period_end: '2024-12-31',
          items: [
            {
              category_id: categoryId,
              total_cost: 120000,
              allocation_key: 'fläche',
              allocation_params: { tenant_area: 75, total_area: 300 },
            },
          ],
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/utility-billing/${created.id}/pdf`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('nebenkostenabrechnung');
      // PDF starts with %PDF magic bytes
      expect(res.rawPayload[0]).toBe(0x25); // %
      expect(res.rawPayload[1]).toBe(0x50); // P
      expect(res.rawPayload[2]).toBe(0x44); // D
      expect(res.rawPayload[3]).toBe(0x46); // F
    });

    it('should return 404 for non-existent billing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/utility-billing/non-existent-id/pdf',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/utility-billing/some-id/pdf',
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
