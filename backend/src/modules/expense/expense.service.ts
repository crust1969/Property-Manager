import type { FastifyInstance } from 'fastify';
import { ExpenseRepository, type BookingRecord, type BookingSplitRecord, type CreateSplitInput } from './expense.repository.js';
import { ClassificationService } from '../category/classification.service.js';
import type { CreateExpenseInput, UpdateExpenseInput, SplitItemInput } from './expense.validators.js';

export interface ExpenseWithSplits {
  id: string;
  property_id: string;
  user_id: string;
  type: string;
  booking_date: string;
  total_amount: number;
  counterparty: string | null;
  description: string | null;
  receivable_id: string | null;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  document_count: number;
  splits: {
    id: string;
    booking_id: string;
    amount: number;
    category_id: string;
    category_name?: string;
    is_allocable: boolean;
    is_tax_deductible: boolean;
    requires_capitalization: boolean;
    is_financing_related: boolean;
    overridden_flags: string[];
  }[];
}

function formatSplit(split: BookingSplitRecord) {
  return {
    id: split.id,
    booking_id: split.booking_id,
    amount: split.amount,
    category_id: split.category_id,
    is_allocable: split.is_allocable === 1,
    is_tax_deductible: split.is_tax_deductible === 1,
    requires_capitalization: split.requires_capitalization === 1,
    is_financing_related: split.is_financing_related === 1,
    overridden_flags: JSON.parse(split.overridden_flags || '[]'),
  };
}

function formatExpense(booking: BookingRecord, splits: BookingSplitRecord[], db?: import('better-sqlite3').Database): ExpenseWithSplits {
  // Get category name from first split
  let categoryName: string | null = null;
  if (splits.length > 0 && db) {
    const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(splits[0].category_id) as { name: string } | undefined;
    categoryName = cat?.name ?? null;
  }

  // Count linked documents
  let documentCount = 0;
  if (db) {
    const docResult = db.prepare("SELECT COUNT(*) as count FROM document_links WHERE entity_type = 'booking' AND entity_id = ?").get(booking.id) as { count: number };
    documentCount = docResult.count;
  }

  return {
    id: booking.id,
    property_id: booking.property_id,
    user_id: booking.user_id,
    type: booking.type,
    booking_date: booking.booking_date,
    total_amount: booking.total_amount,
    counterparty: booking.counterparty,
    description: booking.description,
    receivable_id: booking.receivable_id,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
    category_name: categoryName,
    document_count: documentCount,
    splits: splits.map(formatSplit),
  };
}

export class ExpenseService {
  private repository: ExpenseRepository;
  private classificationService: ClassificationService;

  constructor(private app: FastifyInstance) {
    this.repository = new ExpenseRepository(app.db);
    this.classificationService = new ClassificationService(app);
  }

  /**
   * Create an expense with splits. Validates split sum invariant.
   */
  create(input: CreateExpenseInput, userId: string): ExpenseWithSplits {
    // Validate split sum equals total amount
    this.validateSplitSum(input.total_amount, input.splits);

    // Build splits with flag inheritance from categories
    const splitInputs: CreateSplitInput[] = input.splits.map(split => {
      const defaults = this.classificationService.getDefaultsFromCategory(split.category_id);
      return {
        booking_id: '', // will be set in repository
        amount: split.amount,
        category_id: split.category_id,
        is_allocable: split.is_allocable ?? defaults.is_allocable,
        is_tax_deductible: split.is_tax_deductible ?? defaults.is_tax_deductible,
        requires_capitalization: split.requires_capitalization ?? defaults.requires_capitalization,
        is_financing_related: split.is_financing_related ?? defaults.is_financing_related,
      };
    });

    const result = this.repository.createWithSplits(
      {
        property_id: input.property_id,
        user_id: userId,
        booking_date: input.booking_date,
        total_amount: input.total_amount,
        counterparty: input.counterparty,
        description: input.description,
        receivable_id: input.receivable_id,
      },
      splitInputs
    );

    return formatExpense(result.booking, result.splits, this.app.db);
  }

