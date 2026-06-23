import { api } from '../../shared/api/client';
import { parseCurrencyInput, parseGermanNumber } from '../../shared/utils/formatting';
import type { Loan, LoanFormData, LoanPayment, PaymentFormData, BalanceEntry, AnnuityScheduleResult } from './types';

/** Fetch loans with optional property filter */
export async function fetchLoans(propertyId?: string): Promise<Loan[]> {
  const params: Record<string, string> = {};
  if (propertyId) params.propertyId = propertyId;
  return api.get<Loan[]>('/loans', params);
}

/** Fetch a single loan by ID */
export async function fetchLoan(id: string): Promise<Loan> {
  return api.get<Loan>(`/loans/${id}`);
}

/** Create a new loan */
export async function createLoan(data: LoanFormData): Promise<Loan> {
  return api.post<Loan>('/loans', {
    property_id: data.property_id,
    lender: data.lender.trim(),
    contract_number: data.contract_number.trim(),
    loan_amount: parseCurrencyInput(data.loan_amount) ?? 0,
    interest_rate: parseGermanNumber(data.interest_rate) ?? 0,
    repayment_rate: parseGermanNumber(data.repayment_rate) ?? 0,
    start_date: data.start_date,
    end_date: data.end_date,
    fixed_interest_months: data.fixed_interest_months ? parseInt(data.fixed_interest_months, 10) : null,
    interest_only_months: data.interest_only_months ? parseInt(data.interest_only_months, 10) : 0,
  });
}

/** Update an existing loan */
export async function updateLoan(id: string, data: LoanFormData): Promise<Loan> {
  return api.put<Loan>(`/loans/${id}`, {
    property_id: data.property_id,
    lender: data.lender.trim(),
    contract_number: data.contract_number.trim(),
    loan_amount: parseCurrencyInput(data.loan_amount) ?? 0,
    interest_rate: parseGermanNumber(data.interest_rate) ?? 0,
    repayment_rate: parseGermanNumber(data.repayment_rate) ?? 0,
    start_date: data.start_date,
    end_date: data.end_date,
    fixed_interest_months: data.fixed_interest_months ? parseInt(data.fixed_interest_months, 10) : null,
    interest_only_months: data.interest_only_months ? parseInt(data.interest_only_months, 10) : 0,
  });
}

/** Delete a loan */
export async function deleteLoan(id: string): Promise<void> {
  return api.delete(`/loans/${id}`);
}

/** Record a payment for a loan */
export async function recordPayment(loanId: string, data: PaymentFormData): Promise<LoanPayment> {
  return api.post<LoanPayment>(`/loans/${loanId}/payments`, {
    payment_date: data.payment_date,
    interest_amount: parseCurrencyInput(data.interest_amount) ?? 0,
    repayment_amount: parseCurrencyInput(data.repayment_amount) ?? 0,
    fee_amount: parseCurrencyInput(data.fee_amount) ?? 0,
    extra_repayment: parseCurrencyInput(data.extra_repayment) ?? 0,
  });
}

/** Fetch payments for a loan */
export async function fetchPayments(loanId: string): Promise<LoanPayment[]> {
  return api.get<LoanPayment[]>(`/loans/${loanId}/payments`);
}

/** Fetch remaining balance history for a loan */
export async function fetchBalance(loanId: string): Promise<BalanceEntry[]> {
  return api.get<BalanceEntry[]>(`/loans/${loanId}/balance`);
}

/** Fetch calculated annuity repayment schedule */
export async function fetchSchedule(loanId: string): Promise<AnnuityScheduleResult> {
  return api.get<AnnuityScheduleResult>(`/loans/${loanId}/schedule`);
}
