import type Database from 'better-sqlite3';

export interface DepositRecord {
  id: string;
  lease_id: string;
  property_id: string;
  amount: number;
  received_date: string;
  account_reference: string;
  status: string;
  refunded_amount: number;
  created_at: string;
}

export class DepositRepository {
  constructor(private db: Database.Database) {}

  findAllByLeaseId(leaseId: string, userId: string): DepositRecord[] {
    return this.db
      .prepare(
        `SELECT d.* FROM deposits d
         JOIN leases l ON d.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         WHERE d.lease_id = ? AND p.user_id = ?
         ORDER BY d.created_at DESC`
      )
      .all(leaseId, userId) as DepositRecord[];
  }

  findAllByUserId(userId: string): DepositRecord[] {
    return this.db
      .prepare(
        `SELECT d.* FROM deposits d
         JOIN leases l ON d.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         WHERE p.user_id = ?
         ORDER BY d.created_at DESC`
      )
      .all(userId) as DepositRecord[];
  }

  findById(id: string, userId: string): DepositRecord | undefined {
    return this.db
      .prepare(
        `SELECT d.* FROM deposits d
         JOIN leases l ON d.lease_id = l.id
         JOIN properties p ON l.property_id = p.id
         WHERE d.id = ? AND p.user_id = ?`
      )
      .get(id, userId) as DepositRecord | undefined;
  }

  findByIdInternal(id: string): DepositRecord | undefined {
    return this.db
      .prepare('SELECT * FROM deposits WHERE id = ?')
      .get(id) as DepositRecord | undefined;
  }

  create(deposit: DepositRecord): void {
    this.db
      .prepare(
        `INSERT INTO deposits (id, lease_id, property_id, amount, received_date, account_reference, status, refunded_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        deposit.id,
        deposit.lease_id,
        deposit.property_id,
        deposit.amount,
        deposit.received_date,
        deposit.account_reference,
        deposit.status,
        deposit.refunded_amount,
        deposit.created_at
      );
  }

  updateStatusAndRefund(id: string, status: string, refundedAmount: number): boolean {
    const result = this.db
      .prepare(
        `UPDATE deposits SET status = ?, refunded_amount = ? WHERE id = ?`
      )
      .run(status, refundedAmount, id);
    return result.changes > 0;
  }

  // Helpers for validation
  leaseExists(leaseId: string, userId: string): { exists: boolean; propertyId: string | null } {
    const result = this.db
      .prepare(
        `SELECT l.property_id FROM leases l
         JOIN properties p ON l.property_id = p.id
         WHERE l.id = ? AND p.user_id = ?`
      )
      .get(leaseId, userId) as { property_id: string } | undefined;

    return {
      exists: !!result,
      propertyId: result?.property_id ?? null,
    };
  }
}
