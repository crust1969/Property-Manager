import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { generateAfaPlanByMethod, type DepreciationMethod } from '../depreciation/afa.calculator.js';
import { calculateAnnuitySchedule } from '../loan/annuity.calculator.js';

// ─── Profitability Interfaces ───────────────────────────────────────────────────

export interface ProfitabilityInput {
  propertyId: string;
  equityInvested: number;           // Eigenkapital in cents
  purchasePrice: number;            // Kaufpreis in cents
  annualAppreciationRates: number[]; // e.g. [0.02, 0.03, 0.04, 0.05]
  years: number;                     // same as simulation years
  totalCashflow: number;            // from cashflow simulation (cents)
  remainingLoanBalance: number;     // Restschuld after N years (cents)
}

export interface ProfitabilityScenario {
  appreciationRate: number;          // e.g. 0.03
  estimatedSalePrice: number;        // purchasePrice * (1 + rate)^years
  remainingLoanBalance: number;
  equityAtSale: number;             // salePrice - remainingLoanBalance
  totalProfit: number;              // equityAtSale + totalCashflow - equityInvested
  eigenkapitalRendite: number;      // (totalProfit / equityInvested) * 100
  roi: number;                      // (totalProfit / purchasePrice) * 100
  annualizedReturn: number;         // ((1 + totalProfit/equityInvested)^(1/years) - 1) * 100
}

export interface ProfitabilityResult {
  input: ProfitabilityInput;
  scenarios: ProfitabilityScenario[];
  formulas: {
    salePrice: string;
    equityAtSale: string;
    totalProfit: string;
    eigenkapitalRendite: string;
    roi: string;
    annualizedReturn: string;
  };
}

// ─── Simulation Interfaces ─────────────────────────────────────────────────────

export interface SimulationInput {
  propertyId: string;
  taxRate: number;              // e.g. 0.44 for 44%
  annualNonAllocableCosts: number; // in cents, annual
  years: number;                // default 10
  rentIncreasePercent: number;  // e.g. 0.05 for 5% increase
  rentIncreaseEveryYears: number; // e.g. 3 = every 3 years
}

export interface SimulationYearEntry {
  year: number;
  rentalIncome: number;         // Mieteinnahmen (cents)
  depreciation: number;         // AfA (cents)
  loanInterest: number;         // Darlehenszinsen (cents)
  nonAllocableCosts: number;    // Nicht umlagefähige NK (cents)
  taxDeductibleTotal: number;   // Summe absetzbar
  taxableResult: number;        // Mieteinnahmen - absetzbar
  taxEffect: number;            // Steuerersparnis (+) oder -last (-)
  annuity: number;              // Jährliche Annuität (cents)
  cashflow: number;             // Netto-Cashflow
}

