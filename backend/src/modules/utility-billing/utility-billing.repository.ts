import type Database from 'better-sqlite3';

export interface UtilityBillingRecord {
  id: string;
  property_id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  total_allocable_costs: number | null;
  tenant_share: number | null;
  prepayments: number | null;
  balance: number | null;
  status: string;
  created_at: string;
}

export interface UtilityBillingItemRecord {
  id: string;
  billing_id: string;
  category_id: string;
  total_cost: number;
  allocation_key: string;
  tenant_share: number;
  is_complete: number;
}

export interface CreateBillingInput {
  id: string;
  property_id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  total_allocable_costs: number;
  tenant_share: number;
  prepayments: number;
  balance: number;
  status: string;
  created_at: string;
}

export interface CreateBillingItemInput {
  id: string;
  billing_id: string;
  category_id: string;
  total_cost: number;
  allocation_key: string;
  tenant_share: number;
  is_complete: number;
}

export interface AllocableSplitRecord {
  category_id: string;
  total_cost: number;
}

export class UtilityBillingRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateBillingInput): UtilityBillingRecord {
    this.db
      .prepare(
        `INSERT INTO utility_billings (id, property_id, lease_id, period_start, period_end, total_allocable_costs, tenant_share, prepayments, balance, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.property_id,
        input.lease_id,
        input.period_start,
        input.period_end,
        input.total_allocable_costs,
        input.tenant_share,
        input.prepayments,
        input.balance,
        input.status,
        input.created_at
      );

    return this.findById(input.id)!;
  }

  createItem(input: CreateBillingItemInput): void {
    this.db
      .prepare(
        `INSERT INTO utility_billing_items (id, billing_id, category_id, total_cost, allocation_key, tenant_share, is_complete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.billing_id,
        input.category_id,
        input.total_cost,
        input.allocation_key,
        input.tenant_share,
        input.is_complete
      );
  }

  findById(id: string): UtilityBillingRecord | undefined {
    return this.db
      .prepare('SELECT * FROM utility_billings WHERE id = ?')
      .get(id) as UtilityBillingRecord | undefined;
  }

  findItemsByBillingId(billingId: string): UtilityBillingItemRecord[] {
    return this.db
      .prepare('SELECT * FROM utility_billing_items WHERE billing_id = ?')
      .all(billingId) as UtilityBillingItemRecord[];
  }

  /**
   * Get allocable booking splits for a property within a date range.
   * Only includes splits where is_allocable = 1.
   */
  getAllocableCosts(propertyId: string, periodStart: string, periodEnd: string): AllocableSplitRecord[] {
    return this.db
      .prepare(
        `SELECT bs.category_id, SUM(bs.amount) as total_cost
         FROM booking_splits bs
         JOIN bookings b ON bs.booking_id = b.id
         WHERE b.property_id = ?
           AND b.booking_date >= ?
           AND b.booking_date <= ?
           AND bs.is_allocable = 1
         GROUP BY bs.category_id`
      )
      .all(propertyId, periodStart, periodEnd) as AllocableSplitRecord[];
  }

  /**
   * Get total prepayments (operating + heating cost advances) for a lease in a period.
   * Uses receivables table to sum operating_cost + heating_cost for the period.
   */
  getPrepayments(leaseId: string, periodStart: string, periodEnd: string): number {
    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(paid_amount), 0) as total
         FROM receivables
         WHERE lease_id = ?
           AND due_date >= ?
           AND due_date <= ?
           AND status != 'storniert'`
      )
      .get(leaseId, periodStart, periodEnd) as { total: number };

    // We need prepayments for Nebenkosten specifically, so we compute from
    // operating_cost + heating_cost columns of the receivables in the period
    const advanceResult = this.db
      .prepare(
        `SELECT COALESCE(SUM(operating_cost + heating_cost), 0) as total
         FROM receivables
         WHERE lease_id = ?
           AND due_date >= ?
           AND due_date <= ?
           AND status != 'storniert'`
      )
      .get(leaseId, periodStart, periodEnd) as { total: number };

    return advanceResult.total;
  }

  /**
   * Check if property belongs to user.
   */
  propertyBelongsToUser(propertyId: string, userId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM properties WHERE id = ? AND user_id = ?')
      .get(propertyId, userId) as { count: number };
    return result.count > 0;
  }

  /**
   * Check if lease exists and belongs to the property.
   */
  leaseExists(leaseId: string, propertyId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM leases WHERE id = ? AND property_id = ?')
      .get(leaseId, propertyId) as { count: number };
    return result.count > 0;
  }

  /**
   * Get the property's living area.
   */
  getPropertyArea(propertyId: string): number {
    const result = this.db
      .prepare('SELECT living_area_sqm FROM properties WHERE id = ?')
      .get(propertyId) as { living_area_sqm: number } | undefined;
    return result?.living_area_sqm ?? 0;
  }

  /**
   * Get category name by id.
   */
  getCategoryName(categoryId: string): string {
    const result = this.db
      .prepare('SELECT name FROM categories WHERE id = ?')
      .get(categoryId) as { name: string } | undefined;
    return result?.name ?? 'Unbekannt';
  }
}
