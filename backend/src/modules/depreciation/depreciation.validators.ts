import { z } from 'zod';

export const createPositionSchema = z.object({
  name: z.string().min(1, 'Positionsname ist erforderlich').max(100, 'Positionsname darf maximal 100 Zeichen lang sein'),
  method: z.enum(['linear', 'degressiv'], { errorMap: () => ({ message: "Methode muss 'linear' oder 'degressiv' sein" }) }),
  basis: z.number().int().positive('Bemessungsgrundlage muss größer als 0 sein'),
  rate: z.number().min(0.0001).max(1.0).optional(),
  duration_years: z.number().int().min(1).max(100).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (erwartet: YYYY-MM-DD)'),
}).refine(
  (data) => data.rate !== undefined || (data.method === 'linear' && data.duration_years !== undefined),
  { message: 'AfA-Satz oder Nutzungsdauer muss angegeben werden' }
);

export const updatePositionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  method: z.enum(['linear', 'degressiv']).optional(),
  basis: z.number().int().positive().optional(),
  rate: z.number().min(0.0001).max(1.0).optional(),
  duration_years: z.number().int().min(1).max(100).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
