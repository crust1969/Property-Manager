import { z } from 'zod';

export const createIncomeSchema = z.object({
  property_id: z.string().uuid('Objekt ist erforderlich'),
  booking_date: z.string()
    .min(1, 'Buchungsdatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Buchungsdatum muss im Format YYYY-MM-DD sein'),
  total_amount: z.number()
    .int('Betrag muss in Cent angegeben werden')
    .min(1, 'Betrag muss mindestens 0,01 EUR (1 Cent) betragen')
    .max(99999999, 'Betrag darf maximal 999.999,99 EUR betragen'),
  counterparty: z.string()
    .min(1, 'Gegenpartei ist erforderlich')
    .max(100, 'Gegenpartei darf maximal 100 Zeichen lang sein'),
  category_id: z.string().uuid('Kategorie ist erforderlich'),
  receivable_id: z.string().uuid('Ungültige Sollstellungs-ID').optional().nullable(),
  description: z.string().max(500, 'Beschreibung darf maximal 500 Zeichen lang sein').optional().nullable(),
});

export const updateIncomeSchema = z.object({
  property_id: z.string().uuid('Objekt ist erforderlich'),
  booking_date: z.string()
    .min(1, 'Buchungsdatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Buchungsdatum muss im Format YYYY-MM-DD sein'),
  total_amount: z.number()
    .int('Betrag muss in Cent angegeben werden')
    .min(1, 'Betrag muss mindestens 0,01 EUR (1 Cent) betragen')
    .max(99999999, 'Betrag darf maximal 999.999,99 EUR betragen'),
  counterparty: z.string()
    .min(1, 'Gegenpartei ist erforderlich')
    .max(100, 'Gegenpartei darf maximal 100 Zeichen lang sein'),
  category_id: z.string().uuid('Kategorie ist erforderlich'),
  receivable_id: z.string().uuid('Ungültige Sollstellungs-ID').optional().nullable(),
  description: z.string().max(500, 'Beschreibung darf maximal 500 Zeichen lang sein').optional().nullable(),
});

export const incomeQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const comparisonQuerySchema = z.object({
  leaseId: z.string().uuid('Mietvertrag-ID ist erforderlich'),
  year: z.coerce.number().int().min(1900).max(2200),
  month: z.coerce.number().int().min(1).max(12),
});

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
export type IncomeQuery = z.infer<typeof incomeQuerySchema>;
export type ComparisonQuery = z.infer<typeof comparisonQuerySchema>;
