import type Database from 'better-sqlite3';
import type { CreateTenantInput, UpdateTenantInput } from './tenant.validators.js';

export interface TenantRecord {
  id: string;
  property_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export class TenantRepository {
  constructor(private db: Database.Database) {}

  findAllByUserId(userId: string, propertyId?: string): TenantRecord[] {
    if (propertyId) {
      return this.db
        .prepare(
          `SELECT t.* FROM tenants t
           JOIN properties p ON t.property_id = p.id
           WHERE p.user_id = ? AND t.property_id = ?
           ORDER BY t.created_at DESC`
        )
        .all(userId, propertyId) as TenantRecord[];
    }
    return this.db
      .prepare(
        `SELECT t.* FROM tenants t
         JOIN properties p ON t.property_id = p.id
         WHERE p.user_id = ?
         ORDER BY t.created_at DESC`
      )
      .all(userId) as TenantRecord[];
  }

  findById(id: string, userId: string): TenantRecord | undefined {
    return this.db
      .prepare(
        `SELECT t.* FROM tenants t
         JOIN properties p ON t.property_id = p.id
         WHERE t.id = ? AND p.user_id = ?`
      )
      .get(id, userId) as TenantRecord | undefined;
  }

  propertyBelongsToUser(propertyId: string, userId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM properties WHERE id = ? AND user_id = ?')
      .get(propertyId, userId) as { count: number };
    return result.count > 0;
  }

  create(id: string, input: CreateTenantInput, now: string): TenantRecord {
    this.db
      .prepare(
        `INSERT INTO tenants (id, property_id, first_name, last_name, email, phone, address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.property_id,
        input.first_name,
        input.last_name,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        now,
        now
      );

    return this.db
      .prepare('SELECT * FROM tenants WHERE id = ?')
      .get(id) as TenantRecord;
  }

  update(id: string, userId: string, input: UpdateTenantInput, now: string): TenantRecord | undefined {
    // First verify the tenant belongs to the user
    const tenant = this.findById(id, userId);
    if (!tenant) {
      return undefined;
    }

    this.db
      .prepare(
        `UPDATE tenants SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.first_name,
        input.last_name,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        now,
        id
      );

    return this.db
      .prepare('SELECT * FROM tenants WHERE id = ?')
      .get(id) as TenantRecord;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM tenants WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  hasActiveLease(tenantId: string): boolean {
    const result = this.db
      .prepare("SELECT COUNT(*) as count FROM leases WHERE tenant_id = ? AND status = 'aktiv'")
      .get(tenantId) as { count: number };
    return result.count > 0;
  }
}
