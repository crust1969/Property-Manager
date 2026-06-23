import { api } from '../../shared/api/client';
import { parseCurrencyInput, parseGermanNumber } from '../../shared/utils/formatting';
import type { UtilityBilling, BillingFormData } from './types';

/** Create a new utility billing */
export async function createBilling(data: BillingFormData): Promise<UtilityBilling> {
  const items = data.positions.map((pos) => {
    const totalCost = parseCurrencyInput(pos.amount) ?? 0;
    const item: Record<string, unknown> = {
      category_id: pos.category_id,
      total_cost: totalCost,
      allocation_key: pos.allocation_key,
    };

    // Add allocation parameters based on key type
    const p = pos.allocation_params;
    if (p.key === 'fläche') {
      item.tenant_area = parseGermanNumber(p.params.tenant_area) ?? 0;
      item.total_area = parseGermanNumber(p.params.total_area) ?? 0;
    } else if (p.key === 'personen') {
      item.tenant_persons = parseInt(p.params.tenant_persons, 10) || 0;
      item.total_persons = parseInt(p.params.total_persons, 10) || 0;
    } else if (p.key === 'verbrauch') {
      item.tenant_consumption = parseGermanNumber(p.params.tenant_consumption) ?? 0;
      item.total_consumption = parseGermanNumber(p.params.total_consumption) ?? 0;
    } else if (p.key === 'manuell') {
      item.manual_percentage = parseGermanNumber(p.params.manual_percentage) ?? 0;
    }
    // 'direkt' has no extra params

    return item;
  });

  return api.post<UtilityBilling>('/utility-billing', {
    property_id: data.property_id,
    lease_id: data.lease_id,
    period_start: data.period_start,
    period_end: data.period_end,
    items,
  });
}

/** Fetch a single utility billing by ID */
export async function fetchBilling(id: string): Promise<UtilityBilling> {
  return api.get<UtilityBilling>(`/utility-billing/${id}`);
}

/** Download the billing as PDF (returns blob URL) */
export async function downloadBillingPdf(id: string): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/v1/utility-billing/${id}/pdf`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('PDF-Download fehlgeschlagen');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nebenkostenabrechnung-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
