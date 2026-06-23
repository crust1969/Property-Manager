import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

interface CategorySeed {
  name: string;
  type: 'income' | 'expense';
  is_allocable: number;
  is_tax_deductible: number;
  requires_capitalization: number;
  is_financing_related: number;
}

/**
 * Standard-Kategorien gemäß deutschem Mietrecht.
 * Flags basieren auf steuerrechtlichen Konventionen:
 * - is_allocable: umlagefähig auf Mieter (gemäß BetrKV)
 * - is_tax_deductible: steuerlich als Werbungskosten absetzbar
 * - requires_capitalization: muss aktiviert werden (Anschaffungs-/Herstellungskosten)
 * - is_financing_related: finanzierungsbezogene Kosten
 */
const STANDARD_CATEGORIES: CategorySeed[] = [
  // === EINNAHMEN ===
  { name: 'Kaltmiete', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Betriebskostenvorauszahlung', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Heizkostenvorauszahlung', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Garagen-/Stellplatzmiete', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Möblierungszuschlag', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Nebenkostennachzahlung', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Erstattung Versicherung', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Erstattung Hausverwaltung', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Schadenersatz', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Verzugszinsen', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Sonstige Einnahmen', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Mietkaution Eingang', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Mietkaution Rückzahlung', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Kautionsverrechnung', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Kautionszinsen', type: 'income', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },

  // === AUSGABEN – UMLAGEFÄHIG (BetrKV §2) ===
  { name: 'Grundsteuer', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Wasserversorgung', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Abwasser', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Heizkosten', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Warmwasserkosten', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Müllabfuhr', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Straßenreinigung', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Gebäudereinigung', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Ungezieferbekämpfung', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Gartenpflege', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Allgemeinstrom', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Schornsteinreinigung', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Sach- und Haftpflichtversicherung', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Hausmeister', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Aufzug', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Gemeinschaftsantenne / Breitband', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Sonstige Betriebskosten', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },

  // === AUSGABEN – NICHT UMLAGEFÄHIG ===
  { name: 'Verwaltervergütung', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Kontoführungsgebühren', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Bankspesen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Steuerberatungskosten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Rechtsberatungskosten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Porto / Büromaterial', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Inseratskosten / Vermietungskosten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Fahrtkosten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Leerstandskosten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Nicht umlagefähiger Hausgeldanteil', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Sonstige nicht umlagefähige Kosten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },

  // === AUSGABEN – ERHALTUNGSAUFWAND (sofort abziehbar) ===
  { name: 'Reparaturen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Instandhaltung', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Wartung', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Kleinreparaturen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Malerarbeiten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Bodenreparaturen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Sanitärarbeiten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Elektroarbeiten', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Fensterreparaturen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Türreparaturen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Handwerkerleistungen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Schönheitsreparaturen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },

  // === AUSGABEN – AKTIVIERUNGSPFLICHTIG (AfA über Nutzungsdauer) ===
  { name: 'Modernisierung', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Energetische Sanierung', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Erweiterung', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Standarderhöhung', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Anschaffungsnahe Herstellungskosten', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Größere Umbaumaßnahme', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Einbauküche', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },

  // === FINANZIERUNGSKOSTEN ===
  { name: 'Darlehenszinsen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 1 },
  { name: 'Bereitstellungszinsen', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 1 },
  { name: 'Darlehensgebühren', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 1 },
  { name: 'Bearbeitungsgebühren', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 1 },
  { name: 'Tilgung', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 1 },
  { name: 'Sondertilgung', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 1 },
  { name: 'Vorfälligkeitsentschädigung', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 1 },

  // === ANSCHAFFUNGS-/KAUFNEBENKOSTEN (aktivierungspflichtig) ===
  { name: 'Kaufpreis Gebäude', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Kaufpreis Grund und Boden', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Notarkosten', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Grunderwerbsteuer', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Grundbuchkosten', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Maklerprovision', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },
  { name: 'Gutachterkosten', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 1, is_financing_related: 0 },

  // === WEG / HAUSGELD ===
  { name: 'Hausgeld umlagefähig', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Hausgeld nicht umlagefähig', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Zuführung Instandhaltungsrücklage', type: 'expense', is_allocable: 0, is_tax_deductible: 0, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Entnahme Instandhaltungsrücklage', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Sonderumlage umlagefähig', type: 'expense', is_allocable: 1, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
  { name: 'Sonderumlage nicht umlagefähig', type: 'expense', is_allocable: 0, is_tax_deductible: 1, requires_capitalization: 0, is_financing_related: 0 },
];

/**
 * Seeds the database with standard German rental property categories.
 * Only inserts categories that don't already exist (idempotent).
 */
export function seedCategories(db: Database.Database): void {
  const checkStmt = db.prepare(`
    SELECT id FROM categories WHERE property_id IS NULL AND user_id IS NULL AND name = ? AND type = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO categories (id, property_id, user_id, name, type, is_allocable, is_tax_deductible, requires_capitalization, is_financing_related, is_system, is_active)
    VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, 1, 1)
  `);

  const seedAll = db.transaction(() => {
    for (const cat of STANDARD_CATEGORIES) {
      const existing = checkStmt.get(cat.name, cat.type);
      if (existing) continue;

      insertStmt.run(
        uuidv4(),
        cat.name,
        cat.type,
        cat.is_allocable,
        cat.is_tax_deductible,
        cat.requires_capitalization,
        cat.is_financing_related,
      );
    }
  });

  seedAll();
  console.log(`Seed: ${STANDARD_CATEGORIES.length} Standardkategorien eingefügt/überprüft.`);
}

export { STANDARD_CATEGORIES };
