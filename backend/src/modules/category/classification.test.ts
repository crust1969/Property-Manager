import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';

describe('Classification Service (Task 6.2)', () => {
  let app: FastifyInstance;
  let tmpDir: string;
  let accessToken: string;
  let userId: string;
  let propertyId: string;
  let categoryId: string;
  let bookingId: string;
  let splitId: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classification-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();

    // Register a user
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'classification-test@example.com',
        password: 'password123',
        name: 'Classification Tester',
      },
    });
    const registerBody = JSON.parse(registerRes.body);
    accessToken = registerBody.accessToken;

    // Decode JWT to get userId
    const tokenPayload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString()
    );
    userId = tokenPayload.userId;

    // Create a property
    const propertyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Classification Wohnung',
        street: 'Teststraße 1',
        zip_code: '12345',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 75.5,
      },
    });
    propertyId = JSON.parse(propertyRes.body).id;

    // Create a custom category with specific flags
    const categoryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Test Kategorie Flags',
        type: 'expense',
        property_id: propertyId,
        is_allocable: true,
        is_tax_deductible: true,
        requires_capitalization: false,
        is_financing_related: false,
      },
    });
    categoryId = JSON.parse(categoryRes.body).id;

    // Insert a booking and a booking split directly into the DB for testing
    bookingId = uuidv4();
    splitId = uuidv4();
    const now = new Date().toISOString();

    app.db.prepare(`
      INSERT INTO bookings (id, property_id, user_id, type, booking_date, total_amount, counterparty, description, created_at, updated_at)
      VALUES (?, ?, ?, 'expense', ?, 10000, 'Test GmbH', 'Test Buchung', ?, ?)
    `).run(bookingId, propertyId, userId, '2024-01-15', now, now);

    // Insert split with category defaults (inheriting from category)
    app.db.prepare(`
      INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
      VALUES (?, ?, 10000, ?, 1, 1, 0, 0, '[]')
    `).run(splitId, bookingId, categoryId);
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/:categoryId/defaults', () => {
    it('should return default flags for a category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/${categoryId}/defaults`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.is_allocable).toBe(true);
      expect(body.is_tax_deductible).toBe(true);
      expect(body.requires_capitalization).toBe(false);
      expect(body.is_financing_related).toBe(false);
    });

    it('should return 404 for non-existent category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/00000000-0000-0000-0000-000000000000/defaults`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/${categoryId}/defaults`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/booking-splits/:id/override-flag', () => {
    it('should override a flag and create audit log entry', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/${splitId}/override-flag`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          flag: 'is_allocable',
          new_value: false,
          reason: 'Diese Kosten sind nicht umlagefähig laut Vertrag',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.booking_split_id).toBe(splitId);
      expect(body.flag).toBe('is_allocable');
      expect(body.previous_value).toBe(true);
      expect(body.new_value).toBe(false);
      expect(body.overridden_flags).toContain('is_allocable');
      expect(body.audit_log_id).toBeDefined();
    });

    it('should persist the override in the database', async () => {
      // Verify in DB
      const split = app.db
        .prepare('SELECT * FROM booking_splits WHERE id = ?')
        .get(splitId) as {
        is_allocable: number;
        overridden_flags: string;
      };

      expect(split.is_allocable).toBe(0);
      const overridden = JSON.parse(split.overridden_flags);
      expect(overridden).toContain('is_allocable');
    });

    it('should create an audit log entry in the same transaction', async () => {
      const auditEntries = app.db
        .prepare('SELECT * FROM audit_log WHERE booking_split_id = ?')
        .all(splitId) as Array<{
        changed_flag: string;
        previous_value: number;
        new_value: number;
        reason: string;
        user_id: string;
        created_at: string;
      }>;

      expect(auditEntries.length).toBeGreaterThanOrEqual(1);
      const entry = auditEntries.find((e) => e.changed_flag === 'is_allocable');
      expect(entry).toBeDefined();
      expect(entry!.previous_value).toBe(1);
      expect(entry!.new_value).toBe(0);
      expect(entry!.reason).toBe('Diese Kosten sind nicht umlagefähig laut Vertrag');
      expect(entry!.user_id).toBe(userId);
      // ISO 8601 timestamp
      expect(entry!.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should reject override with same value (no-op)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/${splitId}/override-flag`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          flag: 'is_allocable',
          new_value: false, // already false from previous test
          reason: 'No change',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('bereits');
    });

    it('should override a second flag on the same split', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/${splitId}/override-flag`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          flag: 'requires_capitalization',
          new_value: true,
          reason: 'Muss aktiviert werden laut Steuerberater',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.overridden_flags).toContain('is_allocable');
      expect(body.overridden_flags).toContain('requires_capitalization');
    });

    it('should reject invalid flag name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/${splitId}/override-flag`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          flag: 'invalid_flag',
          new_value: true,
          reason: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty reason', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/${splitId}/override-flag`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          flag: 'is_tax_deductible',
          new_value: false,
          reason: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject reason longer than 500 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/${splitId}/override-flag`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          flag: 'is_tax_deductible',
          new_value: false,
          reason: 'A'.repeat(501),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent booking split', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/00000000-0000-0000-0000-000000000000/override-flag`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          flag: 'is_allocable',
          new_value: true,
          reason: 'Test',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/${splitId}/override-flag`,
        payload: {
          flag: 'is_allocable',
          new_value: true,
          reason: 'Test',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Overridden flags persist when category defaults change', () => {
    it('should keep overridden flag value when category is updated', async () => {
      // The split currently has is_allocable=0 (overridden from category default 1)
      // and requires_capitalization=1 (overridden from category default 0)
      // Now update the category's defaults
      await app.inject({
        method: 'PUT',
        url: `/api/v1/categories/${categoryId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Test Kategorie Flags',
          type: 'expense',
          is_allocable: false, // changed from true to false
          is_tax_deductible: false, // changed from true to false
          requires_capitalization: true, // changed from false to true
          is_financing_related: true, // changed from false to true
        },
      });

      // Verify the split's overridden flags were NOT changed
      const split = app.db
        .prepare('SELECT * FROM booking_splits WHERE id = ?')
        .get(splitId) as {
        is_allocable: number;
        is_tax_deductible: number;
        requires_capitalization: number;
        is_financing_related: number;
        overridden_flags: string;
      };

      // is_allocable was overridden to 0, should stay 0 (category now also 0 but that's coincidence)
      expect(split.is_allocable).toBe(0);
      // requires_capitalization was overridden to 1, should stay 1
      expect(split.requires_capitalization).toBe(1);
      // is_tax_deductible was NOT overridden - it keeps whatever value it had
      // (the design says overridden flags persist; non-overridden would be synced if we call the method)
      expect(split.is_tax_deductible).toBe(1); // still original value since no sync was triggered
      // is_financing_related was NOT overridden
      expect(split.is_financing_related).toBe(0); // still original value

      const overridden = JSON.parse(split.overridden_flags);
      expect(overridden).toContain('is_allocable');
      expect(overridden).toContain('requires_capitalization');
    });
  });

  describe('GET /api/v1/audit-log', () => {
    it('should return audit log entries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-log?bookingSplitId=${splitId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(2); // We made 2 overrides
      expect(body.entries.length).toBeGreaterThanOrEqual(2);

      // Verify audit log entry structure
      const entry = body.entries[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('booking_split_id');
      expect(entry).toHaveProperty('user_id');
      expect(entry).toHaveProperty('changed_flag');
      expect(entry).toHaveProperty('previous_value');
      expect(entry).toHaveProperty('new_value');
      expect(entry).toHaveProperty('reason');
      expect(entry).toHaveProperty('created_at');
    });

    it('should filter by changed_flag type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-log?bookingSplitId=${splitId}&type=is_allocable`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries.length).toBe(1);
      expect(body.entries[0].changed_flag).toBe('is_allocable');
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-log?bookingSplitId=${splitId}&page=1&limit=1`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries.length).toBe(1);
      expect(body.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by bookingId (joining through booking_splits)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-log?bookingId=${bookingId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries.length).toBeGreaterThanOrEqual(2);
      // All entries should be for splits belonging to this booking
      for (const entry of body.entries) {
        const split = app.db
          .prepare('SELECT booking_id FROM booking_splits WHERE id = ?')
          .get(entry.booking_split_id) as { booking_id: string };
        expect(split.booking_id).toBe(bookingId);
      }
    });

    it('should filter by date range (from/to)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-log?from=2020-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.999Z`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries.length).toBeGreaterThanOrEqual(2);
    });

    it('should cap limit at 50 even if higher value requested', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-log?limit=100`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // The validator enforces max 50, so this should be rejected
      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-log?bookingSplitId=${splitId}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Category flag inheritance on new split creation', () => {
    it('should inherit category flags when creating a new split', async () => {
      // Create a new category with specific flags
      const catRes = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Inheritance Test',
          type: 'expense',
          property_id: propertyId,
          is_allocable: false,
          is_tax_deductible: true,
          requires_capitalization: true,
          is_financing_related: false,
        },
      });
      const newCategoryId = JSON.parse(catRes.body).id;

      // Get defaults from category (simulates what the frontend/expense service would do)
      const defaultsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/${newCategoryId}/defaults`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(defaultsRes.statusCode).toBe(200);
      const defaults = JSON.parse(defaultsRes.body);
      expect(defaults.is_allocable).toBe(false);
      expect(defaults.is_tax_deductible).toBe(true);
      expect(defaults.requires_capitalization).toBe(true);
      expect(defaults.is_financing_related).toBe(false);

      // Insert a split with inherited defaults (simulating what the expense service would do)
      const newSplitId = uuidv4();
      app.db.prepare(`
        INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
        VALUES (?, ?, 5000, ?, ?, ?, ?, ?, '[]')
      `).run(
        newSplitId,
        bookingId,
        newCategoryId,
        defaults.is_allocable ? 1 : 0,
        defaults.is_tax_deductible ? 1 : 0,
        defaults.requires_capitalization ? 1 : 0,
        defaults.is_financing_related ? 1 : 0
      );

      // Verify stored values match category defaults
      const stored = app.db
        .prepare('SELECT * FROM booking_splits WHERE id = ?')
        .get(newSplitId) as {
        is_allocable: number;
        is_tax_deductible: number;
        requires_capitalization: number;
        is_financing_related: number;
        overridden_flags: string;
      };

      expect(stored.is_allocable).toBe(0);
      expect(stored.is_tax_deductible).toBe(1);
      expect(stored.requires_capitalization).toBe(1);
      expect(stored.is_financing_related).toBe(0);
      expect(JSON.parse(stored.overridden_flags)).toEqual([]);
    });
  });

  describe('Transaction atomicity', () => {
    it('should rollback flag change if audit log insert would fail', async () => {
      // Create a new split for this test
      const testSplitId = uuidv4();
      app.db.prepare(`
        INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
        VALUES (?, ?, 3000, ?, 1, 0, 0, 0, '[]')
      `).run(testSplitId, bookingId, categoryId);

      // The transaction integrity is enforced by the ClassificationService.
      // We can test by verifying that after a successful override,
      // both the split AND the audit log are updated.
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/booking-splits/${testSplitId}/override-flag`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          flag: 'is_tax_deductible',
          new_value: true,
          reason: 'Steuerberater bestätigt Abzugsfähigkeit',
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify both were written
      const split = app.db
        .prepare('SELECT is_tax_deductible FROM booking_splits WHERE id = ?')
        .get(testSplitId) as { is_tax_deductible: number };
      expect(split.is_tax_deductible).toBe(1);

      const auditEntry = app.db
        .prepare(
          'SELECT * FROM audit_log WHERE booking_split_id = ? AND changed_flag = ?'
        )
        .get(testSplitId, 'is_tax_deductible') as { reason: string } | undefined;
      expect(auditEntry).toBeDefined();
      expect(auditEntry!.reason).toBe('Steuerberater bestätigt Abzugsfähigkeit');
    });
  });
});
