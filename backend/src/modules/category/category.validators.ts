import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen lang sein'),
  type: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: 'Typ muss "income" oder "expense" sein' }),
  }),
  property_id: z.string().uuid('Ungültige Property-ID'),
  is_allocable: z.boolean({ required_error: 'Umlagefähig ist erforderlich' }),
  is_tax_deductible: z.boolean({ required_error: 'Steuerlich abziehbar ist erforderlich' }),
  requires_capitalization: z.boolean({ required_error: 'Aktivierungspflichtig ist erforderlich' }),
  is_financing_related: z.boolean({ required_error: 'Finanzierungsbezogen ist erforderlich' }),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen lang sein'),
  type: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: 'Typ muss "income" oder "expense" sein' }),
  }),
  is_allocable: z.boolean({ required_error: 'Umlagefähig ist erforderlich' }),
  is_tax_deductible: z.boolean({ required_error: 'Steuerlich abziehbar ist erforderlich' }),
  requires_capitalization: z.boolean({ required_error: 'Aktivierungspflichtig ist erforderlich' }),
  is_financing_related: z.boolean({ required_error: 'Finanzierungsbezogen ist erforderlich' }),
});

export const getCategoriesQuerySchema = z.object({
  propertyId: z.string().uuid('Ungültige Property-ID').optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type GetCategoriesQuery = z.infer<typeof getCategoriesQuerySchema>;
