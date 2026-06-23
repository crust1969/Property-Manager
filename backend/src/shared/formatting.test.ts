import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatCurrency,
  parseCurrency,
  formatDate,
  parseDate,
  formatPercent,
} from './formatting';

describe('formatCurrency', () => {
  it('formatiert einfache Beträge korrekt', () => {
    expect(formatCurrency(123456)).toBe('1.234,56');
    expect(formatCurrency(100)).toBe('1,00');
    expect(formatCurrency(1)).toBe('0,01');
    expect(formatCurrency(99)).toBe('0,99');
  });

  it('formatiert 0 korrekt', () => {
    expect(formatCurrency(0)).toBe('0,00');
  });

  it('formatiert negative Beträge korrekt', () => {
    expect(formatCurrency(-123456)).toBe('-1.234,56');
    expect(formatCurrency(-1)).toBe('-0,01');
    expect(formatCurrency(-100)).toBe('-1,00');
  });

  it('formatiert große Beträge mit Tausendertrennzeichen', () => {
    expect(formatCurrency(100000000)).toBe('1.000.000,00');
    expect(formatCurrency(123456789)).toBe('1.234.567,89');
  });
});

describe('parseCurrency', () => {
  it('parst einfache deutsche Währungsstrings', () => {
    expect(parseCurrency('1.234,56')).toBe(123456);
    expect(parseCurrency('1,00')).toBe(100);
    expect(parseCurrency('0,01')).toBe(1);
    expect(parseCurrency('0,99')).toBe(99);
  });

  it('parst 0,00', () => {
    expect(parseCurrency('0,00')).toBe(0);
  });

  it('parst negative Beträge', () => {
    expect(parseCurrency('-1.234,56')).toBe(-123456);
    expect(parseCurrency('-1,00')).toBe(-100);
  });

  it('parst große Beträge', () => {
    expect(parseCurrency('1.000.000,00')).toBe(100000000);
  });

  it('wirft Fehler bei ungültigem Format', () => {
    expect(() => parseCurrency('1234.56')).toThrow('Ungültiges Währungsformat');
    expect(() => parseCurrency('abc')).toThrow('Ungültiges Währungsformat');
    expect(() => parseCurrency('')).toThrow('Ungültiges Währungsformat');
    expect(() => parseCurrency('1,2')).toThrow('Ungültiges Währungsformat');
    expect(() => parseCurrency('1,234')).toThrow('Ungültiges Währungsformat');
  });

  it('Fehlermeldung beschreibt erwartetes Format', () => {
    try {
      parseCurrency('invalid');
    } catch (e: any) {
      expect(e.message).toContain('Erwartetes Format');
      expect(e.message).toContain('1.234,56');
    }
  });
});

describe('formatCurrency/parseCurrency Round-Trip', () => {
  it('format → parse → original für verschiedene Werte', () => {
    const testValues = [0, 1, 99, 100, 123456, 100000000, 999999999];
    for (const value of testValues) {
      expect(parseCurrency(formatCurrency(value))).toBe(value);
    }
  });

  it('format → parse → original für negative Werte', () => {
    const testValues = [-1, -99, -100, -123456, -100000000];
    for (const value of testValues) {
      expect(parseCurrency(formatCurrency(value))).toBe(value);
    }
  });

  /**
   * Property-Based Test: Round-Trip für Zahlenformat
   * Validates: Requirements 21.2, 21.5
   */
  it('Round-Trip: formatCurrency → parseCurrency ergibt den Originalwert (Property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -99999999999, max: 99999999999 }),
        (cents) => {
          const formatted = formatCurrency(cents);
          const parsed = parseCurrency(formatted);
          return parsed === cents;
        }
      ),
      { numRuns: 1000 }
    );
  });
});

describe('formatDate', () => {
  it('formatiert ISO-Daten ins deutsche Format', () => {
    expect(formatDate('2024-03-15')).toBe('15.03.2024');
    expect(formatDate('2000-01-01')).toBe('01.01.2000');
    expect(formatDate('2024-12-31')).toBe('31.12.2024');
  });

  it('formatiert Schaltjahr-Datum (29. Feb)', () => {
    expect(formatDate('2024-02-29')).toBe('29.02.2024');
  });

  it('wirft Fehler bei ungültigem Format', () => {
    expect(() => formatDate('15.03.2024')).toThrow('Ungültiges ISO-Datumsformat');
    expect(() => formatDate('2024/03/15')).toThrow('Ungültiges ISO-Datumsformat');
    expect(() => formatDate('abc')).toThrow('Ungültiges ISO-Datumsformat');
    expect(() => formatDate('')).toThrow('Ungültiges ISO-Datumsformat');
  });

  it('wirft Fehler bei ungültigem Datum (31. Feb)', () => {
    expect(() => formatDate('2024-02-31')).toThrow('Ungültiges Datum');
  });

  it('wirft Fehler bei ungültigem Monat', () => {
    expect(() => formatDate('2024-13-01')).toThrow('Ungültiges Datum');
    expect(() => formatDate('2024-00-01')).toThrow('Ungültiges Datum');
  });
});

