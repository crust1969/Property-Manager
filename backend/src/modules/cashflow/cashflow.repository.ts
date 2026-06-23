import type Database from 'better-sqlite3';

export interface MonthlyAmountResult {
  total: number;
}

export interface AcquisitionRecord {
  purchase_price: number;
  notary_cost: number;
  transfer_tax: number;
  land_registry_cost: number;
  broker_cost: number;
}

export class CashflowRepository {
  constructor(private db: Database.Database) {}

  /**
   * Check if a property belongs to a user.
   */
  propertyBelongsToUser(propertyId: string, userId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM properties WHERE id = ? AND user_id = ?')
      .get(propertyId, userId) as { count: number };
    return result.count > 0;
  }

  /**
   * Query income by property and year, summed by month.
   * Only includes income-type bookings.
   */
  getMonthlyIncome(propertyId: string, year: number, month: number): number {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM bookings
         WHERE property_id = ? AND type = 'income'
         AND booking_date >= ? AND booking_date < ?`
      )
      .get(propertyId, startDate, endDate) as MonthlyAmountResult;

    return result.total;
  }

  /**
   * Query expenses by property and year, summed by month.
   * Only expense-type bookings (excludes non-cash/AfA bookings).
   */
  getMonthlyCashExpenses(propertyId: string, year: number, month: number): number {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM bookings
         WHERE property_id = ? AND type = 'expense'
         AND booking_date >= ? AND booking_date < ?`
      )
      .get(propertyId, startDate, endDate) as MonthlyAmountResult;

    return result.total;
  }

  /**
   * Query financing-related, non-tax-deductible amounts from booking splits.
   * This identifies the repayment portion within expense bookings
   * (financing-related but not tax-deductible = repayment).
   */
  getMonthlyRepaymentFromExpenses(propertyId: string, year: number, month: number): number {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(bs.amount), 0) as total
         FROM booking_splits bs
         JOIN bookings b ON bs.booking_id = b.id
         WHERE b.property_id = ? AND b.type = 'expense'
         AND b.booking_date >= ? AND b.booking_date < ?
         AND bs.is_financing_related = 1
         AND bs.is_tax_deductible = 0`
      )
      .get(propertyId, startDate, endDate) as MonthlyAmountResult;

    return result.total;
  }

  /**
   * Query loan repayments by property and year, summed by month.
   * Uses the loan_payments table for accurate repayment tracking.
   */
  getMonthlyLoanRepayment(propertyId: string, year: number, month: number): number {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(lp.repayment_amount + lp.extra_repayment), 0) as total
         FROM loan_payments lp
         JOIN loans l ON lp.loan_id = l.id
         WHERE l.property_id = ?
         AND lp.payment_date >= ? AND lp.payment_date < ?`
      )
      .get(propertyId, startDate, endDate) as MonthlyAmountResult;

    return result.total;
  }

  /**
   * Query acquisition data for investment costs calculation.
   * Returns null if no acquisition data exists.
   */
  getAcquisition(propertyId: string): AcquisitionRecord | null {
    const acquisition = this.db
      .prepare(
        `SELECT purchase_price, notary_cost, transfer_tax, land_registry_cost, broker_cost
         FROM acquisitions
         WHERE property_id = ?`
      )
      .get(propertyId) as AcquisitionRecord | undefined;

    return acquisition ?? null;
  }

  /**
   * Query annual cold rent from active leases for a property.
   * Calculates cold_rent × 12 for all active leases.
   */
  getAnnualColdRent(propertyId: string): number {
    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(cold_rent * 12), 0) as total
         FROM leases
         WHERE property_id = ? AND status = 'aktiv'`
      )
      .get(propertyId) as MonthlyAmountResult;

    return result.total;
  }

  /**
   * Query annual non-allocable costs for a property in a given year.
   * Sums booking splits where is_allocable = 0 for expense bookings.
   */
  getAnnualNonAllocableCosts(propertyId: string, year: number): number {
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(bs.amount), 0) as total
         FROM booking_splits bs
         JOIN bookings b ON bs.booking_id = b.id
         WHERE b.property_id = ? AND b.type = 'expense'
         AND b.booking_date >= ? AND b.booking_date < ?
         AND bs.is_allocable = 0`
      )
      .get(propertyId, startDate, endDate) as MonthlyAmountResult;

    return result.total;
  }
}
