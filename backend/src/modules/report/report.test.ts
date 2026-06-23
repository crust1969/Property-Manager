import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('Report API', () => {
  let app: FastifyInstance;
  let authToken: string;
  let propertyId: string;
  let tmpDir: string;

  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();

    // Register user
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'report-test@example.com',
        password: 'TestPass123!',
        name: 'Report Tester',
      },
    });
    authToken = JSON.parse(registerRes.body).accessToken;

    // Create property
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Testwohnung Report',
        street: 'Berichtstr. 1',
        zip_code: '10115',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 75,
      },
    });
    propertyId = JSON.parse(propRes.body).id;

    // Create acquisition data for AfA
    await app.inject({
      method: 'PUT',
      url: `/api/v1/properties/${propertyId}/acquisition`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        purchase_price: 20000000,
        purchase_date: '2023-01-15',
        notary_cost: 300000,
        transfer_tax: 1200000,
        land_registry_cost: 100000,
        broker_cost: 700000,
        building_share: 16000000,
        land_share: 4000000,
      },
    });

    // Set AfA parameters
    await app.inject({
      method: 'PUT',
      url: `/api/v1/depreciation/${propertyId}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        afa_rate: 0.02,
        afa_start_date: '2023-02-01',
      },
    });

    // Get existing system categories for testing
    const categoriesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/categories?propertyId=${propertyId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    const categories = JSON.parse(categoriesRes.body);
    // Find an expense category that is tax deductible but not aktivierungspflichtig
    const expenseCat = categories.find((c: any) => c.type === 'expense' && c.is_tax_deductible && !c.requires_capitalization);
    const categoryId = expenseCat.id;
    // Find an income category
    const incomeCat = categories.find((c: any) => c.type === 'income');
    const incomeCategoryId = incomeCat.id;

    // Create an expense
    await app.inject({
      method: 'POST',
      url: '/api/v1/expenses',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        property_id: propertyId,
        booking_date: '2024-03-15',
        total_amount: 50000,
        counterparty: 'Handwerker',
        description: 'Reparatur Heizung',
        splits: [
          { amount: 50000, category_id: categoryId },
        ],
      },
    });

    // Create an income booking
    await app.inject({
      method: 'POST',
      url: '/api/v1/income',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        property_id: propertyId,
        booking_date: '2024-03-01',
        total_amount: 80000,
        counterparty: 'Mieter Müller',
        description: 'Miete März',
        category_id: incomeCategoryId,
      },
    });

    // Create a loan
    const loanRes = await app.inject({
      method: 'POST',
      url: '/api/v1/loans',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        property_id: propertyId,
        lender: 'Sparkasse',
        contract_number: 'KR-12345',
        loan_amount: 15000000,
        interest_rate: 3.5,
        repayment_rate: 2.0,
        start_date: '2023-01-01',
        end_date: '2033-01-01',
      },
    });
    const loanId = JSON.parse(loanRes.body).id;

    // Create a loan payment
    await app.inject({
      method: 'POST',
      url: `/api/v1/loans/${loanId}/payments`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        payment_date: '2024-03-01',
        interest_amount: 43750,
        repayment_amount: 25000,
        fee_amount: 500,
        extra_repayment: 0,
      },
    });

    // Create tenant and lease for receivables
    const tenantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        property_id: propertyId,
        first_name: 'Hans',
        last_name: 'Müller',
      },
    });
    const tenantId = JSON.parse(tenantRes.body).id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/leases',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: '2024-01-01',
        cold_rent: 80000,
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

  // ─── Authentication ────────────────────────────────────────────────────────

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/steuerlich?propertyId=${propertyId}&year=2024`,
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── Invalid type ──────────────────────────────────────────────────────────

  it('should reject invalid report type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/invalid?propertyId=${propertyId}&year=2024`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message || body.error).toContain('Ungültiger Berichtstyp');
  });

  // ─── Steuerlich Report ─────────────────────────────────────────────────────

  describe('steuerlich', () => {
    it('should generate JSON report', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.type).toBe('steuerlich');
      expect(body.year).toBe(2024);
      expect(body.propertyId).toBe(propertyId);
      expect(body.disclaimer).toBe('Hinweis: Keine rechtsverbindliche Steueraussage');
      expect(body.data.einnahmenGesamt).toBe(80000);
      expect(body.data.ausgabenGesamt).toBe(50000);
      expect(body.data.werbungskosten).toBe(50000);
      expect(body.data.darlehenszinsen).toBe(43750);
    });

    it('should generate CSV format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=${propertyId}&year=2024&format=csv`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const csv = res.body;
      expect(csv).toContain('Position,Betrag (EUR)');
      expect(csv).toContain('Einnahmen gesamt');
      expect(csv).toContain('Keine rechtsverbindliche Steueraussage');
    });

    it('should generate PDF format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=${propertyId}&year=2024&format=pdf`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      // PDF starts with %PDF
      expect(res.body.startsWith('%PDF')).toBe(true);
    });
  });

  // ─── Werbungskosten Report ─────────────────────────────────────────────────

  describe('werbungskosten', () => {
    it('should generate JSON report with separate aktivierungspflichtig', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/werbungskosten?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.type).toBe('werbungskosten');
      expect(body.disclaimer).toBe('Hinweis: Keine rechtsverbindliche Steueraussage');
      expect(body.data.werbungskosten).toBeInstanceOf(Array);
      expect(body.data.aktivierungspflichtig).toBeInstanceOf(Array);
      expect(body.data.summeWerbungskosten).toBe(50000);
      expect(body.data.summeAktivierungspflichtig).toBe(0);
    });
  });

  // ─── AfA-Plan Report ───────────────────────────────────────────────────────

  describe('afa-plan', () => {
    it('should generate AfA plan report', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/afa-plan?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.type).toBe('afa-plan');
      expect(body.data.afaBasis).toBeGreaterThan(0);
      expect(body.data.afaSatz).toBe(0.02);
      expect(body.data.plan).toBeInstanceOf(Array);
      expect(body.data.plan.length).toBeGreaterThan(0);
      expect(body.data.plan[0]).toHaveProperty('jahr');
      expect(body.data.plan[0]).toHaveProperty('jahresbetrag');
      expect(body.data.plan[0]).toHaveProperty('kumuliert');
      expect(body.data.plan[0]).toHaveProperty('restwert');
    });
  });

  // ─── Zins-/Tilgung Report ──────────────────────────────────────────────────

  describe('zins-tilgung', () => {
    it('should generate loan payment report', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/zins-tilgung?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.type).toBe('zins-tilgung');
      expect(body.data.zahlungen.length).toBe(1);
      expect(body.data.zahlungen[0].darlehensgeber).toBe('Sparkasse');
      expect(body.data.zahlungen[0].zinsen).toBe(43750);
      expect(body.data.zahlungen[0].tilgung).toBe(25000);
      expect(body.data.zahlungen[0].gebuehren).toBe(500);
      expect(body.data.summeZinsen).toBe(43750);
      expect(body.data.summeTilgung).toBe(25000);
      expect(body.data.summeGebuehren).toBe(500);
    });
  });

  // ─── Mieteingänge Report ───────────────────────────────────────────────────

  describe('mieteingaenge', () => {
    it('should generate receivables report', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/mieteingaenge?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.type).toBe('mieteingaenge');
      expect(body.disclaimer).toBe('Hinweis: Keine rechtsverbindliche Steueraussage');
      expect(body.data.sollstellungen).toBeInstanceOf(Array);
      expect(body.data).toHaveProperty('summeGesamt');
      expect(body.data).toHaveProperty('summeBezahlt');
      expect(body.data).toHaveProperty('summeOffen');
    });
  });

  // ─── Belegvollständigkeit Report ───────────────────────────────────────────

  describe('belegvollstaendigkeit', () => {
    it('should generate document completeness report', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/belegvollstaendigkeit?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.type).toBe('belegvollstaendigkeit');
      expect(body.data.buchungen).toBeInstanceOf(Array);
      expect(body.data.buchungen.length).toBeGreaterThan(0);
      expect(body.data).toHaveProperty('mitBeleg');
      expect(body.data).toHaveProperty('ohneBeleg');
      expect(body.data).toHaveProperty('vollstaendigkeitQuote');
      // All bookings have no documents linked
      expect(body.data.ohneBeleg).toBe(body.data.buchungen.length);
      expect(body.data.mitBeleg).toBe(0);
    });
  });

  // ─── Empty period handling ─────────────────────────────────────────────────

  describe('empty period', () => {
    it('should return report with zero values and hint for empty period', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=${propertyId}&year=2020`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.hint).toBe('Keine Daten für den gewählten Zeitraum vorhanden');
      expect(body.data.einnahmenGesamt).toBe(0);
      expect(body.data.ausgabenGesamt).toBe(0);
    });

    it('should return empty zins-tilgung report with hint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/zins-tilgung?propertyId=${propertyId}&year=2020`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.hint).toBe('Keine Daten für den gewählten Zeitraum vorhanden');
      expect(body.data.zahlungen).toHaveLength(0);
      expect(body.data.summeZinsen).toBe(0);
    });
  });

  // ─── Property + year filter ────────────────────────────────────────────────

  describe('property and year filter', () => {
    it('should return 404 for non-owned property', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=non-existent&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should require propertyId parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should require year parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should filter data by year correctly', async () => {
      // Year 2024 should have data, year 2025 should not
      const res2024 = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=${propertyId}&year=2024`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      const res2025 = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=${propertyId}&year=2025`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      const body2024 = JSON.parse(res2024.body);
      const body2025 = JSON.parse(res2025.body);

      expect(body2024.data.einnahmenGesamt).toBe(80000);
      expect(body2025.data.einnahmenGesamt).toBe(0);
      expect(body2025.hint).toBe('Keine Daten für den gewählten Zeitraum vorhanden');
    });
  });

  // ─── CSV Format Validation ─────────────────────────────────────────────────

  describe('CSV format validation', () => {
    it('should produce valid CSV with headers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/zins-tilgung?propertyId=${propertyId}&year=2024&format=csv`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const lines = res.body.split('\n');
      // First line is headers
      expect(lines[0]).toContain('Datum');
      expect(lines[0]).toContain('Darlehensgeber');
      expect(lines[0]).toContain('Zinsen (EUR)');
      // Data row
      expect(lines[1]).toContain('Sparkasse');
      expect(lines[1]).toContain('2024-03-01');
    });

    it('should include disclaimer in CSV', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/steuerlich?propertyId=${propertyId}&year=2024&format=csv`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.body).toContain('Keine rechtsverbindliche Steueraussage');
    });
  });
});
