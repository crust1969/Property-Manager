import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { generateAfaPlan, generateAfaPlanByMethod } from '../depreciation/afa.calculator.js';

export type ReportType =
  | 'steuerlich'
  | 'werbungskosten'
  | 'afa-plan'
  | 'zins-tilgung'
  | 'mieteingaenge'
  | 'belegvollstaendigkeit';

export interface ReportFilter {
  propertyId: string;
  year: number;
}

const DISCLAIMER = 'Hinweis: Keine rechtsverbindliche Steueraussage';
const NO_DATA_HINT = 'Keine Daten für den gewählten Zeitraum vorhanden';

// ─── Report Interfaces ───────────────────────────────────────────────────────

export interface SteuerlichReport {
  type: 'steuerlich';
  propertyId: string;
  year: number;
  disclaimer: string;
  hint?: string;
  data: {
    einnahmenGesamt: number;
    ausgabenGesamt: number;
    werbungskosten: number;
    afaJahresbetrag: number;
    darlehenszinsen: number;
    ergebnis: number;
  };
}

export interface WerbungskostenReport {
  type: 'werbungskosten';
  propertyId: string;
  year: number;
  disclaimer: string;
  hint?: string;
  data: {
    werbungskosten: WerbungskostenItem[];
    summeWerbungskosten: number;
    aktivierungspflichtig: WerbungskostenItem[];
    summeAktivierungspflichtig: number;
  };
}

export interface WerbungskostenItem {
  datum: string;
  beschreibung: string | null;
  kategorie: string;
  betrag: number;
}

export interface AfaPlanReport {
  type: 'afa-plan';
  propertyId: string;
  year: number;
  disclaimer: string;
  hint?: string;
  data: {
    afaBasis: number;
    afaSatz: number | null;
    afaStartdatum: string | null;
    plan: AfaPlanReportEntry[];
  };
}

export interface AfaPlanReportEntry {
  jahr: number;
  jahresbetrag: number;
  kumuliert: number;
  restwert: number;
}

export interface ZinsTilgungReport {
  type: 'zins-tilgung';
  propertyId: string;
  year: number;
  disclaimer: string;
  hint?: string;
  data: {
    zahlungen: ZinsTilgungItem[];
    summeZinsen: number;
    summeTilgung: number;
    summeGebuehren: number;
    summeGesamt: number;
  };
}

export interface ZinsTilgungItem {
  datum: string;
  darlehensgeber: string;
  zinsen: number;
  tilgung: number;
  gebuehren: number;
  sondertilgung: number;
  gesamt: number;
}

export interface MieteingaengeReport {
  type: 'mieteingaenge';
  propertyId: string;
  year: number;
  disclaimer: string;
  hint?: string;
  data: {
    sollstellungen: MieteingangItem[];
    summeGesamt: number;
    summeBezahlt: number;
    summeOffen: number;
  };
}

export interface MieteingangItem {
  faelligkeitsdatum: string;
  sollBetrag: number;
  bezahlt: number;
  status: string;
}

export interface BelegvollstaendigkeitReport {
  type: 'belegvollstaendigkeit';
  propertyId: string;
  year: number;
  disclaimer: string;
  hint?: string;
  data: {
    buchungen: BelegItem[];
    mitBeleg: number;
    ohneBeleg: number;
    vollstaendigkeitQuote: number;
  };
}

export interface BelegItem {
  datum: string;
  beschreibung: string | null;
  betrag: number;
  belegVorhanden: boolean;
}

export type ReportResult =
  | SteuerlichReport
  | WerbungskostenReport
  | AfaPlanReport
  | ZinsTilgungReport
  | MieteingaengeReport
  | BelegvollstaendigkeitReport;

// ─── Service ─────────────────────────────────────────────────────────────────

export class ReportService {
  private db: Database.Database;

  constructor(private app: FastifyInstance) {
    this.db = app.db;
  }

