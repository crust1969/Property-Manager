import { api } from '../../shared/api/client';
import type { UserProfile, ProfileFormData, AuditLogResponse, AuditLogFilters } from './types';

/** Fetch the current user's profile */
export async function fetchProfile(): Promise<UserProfile> {
  return api.get<UserProfile>('/settings/profile');
}

/** Update the current user's profile */
export async function updateProfile(data: ProfileFormData): Promise<UserProfile> {
  return api.put<UserProfile>('/settings/profile', {
    name: data.name.trim(),
    email: data.email.trim(),
  });
}

/** Change the current user's password */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return api.post<void>('/settings/password', {
    currentPassword,
    newPassword,
  });
}

/** Fetch audit log entries with filters and pagination */
export async function fetchAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params: Record<string, string> = {};
  if (filters.bookingId) params.bookingId = filters.bookingId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.type) params.type = filters.type;
  if (filters.page !== undefined) params.page = String(filters.page);
  if (filters.limit !== undefined) params.limit = String(filters.limit);
  return api.get<AuditLogResponse>('/audit-log', params);
}