export interface SimulationResult {
  input: SimulationInput;
  entries: SimulationYearEntry[];
  totalCashflow: number;
  totalTaxEffect: number;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class SimulationService {
  private db: Database.Database;

  constructor(private app: FastifyInstance) {
    this.db = app.db;
  }

  /**
   * Run cashflow simulation for a property over N years.
   */
  simulate(input: SimulationInput, userId: string): SimulationResult {
    this.verifyPropertyOwnership(input.propertyId, userId);

    const currentYear = new Date().getFullYear();
    const entries: SimulationYearEntry[] = [];

    // Pre-calculate annual rental income from active leases
    const baseMonthlyRent = this.getMonthlyRentalIncome(input.propertyId);

    // Get lease start month for pro-rata calculation in first year
    const leaseStartMonth = this.getEarliestLeaseStartMonth(input.propertyId, currentYear);

    // Pre-calculate AfA plan per year (already handles pro-rata internally)
    const afaByYear = this.getAfaByYear(input.propertyId, currentYear, input.years);

    // Pre-calculate loan schedule data (interest + annuity per year — already pro-rata from schedule)
    const loanData = this.getLoanDataByYear(input.propertyId, currentYear, input.years);

    for (let i = 0; i < input.years; i++) {
      const year = currentYear + i;

      // Calculate base monthly rent with increases applied
      let monthlyRent = baseMonthlyRent;
      if (input.rentIncreaseEveryYears > 0 && input.rentIncreasePercent > 0) {
        const increaseCount = Math.floor(i / input.rentIncreaseEveryYears);
        monthlyRent = Math.round(baseMonthlyRent * Math.pow(1 + input.rentIncreasePercent, increaseCount));
      }

      // Pro-rata for first year: only months from lease start
      let activeMonths = 12;
      if (i === 0 && leaseStartMonth > 1) {
        activeMonths = 12 - leaseStartMonth + 1; // e.g. start in March → 10 months
      }

      const rentalIncome = monthlyRent * activeMonths;

      // Non-allocable costs also pro-rata in first year
      const nonAllocableCosts = Math.round(input.annualNonAllocableCosts * activeMonths / 12);

      // AfA already calculated pro-rata in the plan (from afa.calculator)
      const depreciation = afaByYear.get(year) ?? 0;
      // Loan interest already pro-rata from the annuity schedule
      const loanInterest = loanData.interestByYear.get(year) ?? 0;

      const taxDeductibleTotal = depreciation + loanInterest + nonAllocableCosts;
      const taxableResult = rentalIncome - taxDeductibleTotal;

      // Tax effect: if taxableResult < 0 → tax saving (positive), if >= 0 → tax liability (negative)
      let taxEffect: number;
      if (taxableResult < 0) {
        taxEffect = Math.round(Math.abs(taxableResult) * input.taxRate);
      } else {
        taxEffect = -Math.round(taxableResult * input.taxRate);
      }

      const annuity = loanData.annuityByYear.get(year) ?? 0;

      // Cashflow = Mieteinnahmen + Steuereffekt - Annuität - nicht umlagefähige NK
      const cashflow = rentalIncome + taxEffect - annuity - nonAllocableCosts;

      entries.push({
        year,
        rentalIncome,
        depreciation,
        loanInterest,
        nonAllocableCosts,
        taxDeductibleTotal,
        taxableResult,
        taxEffect,
        annuity,
        cashflow,
      });
    }

    const totalCashflow = entries.reduce((sum, e) => sum + e.cashflow, 0);
    const totalTaxEffect = entries.reduce((sum, e) => sum + e.taxEffect, 0);

    return {
      input,
      entries,
      totalCashflow,
      totalTaxEffect,
    };
  }

  /**
   * Calculate profitability analysis for multiple appreciation scenarios.
   */
  calculateProfitability(input: ProfitabilityInput, userId: string): ProfitabilityResult {
    this.verifyPropertyOwnership(input.propertyId, userId);

    const scenarios: ProfitabilityScenario[] = input.annualAppreciationRates.map((rate) => {
      // Rate is the TOTAL appreciation over the full period (not per year)
      // e.g. 0.20 = 20% total increase after N years
      const estimatedSalePrice = Math.round(input.purchasePrice * (1 + rate));
      const remainingLoanBalance = input.remainingLoanBalance;
      const equityAtSale = estimatedSalePrice - remainingLoanBalance;
      const totalProfit = equityAtSale + input.totalCashflow - input.equityInvested;

      let eigenkapitalRendite = 0;
      let annualizedReturn = 0;
      if (input.equityInvested > 0) {
        eigenkapitalRendite = (totalProfit / input.equityInvested) * 100;
        const ratio = 1 + totalProfit / input.equityInvested;
        if (ratio > 0 && input.years > 0) {
          annualizedReturn = (Math.pow(ratio, 1 / input.years) - 1) * 100;
        }
      }

      const roi = input.purchasePrice > 0
        ? (totalProfit / input.purchasePrice) * 100
        : 0;

      return {
        appreciationRate: rate,
        estimatedSalePrice,
        remainingLoanBalance,
        equityAtSale,
        totalProfit,
        eigenkapitalRendite: Math.round(eigenkapitalRendite * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        annualizedReturn: Math.round(annualizedReturn * 100) / 100,
      };
    });

    return {
      input,
      scenarios,
      formulas: {
        salePrice: 'Verkaufspreis = Kaufpreis × (1 + Wertsteigerung gesamt)',
        equityAtSale: 'Eigenkapital bei Verkauf = Verkaufspreis − Restschuld',
        totalProfit: 'Gesamtgewinn = EK bei Verkauf + Gesamt-Cashflow − eingesetztes EK',
        eigenkapitalRendite: 'EK-Rendite = (Gesamtgewinn / eingesetztes EK) × 100',
        roi: 'ROI = (Gesamtgewinn / Gesamtinvestition) × 100',
        annualizedReturn: 'Rendite p.a. = ((1 + Gesamtgewinn / EK)^(1/Jahre) − 1) × 100',
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

  /**
   * Get monthly rental income from active leases (sum of cold_rent).
   */
  private getMonthlyRentalIncome(propertyId: string): number {
    const result = this.db.prepare(
      `SELECT COALESCE(SUM(cold_rent), 0) as monthly_total
       FROM leases
       WHERE property_id = ? AND status = 'aktiv'`
    ).get(propertyId) as { monthly_total: number };

    return result.monthly_total;
  }

  /**
   * Get the earliest lease start month for the given year (for pro-rata calculation).
   * Returns 1 if lease started before the current year.
   */
  private getEarliestLeaseStartMonth(propertyId: string, currentYear: number): number {
    const result = this.db.prepare(
      `SELECT start_date FROM leases
       WHERE property_id = ? AND status = 'aktiv'
       ORDER BY start_date ASC LIMIT 1`
    ).get(propertyId) as { start_date: string } | undefined;

    if (!result) return 1;

    const startYear = parseInt(result.start_date.split('-')[0], 10);
    const startMonth = parseInt(result.start_date.split('-')[1], 10);

    // If lease started before the current year, full year applies
    if (startYear < currentYear) return 1;
    // If lease starts in the current year, use its start month
    if (startYear === currentYear) return startMonth;
    // Future start — no income yet
    return 13; // will result in 0 months
  }

  /**
   * Get AfA amounts per year from afa_positions table.
   * Falls back to legacy acquisitions table if no positions exist.
   */
  private getAfaByYear(propertyId: string, startYear: number, years: number): Map<number, number> {
    const afaByYear = new Map<number, number>();

    const positions = this.db.prepare(
      `SELECT basis, rate, method, start_date FROM afa_positions WHERE property_id = ?`
    ).all(propertyId) as Array<{ basis: number; rate: number; method: string; start_date: string }>;

    if (positions.length > 0) {
      for (const pos of positions) {
        const plan = generateAfaPlanByMethod(
          pos.method as DepreciationMethod,
          pos.basis,
          pos.rate,
          pos.start_date
        );
        for (const entry of plan) {
          if (entry.year >= startYear && entry.year < startYear + years) {
            afaByYear.set(entry.year, (afaByYear.get(entry.year) ?? 0) + entry.annualAmount);
          }
        }
      }
    } else {
      // Fallback: legacy acquisitions
      const acquisition = this.db.prepare(
        `SELECT afa_basis, afa_rate, afa_start_date FROM acquisitions WHERE property_id = ?`
      ).get(propertyId) as { afa_basis: number; afa_rate: number | null; afa_start_date: string | null } | undefined;

      if (acquisition && acquisition.afa_rate && acquisition.afa_start_date) {
        const plan = generateAfaPlanByMethod(
          'linear',
          acquisition.afa_basis,
          acquisition.afa_rate,
          acquisition.afa_start_date
        );
        for (const entry of plan) {
          if (entry.year >= startYear && entry.year < startYear + years) {
            afaByYear.set(entry.year, entry.annualAmount);
          }
        }
      }
    }

    return afaByYear;
  }

  /**
   * Get loan interest and total annuity per year from calculated annuity schedules.
   */
  private getLoanDataByYear(
    propertyId: string,
    startYear: number,
    years: number
  ): { interestByYear: Map<number, number>; annuityByYear: Map<number, number> } {
    const interestByYear = new Map<number, number>();
    const annuityByYear = new Map<number, number>();

    const loans = this.db.prepare(
      `SELECT loan_amount, interest_rate, repayment_rate, start_date, fixed_interest_months, interest_only_months
       FROM loans WHERE property_id = ?`
    ).all(propertyId) as Array<{
      loan_amount: number;
      interest_rate: number;
      repayment_rate: number;
      start_date: string;
      fixed_interest_months: number | null;
      interest_only_months: number;
    }>;

    for (const loan of loans) {
      const schedule = calculateAnnuitySchedule(
        loan.loan_amount,
        loan.interest_rate,
        loan.repayment_rate,
        loan.start_date,
        loan.fixed_interest_months,
        loan.interest_only_months
      );

      // Group schedule entries by calendar year
      for (const entry of schedule.schedule) {
        const entryYear = parseInt(entry.date.split('-')[0], 10);
        if (entryYear >= startYear && entryYear < startYear + years) {
          interestByYear.set(
            entryYear,
            (interestByYear.get(entryYear) ?? 0) + entry.interestPortion
          );
          annuityByYear.set(
            entryYear,
            (annuityByYear.get(entryYear) ?? 0) + entry.annuity
          );
        }
      }
    }

    return { interestByYear, annuityByYear };
  }
}
