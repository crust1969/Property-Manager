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
let propertyId2: string;
let tenantId: string;
let leaseId: string;
let categoryIncomeId: string;
let categoryExpenseId: string;
let categoryExpenseDeductibleId: string;
let categoryExpenseCapitalizationId: string;

const currentYear = new Date().getFullYear();
const today = new Date().toISOString().split('T')[0];

async function registerAndLogin(appInstance: FastifyInstance, email = 'dashboard-test@example.com') {
  const registerRes = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password123', name: 'Dashboard Test User' },
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

describe('Dashboard KPI Aggregation', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();
    accessToken = await registerAndLogin(app);

    const now = new Date().toISOString();

    // Create properties
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Testwohnung 1',
        street: 'Teststraße 1',
        zip_code: '10115',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 75,
      },
    });
    propertyId = JSON.parse(propRes.body).id;

    const propRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Testwohnung 2',
        street: 'Teststraße 2',
        zip_code: '10115',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 60,
      },
    });
    propertyId2 = JSON.parse(propRes2.body).id;

    // Create categories
    categoryIncomeId = uuidv4();
    categoryExpenseId = uuidv4();
    categoryExpenseDeductibleId = uuidv4();
    categoryExpenseCapitalizationId = uuidv4();

    app.db.prepare(
      `INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
       VALUES (?, NULL, NULL, ?, 'income', 0, 0, 0, 0, 1, 1)`
    ).run(categoryIncomeId, 'Mieteinnahmen Test');

    app.db.prepare(
      `INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
       VALUES (?, NULL, NULL, ?, 'expense', 0, 0, 0, 0, 1, 1)`
    ).run(categoryExpenseId, 'Allgemeine Ausgabe Test');

    app.db.prepare(
      `INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
       VALUES (?, NULL, NULL, ?, 'expense', 0, 1, 0, 0, 1, 1)`
    ).run(categoryExpenseDeductibleId, 'Werbungskosten Test');

    app.db.prepare(
      `INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
       VALUES (?, NULL, NULL, ?, 'expense', 0, 1, 1, 0, 1, 1)`
    ).run(categoryExpenseCapitalizationId, 'Aktivierung Test');

    // Get userId from token
    const decoded = app.jwt.decode(accessToken) as { userId: string };
    const userId = decoded.userId;

    // Create tenant and lease for receivables
    tenantId = uuidv4();
    app.db.prepare(
      `INSERT INTO tenants (id, property_id, first_name, last_name, created_at, updated_at)
       VALUES (?, ?, 'Max', 'Mustermann', ?, ?)`
    ).run(tenantId, propertyId, now, now);

    const leaseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/leases',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: `${currentYear}-01-01`,
        cold_rent: 80000,
        operating_cost_advance: 15000,
        heating_cost_advance: 5000,
        due_day: 1,
        rent_model: 'konstant',
      },
    });
    leaseId = JSON.parse(leaseRes.body).id;

    // Create income bookings for property 1
    await app.inject({
      method: 'POST',
      url: '/api/v1/income',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        property_id: propertyId,
        booking_date: `${currentYear}-02-01`,
        total_amount: 80000,
        counterparty: 'Mieter A',
        category_id: categoryIncomeId,
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/income',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        property_id: propertyId,
        booking_date: `${currentYear}-03-01`,
        total_amount: 80000,
        counterparty: 'Mieter A',
        category_id: categoryIncomeId,
      },
    });

    // Create expense bookings for property 1 with splits
    // Non-deductible expense
    const expBookingId1 = uuidv4();
    app.db.prepare(
      `INSERT INTO bookings (id, property_id, user_id, type, booking_date, total_amount, counterparty, description, created_at, updated_at)
       VALUES (?, ?, ?, 'expense', ?, 30000, 'Handwerker', 'Reparatur', ?, ?)`
    ).run(expBookingId1, propertyId, userId, `${currentYear}-02-15`, now, now);
    app.db.prepare(
      `INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
       VALUES (?, ?, 30000, ?, 0, 0, 0, 0, '[]')`
    ).run(uuidv4(), expBookingId1, categoryExpenseId);

    // Tax-deductible expense (Werbungskosten)
    const expBookingId2 = uuidv4();
    app.db.prepare(
      `INSERT INTO bookings (id, property_id, user_id, type, booking_date, total_amount, counterparty, description, created_at, updated_at)
       VALUES (?, ?, ?, 'expense', ?, 20000, 'Versicherung', 'Gebäudeversicherung', ?, ?)`
    ).run(expBookingId2, propertyId, userId, `${currentYear}-03-01`, now, now);
    app.db.prepare(
      `INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
       VALUES (?, ?, 20000, ?, 0, 1, 0, 0, '[]')`
    ).run(uuidv4(), expBookingId2, categoryExpenseDeductibleId);

    // Capitalization-required expense (tax deductible but requires capitalization)
    const expBookingId3 = uuidv4();
    app.db.prepare(
      `INSERT INTO bookings (id, property_id, user_id, type, booking_date, total_amount, counterparty, description, created_at, updated_at)
       VALUES (?, ?, ?, 'expense', ?, 50000, 'Bauunternehmen', 'Dachsanierung', ?, ?)`
    ).run(expBookingId3, propertyId, userId, `${currentYear}-04-01`, now, now);
    app.db.prepare(
      `INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
       VALUES (?, ?, 50000, ?, 0, 1, 1, 0, '[]')`
    ).run(uuidv4(), expBookingId3, categoryExpenseCapitalizationId);

    // Create a booking with overridden flags (ungeklärte Buchung)
    const expBookingId4 = uuidv4();
    app.db.prepare(
      `INSERT INTO bookings (id, property_id, user_id, type, booking_date, total_amount, counterparty, description, created_at, updated_at)
       VALUES (?, ?, ?, 'expense', ?, 10000, 'Sonstige', 'Unklar', ?, ?)`
    ).run(expBookingId4, propertyId, userId, `${currentYear}-05-01`, now, now);
    app.db.prepare(
      `INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
       VALUES (?, ?, 10000, ?, 0, 1, 0, 0, '["is_tax_deductible"]')`
    ).run(uuidv4(), expBookingId4, categoryExpenseDeductibleId);

    // Create acquisition with AfA params for property 1
    const acqId = uuidv4();
    app.db.prepare(
      `INSERT INTO acquisitions (id, property_id, purchase_price, purchase_date, building_share, land_share, afa_basis, afa_rate, afa_start_date)
       VALUES (?, ?, 30000000, '2020-01-01', 24000000, 6000000, 24000000, 0.02, '2020-01-01')`
    ).run(acqId, propertyId);

    // Create a loan and loan payments for property 1
    const loanId = uuidv4();
    app.db.prepare(
      `INSERT INTO loans (id, property_id, lender, loan_amount, interest_rate, repayment_rate, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, 'Bank AG', 20000000, 2.5, 2.0, '2020-01-01', '2035-01-01', ?, ?)`
    ).run(loanId, propertyId, now, now);

    // Loan payments for current year
    app.db.prepare(
      `INSERT INTO loan_payments (id, loan_id, payment_date, interest_amount, repayment_amount, fee_amount, extra_repayment)
       VALUES (?, ?, ?, 15000, 20000, 0, 0)`
    ).run(uuidv4(), loanId, `${currentYear}-01-15`);
    app.db.prepare(
      `INSERT INTO loan_payments (id, loan_id, payment_date, interest_amount, repayment_amount, fee_amount, extra_repayment)
       VALUES (?, ?, ?, 14500, 20000, 0, 0)`
    ).run(uuidv4(), loanId, `${currentYear}-02-15`);

    // Create a reminder that is due (offen and due_date <= today)
    app.db.prepare(
      `INSERT INTO reminders (id, user_id, property_id, title, due_date, priority, status, recurrence, created_at, updated_at)
       VALUES (?, ?, ?, 'Mietvertrag prüfen', ?, 'hoch', 'offen', 'einmalig', ?, ?)`
    ).run(uuidv4(), userId, propertyId, today, now, now);
    // Another reminder that is overdue
    app.db.prepare(
      `INSERT INTO reminders (id, user_id, property_id, title, due_date, priority, status, recurrence, created_at, updated_at)
       VALUES (?, ?, ?, 'Steuerberater kontaktieren', ?, 'mittel', 'offen', 'einmalig', ?, ?)`
    ).run(uuidv4(), userId, propertyId, `${currentYear}-01-01`, now, now);
    // A completed reminder (should not count)
    app.db.prepare(
      `INSERT INTO reminders (id, user_id, property_id, title, due_date, priority, status, recurrence, created_at, updated_at)
       VALUES (?, ?, ?, 'Erledigte Erinnerung', ?, 'niedrig', 'erledigt', 'einmalig', ?, ?)`
    ).run(uuidv4(), userId, propertyId, today, now, now);

    // Create income for property 2
    await app.inject({
      method: 'POST',
      url: '/api/v1/income',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        property_id: propertyId2,
        booking_date: `${currentYear}-01-01`,
        total_amount: 50000,
        counterparty: 'Mieter B',
        category_id: categoryIncomeId,
      },
    });
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/dashboard', () => {
    it('should return KPIs aggregated across all properties', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      // Mieteingänge - should have receivables from lease
      expect(body.mieteingaenge).toBeDefined();
      expect(typeof body.mieteingaenge.offen_anzahl).toBe('number');
      expect(typeof body.mieteingaenge.offen_summe).toBe('number');
      expect(typeof body.mieteingaenge.bezahlt_anzahl).toBe('number');
      expect(typeof body.mieteingaenge.bezahlt_summe).toBe('number');

      // Einnahmen YTD (2x 80000 property1 + 50000 property2 = 210000)
      expect(body.einnahmen_ytd).toBe(210000);

      // Ausgaben YTD (30000 + 20000 + 50000 + 10000 = 110000)
      expect(body.ausgaben_ytd).toBe(110000);

      // Werbungskosten YTD: tax-deductible AND not requiring capitalization
      // 20000 (deductible, no capitalization) + 10000 (deductible with override, no capitalization) = 30000
      // 50000 is excluded because requires_capitalization = 1
      expect(body.werbungskosten_ytd).toBe(30000);

      // AfA YTD: 24000000 * 0.02 = 480000
      expect(body.afa_ytd).toBe(480000);

      // Zinsen YTD: 15000 + 14500 = 29500
      expect(body.zinsen_ytd).toBe(29500);

      // Cashflow YTD: Einnahmen - Ausgaben = 210000 - 110000 = 100000
      expect(body.cashflow_ytd).toBe(100000);

      // Handlungsbedarf
      expect(body.handlungsbedarf).toBeDefined();
      expect(body.handlungsbedarf.offene_erinnerungen).toBe(2);
      // fehlende_belege - all bookings without documents
      expect(body.handlungsbedarf.fehlende_belege).toBeGreaterThan(0);
      // ungeklaerte_buchungen - 1 booking with overridden flags
      expect(body.handlungsbedarf.ungeklaerte_buchungen).toBe(1);
    });

    it('should filter KPIs by propertyId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      // Only property 1 income: 2x 80000 = 160000
      expect(body.einnahmen_ytd).toBe(160000);

      // Only property 1 expenses: 30000 + 20000 + 50000 + 10000 = 110000
      expect(body.ausgaben_ytd).toBe(110000);

      // AfA still same since only property 1 has acquisition
      expect(body.afa_ytd).toBe(480000);

      // Zinsen: 15000 + 14500 = 29500
      expect(body.zinsen_ytd).toBe(29500);

      // Cashflow: 160000 - 110000 = 50000
      expect(body.cashflow_ytd).toBe(50000);
    });

    it('should return 404 for non-existent propertyId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard?propertyId=00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Empty state', () => {
    it('should return zero values for a user with no data', async () => {
      const token = await registerAndLogin(app, 'empty-dashboard@example.com');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.mieteingaenge.offen_anzahl).toBe(0);
      expect(body.mieteingaenge.offen_summe).toBe(0);
      expect(body.mieteingaenge.bezahlt_anzahl).toBe(0);
      expect(body.mieteingaenge.bezahlt_summe).toBe(0);
      expect(body.einnahmen_ytd).toBe(0);
      expect(body.ausgaben_ytd).toBe(0);
      expect(body.werbungskosten_ytd).toBe(0);
      expect(body.afa_ytd).toBe(0);
      expect(body.zinsen_ytd).toBe(0);
      expect(body.cashflow_ytd).toBe(0);
      expect(body.handlungsbedarf.offene_erinnerungen).toBe(0);
      expect(body.handlungsbedarf.fehlende_belege).toBe(0);
      expect(body.handlungsbedarf.ungeklaerte_buchungen).toBe(0);
    });
  });
});
