import { z } from 'zod';

export const propertyTypeEnum = z.enum(['Wohnung', 'Haus', 'Gewerbe', 'Garage', 'Grundstück']);

export const createPropertySchema = z.object({
  name: z.string().min(1, 'Bezeichnung ist erforderlich').max(100, 'Bezeichnung darf maximal 100 Zeichen lang sein'),
  street: z.string().min(1, 'Straße ist erforderlich').max(150, 'Straße darf maximal 150 Zeichen lang sein'),
  zip_code: z.string().regex(/^\d{5}$/, 'PLZ muss genau 5 Ziffern enthalten'),
  city: z.string().min(1, 'Ort ist erforderlich').max(100, 'Ort darf maximal 100 Zeichen lang sein'),
  property_type: propertyTypeEnum,
  living_area_sqm: z.number().min(1, 'Wohnfläche muss mindestens 1 m² betragen').max(99999, 'Wohnfläche darf maximal 99999 m² betragen'),
});

export const updatePropertySchema = createPropertySchema;

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
