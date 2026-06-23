import type Database from 'better-sqlite3';
import type { CreateLeaseInput, UpdateLeaseInput } from './lease.validators.js';

export interface LeaseRecord {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  cold_rent: number;
  operating_cost_advance: number;
  heating_cost_advance: number;
  due_day: number;
  rent_model: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReceivableRecord {
  id: string;
  lease_id: string;
  property_id: string;
  due_date: string;
  cold_rent: number;
  operating_cost: number;
  heating_cost: number;
  total_amount: number;
  paid_amount: number;
  status: string;
}

export class LeaseRepository {
  constructor(private db: Database.Database) {}

  findAllByUserId(userId: string, propertyId?: string): LeaseRecord[] {
    if (propertyId) {
      return this.db
        .prepare(
          `SELECT l.* FROM leases l
           JOIN properties p ON l.property_id = p.id
           WHERE p.user_id = ? AND l.property_id = ?
           ORDER BY l.created_at DESC`
        )
        .all(userId, propertyId) as LeaseRecord[];
    }
    return this.db
      .prepare(
        `SELECT l.* FROM leases l
         JOIN properties p ON l.property_id = p.id
         WHERE p.user_id = ?
         ORDER BY l.created_at DESC`
      )
      .all(userId) as LeaseRecord[];
  }

  findById(id: string, userId: string): LeaseRecord | undefined {
    return this.db
      .prepare(
        `SELECT l.* FROM leases l
         JOIN properties p ON l.property_id = p.id
         WHERE l.id = ? AND p.user_id = ?`
      )
      .get(id, userId) as LeaseRecord | undefined;
  }

  findByIdInternal(id: string): LeaseRecord | undefined {
    return this.db
      .prepare('SELECT * FROM leases WHERE id = ?')
      .get(id) as LeaseRecord | undefined;
  }

  create(id: string, input: CreateLeaseInput, now: string): LeaseRecord {
    this.db
      .prepare(
        `INSERT INTO leases (id, property_id, tenant_id, start_date, end_date, cold_rent, operating_cost_advance, heating_cost_advance, due_day, rent_model, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv', ?, ?)`
      )
      .run(
        id,
        input.property_id,
        input.tenant_id,
        input.start_date,
        input.end_date ?? null,
        input.cold_rent,
        input.operating_cost_advance,
        input.heating_cost_advance,
        input.due_day,
        input.rent_model,
        now,
        now
      );

    return this.findByIdInternal(id)!;
  }

  update(id: string, input: UpdateLeaseInput, now: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE leases SET property_id = ?, tenant_id = ?, start_date = ?, end_date = ?, cold_rent = ?, operating_cost_advance = ?, heating_cost_advance = ?, due_day = ?, rent_model = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.property_id,
        input.tenant_id,
        input.start_date,
        input.end_date ?? null,
        input.cold_rent,
        input.operating_cost_advance,
        input.heating_cost_advance,
        input.due_day,
        input.rent_model,
        now,
        id
      );

    return result.changes > 0;
  }

  terminate(id: string, endDate: string, now: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE leases SET status = 'beendet', end_date = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(endDate, now, id);

    return result.changes > 0;
  }

  // Receivables

  findReceivablesByLeaseId(leaseId: string): ReceivableRecord[] {
    return this.db
      .prepare('SELECT * FROM receivables WHERE lease_id = ? ORDER BY due_date ASC')
      .all(leaseId) as ReceivableRecord[];
  }

  createReceivable(receivable: ReceivableRecord): void {
    this.db
      .prepare(
        `INSERT INTO receivables (id, lease_id, property_id, due_date, cold_rent, operating_cost, heating_cost, total_amount, paid_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        receivable.id,
        receivable.lease_id,
        receivable.property_id,
        receivable.due_date,
        receivable.cold_rent,
        receivable.operating_cost,
        receivable.heating_cost,
        receivable.total_amount,
        receivable.paid_amount,
        receivable.status
      );
  }

  cancelReceivablesAfterDate(leaseId: string, endDate: string): number {
    const result = this.db
      .prepare(
        `UPDATE receivables SET status = 'storniert'
         WHERE lease_id = ? AND due_date > ? AND status != 'storniert'`
      )
      .run(leaseId, endDate);

    return result.changes;
  }

  findExistingReceivableDates(leaseId: string): string[] {
    const rows = this.db
      .prepare('SELECT due_date FROM receivables WHERE lease_id = ? AND status != ?')
      .all(leaseId, 'storniert') as { due_date: string }[];
    return rows.map((r) => r.due_date);
  }

  // Helpers for validation
  propertyBelongsToUser(propertyId: string, userId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM properties WHERE id = ? AND user_id = ?')
      .get(propertyId, userId) as { count: number };
    return result.count > 0;
  }

  tenantExists(tenantId: string, propertyId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM tenants WHERE id = ? AND property_id = ?')
      .get(tenantId, propertyId) as { count: number };
    return result.count > 0;
  }
}
