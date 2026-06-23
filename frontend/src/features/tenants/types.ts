/** Tenant entity from the API */
export interface Tenant {
  id: string;
  property_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

/** Form data for creating/editing a tenant */
export interface TenantFormData {
  property_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;
