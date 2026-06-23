import { api } from '../../shared/api/client';
import type { Tenant, TenantFormData } from './types';

/** Fetch all tenants, optionally filtered by property */
export async function fetchTenants(propertyId?: string): Promise<Tenant[]> {
  const params: Record<string, string> = {};
  if (propertyId) params.propertyId = propertyId;
  return api.get<Tenant[]>('/tenants', params);
}

/** Fetch a single tenant by ID */
export async function fetchTenant(id: string): Promise<Tenant> {
  return api.get<Tenant>(`/tenants/${id}`);
}

/** Create a new tenant */
export async function createTenant(data: TenantFormData): Promise<Tenant> {
  return api.post<Tenant>('/tenants', {
    property_id: data.property_id,
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email: data.email.trim() || null,
    phone: data.phone.trim() || null,
    address: data.address.trim() || null,
  });
}

/** Update an existing tenant */
export async function updateTenant(id: string, data: TenantFormData): Promise<Tenant> {
  return api.put<Tenant>(`/tenants/${id}`, {
    property_id: data.property_id,
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email: data.email.trim() || null,
    phone: data.phone.trim() || null,
    address: data.address.trim() || null,
  });
}

/** Delete a tenant */
export async function deleteTenant(id: string): Promise<void> {
  return api.delete(`/tenants/${id}`);
}
