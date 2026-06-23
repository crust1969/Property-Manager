import { api } from '../../shared/api/client';
import type { Property, PropertyFormData, Acquisition, AcquisitionFormData } from './types';
import { parseCurrencyInput } from '../../shared/utils/formatting';

/** Fetch all properties for the current user */
export async function fetchProperties(): Promise<Property[]> {
  return api.get<Property[]>('/properties');
}

/** Fetch a single property by ID */
export async function fetchProperty(id: string): Promise<Property> {
  return api.get<Property>(`/properties/${id}`);
}

/** Create a new property */
export async function createProperty(data: PropertyFormData): Promise<Property> {
  return api.post<Property>('/properties', {
    name: data.name.trim(),
    street: data.street.trim(),
    zip_code: data.zip_code.trim(),
    city: data.city.trim(),
    property_type: data.property_type,
    living_area_sqm: parseFloat(data.living_area_sqm.replace(',', '.')),
  });
}

/** Update an existing property */
export async function updateProperty(id: string, data: PropertyFormData): Promise<Property> {
  return api.put<Property>(`/properties/${id}`, {
    name: data.name.trim(),
    street: data.street.trim(),
    zip_code: data.zip_code.trim(),
    city: data.city.trim(),
    property_type: data.property_type,
    living_area_sqm: parseFloat(data.living_area_sqm.replace(',', '.')),
  });
}

/** Delete a property */
export async function deleteProperty(id: string): Promise<void> {
  return api.delete(`/properties/${id}`);
}

/** Fetch acquisition data for a property */
export async function fetchAcquisition(propertyId: string): Promise<Acquisition | null> {
  try {
    return await api.get<Acquisition>(`/properties/${propertyId}/acquisition`);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

/** Save acquisition data for a property */
export async function saveAcquisition(propertyId: string, data: AcquisitionFormData): Promise<Acquisition> {
  return api.put<Acquisition>(`/properties/${propertyId}/acquisition`, {
    purchase_price: parseCurrencyInput(data.purchase_price) ?? 0,
    purchase_date: data.purchase_date,
    transfer_date: data.transfer_date || null,
    notary_cost: parseCurrencyInput(data.notary_cost) ?? 0,
    transfer_tax: parseCurrencyInput(data.transfer_tax) ?? 0,
    land_registry_cost: parseCurrencyInput(data.land_registry_cost) ?? 0,
    broker_cost: parseCurrencyInput(data.broker_cost) ?? 0,
    building_share: parseCurrencyInput(data.building_share) ?? 0,
    land_share: parseCurrencyInput(data.land_share) ?? 0,
  });
}
