import { z } from 'zod';

// UUID regex pattern for validation
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Split item schema: each split has amount (in cents), category_id, and 4 boolean flags.
 */
export const splitItemSchema = z.object({
  amount: z.number().int().min(1).max(99999999999),
  category_id: z.string().regex(uuidPattern, 'Ungültige Kategorie-ID'),
  is_allocable: z.boolean().optional(),
  is_tax_deductible: z.boolean().optional(),
  requires_capitalization: z.boolean().optional(),
  is_financing_related: z.boolean().optional(),
});

/**
 * Create expense schema.
 * Requires at least one split. Amount is in cents (0.01€ = 1 cent to 999,999,999.99€ = 99999999999 cents).
 */
export const createExpenseSchema = z.object({
  property_id: z.string().regex(uuidPattern, 'Ungültige Objekt-ID'),
  booking_date: z.string().min(1, 'Buchungsdatum ist erforderlich'),
  total_amount: z.number().int().min(1, 'Betrag muss mindestens 1 Cent sein').max(99999999999, 'Betrag darf maximal 999.999.999,99€ betragen'),
  counterparty: z.string().max(200, 'Gegenpartei darf maximal 200 Zeichen lang sein').optional().nullable(),
  description: z.string().max(500, 'Beschreibung darf maximal 500 Zeichen lang sein').optional().nullable(),
  receivable_id: z.string().regex(uuidPattern).optional().nullable(),
  splits: z.array(splitItemSchema).min(1, 'Mindestens eine Teilbuchung ist erforderlich'),
});

/**
 * Update expense schema (all fields optional except we need at least one field).
 */
export const updateExpenseSchema = z.object({
  booking_date: z.string().min(1, 'Buchungsdatum ist erforderlich').optional(),
  total_amount: z.number().int().min(1).max(99999999999).optional(),
  counterparty: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  receivable_id: z.string().regex(uuidPattern).optional().nullable(),
  splits: z.array(splitItemSchema).min(1).optional(),
});

/**
 * Split creation/replacement schema: 2–20 splits, sum must be validated in service.
 */
export const splitExpenseSchema = z.object({
  splits: z.array(splitItemSchema).min(2, 'Mindestens 2 Teilbuchungen erforderlich').max(20, 'Maximal 20 Teilbuchungen erlaubt'),
});

/**
 * Query params for listing expenses.
 */
export const getExpensesQuerySchema = z.object({
  propertyId: z.string().regex(uuidPattern, 'Ungültige Objekt-ID').optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  categoryId: z.string().regex(uuidPattern).optional(),
  flags: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type SplitExpenseInput = z.infer<typeof splitExpenseSchema>;
export type SplitItemInput = z.infer<typeof splitItemSchema>;
export type GetExpensesQuery = z.infer<typeof getExpensesQuerySchema>;
