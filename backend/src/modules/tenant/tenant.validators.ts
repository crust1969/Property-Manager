import { z } from 'zod';

export const createTenantSchema = z.object({
  property_id: z.string().min(1, 'Objekt-ID ist erforderlich'),
  first_name: z.string().min(1, 'Vorname ist erforderlich').max(50, 'Vorname darf maximal 50 Zeichen lang sein'),
  last_name: z.string().min(1, 'Nachname ist erforderlich').max(50, 'Nachname darf maximal 50 Zeichen lang sein'),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')).or(z.null()).transform(v => v || undefined),
  phone: z.string().optional().or(z.null()).transform(v => v || undefined),
  address: z.string().optional().or(z.null()).transform(v => v || undefined),
});

export const updateTenantSchema = z.object({
  property_id: z.string().min(1, 'Objekt-ID ist erforderlich').optional(),
  first_name: z.string().min(1, 'Vorname ist erforderlich').max(50, 'Vorname darf maximal 50 Zeichen lang sein'),
  last_name: z.string().min(1, 'Nachname ist erforderlich').max(50, 'Nachname darf maximal 50 Zeichen lang sein'),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')).or(z.null()).transform(v => v || undefined),
  phone: z.string().optional().or(z.null()).transform(v => v || undefined),
  address: z.string().optional().or(z.null()).transform(v => v || undefined),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
