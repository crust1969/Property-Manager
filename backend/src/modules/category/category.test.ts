import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('Category Module', () => {
  let app: FastifyInstance;
  let tmpDir: string;
  let accessToken: string;
  let propertyId: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'category-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();

    // Register a user and get access token
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'category-test@example.com',
        password: 'password123',
        name: 'Category Tester',
      },
    });
    const registerBody = JSON.parse(registerRes.body);
    accessToken = registerBody.accessToken;

    // Create a property to associate categories with
    const propertyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Test Wohnung',
        street: 'Teststraße 1',
        zip_code: '12345',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 75.5,
      },
    });
    const propertyBody = JSON.parse(propertyRes.body);
    propertyId = propertyBody.id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/categories', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/categories?propertyId=${propertyId}`,
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return system categories for a property', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/categories?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);

      // All returned should be system categories since no custom ones created yet
      const systemCategories = body.filter((c: { is_system: boolean }) => c.is_system);
      expect(systemCategories.length).toBeGreaterThan(0);

      // Verify response shape
      const first = body[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('type');
      expect(first).toHaveProperty('is_allocable');
      expect(first).toHaveProperty('is_tax_deductible');
      expect(first).toHaveProperty('requires_capitalization');
      expect(first).toHaveProperty('is_financing_related');
      expect(first).toHaveProperty('is_system');
      expect(first).toHaveProperty('is_active');
    });

    it('should return all system categories when no propertyId is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should reject invalid propertyId format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/categories?propertyId=not-a-uuid',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/categories', () => {
    it('should create a custom category', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Meine Kategorie',
          type: 'expense',
          property_id: propertyId,
          is_allocable: true,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Meine Kategorie');
      expect(body.type).toBe('expense');
      expect(body.is_allocable).toBe(true);
      expect(body.is_tax_deductible).toBe(false);
      expect(body.requires_capitalization).toBe(false);
      expect(body.is_financing_related).toBe(false);
      expect(body.is_system).toBe(false);
      expect(body.is_active).toBe(true);
      expect(body.property_id).toBe(propertyId);
    });

    it('should reject duplicate name within same property and type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Meine Kategorie',
          type: 'expense',
          property_id: propertyId,
          is_allocable: false,
          is_tax_deductible: true,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should allow same name with different type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Meine Kategorie',
          type: 'income',
          property_id: propertyId,
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should reject if name conflicts with system category name and type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Grundsteuer',
          type: 'expense',
          property_id: propertyId,
          is_allocable: true,
          is_tax_deductible: true,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        payload: {
          name: 'Unauthorized',
          type: 'expense',
          property_id: propertyId,
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid input (missing name)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          type: 'expense',
          property_id: propertyId,
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject name longer than 100 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'A'.repeat(101),
          type: 'expense',
          property_id: propertyId,
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Invalid Type',
          type: 'invalid',
          property_id: propertyId,
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should enforce max 50 custom categories per property', async () => {
      // We already have 2 custom categories, create 48 more to reach the limit
      for (let i = 0; i < 48; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/categories',
          headers: { authorization: `Bearer ${accessToken}` },
          payload: {
            name: `Limit Test ${i}`,
            type: 'expense',
            property_id: propertyId,
            is_allocable: false,
            is_tax_deductible: false,
            requires_capitalization: false,
            is_financing_related: false,
          },
        });
      }

      // The 51st should fail
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Over Limit',
          type: 'expense',
          property_id: propertyId,
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('50');
    });
  });

  describe('PUT /api/v1/categories/:id', () => {
    let customCategoryId: string;
    let systemCategoryId: string;

    beforeAll(async () => {
      // Get categories to find a system one and create a new custom one for update tests
      // Create a fresh property for these tests
      const propertyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Update Test Wohnung',
          street: 'Updatestraße 1',
          zip_code: '10115',
          city: 'Berlin',
          property_type: 'Wohnung',
          living_area_sqm: 50,
        },
      });
      const updatePropertyId = JSON.parse(propertyRes.body).id;

      // Create a custom category
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Updatable Kategorie',
          type: 'expense',
          property_id: updatePropertyId,
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });
      customCategoryId = JSON.parse(createRes.body).id;

      // Get a system category ID
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/categories?propertyId=${updatePropertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const categories = JSON.parse(listRes.body);
      const systemCat = categories.find((c: { is_system: boolean }) => c.is_system);
      systemCategoryId = systemCat.id;
    });

    it('should update a custom category', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/categories/${customCategoryId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Updated Name',
          type: 'expense',
          is_allocable: true,
          is_tax_deductible: true,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Updated Name');
      expect(body.is_allocable).toBe(true);
      expect(body.is_tax_deductible).toBe(true);
    });

    it('should not allow updating system categories', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/categories/${systemCategoryId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Hacked System',
          type: 'expense',
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Systemkategorien');
    });

    it('should return 404 for non-existent category', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/categories/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Ghost',
          type: 'expense',
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/categories/${customCategoryId}`,
        payload: {
          name: 'No Auth',
          type: 'expense',
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/categories/:id/deactivate', () => {
    let deactivateCategoryId: string;
    let systemCategoryId: string;

    beforeAll(async () => {
      // Create a fresh property
      const propertyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Deactivate Test',
          street: 'Deaktivstraße 1',
          zip_code: '20095',
          city: 'Hamburg',
          property_type: 'Wohnung',
          living_area_sqm: 60,
        },
      });
      const deactivatePropertyId = JSON.parse(propertyRes.body).id;

      // Create a custom category to deactivate
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Deactivatable',
          type: 'expense',
          property_id: deactivatePropertyId,
          is_allocable: false,
          is_tax_deductible: true,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });
      deactivateCategoryId = JSON.parse(createRes.body).id;

      // Get a system category
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/categories?propertyId=${deactivatePropertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const categories = JSON.parse(listRes.body);
      systemCategoryId = categories.find((c: { is_system: boolean }) => c.is_system).id;
    });

    it('should deactivate a custom category', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/categories/${deactivateCategoryId}/deactivate`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('deaktiviert');
    });

    it('should not return deactivated categories in GET list', async () => {
      // Create another property and category to test listing
      const propertyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/properties',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'List Test',
          street: 'Liststraße 1',
          zip_code: '30159',
          city: 'Hannover',
          property_type: 'Wohnung',
          living_area_sqm: 40,
        },
      });
      const listPropertyId = JSON.parse(propertyRes.body).id;

      // Create and then deactivate
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Will Be Hidden',
          type: 'expense',
          property_id: listPropertyId,
          is_allocable: false,
          is_tax_deductible: false,
          requires_capitalization: false,
          is_financing_related: false,
        },
      });
      const catId = JSON.parse(createRes.body).id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/categories/${catId}/deactivate`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // List should not include deactivated
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/categories?propertyId=${listPropertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const categories = JSON.parse(listRes.body);
      const found = categories.find((c: { id: string }) => c.id === catId);
      expect(found).toBeUndefined();
    });

    it('should not allow deactivating system categories', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/categories/${systemCategoryId}/deactivate`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent category', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/categories/00000000-0000-0000-0000-000000000000/deactivate',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return error when deactivating already deactivated category', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/categories/${deactivateCategoryId}/deactivate`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/categories/${deactivateCategoryId}/deactivate`,
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
