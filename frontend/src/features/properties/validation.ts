import type { PropertyFormData, AcquisitionFormData, ValidationErrors } from './types';
import { t } from '../../i18n/de';
import { parseCurrencyInput } from '../../shared/utils/formatting';

const PROPERTY_TYPES = ['Wohnung', 'Haus', 'Gewerbe', 'Garage', 'Grundstück'];

/** Validate property form fields per requirement 2.2 */
export function validatePropertyForm(data: PropertyFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  // Bezeichnung: 1–100 Zeichen
  if (!data.name.trim()) {
    errors.name = t.common.pflichtfeld;
  } else if (data.name.trim().length > 100) {
    errors.name = t.validierung.maxZeichen(100);
  }

  // Straße: 1–150 Zeichen
  if (!data.street.trim()) {
    errors.street = t.common.pflichtfeld;
  } else if (data.street.trim().length > 150) {
    errors.street = t.validierung.maxZeichen(150);
  }

  // PLZ: genau 5 Ziffern
  if (!data.zip_code.trim()) {
    errors.zip_code = t.common.pflichtfeld;
  } else if (!/^\d{5}$/.test(data.zip_code.trim())) {
    errors.zip_code = t.validierung.plzFormat;
  }

  // Ort: 1–100 Zeichen
  if (!data.city.trim()) {
    errors.city = t.common.pflichtfeld;
  } else if (data.city.trim().length > 100) {
    errors.city = t.validierung.maxZeichen(100);
  }

  // Objekttyp: ein Wert aus der Liste
  if (!data.property_type) {
    errors.property_type = t.common.pflichtfeld;
  } else if (!PROPERTY_TYPES.includes(data.property_type)) {
    errors.property_type = t.common.ungueltigeEingabe;
  }

  // Wohnfläche: numerisch, 1–99.999 m²
  if (!data.living_area_sqm.trim()) {
    errors.living_area_sqm = t.common.pflichtfeld;
  } else {
    const value = parseFloat(data.living_area_sqm.replace(',', '.'));
    if (isNaN(value) || value < 1 || value > 99999) {
      errors.living_area_sqm = 'Wert muss zwischen 1 und 99.999 liegen';
    }
  }

  return errors;
}

/** Validate acquisition form fields per requirements 3.1, 3.2 */
export function validateAcquisitionForm(data: AcquisitionFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  // Kaufpreis: 0,01–99.999.999,99 EUR (stored as cents: 1–9999999999)
  const purchasePrice = parseCurrencyInput(data.purchase_price);
  if (!data.purchase_price.trim()) {
    errors.purchase_price = t.common.pflichtfeld;
  } else if (purchasePrice === null || purchasePrice < 1 || purchasePrice > 9999999999) {
    errors.purchase_price = t.validierung.betragUngueltig;
  }

  // Kaufdatum
  if (!data.purchase_date) {
    errors.purchase_date = t.common.pflichtfeld;
  }

  // Nebenkosten: 0,00–99.999.999,99 EUR each (optional, default 0)
  const costFields: Array<{ key: keyof AcquisitionFormData; label: string }> = [
    { key: 'notary_cost', label: 'Notarkosten' },
    { key: 'transfer_tax', label: 'Grunderwerbsteuer' },
    { key: 'land_registry_cost', label: 'Grundbuchkosten' },
    { key: 'broker_cost', label: 'Maklerkosten' },
  ];

  for (const field of costFields) {
    if (data[field.key].trim()) {
      const value = parseCurrencyInput(data[field.key]);
      if (value === null || value < 0 || value > 9999999999) {
        errors[field.key] = t.validierung.betragUngueltig;
      }
    }
  }

  // Building share + land share must equal purchase price
  const buildingShare = parseCurrencyInput(data.building_share);
  const landShare = parseCurrencyInput(data.land_share);

  if (!data.building_share.trim()) {
    errors.building_share = t.common.pflichtfeld;
  } else if (buildingShare === null || buildingShare < 0) {
    errors.building_share = t.validierung.betragUngueltig;
  }

  if (!data.land_share.trim()) {
    errors.land_share = t.common.pflichtfeld;
  } else if (landShare === null || landShare < 0) {
    errors.land_share = t.validierung.betragUngueltig;
  }

  // Summenvalidierung (Requirement 3.2)
  if (purchasePrice && buildingShare !== null && landShare !== null && !errors.building_share && !errors.land_share) {
    const sum = buildingShare + landShare;
    if (sum !== purchasePrice) {
      const diff = (sum - purchasePrice) / 100;
      const diffFormatted = diff.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const msg = `Summe aus Gebäude- und Grundstücksanteil muss dem Kaufpreis entsprechen (Abweichung: ${diffFormatted} €)`;
      errors.building_share = msg;
      errors.land_share = msg;
    }
  }

  return errors;
}

/** Calculate AfA basis (Requirement 3.5):
 * Gebäudeanteil des Kaufpreises + Gebäudeanteil der Nebenkosten
 * Nebenkosten werden im Verhältnis Gebäudeanteil/Kaufpreis aufgeteilt
 */
export function calculateAfaBasis(data: AcquisitionFormData): number | null {
  const purchasePrice = parseCurrencyInput(data.purchase_price);
  const buildingShare = parseCurrencyInput(data.building_share);
  const notaryCost = parseCurrencyInput(data.notary_cost) ?? 0;
  const transferTax = parseCurrencyInput(data.transfer_tax) ?? 0;
  const landRegistryCost = parseCurrencyInput(data.land_registry_cost) ?? 0;
  const brokerCost = parseCurrencyInput(data.broker_cost) ?? 0;

  if (!purchasePrice || purchasePrice <= 0 || buildingShare === null) {
    return null;
  }

  const ratio = buildingShare / purchasePrice;
  const totalAncillaryCosts = notaryCost + transferTax + landRegistryCost + brokerCost;
  const buildingAncillary = Math.round(totalAncillaryCosts * ratio);

  return buildingShare + buildingAncillary;
}
