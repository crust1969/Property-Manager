import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { DepositRepository, type DepositRecord } from './deposit.repository.js';
import type { CreateDepositInput, RefundDepositInput } from './deposit.validators.js';

// Valid state transitions for the deposit state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  hinterlegt: ['teilweise_zurueckgezahlt', 'vollstaendig_zurueckgezahlt', 'verrechnet'],
  teilweise_zurueckgezahlt: ['teilweise_zurueckgezahlt', 'vollstaendig_zurueckgezahlt', 'verrechnet'],
  vollstaendig_zurueckgezahlt: [],
  verrechnet: [],
};

export class DepositService {
  private repository: DepositRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new DepositRepository(app.db);
  }

  listDeposits(userId: string, leaseId: string): DepositRecord[] {
    return this.repository.findAllByLeaseId(leaseId, userId);
  }

  listAllDeposits(userId: string): DepositRecord[] {
    return this.repository.findAllByUserId(userId);
  }

  getDeposit(id: string, userId: string): DepositRecord {
    const deposit = this.repository.findById(id, userId);
    if (!deposit) {
      const error = new Error('Kaution nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return deposit;
  }

  createDeposit(userId: string, input: CreateDepositInput): DepositRecord {
    // Validate lease belongs to user and get property_id
    const leaseInfo = this.repository.leaseExists(input.lease_id, userId);
    if (!leaseInfo.exists || !leaseInfo.propertyId) {
      const error = new Error('Mietvertrag nicht gefunden oder gehört nicht dem Benutzer') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const deposit: DepositRecord = {
      id,
      lease_id: input.lease_id,
      property_id: leaseInfo.propertyId,
      amount: input.amount,
      received_date: input.received_date,
      account_reference: input.account_reference,
      status: 'hinterlegt',
      refunded_amount: 0,
      created_at: now,
    };

    this.repository.create(deposit);
    return deposit;
  }

  processRefund(id: string, userId: string, input: RefundDepositInput): DepositRecord {
    const deposit = this.repository.findById(id, userId);
    if (!deposit) {
      const error = new Error('Kaution nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Calculate remaining balance
    const remainingBalance = deposit.amount - deposit.refunded_amount;

    // Validate refund amount doesn't exceed remaining balance
    if (input.refund_amount > remainingBalance) {
      const error = new Error(
        `Rückzahlungsbetrag (${input.refund_amount}) übersteigt den verbleibenden Betrag (${remainingBalance})`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Determine new status based on refund
    const newRefundedAmount = deposit.refunded_amount + input.refund_amount;
    const newRemainingBalance = deposit.amount - newRefundedAmount;

    let newStatus: string;
    if (newRemainingBalance === 0) {
      newStatus = 'vollstaendig_zurueckgezahlt';
    } else {
      newStatus = 'teilweise_zurueckgezahlt';
    }

    // Validate state transition
    if (!this.isValidTransition(deposit.status, newStatus)) {
      const error = new Error(
        `Ungültiger Statusübergang: ${deposit.status} → ${newStatus}`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    this.repository.updateStatusAndRefund(id, newStatus, newRefundedAmount);

    return {
      ...deposit,
      status: newStatus,
      refunded_amount: newRefundedAmount,
    };
  }

  isValidTransition(currentStatus: string, newStatus: string): boolean {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed) {
      return false;
    }
    return allowed.includes(newStatus);
  }
}
