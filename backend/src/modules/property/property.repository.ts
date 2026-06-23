import type Database from 'better-sqlite3';
import type { CreatePropertyInput, UpdatePropertyInput } from './property.validators.js';

export interface PropertyRecord {
  id: string;
  user_id: string;
  name: string;
  street: string;
  zip_code: string;
  city: string;
  property_type: string;
  living_area_sqm: number;
  created_at: string;
  updated_at: string;
}

export class PropertyRepository {
  constructor(private db: Database.Database) {}

  findAllByUserId(userId: string): PropertyRecord[] {
    return this.db
      .prepare('SELECT * FROM properties WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as PropertyRecord[];
  }

  findById(id: string, userId: string): PropertyRecord | undefined {
    return this.db
      .prepare('SELECT * FROM properties WHERE id = ? AND user_id = ?')
      .get(id, userId) as PropertyRecord | undefined;
  }

  countByUserId(userId: string): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM properties WHERE user_id = ?')
      .get(userId) as { count: number };
    return result.count;
  }

  create(id: string, userId: string, input: CreatePropertyInput, now: string): PropertyRecord {
    this.db
      .prepare(
        `INSERT INTO properties (id, user_id, name, street, zip_code, city, property_type, living_area_sqm, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, userId, input.name, input.street, input.zip_code, input.city, input.property_type, input.living_area_sqm, now, now);

    return this.findById(id, userId)!;
  }

  update(id: string, userId: string, input: UpdatePropertyInput, now: string): PropertyRecord | undefined {
    const result = this.db
      .prepare(
        `UPDATE properties SET name = ?, street = ?, zip_code = ?, city = ?, property_type = ?, living_area_sqm = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(input.name, input.street, input.zip_code, input.city, input.property_type, input.living_area_sqm, now, id, userId);

    if (result.changes === 0) {
      return undefined;
    }

    return this.findById(id, userId);
  }

  delete(id: string, userId: string): boolean {
    const result = this.db
      .prepare('DELETE FROM properties WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return result.changes > 0;
  }

  hasBookings(propertyId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM bookings WHERE property_id = ?')
      .get(propertyId) as { count: number };
    return result.count > 0;
  }

  hasLeases(propertyId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM leases WHERE property_id = ?')
      .get(propertyId) as { count: number };
    return result.count > 0;
  }

  hasLoans(propertyId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM loans WHERE property_id = ?')
      .get(propertyId) as { count: number };
    return result.count > 0;
  }
}
