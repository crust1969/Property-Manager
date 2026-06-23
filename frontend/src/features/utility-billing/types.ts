/** Allocation key types for utility billing */
export type AllocationKey = 'fläche' | 'personen' | 'verbrauch' | 'direkt' | 'manuell';

/** Status of a utility billing */
export type BillingStatus = 'entwurf' | 'abgeschlossen';

/** A single cost position in the billing */
export interface BillingItem {
  id: string;
  billing_id: string;
  category_id: string;
  category_name?: string;
  total_cost: number; // in cents
  allocation_key: AllocationKey;
  tenant_share: number; // in cents
  is_complete: boolean;
}

/** The full utility billing entity from the API */
export interface UtilityBilling {
  id: string;
  property_id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  total_allocable_costs: number; // in cents
  tenant_share: number; // in cents
  prepayments: number; // in cents
  balance: number; // in cents (positive = Nachzahlung, negative = Guthaben)
  status: BillingStatus;
  items: BillingItem[];
  created_at: string;
}

/** Allocation parameters for "fläche" key */
export interface FlaecheParams {
  tenant_area: string; // German number string
  total_area: string;
}

/** Allocation parameters for "personen" key */
export interface PersonenParams {
  tenant_persons: string;
  total_persons: string;
}

/** Allocation parameters for "verbrauch" key */
export interface VerbrauchParams {
  tenant_consumption: string;
  total_consumption: string;
}

/** Allocation parameters for "manuell" key */
export interface ManuellParams {
  manual_percentage: string;
}

/** Union type for all allocation params */
export type AllocationParams =
  | { key: 'fläche'; params: FlaecheParams }
  | { key: 'personen'; params: PersonenParams }
  | { key: 'verbrauch'; params: VerbrauchParams }
  | { key: 'direkt'; params: Record<string, never> }
  | { key: 'manuell'; params: ManuellParams };

/** A cost position row in the form */
export interface CostPositionRow {
  category_id: string;
  amount: string; // German formatted string
  allocation_key: AllocationKey;
  allocation_params: AllocationParams;
}

/** Form data for creating a new billing */
export interface BillingFormData {
  property_id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  positions: CostPositionRow[];
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;
