import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { CategoryRepository, type CategoryRecord } from './category.repository.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.validators.js';

const MAX_CUSTOM_CATEGORIES_PER_PROPERTY = 50;

export interface CategoryResponse {
  id: string;
  property_id: string | null;
  user_id: string | null;
  name: string;
  type: 'income' | 'expense';
  is_allocable: boolean;
  is_tax_deductible: boolean;
  requires_capitalization: boolean;
  is_financing_related: boolean;
  is_system: boolean;
  is_active: boolean;
}

function toResponse(record: CategoryRecord): CategoryResponse {
  return {
    id: record.id,
    property_id: record.property_id,
    user_id: record.user_id,
    name: record.name,
    type: record.type,
    is_allocable: record.is_allocable === 1,
    is_tax_deductible: record.is_tax_deductible === 1,
    requires_capitalization: record.requires_capitalization === 1,
    is_financing_related: record.is_financing_related === 1,
    is_system: record.is_system === 1,
    is_active: record.is_active === 1,
  };
}

export class CategoryService {
  private repository: CategoryRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new CategoryRepository(app.db);
  }

  /**
   * List all categories for a property (system + custom).
   * If no propertyId, returns all system categories + all user custom categories.
   */
  listByProperty(propertyId: string | undefined, userId: string): CategoryResponse[] {
    const records = propertyId
      ? this.repository.findByProperty(propertyId, userId)
      : this.repository.findAllForUser(userId);
    return records.map(toResponse);
  }

  /**
   * Create a new custom category.
   */
  create(input: CreateCategoryInput, userId: string): CategoryResponse {
    // Check max custom categories per property
    const count = this.repository.countCustomByProperty(input.property_id);
    if (count >= MAX_CUSTOM_CATEGORIES_PER_PROPERTY) {
      const error = new Error(
        `Maximale Anzahl von ${MAX_CUSTOM_CATEGORIES_PER_PROPERTY} benutzerdefinierten Kategorien pro Objekt erreicht`
      ) as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    // Check name uniqueness per (property_id, type)
    if (this.repository.existsByNameAndType(input.property_id, input.name, input.type)) {
      const error = new Error(
        'Eine Kategorie mit diesem Namen und Typ existiert bereits für dieses Objekt'
      ) as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    const record: CategoryRecord = {
      id: uuidv4(),
      property_id: input.property_id,
      user_id: userId,
      name: input.name,
      type: input.type,
      is_allocable: input.is_allocable ? 1 : 0,
      is_tax_deductible: input.is_tax_deductible ? 1 : 0,
      requires_capitalization: input.requires_capitalization ? 1 : 0,
      is_financing_related: input.is_financing_related ? 1 : 0,
      is_system: 0,
      is_active: 1,
    };

    this.repository.create(record);
    return toResponse(record);
  }

  /**
   * Update a custom category.
   */
  update(id: string, input: UpdateCategoryInput, userId: string): CategoryResponse {
    const existing = this.repository.findById(id);

    if (!existing) {
      const error = new Error('Kategorie nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // System categories cannot be edited
    if (existing.is_system === 1) {
      const error = new Error('Systemkategorien können nicht bearbeitet werden') as Error & {
        statusCode: number;
      };
      error.statusCode = 403;
      throw error;
    }

    // Check ownership
    if (existing.user_id !== userId) {
      const error = new Error('Keine Berechtigung zum Bearbeiten dieser Kategorie') as Error & {
        statusCode: number;
      };
      error.statusCode = 403;
      throw error;
    }

    // Check name uniqueness per (property_id, type) excluding current category
    if (
      this.repository.existsByNameAndType(existing.property_id!, input.name, input.type, id)
    ) {
      const error = new Error(
        'Eine Kategorie mit diesem Namen und Typ existiert bereits für dieses Objekt'
      ) as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    this.repository.update(id, {
      name: input.name,
      type: input.type,
      is_allocable: input.is_allocable ? 1 : 0,
      is_tax_deductible: input.is_tax_deductible ? 1 : 0,
      requires_capitalization: input.requires_capitalization ? 1 : 0,
      is_financing_related: input.is_financing_related ? 1 : 0,
    });

    // Return updated record
    const updated = this.repository.findById(id)!;
    return toResponse(updated);
  }

  /**
   * Deactivate a custom category.
   */
  deactivate(id: string, userId: string): void {
    const existing = this.repository.findById(id);

    if (!existing) {
      const error = new Error('Kategorie nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // System categories cannot be deactivated
    if (existing.is_system === 1) {
      const error = new Error('Systemkategorien können nicht deaktiviert werden') as Error & {
        statusCode: number;
      };
      error.statusCode = 403;
      throw error;
    }

    // Check ownership
    if (existing.user_id !== userId) {
      const error = new Error('Keine Berechtigung zum Deaktivieren dieser Kategorie') as Error & {
        statusCode: number;
      };
      error.statusCode = 403;
      throw error;
    }

    // Already deactivated
    if (existing.is_active === 0) {
      const error = new Error('Kategorie ist bereits deaktiviert') as Error & {
        statusCode: number;
      };
      error.statusCode = 400;
      throw error;
    }

    this.repository.deactivate(id);
  }
}
