import type { FastifyInstance } from 'fastify';
import {
  calculateMonthlyCashflow,
  calculateGrossYield,
  calculateNetYield,
  type MonthlyCashflowResult,
} from './cashflow.calculator.js';
import { CashflowRepository } from './cashflow.repository.js';

export interface MonthlyCashflowEntry {
  month: number;
  year: number;
  incomeTotal: number;
  expensesWithoutRepayment: number;
  repaymentTotal: number;
  cashflowBeforeRepayment: number;
  cashflowAfterRepayment: number;
}

export interface AnnualCashflowResult {
  year: number;
  monthly: MonthlyCashflowEntry[];
  annualIncomeTotal: number;
  annualExpensesWithoutRepayment: number;
  annualRepaymentTotal: number;
  annualCashflowBeforeRepayment: number;
  annualCashflowAfterRepayment: number;
}

export interface YieldResult {
  grossYield: number | null;
  netYield: number | null;
  annualColdRent: number;
  totalInvestment: number;
  annualNonAllocableCosts: number;
  hint?: string;
}

export class CashflowService {
  private repository: CashflowRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new CashflowRepository(app.db);
  }

  /**
   * Get monthly and annual cashflow for a property in a given year.
   */
  getCashflow(propertyId: string, userId: string, year: number): AnnualCashflowResult {
    // Verify property belongs to user
    this.verifyPropertyOwnership(propertyId, userId);

    const monthly: MonthlyCashflowEntry[] = [];

    for (let month = 1; month <= 12; month++) {
      const income = this.repository.getMonthlyIncome(propertyId, year, month);
      const totalExpenses = this.repository.getMonthlyCashExpenses(propertyId, year, month);
      const repaymentFromExpenses = this.repository.getMonthlyRepaymentFromExpenses(propertyId, year, month);
      const repaymentFromLoans = this.repository.getMonthlyLoanRepayment(propertyId, year, month);

      // Expenses without repayment = total expenses - repayment portion in expenses
      const expenses = totalExpenses - repaymentFromExpenses;
      // Total repayment = from loan_payments table
      const repayment = repaymentFromLoans;

      const cashflow: MonthlyCashflowResult = calculateMonthlyCashflow(income, expenses, repayment);

      monthly.push({
        month,
        year,
        incomeTotal: income,
        expensesWithoutRepayment: expenses,
        repaymentTotal: repayment,
        cashflowBeforeRepayment: cashflow.beforeRepayment,
        cashflowAfterRepayment: cashflow.afterRepayment,
      });
    }

    const annualIncomeTotal = monthly.reduce((sum, m) => sum + m.incomeTotal, 0);
    const annualExpensesWithoutRepayment = monthly.reduce((sum, m) => sum + m.expensesWithoutRepayment, 0);
    const annualRepaymentTotal = monthly.reduce((sum, m) => sum + m.repaymentTotal, 0);

    return {
      year,
      monthly,
      annualIncomeTotal,
      annualExpensesWithoutRepayment,
      annualRepaymentTotal,
      annualCashflowBeforeRepayment: annualIncomeTotal - annualExpensesWithoutRepayment,
      annualCashflowAfterRepayment: annualIncomeTotal - annualExpensesWithoutRepayment - annualRepaymentTotal,
    };
  }

  /**
   * Get yield (Rendite) calculations for a property.
   */
  getYield(propertyId: string, userId: string): YieldResult {
    // Verify property belongs to user
    this.verifyPropertyOwnership(propertyId, userId);

    // Get total investment from acquisitions
    const acquisition = this.repository.getAcquisition(propertyId);

    if (!acquisition) {
      return {
        grossYield: null,
        netYield: null,
        annualColdRent: 0,
        totalInvestment: 0,
        annualNonAllocableCosts: 0,
        hint: 'Keine Anschaffungsdaten vorhanden. Bitte erfassen Sie die Kaufdaten des Objekts.',
      };
    }

    const totalInvestment =
      acquisition.purchase_price +
      acquisition.notary_cost +
      acquisition.transfer_tax +
      acquisition.land_registry_cost +
      acquisition.broker_cost;

    if (totalInvestment === 0) {
      return {
        grossYield: null,
        netYield: null,
        annualColdRent: 0,
        totalInvestment: 0,
        annualNonAllocableCosts: 0,
        hint: 'Die Gesamtinvestitionskosten betragen 0. Bitte prüfen Sie die Anschaffungsdaten.',
      };
    }

    // Get annual cold rent from active leases
    const annualColdRent = this.repository.getAnnualColdRent(propertyId);

    if (annualColdRent === 0) {
      return {
        grossYield: null,
        netYield: null,
        annualColdRent: 0,
        totalInvestment,
        annualNonAllocableCosts: 0,
        hint: 'Keine aktiven Mietverträge vorhanden. Bitte erfassen Sie einen Mietvertrag.',
      };
    }

    // Get annual non-allocable costs (for the current year)
    const currentYear = new Date().getFullYear();
    const annualNonAllocableCosts = this.repository.getAnnualNonAllocableCosts(propertyId, currentYear);

    const grossYield = calculateGrossYield(annualColdRent, totalInvestment);
    const netYield = calculateNetYield(annualColdRent, annualNonAllocableCosts, totalInvestment);

    return {
      grossYield,
      netYield,
      annualColdRent,
      totalInvestment,
      annualNonAllocableCosts,
    };
  }

  // -- Private helpers --

  private verifyPropertyOwnership(propertyId: string, userId: string): void {
    if (!this.repository.propertyBelongsToUser(propertyId, userId)) {
      const error = new Error('Objekt nicht gefunden oder gehört nicht dem Benutzer') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
  }
}
