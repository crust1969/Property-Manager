import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { generateAfaPlan } from '../depreciation/afa.calculator.js';

export interface DashboardKPIs {
  mieteingaenge: {
    offen_anzahl: number;
    offen_summe: number;
    bezahlt_anzahl: number;
    bezahlt_summe: number;
  };
  einnahmen_ytd: number;
  ausgaben_ytd: number;
  werbungskosten_ytd: number;
  afa_ytd: number;
  zinsen_ytd: number;
  cashflow_ytd: number;
  handlungsbedarf: {
    offene_erinnerungen: number;
    fehlende_belege: number;
    ungeklaerte_buchungen: number;
  };
}

export class DashboardService {
  private db: Database.Database;

  constructor(private app: FastifyInstance) {
    this.db = app.db;
  }

  /**
   * Get aggregated dashboard KPIs for the current year (YTD).
   * When propertyId is provided, filter by that property.
   * When not provided, aggregate across all user's properties.
   */
  getDashboardKPIs(userId: string, propertyId?: string): DashboardKPIs {
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;
    const today = new Date().toISOString().split('T')[0];

    // Get user's property IDs for security filtering
    const propertyFilter = this.getPropertyFilter(userId, propertyId);

    const mieteingaenge = this.getMieteingaenge(propertyFilter, yearStart, yearEnd);
    const einnahmenYtd = this.getEinnahmenYtd(propertyFilter, userId, yearStart, yearEnd);
    const ausgabenYtd = this.getAusgabenYtd(propertyFilter, userId, yearStart, yearEnd);
    const werbungskostenYtd = this.getWerbungskostenYtd(propertyFilter, userId, yearStart, yearEnd);
    const afaYtd = this.getAfaYtd(propertyFilter, currentYear);
    const zinsenYtd = this.getZinsenYtd(propertyFilter, yearStart, yearEnd);
    const cashflowYtd = einnahmenYtd - ausgabenYtd;
    const handlungsbedarf = this.getHandlungsbedarf(userId, propertyFilter, today);

    return {
      mieteingaenge,
      einnahmen_ytd: einnahmenYtd,
      ausgaben_ytd: ausgabenYtd,
      werbungskosten_ytd: werbungskostenYtd,
      afa_ytd: afaYtd,
      zinsen_ytd: zinsenYtd,
      cashflow_ytd: cashflowYtd,
      handlungsbedarf,
    };
  }

  private getPropertyFilter(userId: string, propertyId?: string): { ids: string[]; clause: string; params: string[] } {
    if (propertyId) {
      // Verify property belongs to user
      const prop = this.db
        .prepare('SELECT id FROM properties WHERE id = ? AND user_id = ?')
        .get(propertyId, userId) as { id: string } | undefined;

      if (!prop) {
        const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
        error.statusCode = 404;
        throw error;
      }
      return { ids: [propertyId], clause: '= ?', params: [propertyId] };
    }

    // Get all user's properties
    const properties = this.db
      .prepare('SELECT id FROM properties WHERE user_id = ?')
      .all(userId) as { id: string }[];

    const ids = properties.map(p => p.id);
    if (ids.length === 0) {
      return { ids: [], clause: 'IN ()', params: [] };
    }

    const placeholders = ids.map(() => '?').join(',');
    return { ids, clause: `IN (${placeholders})`, params: ids };
  }

