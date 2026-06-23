export interface AnnuityScheduleEntry {
  month: number;           // 1-based month count from start
  date: string;            // ISO date YYYY-MM-DD
  annuity: number;         // monthly payment (constant) in cents
  interestPortion: number; // Zinsanteil in cents
  repaymentPortion: number;// Tilgungsanteil in cents
  remainingBalance: number;// Restschuld after this payment in cents
}

export interface AnnuityScheduleResult {
  monthlyAnnuity: number;  // in cents
  totalInterest: number;   // Gesamtzinsen in cents
  totalRepayment: number;  // Gesamttilgung in cents
  schedule: AnnuityScheduleEntry[];
}

/**
 * Calculate annuity repayment schedule.
 *
 * Formula:
 * - Annual annuity = loan_amount * (interest_rate + repayment_rate) / 100
 * - Monthly annuity = annual_annuity / 12
 * - Each month: interest = remaining_balance * (interest_rate / 100) / 12
 * - Each month: repayment = monthly_annuity - interest
 *
 * During the interest-only period (tilgungsfreie Zeit):
 * - Only interest is paid, no repayment
 * - Remaining balance stays unchanged
 *
 * Continue until remaining_balance <= 0 or fixed_interest_months is reached.
 */
export function calculateAnnuitySchedule(
  loanAmount: number,       // in cents
  interestRate: number,     // annual %, e.g. 3.5
  repaymentRate: number,    // initial annual repayment %, e.g. 2.0
  startDate: string,        // ISO YYYY-MM-DD
  fixedInterestMonths?: number | null, // Sollzinsbindung in months
  interestOnlyMonths?: number // tilgungsfreie Monate am Anfang
): AnnuityScheduleResult {
  const annualAnnuity = loanAmount * (interestRate + repaymentRate) / 100;
  const monthlyAnnuity = Math.round(annualAnnuity / 12);
  const interestOnlyPeriod = interestOnlyMonths ?? 0;

  const schedule: AnnuityScheduleEntry[] = [];
  let remainingBalance = loanAmount;
  let totalInterest = 0;
  let totalRepayment = 0;

  const start = parseDate(startDate);
  let month = 0;

  while (remainingBalance > 0) {
    month++;

    // Respect fixed interest period
    if (fixedInterestMonths != null && month > fixedInterestMonths) {
      break;
    }

    const date = addMonths(start, month);
    const dateStr = formatISODate(date);

    // Calculate interest for this month
    const interestPortion = Math.round(remainingBalance * (interestRate / 100) / 12);

    let repaymentPortion: number;
    let actualAnnuity: number;

    if (month <= interestOnlyPeriod) {
      // Tilgungsfreie Zeit: nur Zinsen, keine Tilgung
      repaymentPortion = 0;
      actualAnnuity = interestPortion;
    } else {
      // Normal annuity payment
      repaymentPortion = monthlyAnnuity - interestPortion;

      // In the final month, cap repayment at remaining balance
      if (repaymentPortion >= remainingBalance) {
        repaymentPortion = remainingBalance;
      }

      actualAnnuity = interestPortion + repaymentPortion;
    }

    remainingBalance -= repaymentPortion;
    totalInterest += interestPortion;
    totalRepayment += repaymentPortion;

    schedule.push({
      month,
      date: dateStr,
      annuity: actualAnnuity,
      interestPortion,
      repaymentPortion,
      remainingBalance,
    });
  }

  return {
    monthlyAnnuity,
    totalInterest,
    totalRepayment,
    schedule,
  };
}

function parseDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  return result;
}

function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
