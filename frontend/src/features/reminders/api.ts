import { api } from '../../shared/api/client';
import type { Reminder, ReminderFormData, ReminderFilters } from './types';

/** Fetch reminders with optional filters */
export async function fetchReminders(filters: ReminderFilters = {}): Promise<Reminder[]> {
  const params: Record<string, string> = {};
  if (filters.propertyId) params.propertyId = filters.propertyId;
  if (filters.status) params.status = filters.status;
  return api.get<Reminder[]>('/reminders', params);
}

/** Create a new reminder */
export async function createReminder(data: ReminderFormData): Promise<Reminder> {
  return api.post<Reminder>('/reminders', {
    title: data.title.trim(),
    due_date: data.due_date,
    priority: data.priority,
    recurrence: data.recurrence,
    note: data.note.trim() || null,
    property_id: data.property_id || null,
    linked_entity_type: data.linked_entity_type || null,
    linked_entity_id: data.linked_entity_id || null,
  });
}

/** Update an existing reminder */
export async function updateReminder(id: string, data: ReminderFormData): Promise<Reminder> {
  return api.put<Reminder>(`/reminders/${id}`, {
    title: data.title.trim(),
    due_date: data.due_date,
    priority: data.priority,
    recurrence: data.recurrence,
    note: data.note.trim() || null,
    property_id: data.property_id || null,
    linked_entity_type: data.linked_entity_type || null,
    linked_entity_id: data.linked_entity_id || null,
  });
}

/** Mark a reminder as completed */
export async function completeReminder(id: string): Promise<Reminder> {
  return api.post<Reminder>(`/reminders/${id}/complete`);
}

/** Postpone a reminder with a new due date */
export async function postponeReminder(id: string, newDueDate: string): Promise<Reminder> {
  return api.post<Reminder>(`/reminders/${id}/postpone`, { due_date: newDueDate });
}
