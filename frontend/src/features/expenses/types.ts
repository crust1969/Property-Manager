import type { Category } from '../categories/types';

/** Expense (booking of type 'expense') from the API */
export interface Expense {
  id: string;
  property_id: string;
  user_id: string;
  type: 'expense';
  booking_date: string;
  total_amount: number; // in cents
  counterparty: string;
  description: string;
  category_id: string;
  category_name?: string;
  property_name?: string;
  is_allocable: boolean;
  is_tax_deductible: boolean;
  requires_capitalization: boolean;
  is_financing_related: boolean;
  has_splits: boolean;
  document_count: number;
  created_at: string;
  updated_at: string;
}

/** Form data for creating/editing an expense */
export interface ExpenseFormData {
  booking_date: string;
  total_amount: string; // German formatted string
  counterparty: string;
  category_id: string;
  description: string;
  property_id: string;
  use_split: boolean;
}

/** A single split row */
export interface SplitRow {
  id?: string;
  amount: string; // German formatted string
  category_id: string;
  is_allocable: boolean;
  is_tax_deductible: boolean;
  requires_capitalization: boolean;
  is_financing_related: boolean;
}

/** Split data from API */
export interface BookingSplit {
  id: string;
  booking_id: string;
  amount: number; // cents
  category_id: string;
  is_allocable: boolean;
  is_tax_deductible: boolean;
  requires_capitalization: boolean;
  is_financing_related: boolean;
  overridden_flags: string[];
}

/** Document metadata */
export interface Document {
  id: string;
  filename: string;
  file_type: 'pdf' | 'jpeg' | 'png';
  file_size: number;
  storage_path: string;
  keywords: string[];
  uploaded_at: string;
}

/** Document link */
export interface DocumentLink {
  id: string;
  document_id: string;
  entity_type: 'property' | 'booking' | 'loan' | 'lease';
  entity_id: string;
}

/** Filters for fetching expenses */
export interface ExpenseFilters {
  propertyId?: string;
  year?: string;
  categoryId?: string;
  is_allocable?: string;
  is_tax_deductible?: string;
  requires_capitalization?: string;
  is_financing_related?: string;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;

/** Re-export Category for convenience */
export type { Category };
