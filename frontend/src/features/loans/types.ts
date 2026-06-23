/** Loan entity from the API */
export interface Loan {
  id: string;
  property_id: string;
  property_name?: string;
  lender: string;
  contract_number: string;
  loan_amount: number; // in cents
  interest_rate: number; // e.g. 2.5 for 2.5%
  repayment_rate: number; // e.g. 1.0 for 1%
  start_date: string;
  end_date: string;
  fixed_interest_months: number | null;
  interest_only_months: number;
  remaining_balance?: number; // in cents
  status?: 'aktiv' | 'abgeschlossen';
  created_at: string;
  updated_at: string;
}

/** Form data for creating/editing a loan */
export interface LoanFormData {
  property_id: string;
  lender: string;
  contract_number: string;
  loan_amount: string; // German formatted string
  interest_rate: string; // e.g. "2,50"
  repayment_rate: string; // e.g. "1,00"
  start_date: string;
  end_date: string;
  fixed_interest_months: string;
  interest_only_months: string;
}

/** Loan payment entity from the API */
export interface LoanPayment {
  id: string;
  loan_id: string;
  payment_date: string;
  interest_amount: number; // in cents
  repayment_amount: number; // in cents
  fee_amount: number; // in cents
  extra_repayment: number; // in cents
}

/** Form data for recording a payment */
export interface PaymentFormData {
  payment_date: string;
  interest_amount: string; // German formatted string
  repayment_amount: string; // German formatted string
  fee_amount: string; // German formatted string
  extra_repayment: string; // German formatted string
}

/** Balance entry for remaining balance display */
export interface BalanceEntry {
  payment_date: string;
  remaining_balance: number; // in cents
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;

/** Single entry in the annuity repayment schedule */
export interface AnnuityScheduleEntry {
  month: number;           // 1-based month count from start
  date: string;            // ISO date YYYY-MM-DD
  annuity: number;         // monthly payment (constant) in cents
  interestPortion: number; // Zinsanteil in cents
  repaymentPortion: number;// Tilgungsanteil in cents
  remainingBalance: number;// Restschuld after this payment in cents
}

/** Result of the annuity schedule calculation */
export interface AnnuityScheduleResult {
  monthlyAnnuity: number;  // in cents
  totalInterest: number;   // Gesamtzinsen in cents
  totalRepayment: number;  // Gesamttilgung in cents
  schedule: AnnuityScheduleEntry[];
}
