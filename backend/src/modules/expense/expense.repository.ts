import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface BookingRecord {
  id: string;
  property_id: string;
  user_id: string;
  type: string;
  booking_date: string;
  total_amount: number;
  counterparty: string | null;
  description: string | null;
  receivable_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingSplitRecord {
  id: string;
  booking_id: string;
  amount: number;
  category_id: string;
  is_allocable: number;
  is_tax_deductible: number;
  requires_capitalization: number;
  is_financing_related: number;
  overridden_flags: string;
}

export interface CreateBookingInput {
  property_id: string;
  user_id: string;
  booking_date: string;
  total_amount: number;
  counterparty?: string | null;
  description?: string | null;
  receivable_id?: string | null;
}

export interface CreateSplitInput {
  booking_id: string;
  amount: number;
  category_id: string;
  is_allocable: boolean;
  is_tax_deductible: boolean;
  requires_capitalization: boolean;
  is_financing_related: boolean;
}

export interface ListExpensesFilter {
  property_id: string;
  user_id: string;
  year?: number;
  category_id?: string;
  flags?: string; // comma-separated flag filters like "is_allocable,is_tax_deductible"
}

export class ExpenseRepository {
  constructor(private db: Database.Database) {}

  /**
   * Create a booking with its splits atomically within a transaction.
   */
  createWithSplits(booking: CreateBookingInput, splits: CreateSplitInput[]): { booking: BookingRecord; splits: BookingSplitRecord[] } {
    const bookingId = uuidv4();
    const now = new Date().toISOString();

    const result = this.db.transaction(() => {
      // Insert booking
      const insertBooking = this.db.prepare(`
        INSERT INTO bookings (id, property_id, user_id, type, booking_date, total_amount, counterparty, description, receivable_id, created_at, updated_at)
        VALUES (?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?)
      `);
      insertBooking.run(
        bookingId,
        booking.property_id,
        booking.user_id,
        booking.booking_date,
        booking.total_amount,
        booking.counterparty ?? null,
        booking.description ?? null,
        booking.receivable_id ?? null,
        now,
        now
      );

      // Insert splits
      const insertSplit = this.db.prepare(`
        INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]')
      `);

      const createdSplits: BookingSplitRecord[] = [];
      for (const split of splits) {
        const splitId = uuidv4();
        insertSplit.run(
          splitId,
          bookingId,
          split.amount,
          split.category_id,
          split.is_allocable ? 1 : 0,
          split.is_tax_deductible ? 1 : 0,
          split.requires_capitalization ? 1 : 0,
          split.is_financing_related ? 1 : 0
        );
        createdSplits.push({
          id: splitId,
          booking_id: bookingId,
          amount: split.amount,
          category_id: split.category_id,
          is_allocable: split.is_allocable ? 1 : 0,
          is_tax_deductible: split.is_tax_deductible ? 1 : 0,
          requires_capitalization: split.requires_capitalization ? 1 : 0,
          is_financing_related: split.is_financing_related ? 1 : 0,
          overridden_flags: '[]',
        });
      }

      const createdBooking: BookingRecord = {
        id: bookingId,
        property_id: booking.property_id,
        user_id: booking.user_id,
        type: 'expense',
        booking_date: booking.booking_date,
        total_amount: booking.total_amount,
        counterparty: booking.counterparty ?? null,
        description: booking.description ?? null,
        receivable_id: booking.receivable_id ?? null,
        created_at: now,
        updated_at: now,
      };

      return { booking: createdBooking, splits: createdSplits };
    })();

    return result;
  }

  /**
   * Find a booking by ID (expense type only).
   */
  findById(id: string, userId: string): BookingRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM bookings WHERE id = ? AND user_id = ? AND type = 'expense'
    `);
    return stmt.get(id, userId) as BookingRecord | undefined;
  }

  /**
   * Find splits for a booking.
   */
  findSplitsByBookingId(bookingId: string): BookingSplitRecord[] {
    const stmt = this.db.prepare('SELECT * FROM booking_splits WHERE booking_id = ?');
    return stmt.all(bookingId) as BookingSplitRecord[];
  }

  /**
   * List expenses with filters.
   */
  list(filter: ListExpensesFilter): (BookingRecord & { splits: BookingSplitRecord[] })[] {
    const conditions: string[] = ["b.type = 'expense'", 'b.user_id = ?'];
    const params: unknown[] = [filter.user_id];

    if (filter.property_id) {
      conditions.push('b.property_id = ?');
      params.push(filter.property_id);
    }

    if (filter.year) {
      conditions.push("strftime('%Y', b.booking_date) = ?");
      params.push(String(filter.year));
    }

    if (filter.category_id) {
      conditions.push('EXISTS (SELECT 1 FROM booking_splits bs WHERE bs.booking_id = b.id AND bs.category_id = ?)');
      params.push(filter.category_id);
    }

    if (filter.flags) {
      const flagList = filter.flags.split(',').map(f => f.trim());
      for (const flag of flagList) {
        if (['is_allocable', 'is_tax_deductible', 'requires_capitalization', 'is_financing_related'].includes(flag)) {
          conditions.push(`EXISTS (SELECT 1 FROM booking_splits bs WHERE bs.booking_id = b.id AND bs.${flag} = 1)`);
        }
      }
    }

    const whereClause = conditions.join(' AND ');
    const query = `SELECT b.* FROM bookings b WHERE ${whereClause} ORDER BY b.booking_date DESC, b.created_at DESC`;
    const bookings = this.db.prepare(query).all(...params) as BookingRecord[];

    // Fetch splits for each booking
    const splitsStmt = this.db.prepare('SELECT * FROM booking_splits WHERE booking_id = ?');
    return bookings.map(booking => ({
      ...booking,
      splits: splitsStmt.all(booking.id) as BookingSplitRecord[],
    }));
  }

  /**
   * Update a booking.
   */
  update(id: string, data: Partial<Pick<BookingRecord, 'booking_date' | 'total_amount' | 'counterparty' | 'description' | 'receivable_id'>>): void {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.booking_date !== undefined) {
      fields.push('booking_date = ?');
      params.push(data.booking_date);
    }
    if (data.total_amount !== undefined) {
      fields.push('total_amount = ?');
      params.push(data.total_amount);
    }
    if (data.counterparty !== undefined) {
      fields.push('counterparty = ?');
      params.push(data.counterparty);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }
    if (data.receivable_id !== undefined) {
      fields.push('receivable_id = ?');
      params.push(data.receivable_id);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const query = `UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...params);
  }

  /**
   * Delete a booking and its splits (cascade handled by FK).
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM bookings WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Replace all splits for a booking (atomically).
   */
  replaceSplits(bookingId: string, splits: CreateSplitInput[]): BookingSplitRecord[] {
    const result = this.db.transaction(() => {
      // Delete existing splits
      this.db.prepare('DELETE FROM booking_splits WHERE booking_id = ?').run(bookingId);

      // Insert new splits
      const insertSplit = this.db.prepare(`
        INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]')
      `);

      const createdSplits: BookingSplitRecord[] = [];
      for (const split of splits) {
        const splitId = uuidv4();
        insertSplit.run(
          splitId,
          bookingId,
          split.amount,
          split.category_id,
          split.is_allocable ? 1 : 0,
          split.is_tax_deductible ? 1 : 0,
          split.requires_capitalization ? 1 : 0,
          split.is_financing_related ? 1 : 0
        );
        createdSplits.push({
          id: splitId,
          booking_id: bookingId,
          amount: split.amount,
          category_id: split.category_id,
          is_allocable: split.is_allocable ? 1 : 0,
          is_tax_deductible: split.is_tax_deductible ? 1 : 0,
          requires_capitalization: split.requires_capitalization ? 1 : 0,
          is_financing_related: split.is_financing_related ? 1 : 0,
          overridden_flags: '[]',
        });
      }

      return createdSplits;
    })();

    return result;
  }
}
