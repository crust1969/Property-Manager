import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('Expense Module', () => {
  let app: FastifyInstance;
  let tmpDir: string;
  let accessToken: string;
  let propertyId: string;
  let categoryId: string;
  let categoryId2: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();

    // Register a user and get access token
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'expense-test@example.com',
        password: 'password123',
        name: 'Expense Tester',
      },
    });
    const registerBody = JSON.parse(registerRes.body);
    accessToken = registerBody.accessToken;

    // Create a property
    const propertyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Expense Test Wohnung',
        street: 'Teststraße 1',
        zip_code: '12345',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 75.5,
      },
    });
    propertyId = JSON.parse(propertyRes.body).id;

    // Create two expense categories
    const cat1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Test Reparaturen Ausgaben',
        type: 'expense',
        property_id: propertyId,
        is_allocable: true,
        is_tax_deductible: true,
        requires_capitalization: false,
        is_financing_related: false,
      },
    });
    categoryId = JSON.parse(cat1Res.body).id;

    const cat2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Test Versicherung Ausgaben',
        type: 'expense',
        property_id: propertyId,
        is_allocable: false,
        is_tax_deductible: true,
        requires_capitalization: false,
        is_financing_related: false,
      },
    });
    categoryId2 = JSON.parse(cat2Res.body).id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/expenses', () => {
    it('should create an expense with a single split', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-03-15',
          total_amount: 50000, // 500.00€
          counterparty: 'Handwerker GmbH',
          description: 'Rohrreparatur',
          splits: [
            { amount: 50000, category_id: categoryId },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.property_id).toBe(propertyId);
      expect(body.booking_date).toBe('2024-03-15');
      expect(body.total_amount).toBe(50000);
      expect(body.counterparty).toBe('Handwerker GmbH');
      expect(body.description).toBe('Rohrreparatur');
      expect(body.type).toBe('expense');
      expect(body.splits).toHaveLength(1);
      expect(body.splits[0].amount).toBe(50000);
      expect(body.splits[0].category_id).toBe(categoryId);
    });

    it('should inherit category flags as defaults', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-03-16',
          total_amount: 30000,
          counterparty: 'Versicherung AG',
          splits: [
            { amount: 30000, category_id: categoryId },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      // categoryId has: is_allocable=true, is_tax_deductible=true, requires_capitalization=false, is_financing_related=false
      expect(body.splits[0].is_allocable).toBe(true);
      expect(body.splits[0].is_tax_deductible).toBe(true);
      expect(body.splits[0].requires_capitalization).toBe(false);
      expect(body.splits[0].is_financing_related).toBe(false);
    });

    it('should allow overriding category flags explicitly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-03-17',
          total_amount: 20000,
          splits: [
            {
              amount: 20000,
              category_id: categoryId,
              is_allocable: false, // override from true
              is_tax_deductible: true,
              requires_capitalization: true, // override from false
              is_financing_related: false,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.splits[0].is_allocable).toBe(false);
      expect(body.splits[0].requires_capitalization).toBe(true);
    });

    it('should reject when split sum does not equal total', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-03-18',
          total_amount: 50000,
          splits: [
            { amount: 30000, category_id: categoryId },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Differenz');
    });

    it('should reject missing booking_date', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          total_amount: 10000,
          splits: [{ amount: 10000, category_id: categoryId }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject amount below minimum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-03-18',
          total_amount: 0,
          splits: [{ amount: 0, category_id: categoryId }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject counterparty longer than 200 chars', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-03-18',
          total_amount: 10000,
          counterparty: 'A'.repeat(201),
          splits: [{ amount: 10000, category_id: categoryId }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject description longer than 500 chars', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-03-18',
          total_amount: 10000,
          description: 'A'.repeat(501),
          splits: [{ amount: 10000, category_id: categoryId }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        payload: {
          property_id: propertyId,
          booking_date: '2024-03-18',
          total_amount: 10000,
          splits: [{ amount: 10000, category_id: categoryId }],
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/expenses', () => {
    it('should list expenses for a property', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0].splits).toBeDefined();
    });

    it('should filter by year', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      for (const expense of body) {
        expect(expense.booking_date.startsWith('2024')).toBe(true);
      }
    });

    it('should filter by categoryId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses?propertyId=${propertyId}&categoryId=${categoryId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      for (const expense of body) {
        const hasCat = expense.splits.some((s: { category_id: string }) => s.category_id === categoryId);
        expect(hasCat).toBe(true);
      }
    });

    it('should filter by flags', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses?propertyId=${propertyId}&flags=is_allocable`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      for (const expense of body) {
        const hasFlag = expense.splits.some((s: { is_allocable: boolean }) => s.is_allocable === true);
        expect(hasFlag).toBe(true);
      }
    });

    it('should return empty for non-matching year', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses?propertyId=${propertyId}&year=1990`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(0);
    });

    it('should require propertyId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/expenses/:id', () => {
    let expenseId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-04-01',
          total_amount: 75000,
          counterparty: 'Detail Test',
          splits: [{ amount: 75000, category_id: categoryId }],
        },
      });
      expenseId = JSON.parse(res.body).id;
    });

    it('should return expense with splits', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(expenseId);
      expect(body.splits).toHaveLength(1);
      expect(body.splits[0].amount).toBe(75000);
    });

    it('should return 404 for non-existent expense', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/expenses/:id', () => {
    let expenseId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-05-01',
          total_amount: 40000,
          counterparty: 'Update Test',
          splits: [{ amount: 40000, category_id: categoryId }],
        },
      });
      expenseId = JSON.parse(res.body).id;
    });

    it('should update expense fields', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          booking_date: '2024-05-15',
          counterparty: 'Updated Counterparty',
          description: 'Updated description',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.booking_date).toBe('2024-05-15');
      expect(body.counterparty).toBe('Updated Counterparty');
      expect(body.description).toBe('Updated description');
    });

    it('should update with new splits', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          total_amount: 40000,
          splits: [
            { amount: 25000, category_id: categoryId },
            { amount: 15000, category_id: categoryId2 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.splits).toHaveLength(2);
      expect(body.splits[0].amount + body.splits[1].amount).toBe(40000);
    });

    it('should reject if total_amount changes without matching splits', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          total_amount: 60000, // Changed but no new splits
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Differenz');
    });

    it('should return 404 for non-existent expense', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/expenses/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { description: 'ghost' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/expenses/:id', () => {
    let expenseId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-06-01',
          total_amount: 10000,
          splits: [{ amount: 10000, category_id: categoryId }],
        },
      });
      expenseId = JSON.parse(res.body).id;
    });

    it('should delete an expense', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);

      // Verify it's gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 for non-existent expense', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/expenses/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/expenses/:id/split', () => {
    let expenseId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-07-01',
          total_amount: 100000,
          splits: [{ amount: 100000, category_id: categoryId }],
        },
      });
      expenseId = JSON.parse(res.body).id;
    });

    it('should create/replace splits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/expenses/${expenseId}/split`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          splits: [
            { amount: 60000, category_id: categoryId },
            { amount: 40000, category_id: categoryId2 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.splits).toHaveLength(2);
      expect(body.splits[0].amount + body.splits[1].amount).toBe(100000);
    });

    it('should inherit flags from categories in splits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/expenses/${expenseId}/split`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          splits: [
            { amount: 70000, category_id: categoryId },
            { amount: 30000, category_id: categoryId2 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // categoryId: is_allocable=true, categoryId2: is_allocable=false
      const split1 = body.splits.find((s: { category_id: string }) => s.category_id === categoryId);
      const split2 = body.splits.find((s: { category_id: string }) => s.category_id === categoryId2);
      expect(split1.is_allocable).toBe(true);
      expect(split2.is_allocable).toBe(false);
    });

    it('should reject split sum that does not match total', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/expenses/${expenseId}/split`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          splits: [
            { amount: 60000, category_id: categoryId },
            { amount: 30000, category_id: categoryId2 },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Differenz');
    });

    it('should reject fewer than 2 splits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/expenses/${expenseId}/split`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          splits: [
            { amount: 100000, category_id: categoryId },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject more than 20 splits', async () => {
      const splits = Array.from({ length: 21 }, (_, i) => ({
        amount: i < 20 ? 4761 : 100000 - 4761 * 20,
        category_id: categoryId,
      }));

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/expenses/${expenseId}/split`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { splits },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/v1/expenses/:id/split', () => {
    let expenseId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          property_id: propertyId,
          booking_date: '2024-08-01',
          total_amount: 80000,
          splits: [{ amount: 80000, category_id: categoryId }],
        },
      });
      expenseId = JSON.parse(res.body).id;
    });

    it('should update splits', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/expenses/${expenseId}/split`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          splits: [
            { amount: 50000, category_id: categoryId },
            { amount: 30000, category_id: categoryId2 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.splits).toHaveLength(2);
    });

    it('should reject split sum mismatch', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/expenses/${expenseId}/split`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          splits: [
            { amount: 50000, category_id: categoryId },
            { amount: 20000, category_id: categoryId2 },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
