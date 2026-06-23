import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { LoanRepository, type LoanRecord, type LoanPaymentRecord } from './loan.repository.js';
import type { CreateLoanInput, UpdateLoanInput, CreatePaymentInput } from './loan.validators.js';
import { calculateAnnuitySchedule, type AnnuityScheduleResult } from './annuity.calculator.js';

export interface LoanResponse {
  id: string;
  property_id: string;
  lender: string;
  contract_number: string | null;
  loan_amount: number;
  interest_rate: number;
  repayment_rate: number;
  start_date: string;
  end_date: string;
  fixed_interest_months: number | null;
  interest_only_months: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentResponse {
  id: string;
  loan_id: string;
  payment_date: string;
  interest_amount: number;
  repayment_amount: number;
  fee_amount: number;
  extra_repayment: number;
  total_payment: number;
  tax_deductible: number;
  not_tax_deductible: number;
}

export interface BalanceEntry {
  payment_date: string;
  interest_amount: number;
  repayment_amount: number;
  fee_amount: number;
  extra_repayment: number;
  total_payment: number;
  remaining_balance: number;
}

export interface BalanceResponse {
  loan_amount: number;
  total_repaid: number;
  remaining_balance: number;
  history: BalanceEntry[];
}

function formatLoan(loan: LoanRecord): LoanResponse {
  return {
    id: loan.id,
    property_id: loan.property_id,
    lender: loan.lender,
    contract_number: loan.contract_number,
    loan_amount: loan.loan_amount,
    interest_rate: loan.interest_rate,
    repayment_rate: loan.repayment_rate,
    start_date: loan.start_date,
    end_date: loan.end_date,
    fixed_interest_months: loan.fixed_interest_months,
    interest_only_months: loan.interest_only_months,
    created_at: loan.created_at,
    updated_at: loan.updated_at,
  };
}

function formatPayment(payment: LoanPaymentRecord): PaymentResponse {
  const totalPayment = payment.interest_amount + payment.repayment_amount + payment.fee_amount + payment.extra_repayment;
  // Tax classification: interest + fees → Werbungskosten (tax deductible)
  // repayment + extra → not deductible
  const taxDeductible = payment.interest_amount + payment.fee_amount;
  const notTaxDeductible = payment.repayment_amount + payment.extra_repayment;

  return {
    id: payment.id,
    loan_id: payment.loan_id,
    payment_date: payment.payment_date,
    interest_amount: payment.interest_amount,
    repayment_amount: payment.repayment_amount,
    fee_amount: payment.fee_amount,
    extra_repayment: payment.extra_repayment,
    total_payment: totalPayment,
    tax_deductible: taxDeductible,
    not_tax_deductible: notTaxDeductible,
  };
}

export class LoanService {
  private repository: LoanRepository;

  constructor(app: FastifyInstance) {
    this.repository = new LoanRepository(app.db);
  }

  /**
   * List loans for a user, optionally filtered by property.
   */
  listLoans(userId: string, propertyId?: string): LoanResponse[] {
    const loans = this.repository.findAllByUserId(userId, propertyId);
    return loans.map(formatLoan);
  }

  /**
   * Create a new loan.
   */
  createLoan(userId: string, input: CreateLoanInput): LoanResponse {
    // Verify property belongs to user
    if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const now = new Date().toISOString();
    const loan: LoanRecord = {
      id: uuidv4(),
      property_id: input.property_id,
      lender: input.lender,
      contract_number: input.contract_number ?? null,
      loan_amount: input.loan_amount,
      interest_rate: input.interest_rate,
      repayment_rate: input.repayment_rate,
      start_date: input.start_date,
      end_date: input.end_date,
      fixed_interest_months: input.fixed_interest_months ?? null,
      interest_only_months: input.interest_only_months ?? 0,
      created_at: now,
      updated_at: now,
    };

    this.repository.create(loan);
    return formatLoan(loan);
  }

