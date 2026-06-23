import { api } from '../../shared/api/client';
import type { ReportType, ReportFormat, ReportResponse } from './types';

const API_BASE = '/api/v1';

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Fetch a report. For JSON format, returns parsed data.
 * For CSV/PDF format, triggers a file download.
 */
export async function fetchReport(
  type: ReportType,
  propertyId: string | undefined,
  year: string,
  format: ReportFormat
): Promise<ReportResponse | null> {
  if (format === 'json') {
    const params: Record<string, string> = { year, format: 'json' };
    if (propertyId) params.propertyId = propertyId;
    return api.get<ReportResponse>(`/reports/${type}`, params);
  }

  // For CSV/PDF: trigger download via fetch + blob
  const url = new URL(`${API_BASE}/reports/${type}`, window.location.origin);
  url.searchParams.set('year', year);
  url.searchParams.set('format', format);
  if (propertyId) url.searchParams.set('propertyId', propertyId);

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), { method: 'GET', headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Fehler beim Herunterladen: ${response.status}`);
  }

  const blob = await response.blob();
  const filename = `${type}_${year}.${format}`;
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);

  return null;
}
