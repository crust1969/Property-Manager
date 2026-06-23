import { z } from 'zod';

// All monetary values are in cents (integer)
// Purchase price: 0.01 EUR – 99,999,999.99 EUR => 1 – 9999999999 cents
// Ancillary costs: 0.00 EUR – 99,999,999.99 EUR => 0 – 9999999999 cents

const purchasePriceCents = z
  .number()
  .int('Kaufpreis muss ein ganzzahliger Cent-Betrag sein')
  .min(1, 'Kaufpreis muss mindestens 0,01 EUR (1 Cent) betragen')
  .max(9999999999, 'Kaufpreis darf maximal 99.999.999,99 EUR betragen');

const ancillaryCostCents = z
  .number()
  .int('Nebenkosten müssen ganzzahlige Cent-Beträge sein')
  .min(0, 'Nebenkosten dürfen nicht negativ sein')
  .max(9999999999, 'Nebenkosten dürfen maximal 99.999.999,99 EUR betragen');

const dateString = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Datum muss im Format YYYY-MM-DD sein'
);

export const putAcquisitionSchema = z
  .object({
    purchase_price: purchasePriceCents,
    purchase_date: dateString,
    transfer_date: dateString.optional().nullable(),
    notary_cost: ancillaryCostCents.default(0),
    transfer_tax: ancillaryCostCents.default(0),
    land_registry_cost: ancillaryCostCents.default(0),
    broker_cost: ancillaryCostCents.default(0),
    building_share: z
      .number()
      .int('Gebäudeanteil muss ein ganzzahliger Cent-Betrag sein')
      .min(0, 'Gebäudeanteil darf nicht negativ sein'),
    land_share: z
      .number()
      .int('Grundstücksanteil muss ein ganzzahliger Cent-Betrag sein')
      .min(0, 'Grundstücksanteil darf nicht negativ sein'),
    afa_rate: z
      .number()
      .min(0, 'AfA-Satz darf nicht negativ sein')
      .max(1, 'AfA-Satz darf maximal 100% (1.0) betragen')
      .optional()
      .nullable(),
    afa_start_date: dateString.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Validate: building_share + land_share == purchase_price
    if (data.building_share + data.land_share !== data.purchase_price) {
      const diff = data.purchase_price - (data.building_share + data.land_share);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Die Summe aus Gebäudeanteil und Grundstücksanteil muss dem Kaufpreis entsprechen. Abweichung: ${diff} Cent`,
        path: ['building_share'],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Die Summe aus Gebäudeanteil und Grundstücksanteil muss dem Kaufpreis entsprechen. Abweichung: ${diff} Cent`,
        path: ['land_share'],
      });
    }
  });

export type PutAcquisitionInput = z.infer<typeof putAcquisitionSchema>;

/**
 * Calculates the AfA assessment basis (AfA-Bemessungsgrundlage).
 *
 * The AfA basis = building share of purchase price + building share of all ancillary costs.
 * Building share of ancillary costs is proportional: cost * (building_share / purchase_price),
 * rounded to the nearest cent.
 */
export function calculateAfaBasis(input: PutAcquisitionInput): number {
  const { purchase_price, building_share, notary_cost, transfer_tax, land_registry_cost, broker_cost } = input;

  if (purchase_price === 0) {
    return 0;
  }

  const buildingRatio = building_share / purchase_price;

  // Calculate building portion of each ancillary cost, rounded to nearest cent
  const buildingNotary = Math.round(notary_cost * buildingRatio);
  const buildingTransferTax = Math.round(transfer_tax * buildingRatio);
  const buildingLandRegistry = Math.round(land_registry_cost * buildingRatio);
  const buildingBroker = Math.round(broker_cost * buildingRatio);

  // AfA basis = building share of purchase price + building share of ancillary costs
  return building_share + buildingNotary + buildingTransferTax + buildingLandRegistry + buildingBroker;
}
