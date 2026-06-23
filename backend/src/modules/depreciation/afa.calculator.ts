/**
 * AfA (Absetzung für Abnutzung) Calculator
 * Pure functions for linear and degressive depreciation calculation.
 * All monetary values are in cents (integer).
 */

export type DepreciationMethod = 'linear' | 'degressiv';

export interface AfaPlanEntry {
  year: number;
  annualAmount: number;       // Jahres-AfA in Cents
  cumulativeAmount: number;   // Kumulierte AfA in Cents
  residualValue: number;      // Restwert in Cents
}

/**
 * Calculate annual AfA amount using linear method.
 * Result is rounded to the nearest cent.
 * @param basis - AfA-Bemessungsgrundlage in cents
 * @param rate - AfA-Satz as decimal (e.g., 0.02 for 2%)
 * @returns Annual AfA amount in cents
 */
export function calculateAnnualAfa(basis: number, rate: number): number {
  return Math.round(basis * rate);
}

/**
 * Calculate first year AfA with pro rata temporis.
 * The start month counts as a full month.
 * @param annualAmount - Full annual AfA in cents
 * @param startMonth - Month the AfA starts (1-12)
 * @returns Pro-rata first year AfA in cents
 */
export function calculateFirstYearAfa(annualAmount: number, startMonth: number): number {
  const remainingMonths = 12 - startMonth + 1;
  return Math.round(annualAmount * remainingMonths / 12);
}

/**
 * Generate a complete AfA plan from start until residual value reaches 0.
 * @param basis - AfA-Bemessungsgrundlage in cents
 * @param rate - AfA-Satz as decimal (e.g., 0.02 for 2%)
 * @param startDate - ISO date string (YYYY-MM-DD) when AfA begins
 * @returns Array of AfaPlanEntry until residual reaches 0
 */
export function generateAfaPlan(basis: number, rate: number, startDate: string): AfaPlanEntry[] {
  const plan: AfaPlanEntry[] = [];
  const annualAmount = calculateAnnualAfa(basis, rate);

  // Parse start date to get year and month
  const [yearStr, monthStr] = startDate.split('-');
  const startYear = parseInt(yearStr, 10);
  const startMonth = parseInt(monthStr, 10);

  let cumulativeAmount = 0;
  let currentYear = startYear;

  // First year: pro rata temporis if not starting on January 1st
  const isFullFirstYear = startMonth === 1;
  const firstYearAmount = isFullFirstYear
    ? annualAmount
    : calculateFirstYearAfa(annualAmount, startMonth);

  // Cap first year amount to not exceed basis
  const cappedFirstYear = Math.min(firstYearAmount, basis - cumulativeAmount);
  cumulativeAmount += cappedFirstYear;

  plan.push({
    year: currentYear,
    annualAmount: cappedFirstYear,
    cumulativeAmount,
    residualValue: basis - cumulativeAmount,
  });

  currentYear++;

  // Subsequent full years until residual reaches 0
  while (cumulativeAmount < basis) {
    const remaining = basis - cumulativeAmount;
    const yearAmount = Math.min(annualAmount, remaining);

    cumulativeAmount += yearAmount;

    plan.push({
      year: currentYear,
      annualAmount: yearAmount,
      cumulativeAmount,
      residualValue: basis - cumulativeAmount,
    });

    currentYear++;
  }

  return plan;
}

/**
 * Convert duration in years to rate.
 * @param durationYears - Number of years for depreciation (1-100)
 * @returns Rate as decimal (e.g., 10 years → 0.1)
 */
export function durationToRate(durationYears: number): number {
  return 1 / durationYears;
}

/**
 * Generate a degressive AfA plan.
 * Each year: amount = round(currentResidual × rate)
 * First year: pro rata temporis based on start month.
 * Terminates when residual rounds to 0.
 * If annual amount < 1 cent: set amount to remaining residual and terminate.
 * @param basis - AfA-Bemessungsgrundlage in cents
 * @param rate - AfA-Satz as decimal (e.g., 0.05 for 5%)
 * @param startDate - ISO date string (YYYY-MM-DD) when AfA begins
 * @returns Array of AfaPlanEntry until residual reaches 0
 */
export function generateDegressiveAfaPlan(
  basis: number,
  rate: number,
  startDate: string
): AfaPlanEntry[] {
  const plan: AfaPlanEntry[] = [];

  // Parse start date to get year and month
  const [yearStr, monthStr] = startDate.split('-');
  const startYear = parseInt(yearStr, 10);
  const startMonth = parseInt(monthStr, 10);

  let cumulativeAmount = 0;
  let currentResidual = basis;
  let currentYear = startYear;

  // First year: pro rata temporis
  const fullFirstYearAmount = Math.round(currentResidual * rate);
  const remainingMonths = 12 - startMonth + 1;
  let firstYearAmount = startMonth === 1
    ? fullFirstYearAmount
    : Math.round(fullFirstYearAmount * remainingMonths / 12);

  // If annual amount < 1 cent, set to remaining residual and terminate
  if (firstYearAmount < 1) {
    firstYearAmount = currentResidual;
  }

  // Cap to not exceed residual
  firstYearAmount = Math.min(firstYearAmount, currentResidual);

  cumulativeAmount += firstYearAmount;
  currentResidual -= firstYearAmount;

  plan.push({
    year: currentYear,
    annualAmount: firstYearAmount,
    cumulativeAmount,
    residualValue: currentResidual,
  });

  currentYear++;

  // Subsequent years until residual reaches 0
  while (currentResidual > 0) {
    let yearAmount = Math.round(currentResidual * rate);

    // If annual amount < 1 cent, set to remaining residual and terminate
    if (yearAmount < 1) {
      yearAmount = currentResidual;
    }

    // Cap to not exceed residual
    yearAmount = Math.min(yearAmount, currentResidual);

    cumulativeAmount += yearAmount;
    currentResidual -= yearAmount;

    plan.push({
      year: currentYear,
      annualAmount: yearAmount,
      cumulativeAmount,
      residualValue: currentResidual,
    });

    currentYear++;
  }

  return plan;
}

/**
 * Unified entry point for AfA plan generation.
 * Dispatches to linear or degressive based on method.
 * @param method - Depreciation method: 'linear' or 'degressiv'
 * @param basis - AfA-Bemessungsgrundlage in cents
 * @param rate - AfA-Satz as decimal
 * @param startDate - ISO date string (YYYY-MM-DD) when AfA begins
 * @returns Array of AfaPlanEntry
 */
export function generateAfaPlanByMethod(
  method: DepreciationMethod,
  basis: number,
  rate: number,
  startDate: string
): AfaPlanEntry[] {
  if (method === 'degressiv') return generateDegressiveAfaPlan(basis, rate, startDate);
  return generateAfaPlan(basis, rate, startDate);
}