  /**
   * Get a single expense with its splits.
   */
  getById(id: string, userId: string): ExpenseWithSplits {
    const booking = this.repository.findById(id, userId);
    if (!booking) {
      const error = new Error('Ausgabe nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const splits = this.repository.findSplitsByBookingId(id);
    return formatExpense(booking, splits, this.app.db);
  }

  /**
   * List expenses with filters.
   */
  list(propertyId: string, userId: string, options?: { year?: number; categoryId?: string; flags?: string }): ExpenseWithSplits[] {
    const results = this.repository.list({
      property_id: propertyId,
      user_id: userId,
      year: options?.year,
      category_id: options?.categoryId,
      flags: options?.flags,
    });

    return results.map(r => formatExpense(r, r.splits, this.app.db));
  }

  /**
   * Update an expense. If splits are provided, replaces them and validates sum.
   */
  update(id: string, input: UpdateExpenseInput, userId: string): ExpenseWithSplits {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Ausgabe nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const newTotalAmount = input.total_amount ?? existing.total_amount;

    // If splits are provided, validate and replace
    if (input.splits) {
      this.validateSplitSum(newTotalAmount, input.splits);

      const splitInputs: CreateSplitInput[] = input.splits.map(split => {
        const defaults = this.classificationService.getDefaultsFromCategory(split.category_id);
        return {
          booking_id: id,
          amount: split.amount,
          category_id: split.category_id,
          is_allocable: split.is_allocable ?? defaults.is_allocable,
          is_tax_deductible: split.is_tax_deductible ?? defaults.is_tax_deductible,
          requires_capitalization: split.requires_capitalization ?? defaults.requires_capitalization,
          is_financing_related: split.is_financing_related ?? defaults.is_financing_related,
        };
      });

      this.repository.replaceSplits(id, splitInputs);
    } else {
      // If total_amount changed but no splits provided, validate existing splits still sum correctly
      if (input.total_amount !== undefined && input.total_amount !== existing.total_amount) {
        const existingSplits = this.repository.findSplitsByBookingId(id);
        const splitSum = existingSplits.reduce((sum, s) => sum + s.amount, 0);
        if (splitSum !== input.total_amount) {
          const diff = input.total_amount - splitSum;
          const error = new Error(
            `Split-Summe (${splitSum}) stimmt nicht mit dem Gesamtbetrag (${input.total_amount}) überein. Differenz: ${diff} Cent`
          ) as Error & { statusCode: number };
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // Update booking fields
    this.repository.update(id, {
      booking_date: input.booking_date,
      total_amount: input.total_amount,
      counterparty: input.counterparty,
      description: input.description,
      receivable_id: input.receivable_id,
    });

    return this.getById(id, userId);
  }

  /**
   * Delete an expense.
   */
  delete(id: string, userId: string): void {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Ausgabe nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    this.repository.delete(id);
  }

  /**
   * Create or replace split bookings for an expense.
   * Validates: 2–20 splits, sum must equal total_amount.
   */
  createOrReplaceSplits(bookingId: string, splits: SplitItemInput[], userId: string): ExpenseWithSplits {
    const booking = this.repository.findById(bookingId, userId);
    if (!booking) {
      const error = new Error('Ausgabe nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    this.validateSplitSum(booking.total_amount, splits);

    const splitInputs: CreateSplitInput[] = splits.map(split => {
      const defaults = this.classificationService.getDefaultsFromCategory(split.category_id);
      return {
        booking_id: bookingId,
        amount: split.amount,
        category_id: split.category_id,
        is_allocable: split.is_allocable ?? defaults.is_allocable,
        is_tax_deductible: split.is_tax_deductible ?? defaults.is_tax_deductible,
        requires_capitalization: split.requires_capitalization ?? defaults.requires_capitalization,
        is_financing_related: split.is_financing_related ?? defaults.is_financing_related,
      };
    });

    this.repository.replaceSplits(bookingId, splitInputs);
    return this.getById(bookingId, userId);
  }

  /**
   * Update (replace) split bookings — same operation as create/replace.
   */
  updateSplits(bookingId: string, splits: SplitItemInput[], userId: string): ExpenseWithSplits {
    return this.createOrReplaceSplits(bookingId, splits, userId);
  }

  // -- Private helpers --

  private validateSplitSum(totalAmount: number, splits: SplitItemInput[]): void {
    const splitSum = splits.reduce((sum, s) => sum + s.amount, 0);
    if (splitSum !== totalAmount) {
      const diff = totalAmount - splitSum;
      const error = new Error(
        `Split-Summe (${splitSum}) stimmt nicht mit dem Gesamtbetrag (${totalAmount}) überein. Differenz: ${diff} Cent`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }
  }
}
