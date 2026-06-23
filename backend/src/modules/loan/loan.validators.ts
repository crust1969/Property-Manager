import { z } from 'zod';

export const createLoanSchema = z.object({
  property_id: z.string().uuid('Objekt-ID ist erforderlich'),
  lender: z.string()
    .min(1, 'Darlehensgeber ist erforderlich')
    .max(100, 'Darlehensgeber darf maximal 100 Zeichen lang sein'),
  contract_number: z.string()
    .max(50, 'Vertragsnummer darf maximal 50 Zeichen lang sein')
    .optional()
    .nullable(),
  loan_amount: z.number()
    .int('Darlehenssumme muss in Cent angegeben werden')
    .min(1, 'Darlehenssumme muss mindestens 0,01 EUR (1 Cent) betragen')
    .max(9999999999, 'Darlehenssumme darf maximal 99.999.999,99 EUR betragen'),
  interest_rate: z.number()
    .min(0, 'Zinssatz darf nicht negativ sein')
    .max(99.99, 'Zinssatz darf maximal 99,99% betragen'),
  repayment_rate: z.number()
    .min(0, 'Tilgungssatz darf nicht negativ sein')
    .max(99.99, 'Tilgungssatz darf maximal 99,99% betragen'),
  start_date: z.string()
    .min(1, 'Startdatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Startdatum muss im Format YYYY-MM-DD sein'),
  end_date: z.string()
    .min(1, 'Enddatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enddatum muss im Format YYYY-MM-DD sein'),
  fixed_interest_months: z.number()
    .int('Sollzinsbindung muss ganzzahlig sein')
    .min(0, 'Sollzinsbindung darf nicht negativ sein')
    .optional()
    .nullable(),
  interest_only_months: z.number()
    .int('Tilgungsfreie Monate muss ganzzahlig sein')
    .min(0, 'Tilgungsfreie Monate darf nicht negativ sein')
    .max(120, 'Tilgungsfreie Monate darf maximal 120 betragen')
    .optional()
    .default(0),
}).refine(data => data.end_date > data.start_date, {
  message: 'Enddatum muss nach dem Startdatum liegen',
  path: ['end_date'],
});

export const updateLoanSchema = z.object({
  property_id: z.string().uuid('Objekt-ID ist erforderlich'),
  lender: z.string()
    .min(1, 'Darlehensgeber ist erforderlich')
    .max(100, 'Darlehensgeber darf maximal 100 Zeichen lang sein'),
  contract_number: z.string()
    .max(50, 'Vertragsnummer darf maximal 50 Zeichen lang sein')
    .optional()
    .nullable(),
  loan_amount: z.number()
    .int('Darlehenssumme muss in Cent angegeben werden')
    .min(1, 'Darlehenssumme muss mindestens 0,01 EUR (1 Cent) betragen')
    .max(9999999999, 'Darlehenssumme darf maximal 99.999.999,99 EUR betragen'),
  interest_rate: z.number()
    .min(0, 'Zinssatz darf nicht negativ sein')
    .max(99.99, 'Zinssatz darf maximal 99,99% betragen'),
  repayment_rate: z.number()
    .min(0, 'Tilgungssatz darf nicht negativ sein')
    .max(99.99, 'Tilgungssatz darf maximal 99,99% betragen'),
  start_date: z.string()
    .min(1, 'Startdatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Startdatum muss im Format YYYY-MM-DD sein'),
  end_date: z.string()
    .min(1, 'Enddatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enddatum muss im Format YYYY-MM-DD sein'),
  fixed_interest_months: z.number()
    .int('Sollzinsbindung muss ganzzahlig sein')
    .min(0, 'Sollzinsbindung darf nicht negativ sein')
    .optional()
    .nullable(),
  interest_only_months: z.number()
    .int('Tilgungsfreie Monate muss ganzzahlig sein')
    .min(0, 'Tilgungsfreie Monate darf nicht negativ sein')
    .max(120, 'Tilgungsfreie Monate darf maximal 120 betragen')
    .optional()
    .default(0),
}).refine(data => data.end_date > data.start_date, {
  message: 'Enddatum muss nach dem Startdatum liegen',
  path: ['end_date'],
});

export const createPaymentSchema = z.object({
  payment_date: z.string()
    .min(1, 'Zahlungsdatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Zahlungsdatum muss im Format YYYY-MM-DD sein'),
  interest_amount: z.number()
    .int('Zinsbetrag muss in Cent angegeben werden')
    .min(0, 'Zinsbetrag darf nicht negativ sein')
    .max(9999999999, 'Zinsbetrag darf maximal 99.999.999,99 EUR betragen'),
  repayment_amount: z.number()
    .int('Tilgungsbetrag muss in Cent angegeben werden')
    .min(0, 'Tilgungsbetrag darf nicht negativ sein')
    .max(9999999999, 'Tilgungsbetrag darf maximal 99.999.999,99 EUR betragen'),
  fee_amount: z.number()
    .int('Gebühren müssen in Cent angegeben werden')
    .min(0, 'Gebühren dürfen nicht negativ sein')
    .max(9999999999, 'Gebühren dürfen maximal 99.999.999,99 EUR betragen')
    .optional()
    .default(0),
  extra_repayment: z.number()
    .int('Sondertilgung muss in Cent angegeben werden')
    .min(0, 'Sondertilgung darf nicht negativ sein')
    .max(9999999999, 'Sondertilgung darf maximal 99.999.999,99 EUR betragen')
    .optional()
    .default(0),
});

export const loanQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type LoanQuery = z.infer<typeof loanQuerySchema>;