  /**
   * Mieteingänge: shows actually paid amounts vs outstanding amounts.
   * - "bezahlt": sum of paid_amount across all receivables due up to today
   * - "offen": sum of (total_amount - paid_amount) for receivables that are not fully paid and due <= today
   * Future receivables (not yet due) are excluded entirely.
   */
  private getMieteingaenge(propertyFilter: { ids: string[]; clause: string; params: string[] }, yearStart: string, yearEnd: string) {
    if (propertyFilter.ids.length === 0) {
      return { offen_anzahl: 0, offen_summe: 0, bezahlt_anzahl: 0, bezahlt_summe: 0 };
    }

    const today = new Date().toISOString().split('T')[0];

    // Get receivables due up to today: sum paid_amount as "bezahlt", sum remaining as "offen"
    const result = this.db
      .prepare(
        `SELECT 
           COALESCE(SUM(paid_amount), 0) as bezahlt_summe,
           COUNT(CASE WHEN status = 'bezahlt' THEN 1 END) as bezahlt_anzahl,
           COALESCE(SUM(CASE WHEN status != 'bezahlt' THEN total_amount - paid_amount ELSE 0 END), 0) as offen_summe,
           COUNT(CASE WHEN status IN ('offen', 'teilbezahlt', 'überfällig') THEN 1 END) as offen_anzahl
         FROM receivables
         WHERE property_id ${propertyFilter.clause}
           AND due_date >= ? AND due_date <= ?
           AND status != 'storniert'`
      )
      .get(...propertyFilter.params, yearStart, today) as { 
        bezahlt_summe: number; bezahlt_anzahl: number; 
        offen_summe: number; offen_anzahl: number 
      };

    return {
      offen_anzahl: result.offen_anzahl,
      offen_summe: result.offen_summe,
      bezahlt_anzahl: result.bezahlt_anzahl,
      bezahlt_summe: result.bezahlt_summe,
    };
  }

  /**
   * Einnahmen YTD: sum of all income bookings for current year.
   */
  private getEinnahmenYtd(propertyFilter: { ids: string[]; clause: string; params: string[] }, userId: string, yearStart: string, yearEnd: string): number {
    if (propertyFilter.ids.length === 0) return 0;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as sum
         FROM bookings
         WHERE property_id ${propertyFilter.clause}
           AND user_id = ?
           AND type = 'income'
           AND booking_date >= ? AND booking_date <= ?`
      )
      .get(...propertyFilter.params, userId, yearStart, yearEnd) as { sum: number };

    return result.sum;
  }

  /**
   * Ausgaben YTD: sum of all expense bookings for current year.
   */
  private getAusgabenYtd(propertyFilter: { ids: string[]; clause: string; params: string[] }, userId: string, yearStart: string, yearEnd: string): number {
    if (propertyFilter.ids.length === 0) return 0;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as sum
         FROM bookings
         WHERE property_id ${propertyFilter.clause}
           AND user_id = ?
           AND type = 'expense'
           AND booking_date >= ? AND booking_date <= ?`
      )
      .get(...propertyFilter.params, userId, yearStart, yearEnd) as { sum: number };

