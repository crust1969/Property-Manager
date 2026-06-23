import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface AfaPositionRecord {
  id: string;
  property_id: string;
  name: string;
  method: 'linear' | 'degressiv';
  basis: number;        // cents
  rate: number;         // decimal (0.02 = 2%)
  duration_years: number | null;
  start_date: string;   // ISO YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface CreatePositionInput {
  property_id: string;
  name: string;
  method: 'linear' | 'degressiv';
  basis: number;
  rate: number;
  duration_years: number | null;
  start_date: string;
}

export interface UpdatePositionInput {
  name?: string;
  method?: 'linear' | 'degressiv';
  basis?: number;
  rate?: number;
  duration_years?: number | null;
  start_date?: string;
}

export class PositionRepository {
  constructor(private db: Database.Database) {}

  findAllByPropertyId(propertyId: string): AfaPositionRecord[] {
    return this.db
      .prepare('SELECT * FROM afa_positions WHERE property_id = ? ORDER BY created_at ASC')
      .all(propertyId) as AfaPositionRecord[];
  }

  findById(id: string): AfaPositionRecord | undefined {
    return this.db
      .prepare('SELECT * FROM afa_positions WHERE id = ?')
      .get(id) as AfaPositionRecord | undefined;
  }

  countByPropertyId(propertyId: string): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM afa_positions WHERE property_id = ?')
      .get(propertyId) as { count: number };
    return result.count;
  }

  nameExistsForProperty(propertyId: string, name: string, excludeId?: string): boolean {
    if (excludeId) {
      const result = this.db
        .prepare('SELECT COUNT(*) as count FROM afa_positions WHERE property_id = ? AND name = ? AND id != ?')
        .get(propertyId, name, excludeId) as { count: number };
      return result.count > 0;
    }
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM afa_positions WHERE property_id = ? AND name = ?')
      .get(propertyId, name) as { count: number };
    return result.count > 0;
  }

  create(input: CreatePositionInput): AfaPositionRecord {
    const now = new Date().toISOString();
    const id = uuidv4();

    this.db
      .prepare(
        `INSERT INTO afa_positions (id, property_id, name, method, basis, rate, duration_years, start_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.property_id,
        input.name,
        input.method,
        input.basis,
        input.rate,
        input.duration_years,
        input.start_date,
        now,
        now
      );

    return {
      id,
      property_id: input.property_id,
      name: input.name,
      method: input.method,
      basis: input.basis,
      rate: input.rate,
      duration_years: input.duration_years,
      start_date: input.start_date,
      created_at: now,
      updated_at: now,
    };
  }

  update(id: string, input: UpdatePositionInput): AfaPositionRecord {
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.method !== undefined) {
      fields.push('method = ?');
      values.push(input.method);
    }
    if (input.basis !== undefined) {
      fields.push('basis = ?');
      values.push(input.basis);
    }
    if (input.rate !== undefined) {
      fields.push('rate = ?');
      values.push(input.rate);
    }
    if (input.duration_years !== undefined) {
      fields.push('duration_years = ?');
      values.push(input.duration_years);
    }
    if (input.start_date !== undefined) {
      fields.push('start_date = ?');
      values.push(input.start_date);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE afa_positions SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db
      .prepare('DELETE FROM afa_positions WHERE id = ?')
      .run(id);
  }
}
