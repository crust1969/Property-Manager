import type Database from 'better-sqlite3';

export interface LoanRecord {
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

export interface LoanPaymentRecord {
  id: string;
  loan_id: string;
  payment_date: string;
  interest_amount: number;
  repayment_amount: number;
  fee_amount: number;
  extra_repayment: number;
}

export class LoanRepository {
  constructor(private db: Database.Database) {}

  findAllByUserId(userId: string, propertyId?: string): LoanRecord[] {
    let query = `
      SELECT l.* FROM loans l
      JOIN properties p ON l.property_id = p.id
      WHERE p.user_id = ?
    `;
    const params: unknown[] = [userId];

    if (propertyId) {
      query += ' AND l.property_id = ?';
      params.push(propertyId);
    }

    query += ' ORDER BY l.start_date DESC';

    return this.db.prepare(query).all(...params) as LoanRecord[];
  }

  findById(id: string, userId: string): LoanRecord | undefined {
    return this.db
      .prepare(
        `SELECT l.* FROM loans l
         JOIN properties p ON l.property_id = p.id
         WHERE l.id = ? AND p.user_id = ?`
      )
      .get(id, userId) as LoanRecord | undefined;
  }

  create(loan: LoanRecord): void {
    this.db
      .prepare(
        `INSERT INTO loans (id, property_id, lender, contract_number, loan_amount, interest_rate, repayment_rate, start_date, end_date, fixed_interest_months, interest_only_months, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        loan.id,
        loan.property_id,
        loan.lender,
        loan.contract_number,
        loan.loan_amount,
        loan.interest_rate,
        loan.repayment_rate,
        loan.start_date,
        loan.end_date,
        loan.fixed_interest_months,
        loan.interest_only_months,
        loan.created_at,
        loan.updated_at
      );
  }

  update(id: string, data: Omit<LoanRecord, 'id' | 'created_at'>): boolean {
    const result = this.db
      .prepare(
        `UPDATE loans SET property_id = ?, lender = ?, contract_number = ?, loan_amount = ?, interest_rate = ?, repayment_rate = ?, start_date = ?, end_date = ?, fixed_interest_months = ?, interest_only_months = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        data.property_id,
        data.lender,
        data.contract_number,
        data.loan_amount,
        data.interest_rate,
        data.repayment_rate,
        data.start_date,
        data.end_date,
        data.fixed_interest_months,
        data.interest_only_months,
        data.updated_at,
        id
      );
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM loans WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Payments

  createPayment(payment: LoanPaymentRecord): void {
    this.db
      .prepare(
        `INSERT INTO loan_payments (id, loan_id, payment_date, interest_amount, repayment_amount, fee_amount, extra_repayment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        payment.id,
        payment.loan_id,
        payment.payment_date,
        payment.interest_amount,
        payment.repayment_amount,
        payment.fee_amount,
        payment.extra_repayment
      );
  }

  findPaymentsByLoanId(loanId: string): LoanPaymentRecord[] {
    return this.db
      .prepare('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY payment_date ASC')
      .all(loanId) as LoanPaymentRecord[];
  }

  /**
   * Get the sum of repayment_amount + extra_repayment for a loan.
   */
  getTotalRepayments(loanId: string): number {
    const result = this.db
      .prepare(
        'SELECT COALESCE(SUM(repayment_amount + extra_repayment), 0) as total FROM loan_payments WHERE loan_id = ?'
      )
      .get(loanId) as { total: number };
    return result.total;
  }

  // Helpers

  propertyBelongsToUser(propertyId: string, userId: string): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM properties WHERE id = ? AND user_id = ?')
      .get(propertyId, userId) as { count: number };
    return result.count > 0;
  }
}
