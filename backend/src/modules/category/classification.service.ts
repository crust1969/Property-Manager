import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { CategoryRepository, type CategoryRecord } from './category.repository.js';

/**
 * The four classification flags that can be set on a booking split.
 */
export const CLASSIFICATION_FLAGS = [
  'is_allocable',
  'is_tax_deductible',
  'requires_capitalization',
  'is_financing_related',
] as const;

export type ClassificationFlag = (typeof CLASSIFICATION_FLAGS)[number];

export interface BookingSplitRecord {
  id: string;
  booking_id: string;
  amount: number;
  category_id: string;
  is_allocable: number;
  is_tax_deductible: number;
  requires_capitalization: number;
  is_financing_related: number;
  overridden_flags: string; // JSON array of flag names
}

export interface AuditLogRecord {
  id: string;
  booking_split_id: string;
  user_id: string;
  changed_flag: string;
  previous_value: number;
  new_value: number;
  reason: string;
  created_at: string;
}

export interface ClassificationDefaults {
  is_allocable: boolean;
  is_tax_deductible: boolean;
  requires_capitalization: boolean;
  is_financing_related: boolean;
}

export interface OverrideFlagInput {
  booking_split_id: string;
  flag: ClassificationFlag;
  new_value: boolean;
  reason: string;
}

export interface OverrideFlagResult {
  booking_split_id: string;
  flag: ClassificationFlag;
  previous_value: boolean;
  new_value: boolean;
  overridden_flags: string[];
  audit_log_id: string;
}

/**
 * Service to manage classification flag inheritance from categories to booking splits,
 * manual overrides, and audit logging.
 */
export class ClassificationService {
  private categoryRepository: CategoryRepository;
  private db: Database.Database;

  constructor(private app: FastifyInstance) {
    this.db = app.db;
    this.categoryRepository = new CategoryRepository(this.db);
  }

