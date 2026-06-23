import { api } from '../../shared/api/client';
import { parseCurrencyInput } from '../../shared/utils/formatting';
import type { Lease, LeaseFormData, Receivable } from './types';

/** Fetch all leases, optionally filtered by property */
export async function fetchLeases(propertyId?: string): Promise<Lease[]> {
  const params: Record<string, string> = {};
  if (propertyId) params.propertyId = propertyId;
  return api.get<Lease[]>('/leases', params);
}

/** Fetch a single lease by ID */
export async function fetchLease(id: string): Promise<Lease> {
  return api.get<Lease>(`/leases/${id}`);
}

/** Create a new lease */
export async function createLease(data: LeaseFormData): Promise<Lease> {
  return api.post<Lease>('/leases', {
    property_id: data.property_id,
    tenant_id: data.tenant_id,
    start_date: data.start_date,
    end_date: data.end_date || null,
    cold_rent: parseCurrencyInput(data.cold_rent) ?? 0,
    operating_cost_advance: parseCurrencyInput(data.operating_cost_advance) ?? 0,
    heating_cost_advance: parseCurrencyInput(data.heating_cost_advance) ?? 0,
    due_day: parseInt(data.due_day, 10),
    rent_model: data.rent_model,
  });
}

/** Update an existing lease */
export async function updateLease(id: string, data: LeaseFormData): Promise<Lease> {
  return api.put<Lease>(`/leases/${id}`, {
    property_id: data.property_id,
    tenant_id: data.tenant_id,
    start_date: data.start_date,
    end_date: data.end_date || null,
    cold_rent: parseCurrencyInput(data.cold_rent) ?? 0,
    operating_cost_advance: parseCurrencyInput(data.operating_cost_advance) ?? 0,
    heating_cost_advance: parseCurrencyInput(data.heating_cost_advance) ?? 0,
    due_day: parseInt(data.due_day, 10),
    rent_model: data.rent_model,
  });
}

/** Terminate a lease */
export async function terminateLease(id: string): Promise<Lease> {
  return api.post<Lease>(`/leases/${id}/terminate`);
}

/** Delete a lease */
export async function deleteLease(id: string): Promise<void> {
  return api.delete(`/leases/${id}`);
}

/** Fetch receivables for a lease */
export async function fetchReceivables(leaseId: string): Promise<Receivable[]> {
  return api.get<Receivable[]>(`/leases/${leaseId}/receivables`);
}
