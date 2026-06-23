import { api } from '../../shared/api/client';
import { parseCurrencyInput } from '../../shared/utils/formatting';
import type { Deposit, DepositFormData, DepositFilters } from './types';

/** Fetch deposits with optional filters */
export async function fetchDeposits(filters: DepositFilters = {}): Promise<Deposit[]> {
  const params: Record<string, string> = {};
  if (filters.leaseId) params.leaseId = filters.leaseId;
  return api.get<Deposit[]>('/deposits', params);
}

/** Fetch a single deposit by ID */
export async function fetchDeposit(id: string): Promise<Deposit> {
  return api.get<Deposit>(`/deposits/${id}`);
}

/** Create a new deposit */
export async function createDeposit(data: DepositFormData): Promise<Deposit> {
  return api.post<Deposit>('/deposits', {
    lease_id: data.lease_id,
    amount: parseCurrencyInput(data.amount) ?? 0,
    received_date: data.received_date,
    account_reference: data.account_reference.trim(),
  });
}

/** Process a refund for a deposit */
export async function processRefund(
  depositId: string,
  data: { refund_amount: number; refund_date: string }
): Promise<Deposit> {
  return api.post<Deposit>(`/deposits/${depositId}/refund`, data);
}

/** Delete a deposit */
export async function deleteDeposit(id: string): Promise<void> {
  return api.delete(`/deposits/${id}`);
}
