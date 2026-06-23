import { z } from 'zod';

const priorityEnum = z.enum(['hoch', 'mittel', 'niedrig'], {
  errorMap: () => ({ message: 'Priorität muss hoch, mittel oder niedrig sein' }),
});

const recurrenceEnum = z.enum(['einmalig', 'täglich', 'wöchentlich', 'monatlich', 'jährlich'], {
  errorMap: () => ({ message: 'Wiederholung muss einmalig, täglich, wöchentlich, monatlich oder jährlich sein' }),
});

const statusEnum = z.enum(['offen', 'erledigt', 'verschoben'], {
  errorMap: () => ({ message: 'Status muss offen, erledigt oder verschoben sein' }),
});

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

function isFutureOrToday(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  return date >= today;
}

function isFuture(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  return date > today;
}

export const createReminderSchema = z.object({
  title: z.string()
    .min(1, 'Titel ist erforderlich')
    .max(100, 'Titel darf maximal 100 Zeichen lang sein'),
  due_date: z.string()
    .min(1, 'Fälligkeitsdatum ist erforderlich')
    .regex(isoDateRegex, 'Fälligkeitsdatum muss im Format YYYY-MM-DD sein')
    .refine(isFutureOrToday, 'Fälligkeitsdatum darf nicht in der Vergangenheit liegen'),
  priority: priorityEnum,
  recurrence: recurrenceEnum.default('einmalig'),
  property_id: z.string().uuid('Ungültige Objekt-ID').optional().nullable(),
  linked_entity_type: z.enum(['lease', 'loan']).optional().nullable(),
  linked_entity_id: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const updateReminderSchema = z.object({
  title: z.string()
    .min(1, 'Titel ist erforderlich')
    .max(100, 'Titel darf maximal 100 Zeichen lang sein')
    .optional(),
  due_date: z.string()
    .regex(isoDateRegex, 'Fälligkeitsdatum muss im Format YYYY-MM-DD sein')
    .optional(),
  priority: priorityEnum.optional(),
  recurrence: recurrenceEnum.optional(),
  status: statusEnum.optional(),
  property_id: z.string().uuid('Ungültige Objekt-ID').optional().nullable(),
  linked_entity_type: z.enum(['lease', 'loan']).optional().nullable(),
  linked_entity_id: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const postponeReminderSchema = z.object({
  due_date: z.string()
    .min(1, 'Neues Fälligkeitsdatum ist erforderlich')
    .regex(isoDateRegex, 'Fälligkeitsdatum muss im Format YYYY-MM-DD sein')
    .refine(isFuture, 'Neues Fälligkeitsdatum muss in der Zukunft liegen'),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type PostponeReminderInput = z.infer<typeof postponeReminderSchema>;
