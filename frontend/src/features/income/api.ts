import { api } from '../../shared/api/client';
import { parseCurrencyInput } from '../../shared/utils/formatting';
import type { Income, IncomeFormData, IncomeFilters, ComparisonEntry } from './types';

/** Fetch income bookings with optional filters */
export async function fetchIncome(filters: IncomeFilters = {}): Promise<Income[]> {
  const params: Record<string, string> = {};
  if (filters.propertyId) params.propertyId = filters.propertyId;
  if (filters.year) params.year = filters.year;
  if (filters.month) params.month = filters.month;
  return api.get<Income[]>('/income', params);
}

/** Fetch a single income booking by ID */
export async function fetchIncomeById(id: string): Promise<Income> {
  return api.get<Income>(`/income/${id}`);
}

/** Create a new income booking */
export async function createIncome(data: IncomeFormData): Promise<Income> {
  return api.post<Income>('/income', {
    property_id: data.property_id,
    booking_date: data.booking_date,
    total_amount: parseCurrencyInput(data.total_amount) ?? 0,
    counterparty: data.counterparty.trim(),
    category_id: data.category_id,
    description: data.description.trim(),
    receivable_id: data.receivable_id || null,
  });
}

/** Update an existing income booking */
export async function updateIncome(id: string, data: IncomeFormData): Promise<Income> {
  return api.put<Income>(`/income/${id}`, {
    property_id: data.property_id,
    booking_date: data.booking_date,
    total_amount: parseCurrencyInput(data.total_amount) ?? 0,
    counterparty: data.counterparty.trim(),
    category_id: data.category_id,
    description: data.description.trim(),
    receivable_id: data.receivable_id || null,
  });
}

/** Delete an income booking */
export async function deleteIncome(id: string): Promise<void> {
  return api.delete(`/income/${id}`);
}

/** Fetch Soll/Ist comparison data */
export async function fetchComparison(params: {
  leaseId?: string;
  year?: string;
  month?: string;
}): Promise<ComparisonEntry[]> {
  const queryParams: Record<string, string> = {};
  if (params.leaseId) queryParams.leaseId = params.leaseId;
  if (params.year) queryParams.year = params.year;
  if (params.month) queryParams.month = params.month;

  const response = await api.get<{
    soll: number;
    ist: number;
    differenz: number;
    receivables: Array<{
      id: string;
      due_date: string;
      total_amount: number;
      paid_amount: number;
      status: string;
    }>;
  }>('/income/comparison', queryParams);

  // Map backend response to ComparisonEntry[]
  return response.receivables.map((r) => ({
    receivable_id: r.id,
    due_date: r.due_date,
    soll_amount: r.total_amount,
    ist_amount: r.paid_amount,
    differenz: r.total_amount - r.paid_amount,
    status: r.status as ComparisonEntry['status'],
  }));
}