    return result.sum;
  }

  /**
   * Werbungskosten YTD: sum of tax-deductible expense splits
   * excluding those requiring capitalization.
   */
  private getWerbungskostenYtd(propertyFilter: { ids: string[]; clause: string; params: string[] }, userId: string, yearStart: string, yearEnd: string): number {
    if (propertyFilter.ids.length === 0) return 0;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(bs.amount), 0) as sum
         FROM booking_splits bs
         JOIN bookings b ON bs.booking_id = b.id
         WHERE b.property_id ${propertyFilter.clause}
           AND b.user_id = ?
           AND b.type = 'expense'
           AND b.booking_date >= ? AND b.booking_date <= ?
           AND bs.is_tax_deductible = 1
           AND bs.requires_capitalization = 0`
      )
      .get(...propertyFilter.params, userId, yearStart, yearEnd) as { sum: number };

    return result.sum;
  }

  /**
   * AfA YTD: annual depreciation amount for the current year from the AfA plan.
   * Sums across all relevant properties.
   */
  private getAfaYtd(propertyFilter: { ids: string[]; clause: string; params: string[] }, currentYear: number): number {
    if (propertyFilter.ids.length === 0) return 0;

    // Get acquisitions for the filtered properties that have AfA params set
    const acquisitions = this.db
      .prepare(
        `SELECT property_id, afa_basis, afa_rate, afa_start_date
         FROM acquisitions
         WHERE property_id ${propertyFilter.clause}
           AND afa_rate IS NOT NULL
           AND afa_start_date IS NOT NULL
           AND afa_basis > 0`
      )
      .all(...propertyFilter.params) as { property_id: string; afa_basis: number; afa_rate: number; afa_start_date: string }[];

    let totalAfa = 0;
    for (const acq of acquisitions) {
      const plan = generateAfaPlan(acq.afa_basis, acq.afa_rate, acq.afa_start_date);
      const entry = plan.find(e => e.year === currentYear);
      if (entry) {
        totalAfa += entry.annualAmount;
      }
    }

    return totalAfa;
  }

  /**
   * Zinsen YTD: sum of loan interest payments for the current year.
   */
  private getZinsenYtd(propertyFilter: { ids: string[]; clause: string; params: string[] }, yearStart: string, yearEnd: string): number {
    if (propertyFilter.ids.length === 0) return 0;

    const result = this.db
      .prepare(
        `SELECT COALESCE(SUM(lp.interest_amount), 0) as sum
         FROM loan_payments lp
         JOIN loans l ON lp.loan_id = l.id
         WHERE l.property_id ${propertyFilter.clause}
           AND lp.payment_date >= ? AND lp.payment_date <= ?`
      )
      .get(...propertyFilter.params, yearStart, yearEnd) as { sum: number };

    return result.sum;
  }

  /**
   * Handlungsbedarf: action items requiring attention.
   */
  private getHandlungsbedarf(userId: string, propertyFilter: { ids: string[]; clause: string; params: string[] }, today: string) {
    const offeneErinnerungen = this.getOffeneErinnerungen(userId, propertyFilter, today);
    const fehlendeBelege = this.getFehlendeBelege(propertyFilter, userId);
    const ungeklaerteBuchungen = this.getUngeklaerteBuchungen(propertyFilter, userId);

    return {
      offene_erinnerungen: offeneErinnerungen,
      fehlende_belege: fehlendeBelege,
      ungeklaerte_buchungen: ungeklaerteBuchungen,
    };
  }

  /**
   * Count of reminders with status='offen' and due_date <= today.
   */
  private getOffeneErinnerungen(userId: string, propertyFilter: { ids: string[]; clause: string; params: string[] }, today: string): number {
    if (propertyFilter.ids.length === 0) {
      // Still count reminders without property_id for the user
      const result = this.db
        .prepare(
          `SELECT COUNT(*) as count
           FROM reminders
           WHERE user_id = ?
             AND status = 'offen'
             AND due_date <= ?`
        )
        .get(userId, today) as { count: number };
      return result.count;
    }

    // Count reminders: either associated with filtered properties or without property_id (user-level)
    const result = this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM reminders
         WHERE user_id = ?
           AND status = 'offen'
           AND due_date <= ?
           AND (property_id ${propertyFilter.clause} OR property_id IS NULL)`
      )
      .get(userId, today, ...propertyFilter.params) as { count: number };

    return result.count;
  }

  /**
   * Count of bookings without linked documents.
   */
  private getFehlendeBelege(propertyFilter: { ids: string[]; clause: string; params: string[] }, userId: string): number {
    if (propertyFilter.ids.length === 0) return 0;

    const result = this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM bookings b
         WHERE b.property_id ${propertyFilter.clause}
           AND b.user_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM document_links dl
             WHERE dl.entity_type = 'booking' AND dl.entity_id = b.id
           )`
      )
      .get(...propertyFilter.params, userId) as { count: number };

    return result.count;
  }

  /**
   * Count of bookings with manuelle_pruefung_noetig flag:
   * booking_splits that have overridden flags (non-empty overridden_flags).
   */
  private getUngeklaerteBuchungen(propertyFilter: { ids: string[]; clause: string; params: string[] }, userId: string): number {
    if (propertyFilter.ids.length === 0) return 0;

    const result = this.db
      .prepare(
        `SELECT COUNT(DISTINCT b.id) as count
         FROM bookings b
         JOIN booking_splits bs ON bs.booking_id = b.id
         WHERE b.property_id ${propertyFilter.clause}
           AND b.user_id = ?
           AND bs.overridden_flags != '[]'
           AND bs.overridden_flags IS NOT NULL`
      )
      .get(...propertyFilter.params, userId) as { count: number };

    return result.count;
  }
}
