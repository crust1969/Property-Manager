import { z } from 'zod';

export const rentModelEnum = z.enum(['konstant', 'staffel', 'index', 'manuell']);

export const createLeaseSchema = z.object({
  property_id: z.string().uuid('Objekt ist erforderlich'),
  tenant_id: z.string().uuid('Mieter ist erforderlich'),
  start_date: z.string().min(1, 'Mietbeginn ist erforderlich').regex(/^\d{4}-\d{2}-\d{2}$/, 'Mietbeginn muss im Format YYYY-MM-DD sein'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Mietende muss im Format YYYY-MM-DD sein').optional().nullable(),
  cold_rent: z.number()
    .int('Kaltmiete muss in Cent angegeben werden')
    .min(1, 'Kaltmiete muss mindestens 0,01 EUR (1 Cent) betragen')
    .max(9999999, 'Kaltmiete darf maximal 99.999,99 EUR betragen'),
  operating_cost_advance: z.number().int().min(0).default(0),
  heating_cost_advance: z.number().int().min(0).default(0),
  due_day: z.number()
    .int('Fälligkeitstag muss eine ganze Zahl sein')
    .min(1, 'Fälligkeitstag muss mindestens 1 sein')
    .max(28, 'Fälligkeitstag darf maximal 28 sein'),
  rent_model: rentModelEnum,
});

export const updateLeaseSchema = z.object({
  property_id: z.string().uuid('Objekt ist erforderlich'),
  tenant_id: z.string().uuid('Mieter ist erforderlich'),
  start_date: z.string().min(1, 'Mietbeginn ist erforderlich').regex(/^\d{4}-\d{2}-\d{2}$/, 'Mietbeginn muss im Format YYYY-MM-DD sein'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Mietende muss im Format YYYY-MM-DD sein').optional().nullable(),
  cold_rent: z.number()
    .int('Kaltmiete muss in Cent angegeben werden')
    .min(1, 'Kaltmiete muss mindestens 0,01 EUR (1 Cent) betragen')
    .max(9999999, 'Kaltmiete darf maximal 99.999,99 EUR betragen'),
  operating_cost_advance: z.number().int().min(0).default(0),
  heating_cost_advance: z.number().int().min(0).default(0),
  due_day: z.number()
    .int('Fälligkeitstag muss eine ganze Zahl sein')
    .min(1, 'Fälligkeitstag muss mindestens 1 sein')
    .max(28, 'Fälligkeitstag darf maximal 28 sein'),
  rent_model: rentModelEnum,
});

export const terminateLeaseSchema = z.object({
  end_date: z.string().min(1, 'Beendigungsdatum ist erforderlich').regex(/^\d{4}-\d{2}-\d{2}$/, 'Beendigungsdatum muss im Format YYYY-MM-DD sein'),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
export type TerminateLeaseInput = z.infer<typeof terminateLeaseSchema>;