  generateReport(type: ReportType, filter: ReportFilter, userId: string): ReportResult {
    this.verifyPropertyOwnership(filter.propertyId, userId);

    switch (type) {
      case 'steuerlich':
        return this.generateSteuerlich(filter);
      case 'werbungskosten':
        return this.generateWerbungskosten(filter);
      case 'afa-plan':
        return this.generateAfaPlan(filter);
      case 'zins-tilgung':
        return this.generateZinsTilgung(filter);
      case 'mieteingaenge':
        return this.generateMieteingaenge(filter);
      case 'belegvollstaendigkeit':
        return this.generateBelegvollstaendigkeit(filter);
      default:
        const error = new Error(`Unbekannter Berichtstyp: ${type}`) as Error & { statusCode: number };
        error.statusCode = 400;
        throw error;
    }
  }

  // ─── Steuerlich ──────────────────────────────────────────────────────────────

  private generateSteuerlich(filter: ReportFilter): SteuerlichReport {
    const { propertyId, year } = filter;
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    const einnahmen = this.db.prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings
       WHERE property_id = ? AND type = 'income'
       AND booking_date >= ? AND booking_date < ?`
    ).get(propertyId, startDate, endDate) as { total: number };

    const ausgaben = this.db.prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings
       WHERE property_id = ? AND type = 'expense'
       AND booking_date >= ? AND booking_date < ?`
    ).get(propertyId, startDate, endDate) as { total: number };

    // Werbungskosten: tax deductible splits from expenses (excluding aktivierungspflichtig)
    const werbungskosten = this.db.prepare(
      `SELECT COALESCE(SUM(bs.amount), 0) as total
       FROM booking_splits bs
       JOIN bookings b ON bs.booking_id = b.id
       WHERE b.property_id = ? AND b.type = 'expense'
       AND b.booking_date >= ? AND b.booking_date < ?
       AND bs.is_tax_deductible = 1
       AND bs.requires_capitalization = 0`
    ).get(propertyId, startDate, endDate) as { total: number };

    // AfA for this year
    const afaJahresbetrag = this.getAfaForYear(propertyId, year);

    // Darlehenszinsen
    const zinsen = this.db.prepare(
      `SELECT COALESCE(SUM(lp.interest_amount), 0) as total
       FROM loan_payments lp
       JOIN loans l ON lp.loan_id = l.id
       WHERE l.property_id = ?
       AND lp.payment_date >= ? AND lp.payment_date < ?`
    ).get(propertyId, startDate, endDate) as { total: number };

    const hasData = einnahmen.total > 0 || ausgaben.total > 0;
    const ergebnis = einnahmen.total - werbungskosten.total - afaJahresbetrag - zinsen.total;

