import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  determineStatus,
  determineStatusWithCredit,
  updateReceivableStatus,
  markOverdueReceivables,
} from './receivable-status.service.js';

describe('determineStatus (pure function)', () => {
  describe('offen', () => {
    it('should return "offen" when paid_amount == 0 and current_date <= due_date', () => {
      expect(determineStatus(100000, 0, '2024-06-15', '2024-06-15')).toBe('offen');
    });

    it('should return "offen" when paid_amount == 0 and current_date < due_date', () => {
      expect(determineStatus(100000, 0, '2024-06-15', '2024-06-10')).toBe('offen');
    });
  });

  describe('bezahlt', () => {
    it('should return "bezahlt" when paid_amount == total_amount', () => {
      expect(determineStatus(100000, 100000, '2024-06-15', '2024-06-10')).toBe('bezahlt');
    });

    it('should return "bezahlt" when paid_amount > total_amount (overpayment)', () => {
      expect(determineStatus(100000, 150000, '2024-06-15', '2024-06-10')).toBe('bezahlt');
    });

    it('should return "bezahlt" even after due_date when paid_amount >= total_amount', () => {
      expect(determineStatus(100000, 100000, '2024-06-15', '2024-06-20')).toBe('bezahlt');
    });
  });

  describe('teilbezahlt', () => {
    it('should return "teilbezahlt" when 0 < paid_amount < total_amount and on due_date', () => {
      expect(determineStatus(100000, 50000, '2024-06-15', '2024-06-15')).toBe('teilbezahlt');
    });

    it('should return "teilbezahlt" when partially paid before due_date', () => {
      expect(determineStatus(100000, 1, '2024-06-15', '2024-06-10')).toBe('teilbezahlt');
    });

    it('should return "teilbezahlt" for payment of 1 cent before due_date', () => {
      expect(determineStatus(100000, 1, '2024-06-15', '2024-06-14')).toBe('teilbezahlt');
    });
  });

  describe('überfällig', () => {
    it('should return "überfällig" when paid_amount == 0 and current_date > due_date', () => {
      expect(determineStatus(100000, 0, '2024-06-15', '2024-06-16')).toBe('überfällig');
    });

    it('should return "überfällig" when partially paid and current_date > due_date', () => {
      expect(determineStatus(100000, 50000, '2024-06-15', '2024-06-16')).toBe('überfällig');
    });

    it('should return "überfällig" when paid_amount == total_amount - 1 and overdue', () => {
      expect(determineStatus(100000, 99999, '2024-06-15', '2024-06-16')).toBe('überfällig');
    });
  });

  describe('boundary conditions', () => {
    it('on due_date with no payment: "offen"', () => {
      expect(determineStatus(100000, 0, '2024-06-15', '2024-06-15')).toBe('offen');
    });

    it('day after due_date with no payment: "überfällig"', () => {
      expect(determineStatus(100000, 0, '2024-06-15', '2024-06-16')).toBe('überfällig');
    });

    it('on due_date with exact payment: "bezahlt"', () => {
      expect(determineStatus(100000, 100000, '2024-06-15', '2024-06-15')).toBe('bezahlt');
    });

    it('total_amount = 1 cent, paid_amount = 1 cent: "bezahlt"', () => {
      expect(determineStatus(1, 1, '2024-06-15', '2024-06-15')).toBe('bezahlt');
    });
  });
});

describe('determineStatusWithCredit', () => {
  it('should return no excessCredit when paid_amount <= total_amount', () => {
    const result = determineStatusWithCredit(100000, 100000, '2024-06-15', '2024-06-10');
    expect(result.status).toBe('bezahlt');
    expect(result.excessCredit).toBeUndefined();
  });

  it('should return excessCredit when paid_amount > total_amount', () => {
    const result = determineStatusWithCredit(100000, 150000, '2024-06-15', '2024-06-10');
    expect(result.status).toBe('bezahlt');
    expect(result.excessCredit).toBe(50000);
  });

  it('should return excessCredit of 1 cent on minimal overpayment', () => {
    const result = determineStatusWithCredit(100000, 100001, '2024-06-15', '2024-06-10');
    expect(result.status).toBe('bezahlt');
    expect(result.excessCredit).toBe(1);
  });

  it('should not return excessCredit when underpaid', () => {
    const result = determineStatusWithCredit(100000, 50000, '2024-06-15', '2024-06-10');
    expect(result.status).toBe('teilbezahlt');
    expect(result.excessCredit).toBeUndefined();
  });
});

