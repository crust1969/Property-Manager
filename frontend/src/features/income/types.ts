import type { Category } from '../categories/types';

/** Income booking from the API */
export interface Income {
  id: string;
  property_id: string;
  user_id: string;
  type: 'income';
  booking_date: string;
  total_amount: number; // in cents
  counterparty: string;
  description: string;
  category_id: string;
  category_name?: string;
  property_name?: string;
  receivable_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Form data for creating/editing an income booking */
export interface IncomeFormData {
  booking_date: string;
  total_amount: string; // German formatted string
  counterparty: string;
  category_id: string;
  description: string;
  property_id: string;
  receivable_id: string;
}

/** Receivable (Sollstellung) */
export interface Receivable {
  id: string;
  lease_id: string;
  property_id: string;
  due_date: string;
  cold_rent: number; // cents
  operating_cost: number; // cents
  heating_cost: number; // cents
  total_amount: number; // cents
  paid_amount: number; // cents
  status: ReceivableStatus;
}

export type ReceivableStatus = 'offen' | 'bezahlt' | 'teilbezahlt' | 'überfällig' | 'storniert';

/** Soll/Ist comparison entry */
export interface ComparisonEntry {
  receivable_id: string;
  due_date: string;
  soll_amount: number; // cents
  ist_amount: number; // cents
  differenz: number; // cents (soll - ist)
  status: ReceivableStatus;
}

/** Filters for fetching income */
export interface IncomeFilters {
  propertyId?: string;
  year?: string;
  month?: string;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;

/** Re-export Category for convenience */
export type { Category };
