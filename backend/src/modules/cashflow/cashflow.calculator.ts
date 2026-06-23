/**
 * Cashflow & Yield Calculator
 * Pure functions for cashflow and yield calculations.
 * All monetary values are in cents (integer).
 */

export interface MonthlyCashflowResult {
  beforeRepayment: number;
  afterRepayment: number;
}

/**
 * Calculate monthly cashflow before and after repayment.
 * @param income - Total income for the month in cents
 * @param expenses - Total cash expenses (excluding repayment, excluding non-cash like AfA) in cents
 * @param repayment - Total repayment amount for the month in cents
 * @returns Cashflow before and after repayment in cents
 */
export function calculateMonthlyCashflow(
  income: number,
  expenses: number,
  repayment: number
): MonthlyCashflowResult {
  return {
    beforeRepayment: income - expenses,
    afterRepayment: income - expenses - repayment,
  };
}

/**
 * Calculate gross yield (Bruttomietrendite).
 * Formula: (annualRent / totalInvestment) × 100, rounded to 2 decimal places.
 * @param annualRent - Annual cold rent in cents
 * @param totalInvestment - Total investment costs in cents
 * @returns Gross yield as percentage (e.g., 5.23) or null if totalInvestment is 0 or invalid
 */
export function calculateGrossYield(
  annualRent: number,
  totalInvestment: number
): number | null {
  if (totalInvestment <= 0) {
    return null;
  }
  return Math.round((annualRent / totalInvestment) * 100 * 100) / 100;
}

/**
 * Calculate net yield (Nettomietrendite).
 * Formula: ((annualRent - nonAllocableCosts) / totalInvestment) × 100, rounded to 2 decimal places.
 * @param annualRent - Annual cold rent in cents
 * @param nonAllocableCosts - Annual non-allocable costs in cents
 * @param totalInvestment - Total investment costs in cents
 * @returns Net yield as percentage (e.g., 4.12) or null if totalInvestment is 0 or invalid
 */
export function calculateNetYield(
  annualRent: number,
  nonAllocableCosts: number,
  totalInvestment: number
): number | null {
  if (totalInvestment <= 0) {
    return null;
  }
  return Math.round(((annualRent - nonAllocableCosts) / totalInvestment) * 100 * 100) / 100;
}
