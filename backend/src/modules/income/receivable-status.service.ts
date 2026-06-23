import type Database from 'better-sqlite3';

export type ReceivableStatus = 'offen' | 'bezahlt' | 'teilbezahlt' | 'überfällig' | 'storniert';

export interface ReceivableStatusResult {
  status: ReceivableStatus;
  excessCredit?: number; // Überschuss bei Überzahlung (in Cents)
}

/**
 * Pure function to determine the payment status of a receivable.
 *
 * Rules:
 * - 'offen': paid_amount == 0 AND current_date <= due_date
 * - 'bezahlt': paid_amount >= total_amount
 * - 'teilbezahlt': 0 < paid_amount < total_amount AND current_date <= due_date
 * - 'überfällig': paid_amount < total_amount AND current_date > due_date
 *
 * @param totalAmount - Gesamtbetrag der Sollstellung (in Cents)
 * @param paidAmount - Bereits bezahlter Betrag (in Cents)
 * @param dueDate - Fälligkeitsdatum als ISO-String (YYYY-MM-DD)
 * @param currentDate - Aktuelles Datum als ISO-String (YYYY-MM-DD), default: heute
 * @returns Zahlungsstatus
 */
export function determineStatus(
  totalAmount: number,
  paidAmount: number,
  dueDate: string,
  currentDate?: string
): ReceivableStatus {
  const now = currentDate ?? new Date().toISOString().split('T')[0];

  // bezahlt: paid_amount >= total_amount
  if (paidAmount >= totalAmount) {
    return 'bezahlt';
  }

  // Check if overdue: current_date > due_date (after 23:59 on due_date)
  const isOverdue = now > dueDate;

  if (isOverdue) {
    // überfällig: paid_amount < total_amount AND current_date > due_date
    return 'überfällig';
  }

  // teilbezahlt: 0 < paid_amount < total_amount AND current_date <= due_date
  if (paidAmount > 0) {
    return 'teilbezahlt';
  }

  // offen: paid_amount == 0 AND current_date <= due_date
  return 'offen';
}

/**
 * Determines the status and any excess credit when a payment is applied.
 *
 * @param totalAmount - Gesamtbetrag (Cents)
 * @param paidAmount - Bereits bezahlter Betrag inkl. neuer Zahlung (Cents)
 * @param dueDate - Fälligkeitsdatum (YYYY-MM-DD)
 * @param currentDate - Aktuelles Datum (YYYY-MM-DD)
 * @returns Status und ggf. Überschuss
 */
export function determineStatusWithCredit(
  totalAmount: number,
  paidAmount: number,
  dueDate: string,
  currentDate?: string
): ReceivableStatusResult {
  const status = determineStatus(totalAmount, paidAmount, dueDate, currentDate);

  const result: ReceivableStatusResult = { status };

  // If payment exceeds total, record excess as unassigned credit
  if (paidAmount > totalAmount) {
    result.excessCredit = paidAmount - totalAmount;
  }

  return result;
}

/**
 * Updates the status of a single receivable in the database based on current amounts and date.
 *
 * @param db - Database instance
 * @param receivableId - ID der Sollstellung
 * @param currentDate - Optional: aktuelles Datum für Statusberechnung
 * @returns The new status and any excess credit
 */
export function updateReceivableStatus(
  db: Database.Database,
  receivableId: string,
  currentDate?: string
): ReceivableStatusResult | null {
  const receivable = db
    .prepare('SELECT total_amount, paid_amount, due_date, status FROM receivables WHERE id = ?')
    .get(receivableId) as
    | { total_amount: number; paid_amount: number; due_date: string; status: string }
    | undefined;

  if (!receivable) {
    return null;
  }

  // Don't update cancelled receivables
  if (receivable.status === 'storniert') {
    return { status: 'storniert' };
  }

  const result = determineStatusWithCredit(
    receivable.total_amount,
    receivable.paid_amount,
    receivable.due_date,
    currentDate
  );

  db.prepare('UPDATE receivables SET status = ? WHERE id = ?').run(result.status, receivableId);

  return result;
}

/**
 * Batch update: marks all receivables as 'überfällig' where due_date has passed
 * and the receivable is not fully paid or already cancelled.
 *
 * @param db - Database instance
 * @param currentDate - Optional: aktuelles Datum (YYYY-MM-DD), default: heute
 * @returns Number of receivables marked as overdue
 */
export function markOverdueReceivables(db: Database.Database, currentDate?: string): number {
  const now = currentDate ?? new Date().toISOString().split('T')[0];

  const result = db
    .prepare(
      `UPDATE receivables
       SET status = 'überfällig'
       WHERE due_date < ?
         AND paid_amount < total_amount
         AND status NOT IN ('storniert', 'überfällig', 'bezahlt')`
    )
    .run(now);

  return result.changes;
}
