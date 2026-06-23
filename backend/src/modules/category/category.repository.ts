import type Database from 'better-sqlite3';

export interface CategoryRecord {
  id: string;
  property_id: string | null;
  user_id: string | null;
  name: string;
  type: 'income' | 'expense';
  is_allocable: number;
  is_tax_deductible: number;
  requires_capitalization: number;
  is_financing_related: number;
  is_system: number;
  is_active: number;
}

export class CategoryRepository {
  constructor(private db: Database.Database) {}

  /**
   * Get all system categories (global) + user-defined categories for a specific property.
   */
  findByProperty(propertyId: string, userId: string): CategoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM categories
      WHERE (is_system = 1 AND is_active = 1)
         OR (property_id = ? AND user_id = ? AND is_active = 1)
      ORDER BY is_system DESC, name ASC
    `);
    return stmt.all(propertyId, userId) as CategoryRecord[];
  }

  /**
   * Get all system categories + all custom categories owned by the user (across all properties).
   */
  findAllForUser(userId: string): CategoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM categories
      WHERE (is_system = 1 AND is_active = 1)
         OR (user_id = ? AND is_active = 1)
      ORDER BY is_system DESC, name ASC
    `);
    return stmt.all(userId) as CategoryRecord[];
  }

  /**
   * Find a category by ID.
   */
  findById(id: string): CategoryRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM categories WHERE id = ?');
    return stmt.get(id) as CategoryRecord | undefined;
  }

  /**
   * Count custom categories for a specific property.
   */
  countCustomByProperty(propertyId: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM categories WHERE property_id = ? AND is_system = 0'
    );
    const result = stmt.get(propertyId) as { count: number };
    return result.count;
  }

  /**
   * Check if a category with the same name and type already exists for a property.
   * For uniqueness: considers both system categories (property_id IS NULL) and custom categories for the property.
   */
  existsByNameAndType(
    propertyId: string,
    name: string,
    type: string,
    excludeId?: string
  ): boolean {
    let query: string;
    let params: unknown[];

    if (excludeId) {
      query = `
        SELECT id FROM categories
        WHERE ((property_id = ? AND name = ? AND type = ?) OR (property_id IS NULL AND name = ? AND type = ?))
          AND id != ?
          AND is_active = 1
      `;
      params = [propertyId, name, type, name, type, excludeId];
    } else {
      query = `
        SELECT id FROM categories
        WHERE ((property_id = ? AND name = ? AND type = ?) OR (property_id IS NULL AND name = ? AND type = ?))
          AND is_active = 1
      `;
      params = [propertyId, name, type, name, type];
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params);
    return result !== undefined;
  }

  /**
   * Insert a new custom category.
   */
  create(category: CategoryRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      category.id,
      category.property_id,
      category.user_id,
      category.name,
      category.type,
      category.is_allocable,
      category.is_tax_deductible,
      category.requires_capitalization,
      category.is_financing_related,
      category.is_system,
      category.is_active
    );
  }

  /**
   * Update a custom category.
   */
  update(
    id: string,
    data: Pick<
      CategoryRecord,
      'name' | 'type' | 'is_allocable' | 'is_tax_deductible' | 'requires_capitalization' | 'is_financing_related'
    >
  ): void {
    const stmt = this.db.prepare(`
      UPDATE categories
      SET name = ?, type = ?, is_allocable = ?, is_tax_deductible = ?, requires_capitalization = ?, is_financing_related = ?
      WHERE id = ?
    `);
    stmt.run(
      data.name,
      data.type,
      data.is_allocable,
      data.is_tax_deductible,
      data.requires_capitalization,
      data.is_financing_related,
      id
    );
  }

  /**
   * Deactivate a category (soft delete).
   */
  deactivate(id: string): void {
    const stmt = this.db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?');
    stmt.run(id);
  }
}
