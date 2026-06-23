/**
 * PDF Export utility for reports.
 * Uses pdfkit to generate basic PDF with tabular data.
 */

import PDFDocument from 'pdfkit';
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
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function getTitle(report: ReportResult): string {
  switch (report.type) {
    case 'steuerlich': return 'Jahresübersicht steuerlich';
    case 'werbungskosten': return 'Werbungskostenübersicht';
    case 'afa-plan': return 'AfA-Plan';
    case 'zins-tilgung': return 'Zins-/Tilgungsübersicht';
    case 'mieteingaenge': return 'Mieteingangsstatus';
    case 'belegvollstaendigkeit': return 'Belegvollständigkeit';
  }
}

export function reportToPdf(report: ReportResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).text(getTitle(report), { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Jahr: ${report.year} | Objekt-ID: ${report.propertyId}`, { align: 'center' });
    doc.moveDown(1);

    if (report.hint) {
      doc.fontSize(10).fillColor('gray').text(report.hint);
      doc.fillColor('black');
      doc.moveDown(0.5);
    }

    // Content
    switch (report.type) {
      case 'steuerlich':
        renderSteuerlich(doc, report);
        break;
      case 'werbungskosten':
        renderWerbungskosten(doc, report);
        break;
      case 'afa-plan':
        renderAfaPlan(doc, report);
        break;
      case 'zins-tilgung':
        renderZinsTilgung(doc, report);
        break;
      case 'mieteingaenge':
        renderMieteingaenge(doc, report);
        break;
      case 'belegvollstaendigkeit':
        renderBelegvollstaendigkeit(doc, report);
        break;
    }

    // Disclaimer at bottom
    doc.moveDown(2);
    doc.fontSize(8).fillColor('gray').text(report.disclaimer, { align: 'center' });

    doc.end();
  });
}

function renderSteuerlich(doc: PDFKit.PDFDocument, report: SteuerlichReport): void {
  const d = report.data;
  const rows = [
    ['Einnahmen gesamt', formatCents(d.einnahmenGesamt)],
    ['Ausgaben gesamt', formatCents(d.ausgabenGesamt)],
    ['Werbungskosten', formatCents(d.werbungskosten)],
    ['AfA Jahresbetrag', formatCents(d.afaJahresbetrag)],
    ['Darlehenszinsen', formatCents(d.darlehenszinsen)],
    ['Ergebnis', formatCents(d.ergebnis)],
  ];
  renderSimpleTable(doc, ['Position', 'Betrag'], rows);
}

function renderWerbungskosten(doc: PDFKit.PDFDocument, report: WerbungskostenReport): void {
  doc.fontSize(12).text('Werbungskosten');
  doc.moveDown(0.3);
  const wkRows = report.data.werbungskosten.map(i => [i.datum, i.beschreibung ?? '', i.kategorie, formatCents(i.betrag)]);
  wkRows.push(['', '', 'Summe', formatCents(report.data.summeWerbungskosten)]);
  renderSimpleTable(doc, ['Datum', 'Beschreibung', 'Kategorie', 'Betrag'], wkRows);

  if (report.data.aktivierungspflichtig.length > 0) {
    doc.moveDown(1);
    doc.fontSize(12).text('Aktivierungspflichtig (separat)');
    doc.moveDown(0.3);
    const aktRows = report.data.aktivierungspflichtig.map(i => [i.datum, i.beschreibung ?? '', i.kategorie, formatCents(i.betrag)]);
    aktRows.push(['', '', 'Summe', formatCents(report.data.summeAktivierungspflichtig)]);
    renderSimpleTable(doc, ['Datum', 'Beschreibung', 'Kategorie', 'Betrag'], aktRows);
  }
}

function renderAfaPlan(doc: PDFKit.PDFDocument, report: AfaPlanReport): void {
  doc.fontSize(10).text(`AfA-Basis: ${formatCents(report.data.afaBasis)} | Satz: ${report.data.afaSatz ? (report.data.afaSatz * 100).toFixed(2) + '%' : '-'} | Start: ${report.data.afaStartdatum ?? '-'}`);
  doc.moveDown(0.5);
  const rows = report.data.plan.map(e => [String(e.jahr), formatCents(e.jahresbetrag), formatCents(e.kumuliert), formatCents(e.restwert)]);
  renderSimpleTable(doc, ['Jahr', 'Jahresbetrag', 'Kumuliert', 'Restwert'], rows);
}

function renderZinsTilgung(doc: PDFKit.PDFDocument, report: ZinsTilgungReport): void {
  const rows = report.data.zahlungen.map(z => [z.datum, z.darlehensgeber, formatCents(z.zinsen), formatCents(z.tilgung), formatCents(z.gesamt)]);
  rows.push(['', 'Summe', formatCents(report.data.summeZinsen), formatCents(report.data.summeTilgung), formatCents(report.data.summeGesamt)]);
  renderSimpleTable(doc, ['Datum', 'Geber', 'Zinsen', 'Tilgung', 'Gesamt'], rows);
}

function renderMieteingaenge(doc: PDFKit.PDFDocument, report: MieteingaengeReport): void {
  const rows = report.data.sollstellungen.map(s => [s.faelligkeitsdatum, formatCents(s.sollBetrag), formatCents(s.bezahlt), s.status]);
  rows.push(['Summe', formatCents(report.data.summeGesamt), formatCents(report.data.summeBezahlt), '']);
  renderSimpleTable(doc, ['Fällig', 'Soll', 'Bezahlt', 'Status'], rows);
}

function renderBelegvollstaendigkeit(doc: PDFKit.PDFDocument, report: BelegvollstaendigkeitReport): void {
  doc.fontSize(10).text(`Quote: ${report.data.vollstaendigkeitQuote}% | Mit Beleg: ${report.data.mitBeleg} | Ohne Beleg: ${report.data.ohneBeleg}`);
  doc.moveDown(0.5);
  const rows = report.data.buchungen.map(b => [b.datum, b.beschreibung ?? '', formatCents(b.betrag), b.belegVorhanden ? 'Ja' : 'Nein']);
  renderSimpleTable(doc, ['Datum', 'Beschreibung', 'Betrag', 'Beleg'], rows);
}

function renderSimpleTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]): void {
  const fontSize = 9;
  const colWidth = (doc.page.width - 100) / headers.length;
  const startX = 50;
  let y = doc.y;

  // Headers
  doc.fontSize(fontSize).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(h, startX + i * colWidth, y, { width: colWidth, continued: false });
  });
  y = doc.y + 5;

  // Rows
  doc.font('Helvetica');
  for (const row of rows) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
    const rowY = y;
    let maxH = 0;
    row.forEach((cell, i) => {
      doc.text(cell, startX + i * colWidth, rowY, { width: colWidth, continued: false });
      const cellH = doc.y - rowY;
      if (cellH > maxH) maxH = cellH;
    });
    y = rowY + Math.max(maxH, fontSize + 4);
    doc.y = y;
  }
}
