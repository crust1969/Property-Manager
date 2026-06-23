import { z } from 'zod';
import { CLASSIFICATION_FLAGS } from './classification.service.js';

export const overrideFlagSchema = z.object({
  flag: z.enum(CLASSIFICATION_FLAGS as unknown as [string, ...string[]], {
    errorMap: () => ({
      message: `Flag muss eines von ${CLASSIFICATION_FLAGS.join(', ')} sein`,
    }),
  }),
  new_value: z.boolean({ required_error: 'Neuer Wert ist erforderlich' }),
  reason: z
    .string()
    .min(1, 'Änderungsgrund ist erforderlich')
    .max(500, 'Änderungsgrund darf maximal 500 Zeichen lang sein'),
});

export const getAuditLogQuerySchema = z.object({
  bookingSplitId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(CLASSIFICATION_FLAGS as unknown as [string, ...string[]]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type OverrideFlagInput = z.infer<typeof overrideFlagSchema>;
export type GetAuditLogQuery = z.infer<typeof getAuditLogQuerySchema>;
