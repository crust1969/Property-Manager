import { z } from 'zod';

export const createDepositSchema = z.object({
  lease_id: z.string().uuid('Mietvertrag-ID ist erforderlich'),
  amount: z.number()
    .int('Betrag muss in Cent angegeben werden')
    .min(1, 'Betrag muss mindestens 0,01 EUR (1 Cent) betragen')
    .max(99999999, 'Betrag darf maximal 999.999,99 EUR betragen'),
  received_date: z.string()
    .min(1, 'Eingangsdatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Eingangsdatum muss im Format YYYY-MM-DD sein'),
  account_reference: z.string()
    .min(1, 'Kontoreferenz ist erforderlich')
    .max(34, 'Kontoreferenz darf maximal 34 Zeichen lang sein'),
});

export const refundDepositSchema = z.object({
  refund_amount: z.number()
    .int('Rückzahlungsbetrag muss in Cent angegeben werden')
    .min(1, 'Rückzahlungsbetrag muss mindestens 0,01 EUR (1 Cent) betragen'),
  refund_date: z.string()
    .min(1, 'Rückzahlungsdatum ist erforderlich')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Rückzahlungsdatum muss im Format YYYY-MM-DD sein'),
});

export type CreateDepositInput = z.infer<typeof createDepositSchema>;
export type RefundDepositInput = z.infer<typeof refundDepositSchema>;