  /**
   * Get the default classification flags from a category.
   * Used when a booking split is assigned a category to inherit the flags.
   */
  getDefaultsFromCategory(categoryId: string): ClassificationDefaults {
    const category = this.categoryRepository.findById(categoryId);
    if (!category) {
      const error = new Error('Kategorie nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return {
      is_allocable: category.is_allocable === 1,
      is_tax_deductible: category.is_tax_deductible === 1,
      requires_capitalization: category.requires_capitalization === 1,
      is_financing_related: category.is_financing_related === 1,
    };
  }

  /**
   * Apply category defaults to a new booking split.
   * Returns the flag values that should be stored on the split.
   */
  applyDefaultsToSplit(categoryId: string): ClassificationDefaults & { overridden_flags: string[] } {
    const defaults = this.getDefaultsFromCategory(categoryId);
    return {
      ...defaults,
      overridden_flags: [],
    };
  }

  /**
   * Override a single classification flag on a booking split.
   * Creates an audit log entry in the same transaction.
   * Throws if the audit log creation fails (transaction rolls back both).
   */
  overrideFlag(input: OverrideFlagInput, userId: string): OverrideFlagResult {
    const { booking_split_id, flag, new_value, reason } = input;

    // Validate flag name
    if (!CLASSIFICATION_FLAGS.includes(flag)) {
      const error = new Error(
        `Ungültiges Flag: ${flag}. Erlaubt: ${CLASSIFICATION_FLAGS.join(', ')}`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Validate reason
    if (!reason || reason.trim().length === 0) {
      const error = new Error('Änderungsgrund ist erforderlich') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }
    if (reason.length > 500) {
      const error = new Error(
        'Änderungsgrund darf maximal 500 Zeichen lang sein'
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Find the booking split
    const split = this.findSplitById(booking_split_id);
    if (!split) {
      const error = new Error('Buchungsteilung nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const previousValue = split[flag] === 1;
    const newValueInt = new_value ? 1 : 0;

    // If value hasn't changed, do nothing
    if (previousValue === new_value) {
      const error = new Error(
        `Flag "${flag}" hat bereits den Wert ${new_value}`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Parse existing overridden flags
    const overriddenFlags: string[] = JSON.parse(split.overridden_flags || '[]');

    // Add flag to overridden list if not already there
    if (!overriddenFlags.includes(flag)) {
      overriddenFlags.push(flag);
    }

    const auditLogId = uuidv4();
    const now = new Date().toISOString();

    // Execute both the flag update and audit log insert in a single transaction
    const executeOverride = this.db.transaction(() => {
      // Update the flag on the booking split
      const updateStmt = this.db.prepare(`
        UPDATE booking_splits
        SET ${flag} = ?, overridden_flags = ?
        WHERE id = ?
      `);
      updateStmt.run(newValueInt, JSON.stringify(overriddenFlags), booking_split_id);

      // Insert audit log entry
      const auditStmt = this.db.prepare(`
        INSERT INTO audit_log (id, booking_split_id, user_id, changed_flag, previous_value, new_value, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      auditStmt.run(
        auditLogId,
        booking_split_id,
        userId,
        flag,
        previousValue ? 1 : 0,
        newValueInt,
        reason.trim(),
        now
      );
    });

    executeOverride();

    return {
      booking_split_id,
      flag,
      previous_value: previousValue,
      new_value,
      overridden_flags: overriddenFlags,
      audit_log_id: auditLogId,
    };
  }

  /**
   * When a category's default rules are updated, this function ensures that
   * booking splits with manually overridden flags retain their overridden values.
   * Only non-overridden flags are updated to match new category defaults.
   */
  applyCategoryDefaultsToExistingSplits(categoryId: string): number {
    const category = this.categoryRepository.findById(categoryId);
    if (!category) {
      return 0;
    }

    // Find all splits using this category
    const splits = this.findSplitsByCategoryId(categoryId);
    let updatedCount = 0;

    const updateSplitStmt = this.db.prepare(`
      UPDATE booking_splits
      SET is_allocable = ?, is_tax_deductible = ?, requires_capitalization = ?, is_financing_related = ?
      WHERE id = ?
    `);

    for (const split of splits) {
      const overriddenFlags: string[] = JSON.parse(split.overridden_flags || '[]');

      // Determine new values: use category default unless flag was overridden
      const newAllocable = overriddenFlags.includes('is_allocable')
        ? split.is_allocable
        : category.is_allocable;
      const newTaxDeductible = overriddenFlags.includes('is_tax_deductible')
        ? split.is_tax_deductible
        : category.is_tax_deductible;
      const newCapitalization = overriddenFlags.includes('requires_capitalization')
        ? split.requires_capitalization
        : category.requires_capitalization;
      const newFinancingRelated = overriddenFlags.includes('is_financing_related')
        ? split.is_financing_related
        : category.is_financing_related;

      // Only update if something actually changed
      if (
        newAllocable !== split.is_allocable ||
        newTaxDeductible !== split.is_tax_deductible ||
        newCapitalization !== split.requires_capitalization ||
        newFinancingRelated !== split.is_financing_related
      ) {
        updateSplitStmt.run(
          newAllocable,
          newTaxDeductible,
          newCapitalization,
          newFinancingRelated,
          split.id
        );
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Get audit log entries for a specific booking split.
   */
  getAuditLogForSplit(bookingSplitId: string): AuditLogRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_log
      WHERE booking_split_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(bookingSplitId) as AuditLogRecord[];
  }

  /**
   * Get audit log entries with filtering and pagination.
   */
  getAuditLog(params: {
    bookingSplitId?: string;
    bookingId?: string;
    from?: string;
    to?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): { entries: AuditLogRecord[]; total: number } {
    const conditions: string[] = [];
    const queryParams: unknown[] = [];

    if (params.bookingSplitId) {
      conditions.push('al.booking_split_id = ?');
      queryParams.push(params.bookingSplitId);
    }

    if (params.bookingId) {
      conditions.push('bs.booking_id = ?');
      queryParams.push(params.bookingId);
    }

    if (params.from) {
      conditions.push('al.created_at >= ?');
      queryParams.push(params.from);
    }

    if (params.to) {
      conditions.push('al.created_at <= ?');
      queryParams.push(params.to);
    }

    if (params.type) {
      conditions.push('al.changed_flag = ?');
      queryParams.push(params.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 50);
    const offset = (page - 1) * limit;

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total FROM audit_log al
      LEFT JOIN booking_splits bs ON al.booking_split_id = bs.id
      ${whereClause}
    `;
    const countStmt = this.db.prepare(countQuery);
    const { total } = countStmt.get(...queryParams) as { total: number };

    // Fetch entries
    const selectQuery = `
      SELECT al.* FROM audit_log al
      LEFT JOIN booking_splits bs ON al.booking_split_id = bs.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const selectStmt = this.db.prepare(selectQuery);
    const entries = selectStmt.all(...queryParams, limit, offset) as AuditLogRecord[];

    return { entries, total };
  }

  // -- Private helpers --

  private findSplitById(id: string): BookingSplitRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM booking_splits WHERE id = ?');
    return stmt.get(id) as BookingSplitRecord | undefined;
  }

  private findSplitsByCategoryId(categoryId: string): BookingSplitRecord[] {
    const stmt = this.db.prepare('SELECT * FROM booking_splits WHERE category_id = ?');
    return stmt.all(categoryId) as BookingSplitRecord[];
  }
}