describe('updateReceivableStatus (DB integration)', () => {
  let db: Database.Database;
  const receivableId = uuidv4();
  const leaseId = uuidv4();
  const propertyId = uuidv4();

  beforeAll(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE receivables (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        due_date TEXT NOT NULL,
        cold_rent INTEGER NOT NULL,
        operating_cost INTEGER NOT NULL,
        heating_cost INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        paid_amount INTEGER DEFAULT 0,
        status TEXT NOT NULL
      )
    `);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec('DELETE FROM receivables');
  });

  function insertReceivable(overrides: Record<string, unknown> = {}) {
    const id = (overrides.id as string) ?? receivableId;
    const defaults = {
      lease_id: leaseId,
      property_id: propertyId,
      due_date: '2024-06-15',
      cold_rent: 80000,
      operating_cost: 15000,
      heating_cost: 5000,
      total_amount: 100000,
      paid_amount: 0,
      status: 'offen',
    };
    const data = { ...defaults, ...overrides };
    db.prepare(
      `INSERT INTO receivables (id, lease_id, property_id, due_date, cold_rent, operating_cost, heating_cost, total_amount, paid_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.lease_id,
      data.property_id,
      data.due_date,
      data.cold_rent,
      data.operating_cost,
      data.heating_cost,
      data.total_amount,
      data.paid_amount,
      data.status
    );
    return id;
  }

  it('should update status to "offen" when no payment and before due_date', () => {
    insertReceivable({ status: 'offen', paid_amount: 0 });
    const result = updateReceivableStatus(db, receivableId, '2024-06-10');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('offen');

    const row = db.prepare('SELECT status FROM receivables WHERE id = ?').get(receivableId) as { status: string };
    expect(row.status).toBe('offen');
  });

  it('should update status to "bezahlt" when fully paid', () => {
    insertReceivable({ paid_amount: 100000 });
    const result = updateReceivableStatus(db, receivableId, '2024-06-10');
    expect(result!.status).toBe('bezahlt');

    const row = db.prepare('SELECT status FROM receivables WHERE id = ?').get(receivableId) as { status: string };
    expect(row.status).toBe('bezahlt');
  });

  it('should update status to "teilbezahlt" when partially paid before due_date', () => {
    insertReceivable({ paid_amount: 50000 });
    const result = updateReceivableStatus(db, receivableId, '2024-06-10');
    expect(result!.status).toBe('teilbezahlt');

    const row = db.prepare('SELECT status FROM receivables WHERE id = ?').get(receivableId) as { status: string };
    expect(row.status).toBe('teilbezahlt');
  });

  it('should update status to "überfällig" when unpaid after due_date', () => {
    insertReceivable({ paid_amount: 0 });
    const result = updateReceivableStatus(db, receivableId, '2024-06-16');
    expect(result!.status).toBe('überfällig');

    const row = db.prepare('SELECT status FROM receivables WHERE id = ?').get(receivableId) as { status: string };
    expect(row.status).toBe('überfällig');
  });

  it('should return excessCredit on overpayment', () => {
    insertReceivable({ paid_amount: 120000 });
    const result = updateReceivableStatus(db, receivableId, '2024-06-10');
    expect(result!.status).toBe('bezahlt');
    expect(result!.excessCredit).toBe(20000);
  });

  it('should return null for non-existent receivable', () => {
    const result = updateReceivableStatus(db, 'non-existent-id', '2024-06-10');
    expect(result).toBeNull();
  });

  it('should not update status of cancelled receivables', () => {
    insertReceivable({ status: 'storniert', paid_amount: 0 });
    const result = updateReceivableStatus(db, receivableId, '2024-06-16');
    expect(result!.status).toBe('storniert');

    const row = db.prepare('SELECT status FROM receivables WHERE id = ?').get(receivableId) as { status: string };
    expect(row.status).toBe('storniert');
  });
});

