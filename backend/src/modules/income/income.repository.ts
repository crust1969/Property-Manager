import type Database from 'better-sqlite3';

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

export interface CategoryRecord {
  id: string;
  is_allocable: number;
  is_tax_deductible: number;
  requires_capitalization: number;
  is_financing_related: number;
}

export class IncomeRepository {
  constructor(private db: Database.Database) {}

  findAllByUserId(userId: string, propertyId?: string, year?: number, month?: number): BookingRecord[] {
    let query = `
      SELECT b.*, c.name as category_name FROM bookings b
      JOIN properties p ON b.property_id = p.id
      LEFT JOIN booking_splits bs ON bs.booking_id = b.id
      LEFT JOIN categories c ON bs.category_id = c.id
      WHERE p.user_id = ? AND b.type = 'income'
    `;
    const params: unknown[] = [userId];

    if (propertyId) {
      query += ' AND b.property_id = ?';
      params.push(propertyId);
    }

    if (year) {
      query += " AND CAST(substr(b.booking_date, 1, 4) AS INTEGER) = ?";
      params.push(year);
    }

    if (month) {
      query += " AND CAST(substr(b.booking_date, 6, 2) AS INTEGER) = ?";
      params.push(month);
    }

    query += ' ORDER BY b.booking_date DESC';

    return this.db.prepare(query).all(...params) as BookingRecord[];
  }

  findById(id: string, userId: string): BookingRecord | undefined {
    return this.db
      .prepare(
        `SELECT b.* FROM bookings b
         JOIN properties p ON b.property_id = p.id
         WHERE b.id = ? AND p.user_id = ? AND b.type = 'income'`
      )
      .get(id, userId) as BookingRecord | undefined;
  }

  findByIdInternal(id: string): BookingRecord | undefined {
    return this.db
      .prepare("SELECT * FROM bookings WHERE id = ? AND type = 'income'")
      .get(id) as BookingRecord | undefined;
  }

  create(booking: BookingRecord): void {
    this.db
      .prepare(
        `INSERT INTO bookings (id, property_id, user_id, type, booking_date, total_amount, counterparty, description, receivable_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        booking.id,
        booking.property_id,
        booking.user_id,
        booking.type,
        booking.booking_date,
        booking.total_amount,
        booking.counterparty,
        booking.description,
        booking.receivable_id,
        booking.created_at,
        booking.updated_at
      );
  }

  update(id: string, data: { booking_date: string; total_amount: number; counterparty: string; description: string | null; receivable_id: string | null; property_id: string; updated_at: string }): boolean {
    const result = this.db
      .prepare(
        `UPDATE bookings SET booking_date = ?, total_amount = ?, counterparty = ?, description = ?, receivable_id = ?, property_id = ?, updated_at = ?
         WHERE id = ? AND type = 'income'`
      )
      .run(
        data.booking_date,
        data.total_amount,
        data.counterparty,
        data.description,
        data.receivable_id,
        data.property_id,
        data.updated_at,
        id
      );
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM bookings WHERE id = ? AND type = 'income'")
      .run(id);
    return result.changes > 0;
  }

  // Booking splits

  createSplit(split: BookingSplitRecord): void {
    this.db
      .prepare(
        `INSERT INTO booking_splits (id, booking_id, amount, category_id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, overridden_flags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        split.id,
        split.booking_id,
        split.amount,
        split.category_id,
        split.is_allocable,
        split.is_tax_deductible,
        split.requires_capitalization,
        split.is_financing_related,
        split.overridden_flags
      );
  }

  deleteSplitsByBookingId(bookingId: string): void {
    this.db
      .prepare('DELETE FROM booking_splits WHERE booking_id = ?')
      .run(bookingId);
  }

  findSplitsByBookingId(bookingId: string): BookingSplitRecord[] {
    return this.db
      .prepare('SELECT * FROM booking_splits WHERE booking_id = ?')
      .all(bookingId) as BookingSplitRecord[];
  }

  // Category lookup

  findCategoryById(id: string): CategoryRecord | undefined {
    return this.db
      .prepare('SELECT id, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related FROM categories WHERE id = ? AND is_active = 1')
      .get(id) as CategoryRecord | undefined;
  }

  // Receivables

  findReceivableById(id: string): ReceivableRecord | undefined {
    return this.db
      .prepare('SELECT * FROM receivables WHERE id = ?')
      .get(id) as ReceivableRecord | undefined;
  }

  updateReceivablePaidAmount(id: string, paidAmount: number, status: string): void {
    this.db
      .prepare('UPDATE receivables SET paid_amount = ?, status = ? WHERE id = ?')
      .run(paidAmount, status, id);
  }

  /**
   * Get the total paid amount for a receivable from all income bookings linked to it.
   */
  getTotalPaidForReceivable(receivableId: string): number {
    const result = this.db
      .prepare(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings WHERE receivable_id = ? AND type = 'income'"
      )
      .get(receivableId) as { total: number };
    return result.total;
  }

  // Soll/Ist comparison

  findReceivablesByLeaseAndMonth(leaseId: string, year: number, month: number): ReceivableRecord[] {
    const monthStr = month.toString().padStart(2, '0');
    const pattern = `${year}-${monthStr}%`;
    return this.db
      .prepare('SELECT * FROM receivables WHERE lease_id = ? AND due_date LIKE ?')
      .all(leaseId, pattern) as ReceivableRecord[];
  }

  getIncomeForReceivables(receivableIds: string[]): number {
    if (receivableIds.length === 0) return 0;
    const placeholders = receivableIds.map(() => '?').join(',');
    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings
         WHERE receivable_id IN (${placeholders}) AND type = 'income'`
      )
      .get(...receivableIds) as { total: number };
    return result.total;
  }

  // Helpers

  propertyBelongsToUser(propertyId: string, userId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM properties WHERE id = ? AND user_id = ?')
      .get(propertyId, userId) as { count: number };
    return result.count > 0;
  }

  leaseExistsForUser(leaseId: string, userId: string): boolean {
    const result = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM leases l
         JOIN properties p ON l.property_id = p.id
         WHERE l.id = ? AND p.user_id = ?`
      )
      .get(leaseId, userId) as { count: number };
    return result.count > 0;
  }
}