  /**
   * Get a single loan by ID.
   */
  getLoan(id: string, userId: string): LoanResponse {
    const loan = this.repository.findById(id, userId);
    if (!loan) {
      const error = new Error('Darlehen nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return formatLoan(loan);
  }

  /**
   * Update a loan.
   */
  updateLoan(id: string, userId: string, input: UpdateLoanInput): LoanResponse {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Darlehen nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Verify property belongs to user
    if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const now = new Date().toISOString();
    this.repository.update(id, {
      property_id: input.property_id,
      lender: input.lender,
      contract_number: input.contract_number ?? null,
      loan_amount: input.loan_amount,
      interest_rate: input.interest_rate,
      repayment_rate: input.repayment_rate,
      start_date: input.start_date,
      end_date: input.end_date,
      fixed_interest_months: input.fixed_interest_months ?? null,
      interest_only_months: input.interest_only_months ?? 0,
      updated_at: now,
    });

    return this.getLoan(id, userId);
  }

  /**
   * Delete a loan.
   */
  deleteLoan(id: string, userId: string): void {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Darlehen nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    this.repository.delete(id);
  }

  /**
   * Record a payment for a loan.
   */
  createPayment(loanId: string, userId: string, input: CreatePaymentInput): PaymentResponse {
    const loan = this.repository.findById(loanId, userId);
    if (!loan) {
      const error = new Error('Darlehen nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const payment: LoanPaymentRecord = {
      id: uuidv4(),
      loan_id: loanId,
      payment_date: input.payment_date,
      interest_amount: input.interest_amount,
      repayment_amount: input.repayment_amount,
      fee_amount: input.fee_amount,
      extra_repayment: input.extra_repayment,
    };

    this.repository.createPayment(payment);
    return formatPayment(payment);
  }

  /**
   * List all payments for a loan.
   */
  listPayments(loanId: string, userId: string): PaymentResponse[] {
    const loan = this.repository.findById(loanId, userId);
    if (!loan) {
      const error = new Error('Darlehen nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const payments = this.repository.findPaymentsByLoanId(loanId);
    return payments.map(formatPayment);
  }

  /**
   * Get calculated annuity repayment schedule (Tilgungsplan).
   */
  getSchedule(loanId: string, userId: string): AnnuityScheduleResult {
    const loan = this.repository.findById(loanId, userId);
    if (!loan) {
      const error = new Error('Darlehen nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return calculateAnnuitySchedule(
      loan.loan_amount,
      loan.interest_rate,
      loan.repayment_rate,
      loan.start_date,
      loan.fixed_interest_months,
      loan.interest_only_months
    );
  }

  /**
   * Get remaining balance with history.
   * Remaining balance = loan_amount - sum(repayment_amounts) - sum(extra_repayments)
   */
  getBalance(loanId: string, userId: string): BalanceResponse {
    const loan = this.repository.findById(loanId, userId);
    if (!loan) {
      const error = new Error('Darlehen nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const payments = this.repository.findPaymentsByLoanId(loanId);
    let runningBalance = loan.loan_amount;

    const history: BalanceEntry[] = payments.map(payment => {
      const totalPayment = payment.interest_amount + payment.repayment_amount + payment.fee_amount + payment.extra_repayment;
      runningBalance -= (payment.repayment_amount + payment.extra_repayment);

      return {
        payment_date: payment.payment_date,
        interest_amount: payment.interest_amount,
        repayment_amount: payment.repayment_amount,
        fee_amount: payment.fee_amount,
        extra_repayment: payment.extra_repayment,
        total_payment: totalPayment,
        remaining_balance: runningBalance,
      };
    });

    const totalRepaid = this.repository.getTotalRepayments(loanId);

    return {
      loan_amount: loan.loan_amount,
      total_repaid: totalRepaid,
      remaining_balance: loan.loan_amount - totalRepaid,
      history,
    };
  }
}
