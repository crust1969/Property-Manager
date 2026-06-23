import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PropertyFilter } from '../../shared/components';
import { formatCurrency } from '../../shared/utils/formatting';
import { usePropertyFilter } from '../../shared/hooks';
import { fetchReport } from './api';
import type {
  ReportType,
  ReportFormat,
  ReportResponse,
} from './types';
import { REPORT_TYPE_LABELS, FORMAT_LABELS } from './types';

const REPORT_TYPES = Object.keys(REPORT_TYPE_LABELS) as ReportType[];
const FORMATS = Object.keys(FORMAT_LABELS) as ReportFormat[];

function getCurrentYear(): string {
  return String(new Date().getFullYear());
}

function getYearOptions(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current; y >= current - 10; y--) {
    years.push(String(y));
  }
  return years;
}

export function ReportsPage() {
  const { properties, selectedPropertyId, setSelectedPropertyId } = usePropertyFilter();
  const [selectedType, setSelectedType] = useState<ReportType>('steuerlich');
  const [selectedYear, setSelectedYear] = useState<string>(getCurrentYear());
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('json');
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const result = await fetchReport(
        selectedType,
        selectedPropertyId || undefined,
        selectedYear,
        selectedFormat
      );
      if (result) {
        setReport(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Generieren des Berichts');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(format: ReportFormat) {
    setError(null);
    try {
      await fetchReport(
        selectedType,
        selectedPropertyId || undefined,
        selectedYear,
        format
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Herunterladen');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Berichte</h1>

      {/* Link to Cashflow-Simulation */}
      <div>
        <Link
          to="/berichte/simulation"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          Cashflow-Simulation →
        </Link>
      </div>

      {/* Disclaimer banner */}
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md text-sm" role="status">
        Hinweis: Diese Berichte dienen der Vorbereitung und stellen keine rechtsverbindliche Steueraussage dar.
      </div>

      {/* Filters */}
      <Card title="Berichtsauswahl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Report type */}
          <div>
            <label htmlFor="report-type" className="block text-sm font-medium text-gray-700 mb-1">
              Berichtstyp
            </label>
            <select
              id="report-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ReportType)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {/* Property filter */}
          <PropertyFilter
            id="report-property"
            label="Objekt"
            value={selectedPropertyId}
            onChange={setSelectedPropertyId}
            properties={properties}
          />

          {/* Year filter */}
          <div>
            <label htmlFor="report-year" className="block text-sm font-medium text-gray-700 mb-1">
              Jahr
            </label>
            <select
              id="report-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              {getYearOptions().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Format selector */}
          <div>
            <label htmlFor="report-format" className="block text-sm font-medium text-gray-700 mb-1">
              Format
            </label>
            <select
              id="report-format"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as ReportFormat)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              {FORMATS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {FORMAT_LABELS[fmt]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Wird generiert...' : 'Bericht generieren'}
          </button>

          {report && (
            <>
              <button
                onClick={() => handleDownload('csv')}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
              >
                CSV herunterladen
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
              >
                PDF herunterladen
              </button>
            </>
          )}
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Report preview */}
      {report && (
        <Card title={`${REPORT_TYPE_LABELS[report.type]} — ${report.year}`}>
          {report.message && (
            <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm mb-4" role="status">
              {report.message}
            </div>
          )}
          {report.property_name && (
            <p className="text-sm text-gray-600 mb-3">
              Objekt: <span className="font-medium">{report.property_name}</span>
            </p>
          )}
          <ReportPreview type={report.type} data={report.data} />
        </Card>
      )}
    </div>
  );
}

/** Dynamic table preview based on report type */
function ReportPreview({ data }: { type: ReportType; data: unknown }) {
  if (!data) {
    return (
      <p className="text-sm text-gray-500 italic">
        Keine Daten für den gewählten Zeitraum vorhanden.
      </p>
    );
  }

  // Render as formatted key-value pairs for object data
  if (typeof data === 'object' && !Array.isArray(data)) {
    return <ObjectPreview data={data as Record<string, unknown>} />;
  }

  // Fallback: formatted JSON
  return <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96">{JSON.stringify(data, null, 2)}</pre>;
}

function ObjectPreview({ data }: { data: Record<string, unknown> }) {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      // If it looks like cents (> 100 and integer), format as EUR
      if (Number.isInteger(value) && Math.abs(value) >= 100) {
        const euros = (value / 100).toFixed(2).replace('.', ',');
        return `${euros} €`;
      }
      if (typeof value === 'number' && !Number.isInteger(value)) {
        return value.toFixed(2).replace('.', ',');
      }
      return String(value);
    }
    if (Array.isArray(value)) return `${value.length} Einträge`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const labelMap: Record<string, string> = {
    einnahmenGesamt: 'Einnahmen gesamt',
    ausgabenGesamt: 'Ausgaben gesamt',
    werbungskosten: 'Werbungskosten',
    afaJahresbetrag: 'AfA Jahresbetrag',
    darlehenszinsen: 'Darlehenszinsen',
    ergebnis: 'Ergebnis',
    summeWerbungskosten: 'Summe Werbungskosten',
    summeAktivierungspflichtig: 'Summe Aktivierungspflichtig',
    aktivierungspflichtig: 'Aktivierungspflichtig',
    afaBasis: 'AfA-Basis',
    afaSatz: 'AfA-Satz',
    afaStartdatum: 'AfA-Startdatum',
    plan: 'AfA-Plan',
    zahlungen: 'Zahlungen',
    summeZinsen: 'Summe Zinsen',
    summeTilgung: 'Summe Tilgung',
    summeGebuehren: 'Summe Gebühren',
    summeGesamt: 'Summe Gesamt',
    sollstellungen: 'Sollstellungen',
    summeBezahlt: 'Summe Bezahlt',
    summeOffen: 'Summe Offen',
    buchungen: 'Buchungen',
    mitBeleg: 'Mit Beleg',
    ohneBeleg: 'Ohne Beleg',
    vollstaendigkeitQuote: 'Vollständigkeitsquote (%)',
  };

  // Separate scalar values from arrays
  const scalarEntries = Object.entries(data).filter(([, v]) => !Array.isArray(v) && typeof v !== 'object');
  const arrayEntries = Object.entries(data).filter(([, v]) => Array.isArray(v));

  return (
    <div className="space-y-4">
      {/* Scalar values as a summary table */}
      {scalarEntries.length > 0 && (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {scalarEntries.map(([key, value]) => (
              <tr key={key}>
                <td className="py-2 pr-4 font-medium text-gray-700 w-1/3">
                  {labelMap[key] || key}
                </td>
                <td className="py-2 text-gray-900 text-right">
                  {formatValue(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Array values as expandable table or code */}
      {arrayEntries.map(([key, value]) => {
        const arr = value as Record<string, unknown>[];
        const isAfaPlan = arr.length > 0 && 'jahr' in arr[0] && 'jahresbetrag' in arr[0];
        
        return (
          <details key={key} className="border border-gray-200 rounded-md" open={isAfaPlan}>
            <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100">
              {labelMap[key] || key} ({arr.length} Einträge)
            </summary>
            <div className="p-3 overflow-auto max-h-96">
              {isAfaPlan ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1 px-2">Jahr</th>
                      <th className="py-1 px-2 text-right">Jahresbetrag</th>
                      <th className="py-1 px-2 text-right">Kumuliert</th>
                      <th className="py-1 px-2 text-right">Restwert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {arr.slice(0, 60).map((entry: Record<string, unknown>, idx: number) => (
                      <tr key={idx}>
                        <td className="py-1 px-2">{String(entry.jahr)}</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(entry.jahresbetrag as number)} €</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(entry.kumuliert as number)} €</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(entry.restwert as number)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <pre className="text-xs">{JSON.stringify(arr.slice(0, 50), null, 2)}</pre>
              )}
              {arr.length > 60 && isAfaPlan && (
                <p className="mt-2 text-xs text-gray-500">... und {arr.length - 60} weitere Einträge</p>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
