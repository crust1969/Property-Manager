/** Deposit status */
export type DepositStatus =
  | 'hinterlegt'
  | 'teilweise_zurueckgezahlt'
  | 'vollstaendig_zurueckgezahlt'
  | 'verrechnet';

/** Deposit entity from the API */
export interface Deposit {
  id: string;
  lease_id: string;
  property_id: string;
  amount: number; // in cents
  received_date: string;
  account_reference: string;
  status: DepositStatus;
  refunded_amount: number; // in cents
  remaining_amount: number; // computed: amount - refunded_amount
  created_at: string;
  // Joined fields
  tenant_name?: string;
  property_name?: string;
}

/** Form data for creating a deposit */
export interface DepositFormData {
  lease_id: string;
  amount: string; // German formatted string
  received_date: string;
  account_reference: string;
}

/** Form data for refund dialog */
export interface RefundFormData {
  refund_amount: string; // German formatted string
  refund_date: string;
}

/** Filters for fetching deposits */
export interface DepositFilters {
  leaseId?: string;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;
