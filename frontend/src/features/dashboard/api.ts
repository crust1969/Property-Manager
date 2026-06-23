import { api } from '../../shared/api/client';
import type { DashboardKPIs } from './types';

/**
 * Fetch dashboard KPIs.
 * When propertyId is provided, returns data for that property only.
 * When omitted, returns aggregated data across all properties.
 */
export async function fetchDashboard(propertyId?: string): Promise<DashboardKPIs> {
  const params: Record<string, string> = {};
  if (propertyId) {
    params.propertyId = propertyId;
  }
  return api.get<DashboardKPIs>('/dashboard', params);
}
