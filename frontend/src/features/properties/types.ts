import type { PropertyType } from '../../shared/types';

/** Property entity from the API */
export interface Property {
  id: string;
  user_id: string;
  name: string;
  street: string;
  zip_code: string;
  city: string;
  property_type: PropertyType;
  living_area_sqm: number;
  created_at: string;
  updated_at: string;
}

/** Form data for creating/editing a property */
export interface PropertyFormData {
  name: string;
  street: string;
  zip_code: string;
  city: string;
  property_type: PropertyType | '';
  living_area_sqm: string;
}

/** Acquisition data from the API (amounts in cents) */
export interface Acquisition {
  id: string;
  property_id: string;
  purchase_price: number;
  purchase_date: string;
  transfer_date: string | null;
  notary_cost: number;
  transfer_tax: number;
  land_registry_cost: number;
  broker_cost: number;
  building_share: number;
  land_share: number;
  afa_basis: number;
  afa_rate: number | null;
  afa_start_date: string | null;
}

/** Form data for acquisition (user inputs as strings for German formatting) */
export interface AcquisitionFormData {
  purchase_price: string;
  purchase_date: string;
  transfer_date: string;
  notary_cost: string;
  transfer_tax: string;
  land_registry_cost: string;
  broker_cost: string;
  building_share: string;
  land_share: string;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;
