import type Database from 'better-sqlite3';

export interface ReminderRecord {
  id: string;
  user_id: string;
  property_id: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  title: string;
  note: string | null;
  due_date: string;
  priority: string;
  status: string;
  recurrence: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderFilters {
  propertyId?: string;
  status?: string;
}

export class ReminderRepository {
  constructor(private db: Database.Database) {}

  findAll(userId: string, filters: ReminderFilters): ReminderRecord[] {
    let query = `SELECT * FROM reminders WHERE user_id = ?`;
    const params: unknown[] = [userId];

    if (filters.propertyId) {
      query += ` AND property_id = ?`;
      params.push(filters.propertyId);
    }

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    // Order: overdue first (due_date < today and status offen), then by due_date ascending
    query += ` ORDER BY
      CASE WHEN status = 'offen' AND due_date < date('now') THEN 0 ELSE 1 END,
      due_date ASC`;

    return this.db.prepare(query).all(...params) as ReminderRecord[];
  }

  findById(id: string, userId: string): ReminderRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM reminders WHERE id = ? AND user_id = ?`)
      .get(id, userId) as ReminderRecord | undefined;
  }

  create(reminder: ReminderRecord): void {
    this.db
      .prepare(
        `INSERT INTO reminders (id, user_id, property_id, linked_entity_type, linked_entity_id, title, note, due_date, priority, status, recurrence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        reminder.id,
        reminder.user_id,
        reminder.property_id,
        reminder.linked_entity_type,
        reminder.linked_entity_id,
        reminder.title,
        reminder.note,
        reminder.due_date,
        reminder.priority,
        reminder.status,
        reminder.recurrence,
        reminder.created_at,
        reminder.updated_at
      );
  }

  update(id: string, userId: string, data: Partial<Omit<ReminderRecord, 'id' | 'user_id' | 'created_at'>>): boolean {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.property_id !== undefined) {
      fields.push('property_id = ?');
      params.push(data.property_id);
    }
    if (data.linked_entity_type !== undefined) {
      fields.push('linked_entity_type = ?');
      params.push(data.linked_entity_type);
    }
    if (data.linked_entity_id !== undefined) {
      fields.push('linked_entity_id = ?');
      params.push(data.linked_entity_id);
    }
    if (data.title !== undefined) {
      fields.push('title = ?');
      params.push(data.title);
    }
    if (data.note !== undefined) {
      fields.push('note = ?');
      params.push(data.note);
    }
    if (data.due_date !== undefined) {
      fields.push('due_date = ?');
      params.push(data.due_date);
    }
    if (data.priority !== undefined) {
      fields.push('priority = ?');
      params.push(data.priority);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(data.status);
    }
    if (data.recurrence !== undefined) {
      fields.push('recurrence = ?');
      params.push(data.recurrence);
    }
    if (data.updated_at !== undefined) {
      fields.push('updated_at = ?');
      params.push(data.updated_at);
    }

    if (fields.length === 0) return false;

    params.push(id, userId);

    const result = this.db
      .prepare(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...params);

    return result.changes > 0;
  }

  delete(id: string, userId: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM reminders WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    return result.changes > 0;
  }

  propertyBelongsToUser(propertyId: string, userId: string): boolean {
    const result = this.db
      .prepare(`SELECT id FROM properties WHERE id = ? AND user_id = ?`)
      .get(propertyId, userId);
    return !!result;
  }
}