describe('parseDate', () => {
  it('parst deutsche Daten ins ISO-Format', () => {
    expect(parseDate('15.03.2024')).toBe('2024-03-15');
    expect(parseDate('01.01.2000')).toBe('2000-01-01');
    expect(parseDate('31.12.2024')).toBe('2024-12-31');
  });

  it('parst Schaltjahr-Datum (29. Feb)', () => {
    expect(parseDate('29.02.2024')).toBe('2024-02-29');
  });

  it('wirft Fehler bei ungültigem Format', () => {
    expect(() => parseDate('2024-03-15')).toThrow('Ungültiges deutsches Datumsformat');
    expect(() => parseDate('15/03/2024')).toThrow('Ungültiges deutsches Datumsformat');
    expect(() => parseDate('abc')).toThrow('Ungültiges deutsches Datumsformat');
    expect(() => parseDate('')).toThrow('Ungültiges deutsches Datumsformat');
  });

  it('wirft Fehler bei ungültigem Datum (29. Feb in Nicht-Schaltjahr)', () => {
    expect(() => parseDate('29.02.2023')).toThrow('Ungültiges Datum');
  });

  it('wirft Fehler bei ungültigem Monat', () => {
    expect(() => parseDate('15.13.2024')).toThrow('Ungültiger Monat');
    expect(() => parseDate('15.00.2024')).toThrow('Ungültiger Monat');
  });

  it('Fehlermeldung beschreibt erwartetes Format', () => {
    try {
      parseDate('invalid');
    } catch (e: any) {
      expect(e.message).toContain('Erwartetes Format');
      expect(e.message).toContain('TT.MM.JJJJ');
    }
  });
});

describe('formatDate/parseDate Round-Trip', () => {
  it('format → parse → original für verschiedene Daten', () => {
    const testDates = [
      '2024-01-01', '2024-06-15', '2024-12-31',
      '2000-02-29', '1999-03-01', '2024-02-29',
    ];
    for (const date of testDates) {
      expect(parseDate(formatDate(date))).toBe(date);
    }
  });

  /**
   * Property-Based Test: Round-Trip für Datumsformat
   * Validates: Requirements 21.3, 21.5
   */
  it('Round-Trip: formatDate → parseDate ergibt das Originaldatum (Property)', () => {
    // Generate valid dates as ISO strings
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('1900-01-01'),
          max: new Date('2099-12-31'),
        }).filter((d) => !isNaN(d.getTime())),
        (date) => {
          const year = date.getFullYear().toString().padStart(4, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          const isoDate = `${year}-${month}-${day}`;

          const formatted = formatDate(isoDate);
          const parsed = parseDate(formatted);
          return parsed === isoDate;
        }
      ),
      { numRuns: 1000 }
    );
  });
});

describe('formatPercent', () => {
  it('formatiert Prozentwerte im deutschen Format', () => {
    expect(formatPercent(3.5)).toBe('3,50 %');
    expect(formatPercent(0)).toBe('0,00 %');
    expect(formatPercent(100)).toBe('100,00 %');
    expect(formatPercent(2.33)).toBe('2,33 %');
  });

  it('formatiert negative Prozentwerte', () => {
    expect(formatPercent(-1.5)).toBe('-1,50 %');
  });

  it('respektiert benutzerdefinierte Dezimalstellen', () => {
    expect(formatPercent(3.5, 1)).toBe('3,5 %');
    expect(formatPercent(3.5, 0)).toBe('4 %');
  });
});

describe('Validierung (Requirement 21.6)', () => {
  it('parseCurrency wirft bei fehlendem Komma', () => {
    expect(() => parseCurrency('1234')).toThrow();
  });

  it('parseCurrency wirft bei englischem Format', () => {
    expect(() => parseCurrency('1,234.56')).toThrow();
  });

  it('parseDate wirft bei englischem Datumsformat', () => {
    expect(() => parseDate('03/15/2024')).toThrow();
  });

  it('parseDate wirft bei ungültigem Tag 00', () => {
    expect(() => parseDate('00.03.2024')).toThrow();
  });

  it('formatDate wirft bei Tag 00', () => {
    expect(() => formatDate('2024-03-00')).toThrow();
  });
});
