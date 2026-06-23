import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { IncomeRepository, type BookingRecord } from './income.repository.js';
import type { CreateIncomeInput, UpdateIncomeInput } from './income.validators.js';

export interface ComparisonResult {
  soll: number;
  ist: number;
  differenz: number;
  receivables: Array<{
    id: string;
    due_date: string;
    total_amount: number;
    paid_amount: number;
    status: string;
  }>;
}

export class IncomeService {
  private repository: IncomeRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new IncomeRepository(app.db);
  }

  listIncome(userId: string, propertyId?: string, year?: number, month?: number): BookingRecord[] {
    return this.repository.findAllByUserId(userId, propertyId, year, month);
  }

  getIncome(id: string, userId: string): BookingRecord {
    const booking = this.repository.findById(id, userId);
    if (!booking) {
      const error = new Error('Einnahme nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return booking;
  }

  createIncome(userId: string, input: CreateIncomeInput): BookingRecord {
    // Validate property belongs to user
    if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
      const error = new Error('Objekt nicht gefunden oder gehört nicht dem Benutzer') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate category exists and is active
    const category = this.repository.findCategoryById(input.category_id);
    if (!category) {
      const error = new Error('Kategorie nicht gefunden oder inaktiv') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate receivable if provided
    if (input.receivable_id) {
      const receivable = this.repository.findReceivableById(input.receivable_id);
      if (!receivable) {
        const error = new Error('Sollstellung nicht gefunden') as Error & { statusCode: number };
        error.statusCode = 404;
        throw error;
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const booking: BookingRecord = {
      id,
      property_id: input.property_id,
      user_id: userId,
      type: 'income',
      booking_date: input.booking_date,
      total_amount: input.total_amount,
      counterparty: input.counterparty,
      description: input.description ?? null,
      receivable_id: input.receivable_id ?? null,
      created_at: now,
      updated_at: now,
    };

    this.repository.create(booking);

    // Create a single booking split inheriting category flags
    const splitId = uuidv4();
    this.repository.createSplit({
      id: splitId,
      booking_id: id,
      amount: input.total_amount,
      category_id: input.category_id,
      is_allocable: category.is_allocable,
      is_tax_deductible: category.is_tax_deductible,
      requires_capitalization: category.requires_capitalization,
      is_financing_related: category.is_financing_related,
      overridden_flags: '[]',
    });

    // Update receivable paid_amount if linked
    if (input.receivable_id) {
      this.updateReceivableStatus(input.receivable_id);
    }

    return this.repository.findByIdInternal(id)!;
  }

  updateIncome(id: string, userId: string, input: UpdateIncomeInput): BookingRecord {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Einnahme nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate property belongs to user
    if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
      const error = new Error('Objekt nicht gefunden oder gehört nicht dem Benutzer') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate category exists and is active
    const category = this.repository.findCategoryById(input.category_id);
    if (!category) {
      const error = new Error('Kategorie nicht gefunden oder inaktiv') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate receivable if provided
    if (input.receivable_id) {
      const receivable = this.repository.findReceivableById(input.receivable_id);
      if (!receivable) {
        const error = new Error('Sollstellung nicht gefunden') as Error & { statusCode: number };
        error.statusCode = 404;
        throw error;
      }
    }

    const now = new Date().toISOString();
    const oldReceivableId = existing.receivable_id;

    this.repository.update(id, {
      booking_date: input.booking_date,
      total_amount: input.total_amount,
      counterparty: input.counterparty,
      description: input.description ?? null,
      receivable_id: input.receivable_id ?? null,
      property_id: input.property_id,
      updated_at: now,
    });

    // Re-create booking split with updated category flags
    this.repository.deleteSplitsByBookingId(id);
    const splitId = uuidv4();
    this.repository.createSplit({
      id: splitId,
      booking_id: id,
      amount: input.total_amount,
      category_id: input.category_id,
      is_allocable: category.is_allocable,
      is_tax_deductible: category.is_tax_deductible,
      requires_capitalization: category.requires_capitalization,
      is_financing_related: category.is_financing_related,
      overridden_flags: '[]',
    });

    // Update old receivable if it was linked
    if (oldReceivableId && oldReceivableId !== input.receivable_id) {
      this.updateReceivableStatus(oldReceivableId);
    }

    // Update new receivable if linked
    if (input.receivable_id) {
      this.updateReceivableStatus(input.receivable_id);
    }

    return this.repository.findByIdInternal(id)!;
  }

  deleteIncome(id: string, userId: string): void {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Einnahme nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const receivableId = existing.receivable_id;

    // Splits are cascade-deleted by FK
    this.repository.delete(id);

    // Update receivable if it was linked
    if (receivableId) {
      this.updateReceivableStatus(receivableId);
    }
  }

  getComparison(userId: string, leaseId: string, year: number, month: number): ComparisonResult {
    // Verify lease belongs to user
    if (!this.repository.leaseExistsForUser(leaseId, userId)) {
      const error = new Error('Mietvertrag nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const receivables = this.repository.findReceivablesByLeaseAndMonth(leaseId, year, month);

    const soll = receivables.reduce((sum, r) => sum + r.total_amount, 0);

    const receivableIds = receivables.map((r) => r.id);
    const ist = this.repository.getIncomeForReceivables(receivableIds);

    return {
      soll,
      ist,
      differenz: soll - ist,
      receivables: receivables.map((r) => ({
        id: r.id,
        due_date: r.due_date,
        total_amount: r.total_amount,
        paid_amount: r.paid_amount,
        status: r.status,
      })),
    };
  }

  /**
   * Recalculate and update a receivable's paid_amount and status.
   */
  private updateReceivableStatus(receivableId: string): void {
    const receivable = this.repository.findReceivableById(receivableId);
    if (!receivable) return;

    // Don't update cancelled receivables
    if (receivable.status === 'storniert') return;

    const totalPaid = this.repository.getTotalPaidForReceivable(receivableId);
    let status: string;

    if (totalPaid >= receivable.total_amount) {
      status = 'bezahlt';
    } else if (totalPaid > 0) {
      status = 'teilbezahlt';
    } else {
      status = 'offen';
    }

    this.repository.updateReceivablePaidAmount(receivableId, totalPaid, status);
  }
}