    return {
      type: 'steuerlich',
      propertyId,
      year,
      disclaimer: DISCLAIMER,
      ...(hasData ? {} : { hint: NO_DATA_HINT }),
      data: {
        einnahmenGesamt: einnahmen.total,
        ausgabenGesamt: ausgaben.total,
        werbungskosten: werbungskosten.total,
        afaJahresbetrag,
        darlehenszinsen: zinsen.total,
        ergebnis,
      },
    };
  }

  // ─── Werbungskosten ──────────────────────────────────────────────────────────

  private generateWerbungskosten(filter: ReportFilter): WerbungskostenReport {
    const { propertyId, year } = filter;
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    // Tax-deductible, non-aktivierungspflichtig
    const wkRows = this.db.prepare(
      `SELECT b.booking_date, b.description, c.name as category_name, bs.amount
       FROM booking_splits bs
       JOIN bookings b ON bs.booking_id = b.id
       JOIN categories c ON bs.category_id = c.id
       WHERE b.property_id = ? AND b.type = 'expense'
       AND b.booking_date >= ? AND b.booking_date < ?
       AND bs.is_tax_deductible = 1
       AND bs.requires_capitalization = 0
       ORDER BY b.booking_date`
    ).all(propertyId, startDate, endDate) as Array<{ booking_date: string; description: string | null; category_name: string; amount: number }>;

    // Aktivierungspflichtig
    const aktRows = this.db.prepare(
      `SELECT b.booking_date, b.description, c.name as category_name, bs.amount
       FROM booking_splits bs
       JOIN bookings b ON bs.booking_id = b.id
       JOIN categories c ON bs.category_id = c.id
       WHERE b.property_id = ? AND b.type = 'expense'
       AND b.booking_date >= ? AND b.booking_date < ?
       AND bs.requires_capitalization = 1
       ORDER BY b.booking_date`
    ).all(propertyId, startDate, endDate) as Array<{ booking_date: string; description: string | null; category_name: string; amount: number }>;

    const werbungskosten: WerbungskostenItem[] = wkRows.map(r => ({
      datum: r.booking_date,
      beschreibung: r.description,
      kategorie: r.category_name,
      betrag: r.amount,
    }));

    const aktivierungspflichtig: WerbungskostenItem[] = aktRows.map(r => ({
      datum: r.booking_date,
      beschreibung: r.description,
      kategorie: r.category_name,
      betrag: r.amount,
    }));

    const summeWK = werbungskosten.reduce((s, i) => s + i.betrag, 0);
    const summeAkt = aktivierungspflichtig.reduce((s, i) => s + i.betrag, 0);
    const hasData = werbungskosten.length > 0 || aktivierungspflichtig.length > 0;

    return {
      type: 'werbungskosten',
      propertyId,
      year,
      disclaimer: DISCLAIMER,
      ...(hasData ? {} : { hint: NO_DATA_HINT }),
      data: {
        werbungskosten,
        summeWerbungskosten: summeWK,
        aktivierungspflichtig,
        summeAktivierungspflichtig: summeAkt,
      },
    };
  }

  // ─── AfA-Plan ────────────────────────────────────────────────────────────────

  private generateAfaPlan(filter: ReportFilter): AfaPlanReport {
    const { propertyId, year } = filter;

    // Use new afa_positions table
    const positions = this.db.prepare(
      `SELECT name, basis, rate, method, start_date FROM afa_positions WHERE property_id = ?`
    ).all(propertyId) as Array<{ name: string; basis: number; rate: number; method: string; start_date: string }>;

    if (positions.length > 0) {
      // Generate combined plan from all positions
      const reportPlan: AfaPlanReportEntry[] = [];
      let totalBasis = 0;

      for (const pos of positions) {
        totalBasis += pos.basis;
        const plan = generateAfaPlanByMethod(pos.method as 'linear' | 'degressiv', pos.basis, pos.rate, pos.start_date);
        for (const entry of plan) {
          reportPlan.push({
            jahr: entry.year,
            jahresbetrag: entry.annualAmount,
            kumuliert: entry.cumulativeAmount,
            restwert: entry.residualValue,
          });
        }
      }

      // If multiple positions, aggregate by year
      if (positions.length > 1) {
        const yearMap = new Map<number, { jahresbetrag: number; kumuliert: number }>();
        let runningCumulative = 0;
        
        // Collect all unique years and sum amounts
        const allYears = new Set(reportPlan.map(e => e.jahr));
        const sortedYears = Array.from(allYears).sort((a, b) => a - b);
        
        const aggregated: AfaPlanReportEntry[] = [];
        for (const yr of sortedYears) {
          const yearEntries = reportPlan.filter(e => e.jahr === yr);
          const yearTotal = yearEntries.reduce((sum, e) => sum + e.jahresbetrag, 0);
          runningCumulative += yearTotal;
          aggregated.push({
            jahr: yr,
            jahresbetrag: yearTotal,
            kumuliert: runningCumulative,
            restwert: totalBasis - runningCumulative,
          });
        }

        return {
          type: 'afa-plan',
          propertyId,
          year,
          disclaimer: DISCLAIMER,
          data: {
            afaBasis: totalBasis,
            afaSatz: positions[0].rate,
            afaStartdatum: positions[0].start_date,
            plan: aggregated,
          },
        };
      }

      return {
        type: 'afa-plan',
        propertyId,
        year,
        disclaimer: DISCLAIMER,
        data: {
          afaBasis: totalBasis,
          afaSatz: positions[0].rate,
          afaStartdatum: positions[0].start_date,
          plan: reportPlan,
        },
      };
    }

    // Fallback: legacy acquisitions table
    const acquisition = this.db.prepare(
      `SELECT afa_basis, afa_rate, afa_start_date FROM acquisitions WHERE property_id = ?`
    ).get(propertyId) as { afa_basis: number; afa_rate: number | null; afa_start_date: string | null } | undefined;

    if (!acquisition || !acquisition.afa_rate || !acquisition.afa_start_date) {
      return {
        type: 'afa-plan',
        propertyId,
        year,
        disclaimer: DISCLAIMER,
        hint: 'Keine AfA-Parameter vorhanden. Bitte AfA-Positionen unter "AfA" anlegen.',
        data: {
          afaBasis: acquisition?.afa_basis ?? 0,
          afaSatz: acquisition?.afa_rate ?? null,
          afaStartdatum: acquisition?.afa_start_date ?? null,
          plan: [],
        },
      };
    }

    const plan = generateAfaPlan(acquisition.afa_basis, acquisition.afa_rate, acquisition.afa_start_date);
    const reportPlan: AfaPlanReportEntry[] = plan.map(e => ({
      jahr: e.year,
      jahresbetrag: e.annualAmount,
      kumuliert: e.cumulativeAmount,
      restwert: e.residualValue,
    }));

    return {
      type: 'afa-plan',
      propertyId,
      year,
      disclaimer: DISCLAIMER,
      data: {
        afaBasis: acquisition.afa_basis,
        afaSatz: acquisition.afa_rate,
        afaStartdatum: acquisition.afa_start_date,
        plan: reportPlan,
      },
    };
  }

  // ─── Zins-/Tilgungsübersicht ─────────────────────────────────────────────────

  private generateZinsTilgung(filter: ReportFilter): ZinsTilgungReport {
    const { propertyId, year } = filter;
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    const rows = this.db.prepare(
      `SELECT lp.payment_date, l.lender, lp.interest_amount, lp.repayment_amount, lp.fee_amount, lp.extra_repayment
       FROM loan_payments lp
       JOIN loans l ON lp.loan_id = l.id
       WHERE l.property_id = ?
       AND lp.payment_date >= ? AND lp.payment_date < ?
       ORDER BY lp.payment_date`
    ).all(propertyId, startDate, endDate) as Array<{
      payment_date: string;
      lender: string;
      interest_amount: number;
      repayment_amount: number;
      fee_amount: number;
      extra_repayment: number;
    }>;

    const zahlungen: ZinsTilgungItem[] = rows.map(r => ({
      datum: r.payment_date,
      darlehensgeber: r.lender,
      zinsen: r.interest_amount,
      tilgung: r.repayment_amount,
      gebuehren: r.fee_amount,
      sondertilgung: r.extra_repayment,
      gesamt: r.interest_amount + r.repayment_amount + r.fee_amount + r.extra_repayment,
    }));

    const summeZinsen = zahlungen.reduce((s, z) => s + z.zinsen, 0);
    const summeTilgung = zahlungen.reduce((s, z) => s + z.tilgung + z.sondertilgung, 0);
    const summeGebuehren = zahlungen.reduce((s, z) => s + z.gebuehren, 0);
    const summeGesamt = zahlungen.reduce((s, z) => s + z.gesamt, 0);
    const hasData = zahlungen.length > 0;

    return {
      type: 'zins-tilgung',
      propertyId,
      year,
      disclaimer: DISCLAIMER,
      ...(hasData ? {} : { hint: NO_DATA_HINT }),
      data: {
        zahlungen,
        summeZinsen,
        summeTilgung,
        summeGebuehren,
        summeGesamt,
      },
    };
  }

  // ─── Mieteingangsstatus ──────────────────────────────────────────────────────

  private generateMieteingaenge(filter: ReportFilter): MieteingaengeReport {
    const { propertyId, year } = filter;
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    const rows = this.db.prepare(
      `SELECT due_date, total_amount, paid_amount, status
       FROM receivables
       WHERE property_id = ?
       AND due_date >= ? AND due_date < ?
       ORDER BY due_date`
    ).all(propertyId, startDate, endDate) as Array<{
      due_date: string;
      total_amount: number;
      paid_amount: number;
      status: string;
    }>;

    const sollstellungen: MieteingangItem[] = rows.map(r => ({
      faelligkeitsdatum: r.due_date,
      sollBetrag: r.total_amount,
      bezahlt: r.paid_amount,
      status: r.status,
    }));

    const summeGesamt = sollstellungen.reduce((s, r) => s + r.sollBetrag, 0);
    const summeBezahlt = sollstellungen.reduce((s, r) => s + r.bezahlt, 0);
    const summeOffen = summeGesamt - summeBezahlt;
    const hasData = sollstellungen.length > 0;

    return {
      type: 'mieteingaenge',
      propertyId,
      year,
      disclaimer: DISCLAIMER,
      ...(hasData ? {} : { hint: NO_DATA_HINT }),
      data: {
        sollstellungen,
        summeGesamt,
        summeBezahlt,
        summeOffen,
      },
    };
  }

  // ─── Belegvollständigkeit ────────────────────────────────────────────────────

  private generateBelegvollstaendigkeit(filter: ReportFilter): BelegvollstaendigkeitReport {
    const { propertyId, year } = filter;
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    const rows = this.db.prepare(
      `SELECT b.id, b.booking_date, b.description, b.total_amount,
              (SELECT COUNT(*) FROM document_links dl WHERE dl.entity_type = 'booking' AND dl.entity_id = b.id) as doc_count
       FROM bookings b
       WHERE b.property_id = ?
       AND b.booking_date >= ? AND b.booking_date < ?
       ORDER BY b.booking_date`
    ).all(propertyId, startDate, endDate) as Array<{
      id: string;
      booking_date: string;
      description: string | null;
      total_amount: number;
      doc_count: number;
    }>;

    const buchungen: BelegItem[] = rows.map(r => ({
      datum: r.booking_date,
      beschreibung: r.description,
      betrag: r.total_amount,
      belegVorhanden: r.doc_count > 0,
    }));

    const mitBeleg = buchungen.filter(b => b.belegVorhanden).length;
    const ohneBeleg = buchungen.filter(b => !b.belegVorhanden).length;
    const total = buchungen.length;
    const vollstaendigkeitQuote = total > 0 ? Math.round((mitBeleg / total) * 10000) / 100 : 0;
    const hasData = buchungen.length > 0;

    return {
      type: 'belegvollstaendigkeit',
      propertyId,
      year,
      disclaimer: DISCLAIMER,
      ...(hasData ? {} : { hint: NO_DATA_HINT }),
      data: {
        buchungen,
        mitBeleg,
        ohneBeleg,
        vollstaendigkeitQuote,
      },
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private verifyPropertyOwnership(propertyId: string, userId: string): void {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM properties WHERE id = ? AND user_id = ?')
      .get(propertyId, userId) as { count: number };

    if (result.count === 0) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
  }

  private getAfaForYear(propertyId: string, year: number): number {
    // Use afa_positions table (new multi-position system)
    const positions = this.db.prepare(
      `SELECT basis, rate, method, start_date FROM afa_positions WHERE property_id = ?`
    ).all(propertyId) as Array<{ basis: number; rate: number; method: string; start_date: string }>;

    if (positions.length === 0) {
      // Fallback: try legacy acquisitions table
      const acquisition = this.db.prepare(
        `SELECT afa_basis, afa_rate, afa_start_date FROM acquisitions WHERE property_id = ?`
      ).get(propertyId) as { afa_basis: number; afa_rate: number | null; afa_start_date: string | null } | undefined;

      if (!acquisition || !acquisition.afa_rate || !acquisition.afa_start_date) {
        return 0;
      }

      const plan = generateAfaPlan(acquisition.afa_basis, acquisition.afa_rate, acquisition.afa_start_date);
      const entry = plan.find(e => e.year === year);
      return entry?.annualAmount ?? 0;
    }

    // Sum AfA across all positions for the given year
    let totalAfa = 0;
    for (const pos of positions) {
      const plan = generateAfaPlanByMethod(pos.method as 'linear' | 'degressiv', pos.basis, pos.rate, pos.start_date);
      const entry = plan.find(e => e.year === year);
      totalAfa += entry?.annualAmount ?? 0;
    }
    return totalAfa;
  }
}
