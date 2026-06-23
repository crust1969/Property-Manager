/** Rent model type */
export type RentModel = 'konstant' | 'staffel' | 'index' | 'manuell';

/** Lease status */
export type LeaseStatus = 'aktiv' | 'beendet';

/** Receivable status */
export type ReceivableStatus = 'offen' | 'bezahlt' | 'teilbezahlt' | 'überfällig' | 'storniert';

/** Lease entity from the API */
export interface Lease {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  cold_rent: number; // in cents
  operating_cost_advance: number; // in cents
  heating_cost_advance: number; // in cents
  due_day: number;
  rent_model: RentModel;
  status: LeaseStatus;
  created_at: string;
  updated_at: string;
}

/** Form data for creating/editing a lease */
export interface LeaseFormData {
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  cold_rent: string;
  operating_cost_advance: string;
  heating_cost_advance: string;
  due_day: string;
  rent_model: RentModel | '';
}

/** Receivable (Sollstellung) from the API */
export interface Receivable {
  id: string;
  lease_id: string;
  property_id: string;
  due_date: string;
  cold_rent: number; // in cents
  operating_cost: number; // in cents
  heating_cost: number; // in cents
  total_amount: number; // in cents
  paid_amount: number; // in cents
  status: ReceivableStatus;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;
