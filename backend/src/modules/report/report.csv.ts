/**
 * CSV Export utility for reports.
 * Generates comma-separated output with German headers.
 */

import type {
  ReportResult,
  SteuerlichReport,
  WerbungskostenReport,
  AfaPlanReport,
  ZinsTilgungReport,
  MieteingaengeReport,
  BelegvollstaendigkeitReport,
} from './report.service.js';

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvLines(headers: string[], rows: string[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

export function reportToCsv(report: ReportResult): string {
  switch (report.type) {
    case 'steuerlich':
      return steuerlichToCsv(report);
    case 'werbungskosten':
      return werbungskostenToCsv(report);
    case 'afa-plan':
      return afaPlanToCsv(report);
    case 'zins-tilgung':
      return zinsTilgungToCsv(report);
    case 'mieteingaenge':
      return mieteingaengeToCsv(report);
    case 'belegvollstaendigkeit':
      return belegvollstaendigkeitToCsv(report);
  }
}

function steuerlichToCsv(report: SteuerlichReport): string {
  const headers = ['Position', 'Betrag (EUR)'];
  const d = report.data;
  const rows: string[][] = [
    ['Einnahmen gesamt', formatCents(d.einnahmenGesamt)],
    ['Ausgaben gesamt', formatCents(d.ausgabenGesamt)],
    ['Werbungskosten', formatCents(d.werbungskosten)],
    ['AfA Jahresbetrag', formatCents(d.afaJahresbetrag)],
    ['Darlehenszinsen', formatCents(d.darlehenszinsen)],
    ['Ergebnis', formatCents(d.ergebnis)],
  ];
  return buildCsvLines(headers, rows) + '\n' + report.disclaimer;
}

function werbungskostenToCsv(report: WerbungskostenReport): string {
  const headers = ['Datum', 'Beschreibung', 'Kategorie', 'Betrag (EUR)', 'Typ'];
  const rows: string[][] = [];

  for (const item of report.data.werbungskosten) {
    rows.push([item.datum, item.beschreibung ?? '', item.kategorie, formatCents(item.betrag), 'Werbungskosten']);
  }
  for (const item of report.data.aktivierungspflichtig) {
    rows.push([item.datum, item.beschreibung ?? '', item.kategorie, formatCents(item.betrag), 'Aktivierungspflichtig']);
  }

  rows.push(['', '', 'Summe Werbungskosten', formatCents(report.data.summeWerbungskosten), '']);
  rows.push(['', '', 'Summe Aktivierungspflichtig', formatCents(report.data.summeAktivierungspflichtig), '']);

  return buildCsvLines(headers, rows) + '\n' + report.disclaimer;
}

function afaPlanToCsv(report: AfaPlanReport): string {
  const headers = ['Jahr', 'Jahresbetrag (EUR)', 'Kumuliert (EUR)', 'Restwert (EUR)'];
  const rows: string[][] = report.data.plan.map(e => [
    String(e.jahr),
    formatCents(e.jahresbetrag),
    formatCents(e.kumuliert),
    formatCents(e.restwert),
  ]);

  return buildCsvLines(headers, rows) + '\n' + report.disclaimer;
}

function zinsTilgungToCsv(report: ZinsTilgungReport): string {
  const headers = ['Datum', 'Darlehensgeber', 'Zinsen (EUR)', 'Tilgung (EUR)', 'Gebühren (EUR)', 'Sondertilgung (EUR)', 'Gesamt (EUR)'];
  const rows: string[][] = report.data.zahlungen.map(z => [
    z.datum,
    z.darlehensgeber,
    formatCents(z.zinsen),
    formatCents(z.tilgung),
    formatCents(z.gebuehren),
    formatCents(z.sondertilgung),
    formatCents(z.gesamt),
  ]);

  rows.push(['', 'Summe', formatCents(report.data.summeZinsen), formatCents(report.data.summeTilgung), formatCents(report.data.summeGebuehren), '', formatCents(report.data.summeGesamt)]);

  return buildCsvLines(headers, rows) + '\n' + report.disclaimer;
}

function mieteingaengeToCsv(report: MieteingaengeReport): string {
  const headers = ['Fälligkeitsdatum', 'Soll-Betrag (EUR)', 'Bezahlt (EUR)', 'Status'];
  const rows: string[][] = report.data.sollstellungen.map(s => [
    s.faelligkeitsdatum,
    formatCents(s.sollBetrag),
    formatCents(s.bezahlt),
    s.status,
  ]);

  rows.push(['Summe', formatCents(report.data.summeGesamt), formatCents(report.data.summeBezahlt), '']);
  rows.push(['Offen', formatCents(report.data.summeOffen), '', '']);

  return buildCsvLines(headers, rows) + '\n' + report.disclaimer;
}

function belegvollstaendigkeitToCsv(report: BelegvollstaendigkeitReport): string {
  const headers = ['Datum', 'Beschreibung', 'Betrag (EUR)', 'Beleg vorhanden'];
  const rows: string[][] = report.data.buchungen.map(b => [
    b.datum,
    b.beschreibung ?? '',
    formatCents(b.betrag),
    b.belegVorhanden ? 'Ja' : 'Nein',
  ]);

  rows.push(['', `Quote: ${report.data.vollstaendigkeitQuote}%`, `Mit Beleg: ${report.data.mitBeleg}`, `Ohne Beleg: ${report.data.ohneBeleg}`]);

  return buildCsvLines(headers, rows) + '\n' + report.disclaimer;
}