describe('markOverdueReceivables (batch update)', () => {
  let db: Database.Database;
  const leaseId = uuidv4();
  const propertyId = uuidv4();

  beforeAll(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE receivables (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        due_date TEXT NOT NULL,
        cold_rent INTEGER NOT NULL,
        operating_cost INTEGER NOT NULL,
        heating_cost INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        paid_amount INTEGER DEFAULT 0,
        status TEXT NOT NULL
      )
    `);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec('DELETE FROM receivables');
  });

  function insertReceivable(dueDate: string, paidAmount: number, status: string) {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO receivables (id, lease_id, property_id, due_date, cold_rent, operating_cost, heating_cost, total_amount, paid_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, leaseId, propertyId, dueDate, 80000, 15000, 5000, 100000, paidAmount, status);
    return id;
  }

  it('should mark unpaid past-due receivables as "überfällig"', () => {
    insertReceivable('2024-06-01', 0, 'offen');
    insertReceivable('2024-06-10', 0, 'offen');

    const count = markOverdueReceivables(db, '2024-06-15');
    expect(count).toBe(2);

    const rows = db.prepare('SELECT status FROM receivables').all() as { status: string }[];
    for (const row of rows) {
      expect(row.status).toBe('überfällig');
    }
  });

  it('should mark partially paid past-due receivables as "überfällig"', () => {
    insertReceivable('2024-06-01', 50000, 'teilbezahlt');

    const count = markOverdueReceivables(db, '2024-06-15');
    expect(count).toBe(1);

    const row = db.prepare('SELECT status FROM receivables').get() as { status: string };
    expect(row.status).toBe('überfällig');
  });

  it('should NOT mark fully paid receivables as "überfällig"', () => {
    insertReceivable('2024-06-01', 100000, 'bezahlt');

    const count = markOverdueReceivables(db, '2024-06-15');
    expect(count).toBe(0);

    const row = db.prepare('SELECT status FROM receivables').get() as { status: string };
    expect(row.status).toBe('bezahlt');
  });

  it('should NOT mark cancelled receivables as "überfällig"', () => {
    insertReceivable('2024-06-01', 0, 'storniert');

    const count = markOverdueReceivables(db, '2024-06-15');
    expect(count).toBe(0);

    const row = db.prepare('SELECT status FROM receivables').get() as { status: string };
    expect(row.status).toBe('storniert');
  });

  it('should NOT mark receivables that are not yet due', () => {
    insertReceivable('2024-06-20', 0, 'offen');

    const count = markOverdueReceivables(db, '2024-06-15');
    expect(count).toBe(0);

    const row = db.prepare('SELECT status FROM receivables').get() as { status: string };
    expect(row.status).toBe('offen');
  });

  it('should NOT mark receivables already marked as "überfällig"', () => {
    insertReceivable('2024-06-01', 0, 'überfällig');

    const count = markOverdueReceivables(db, '2024-06-15');
    expect(count).toBe(0);
  });

  it('should handle mixed scenarios correctly', () => {
    insertReceivable('2024-06-01', 0, 'offen'); // should become überfällig
    insertReceivable('2024-06-01', 100000, 'bezahlt'); // should stay bezahlt
    insertReceivable('2024-06-01', 0, 'storniert'); // should stay storniert
    insertReceivable('2024-06-20', 0, 'offen'); // not yet due, should stay offen
    insertReceivable('2024-06-10', 30000, 'teilbezahlt'); // should become überfällig

    const count = markOverdueReceivables(db, '2024-06-15');
    expect(count).toBe(2); // only the 'offen' with 2024-06-01 and 'teilbezahlt' with 2024-06-10
  });

  it('should not change receivables due on the current date (boundary)', () => {
    insertReceivable('2024-06-15', 0, 'offen');

    const count = markOverdueReceivables(db, '2024-06-15');
    expect(count).toBe(0);

    const row = db.prepare('SELECT status FROM receivables').get() as { status: string };
    expect(row.status).toBe('offen');
  });
});
