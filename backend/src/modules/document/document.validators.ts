import { z } from 'zod';

export const ALLOWED_FILE_TYPES = ['pdf', 'jpeg', 'png'] as const;
export const ALLOWED_MIME_TYPES: Record<string, typeof ALLOWED_FILE_TYPES[number]> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
};
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
export const MAX_FILENAME_LENGTH = 255;
export const MAX_KEYWORDS = 10;
export const MAX_KEYWORD_LENGTH = 50;
export const MAX_LINKS_PER_DOCUMENT = 10;
export const ALLOWED_ENTITY_TYPES = ['property', 'booking', 'loan', 'lease'] as const;

export const uploadMetadataSchema = z.object({
  keywords: z
    .array(
      z.string().max(MAX_KEYWORD_LENGTH, `Schlagwort darf maximal ${MAX_KEYWORD_LENGTH} Zeichen lang sein`)
    )
    .max(MAX_KEYWORDS, `Maximal ${MAX_KEYWORDS} Schlagwörter erlaubt`)
    .optional()
    .default([]),
});

export const searchDocumentsSchema = z.object({
  search: z.string().optional(),
  propertyId: z.string().optional(),
});

export const linkDocumentSchema = z.object({
  entity_type: z.enum(ALLOWED_ENTITY_TYPES, {
    errorMap: () => ({ message: `Entitätstyp muss einer der folgenden sein: ${ALLOWED_ENTITY_TYPES.join(', ')}` }),
  }),
  entity_id: z.string().min(1, 'Entitäts-ID ist erforderlich'),
});

export type UploadMetadataInput = z.infer<typeof uploadMetadataSchema>;
export type SearchDocumentsInput = z.infer<typeof searchDocumentsSchema>;
export type LinkDocumentInput = z.infer<typeof linkDocumentSchema>;
