/** User profile data */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

/** Form data for updating profile */
export interface ProfileFormData {
  name: string;
  email: string;
}

/** Form data for changing password */
export interface PasswordChangeFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Audit log entry from the API */
export interface AuditLogEntry {
  id: string;
  booking_split_id: string;
  user_id: string;
  user_name?: string;
  changed_flag: string;
  previous_value: number;
  new_value: number;
  reason: string;
  created_at: string;
}

/** Paginated audit log response */
export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

/** Filters for fetching audit log */
export interface AuditLogFilters {
  bookingId?: string;
  from?: string;
  to?: string;
  type?: string;
  page?: number;
  limit?: number;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;
