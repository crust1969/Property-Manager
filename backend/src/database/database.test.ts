import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate.js';
import { seedCategories, STANDARD_CATEGORIES } from './seed.js';

describe('Database Migration System', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  it('should create _migrations tracking table', () => {
    runMigrations(db);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('should apply 001_initial_schema migration', () => {
    runMigrations(db);

    const migrations = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
    expect(migrations.map(m => m.name)).toContain('001_initial_schema.sql');
  });

  it('should create all required tables', () => {
    runMigrations(db);

    const expectedTables = [
      'users', 'properties', 'acquisitions', 'tenants', 'leases',
      'receivables', 'deposits', 'categories', 'bookings', 'booking_splits',
      'loans', 'loan_payments', 'documents', 'document_links',
      'reminders', 'audit_log', 'utility_billings', 'utility_billing_items',
    ];

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\__%' ESCAPE '\\'"
    ).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);

    for (const expected of expectedTables) {
      expect(tableNames, `Table '${expected}' should exist`).toContain(expected);
    }
  });

  it('should be idempotent - running migrations twice has no effect', () => {
    runMigrations(db);
    runMigrations(db);

    const migrations = db.prepare('SELECT name FROM _migrations').all();
    expect(migrations).toHaveLength(2);
  });

  it('should enforce foreign keys', () => {
    runMigrations(db);

    // Trying to insert a property with non-existent user_id should fail
    expect(() => {
      db.prepare(`
        INSERT INTO properties (id, user_id, name, street, zip_code, city, property_type, living_area_sqm, created_at, updated_at)
        VALUES ('p1', 'non-existent-user', 'Test', 'Str 1', '12345', 'Berlin', 'Wohnung', 50.0, '2024-01-01', '2024-01-01')
      `).run();
    }).toThrow();
  });

  it('should enforce CHECK constraints on properties table', () => {
    runMigrations(db);

    // Insert a valid user first
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
      VALUES ('u1', 'test@test.de', 'hash', 'Test User', '2024-01-01', '2024-01-01')
    `).run();

    // Invalid zip_code (not 5 digits)
    expect(() => {
      db.prepare(`
        INSERT INTO properties (id, user_id, name, street, zip_code, city, property_type, living_area_sqm, created_at, updated_at)
        VALUES ('p1', 'u1', 'Test', 'Str 1', '1234', 'Berlin', 'Wohnung', 50.0, '2024-01-01', '2024-01-01')
      `).run();
    }).toThrow();

    // Invalid property_type
    expect(() => {
      db.prepare(`
        INSERT INTO properties (id, user_id, name, street, zip_code, city, property_type, living_area_sqm, created_at, updated_at)
        VALUES ('p2', 'u1', 'Test', 'Str 1', '12345', 'Berlin', 'Villa', 50.0, '2024-01-01', '2024-01-01')
      `).run();
    }).toThrow();
  });
});

describe('Database Seed - Standardkategorien', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should seed all standard categories', () => {
    seedCategories(db);

    const count = db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number };
    expect(count.cnt).toBe(STANDARD_CATEGORIES.length);
  });

  it('should mark all seeded categories as system categories', () => {
    seedCategories(db);

    const nonSystem = db.prepare('SELECT COUNT(*) as cnt FROM categories WHERE is_system = 0').get() as { cnt: number };
    expect(nonSystem.cnt).toBe(0);
  });

  it('should have NULL property_id and user_id for system categories', () => {
    seedCategories(db);

    const withPropertyId = db.prepare('SELECT COUNT(*) as cnt FROM categories WHERE property_id IS NOT NULL').get() as { cnt: number };
    const withUserId = db.prepare('SELECT COUNT(*) as cnt FROM categories WHERE user_id IS NOT NULL').get() as { cnt: number };
    expect(withPropertyId.cnt).toBe(0);
    expect(withUserId.cnt).toBe(0);
  });

  it('should be idempotent - seeding twice does not duplicate categories', () => {
    seedCategories(db);
    seedCategories(db);

    const count = db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number };
    expect(count.cnt).toBe(STANDARD_CATEGORIES.length);
  });

  it('should have correct flags for umlagefähige Betriebskosten', () => {
    seedCategories(db);

    const grundsteuer = db.prepare(
      "SELECT * FROM categories WHERE name = 'Grundsteuer'"
    ).get() as any;

    expect(grundsteuer.is_allocable).toBe(1);
    expect(grundsteuer.is_tax_deductible).toBe(1);
    expect(grundsteuer.requires_capitalization).toBe(0);
    expect(grundsteuer.is_financing_related).toBe(0);
  });

  it('should have correct flags for aktivierungspflichtige Ausgaben', () => {
    seedCategories(db);

    const modernisierung = db.prepare(
      "SELECT * FROM categories WHERE name = 'Modernisierung'"
    ).get() as any;

    expect(modernisierung.is_allocable).toBe(0);
    expect(modernisierung.is_tax_deductible).toBe(0);
    expect(modernisierung.requires_capitalization).toBe(1);
    expect(modernisierung.is_financing_related).toBe(0);
  });

  it('should have correct flags for Finanzierungskosten', () => {
    seedCategories(db);

    const zinsen = db.prepare(
      "SELECT * FROM categories WHERE name = 'Darlehenszinsen'"
    ).get() as any;

    expect(zinsen.is_allocable).toBe(0);
    expect(zinsen.is_tax_deductible).toBe(1);
    expect(zinsen.requires_capitalization).toBe(0);
    expect(zinsen.is_financing_related).toBe(1);
  });

  it('should have correct flags for Tilgung (not tax deductible)', () => {
    seedCategories(db);

    const tilgung = db.prepare(
      "SELECT * FROM categories WHERE name = 'Tilgung'"
    ).get() as any;

    expect(tilgung.is_allocable).toBe(0);
    expect(tilgung.is_tax_deductible).toBe(0);
    expect(tilgung.requires_capitalization).toBe(0);
    expect(tilgung.is_financing_related).toBe(1);
  });

  it('should have both income and expense categories', () => {
    seedCategories(db);

    const income = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE type = 'income'").get() as { cnt: number };
    const expense = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE type = 'expense'").get() as { cnt: number };

    expect(income.cnt).toBeGreaterThan(0);
    expect(expense.cnt).toBeGreaterThan(0);
    expect(income.cnt + expense.cnt).toBe(STANDARD_CATEGORIES.length);
  });
});
