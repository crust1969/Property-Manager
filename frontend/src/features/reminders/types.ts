/** Reminder priority levels */
export type ReminderPriority = 'hoch' | 'mittel' | 'niedrig';

/** Reminder status values */
export type ReminderStatus = 'offen' | 'erledigt' | 'verschoben';

/** Recurrence interval */
export type ReminderRecurrence = 'einmalig' | 'täglich' | 'wöchentlich' | 'monatlich' | 'jährlich';

/** Linked entity type */
export type LinkedEntityType = 'lease' | 'loan';

/** Reminder entity from the API */
export interface Reminder {
  id: string;
  user_id: string;
  property_id: string | null;
  linked_entity_type: LinkedEntityType | null;
  linked_entity_id: string | null;
  title: string;
  note: string | null;
  due_date: string;
  priority: ReminderPriority;
  status: ReminderStatus;
  recurrence: ReminderRecurrence;
  created_at: string;
  updated_at: string;
  property_name?: string;
}

/** Form data for creating/editing a reminder */
export interface ReminderFormData {
  title: string;
  due_date: string;
  priority: ReminderPriority;
  recurrence: ReminderRecurrence;
  note: string;
  property_id: string;
  linked_entity_type: string;
  linked_entity_id: string;
}

/** Filters for fetching reminders */
export interface ReminderFilters {
  propertyId?: string;
  status?: string;
}

/** Validation errors keyed by field name */
export type ValidationErrors = Record<string, string>;
