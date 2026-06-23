/** Category type: income or expense */
export type CategoryType = 'income' | 'expense';

/** Category entity from the API */
export interface Category {
  id: string;
  property_id: string | null;
  user_id: string | null;
  name: string;
  type: CategoryType;
  is_allocable: boolean;
  is_tax_deductible: boolean;
  requires_capitalization: boolean;
  is_financing_related: boolean;
  is_system: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Form data for creating/editing a category */
export interface CategoryFormData {
  name: string;
  type: CategoryType | '';
  property_id: string;
  is_allocable: boolean;
  is_tax_deductible: boolean;
  requires_capitalization: boolean;
  is_financing_related: boolean;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;
