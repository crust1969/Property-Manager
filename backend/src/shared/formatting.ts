/**
 * Deutsche Zahlen- und Datumsformatierung.
 * 
 * Diese Funktionen sind identisch mit frontend/src/shared/utils/formatting.ts
 * und können im Backend für Validierung und Report-Generierung verwendet werden.
 *
 * Konventionen:
 * - Komma als Dezimaltrennzeichen
 * - Punkt als Tausendertrennzeichen
 * - Datumsformat TT.MM.JJJJ
 * - Geldbeträge intern in Cents (Integer)
 */

/**
 * Formatiert einen Cent-Betrag als Euro-String im deutschen Format.
 * Beispiel: 123456 → "1.234,56"
 */
export function formatCurrency(amountInCents: number): string {
  const isNegative = amountInCents < 0;
  const abs = Math.abs(amountInCents);
  const euros = Math.floor(abs / 100);
  const cents = abs % 100;

  const eurosStr = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centsStr = cents.toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}${eurosStr},${centsStr}`;
}

/**
 * Parst einen deutschen Währungsstring (z.B. "1.234,56") zurück in Cents.
 * Wirft einen Fehler wenn das Format nicht dem deutschen Zahlenformat entspricht.
 */
export function parseCurrency(germanString: string): number {
  const trimmed = germanString.trim();

  // Validate german currency format: optional minus, digits with optional dots, comma, 2 digits
  const currencyRegex = /^-?(\d{1,3}(\.\d{3})*|\d+),(\d{2})$/;
  if (!currencyRegex.test(trimmed)) {
    throw new Error(
      `Ungültiges Währungsformat: "${germanString}". ` +
      `Erwartetes Format: "1.234,56" (Punkt als Tausendertrennzeichen, Komma als Dezimaltrennzeichen, genau 2 Nachkommastellen)`
    );
  }

  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;
  const [wholePart, decimalPart] = unsigned.split(',');
  const wholeClean = wholePart.replace(/\./g, '');
  const cents = parseInt(wholeClean, 10) * 100 + parseInt(decimalPart, 10);

  return isNegative ? -cents : cents;
}

/**
 * Formatiert ein ISO-Datum (YYYY-MM-DD) ins deutsche Format (TT.MM.JJJJ).
 * Wirft einen Fehler bei ungültigem ISO-Datum.
 */
export function formatDate(isoDate: string): string {
  const trimmed = isoDate.trim();
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = trimmed.match(isoRegex);

  if (!match) {
    throw new Error(
      `Ungültiges ISO-Datumsformat: "${isoDate}". ` +
      `Erwartetes Format: "JJJJ-MM-TT" (z.B. "2024-03-15")`
    );
  }

  const [, year, month, day] = match;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error(
      `Ungültiges Datum: "${isoDate}". Monat muss 01-12 sein, Tag muss 01-31 sein.`
    );
  }

  // Validate day for the given month
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) {
    throw new Error(
      `Ungültiges Datum: "${isoDate}". Der Monat ${month} hat nur ${daysInMonth} Tage.`
    );
  }

  return `${day}.${month}.${year}`;
}

/**
 * Parst ein deutsches Datum (TT.MM.JJJJ) ins ISO-Format (YYYY-MM-DD).
 * Wirft einen Fehler wenn das Format nicht dem deutschen Datumsformat entspricht.
 */
export function parseDate(germanDate: string): string {
  const trimmed = germanDate.trim();
  const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const match = trimmed.match(dateRegex);

  if (!match) {
    throw new Error(
      `Ungültiges deutsches Datumsformat: "${germanDate}". ` +
      `Erwartetes Format: "TT.MM.JJJJ" (z.B. "15.03.2024")`
    );
  }

  const [, day, month, year] = match;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (m < 1 || m > 12) {
    throw new Error(
      `Ungültiger Monat: "${month}". Monat muss zwischen 01 und 12 liegen.`
    );
  }

  if (d < 1 || d > 31) {
    throw new Error(
      `Ungültiger Tag: "${day}". Tag muss zwischen 01 und 31 liegen.`
    );
  }

  // Validate day for the given month
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) {
    throw new Error(
      `Ungültiges Datum: "${germanDate}". Der Monat ${month} hat nur ${daysInMonth} Tage.`
    );
  }

  return `${year}-${month}-${day}`;
}

/**
 * Formatiert einen Prozentwert im deutschen Format.
 * Beispiel: 3.5 → "3,50 %"
 */
export function formatPercent(value: number, decimals = 2): string {
  const isNegative = value < 0;
  const abs = Math.abs(value);

  // Round to the specified decimal places
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(abs * factor) / factor;

  const [wholePart, decimalPart = ''] = rounded.toString().split('.');
  const wholeFormatted = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalFormatted = decimalPart.padEnd(decimals, '0').slice(0, decimals);

  const numStr = decimals > 0
    ? `${wholeFormatted},${decimalFormatted}`
    : wholeFormatted;

  return `${isNegative ? '-' : ''}${numStr} %`;
}
