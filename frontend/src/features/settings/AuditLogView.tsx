import { useState, useEffect } from 'react';
import { Card, Table, type Column } from '../../shared/components';
import { fetchAuditLog } from './api';
import type { AuditLogEntry, AuditLogFilters } from './types';

/** Map flag names to German labels */
const FLAG_LABELS: Record<string, string> = {
  is_allocable: 'Umlagefähig',
  is_tax_deductible: 'Steuerlich abziehbar',
  requires_capitalization: 'Aktivierungspflichtig',
  is_financing_related: 'Finanzierungsbezogen',
};

/** Convert boolean value (0/1) to readable text */
function formatFlagValue(value: number): string {
  return value === 1 ? 'Ja' : 'Nein';
}

/** Format ISO timestamp to German date+time format */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return isoString;
  }
}

interface AuditLogViewProps {
  /** Optional bookingId to filter audit log entries for a specific booking */
  bookingId?: string;
}

export function AuditLogView({ bookingId }: AuditLogViewProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterType, setFilterType] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    loadAuditLog();
  }, [page, filterFrom, filterTo, filterType, bookingId]);

  async function loadAuditLog() {
    setLoading(true);
    setError(null);
    try {
      const filters: AuditLogFilters = {
        page,
        limit,
      };
      if (bookingId) filters.bookingId = bookingId;
      if (filterFrom) filters.from = filterFrom;
      if (filterTo) filters.to = filterTo;
      if (filterType) filters.type = filterType;

      const response = await fetchAuditLog(filters);
      setEntries(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Audit-Logs');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'created_at',
      header: 'Zeitstempel',
      className: 'w-44',
      render: (entry) => (
        <span className="text-xs text-gray-700 whitespace-nowrap">
          {formatTimestamp(entry.created_at)}
        </span>
      ),
    },
    {
      key: 'user_name',
      header: 'Benutzer',
      className: 'w-32',
      render: (entry) => entry.user_name || entry.user_id.slice(0, 8),
    },
    {
      key: 'changed_flag',
      header: 'Flag',
      className: 'w-40',
      render: (entry) => FLAG_LABELS[entry.changed_flag] || entry.changed_flag,
    },
    {
      key: 'previous_value',
      header: 'Alter Wert',
      className: 'w-24',
      render: (entry) => formatFlagValue(entry.previous_value),
    },
    {
      key: 'new_value',
      header: 'Neuer Wert',
      className: 'w-24',
      render: (entry) => formatFlagValue(entry.new_value),
    },
    {
      key: 'reason',
      header: 'Grund',
      render: (entry) => (
        <span className="text-sm text-gray-700 line-clamp-2" title={entry.reason}>
          {entry.reason}
        </span>
      ),
    },
  ];

  if (loading && entries.length === 0) {
    return (
      <div className="p-4">
        <p className="text-gray-500">Wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Änderungsprotokoll</h2>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="audit-filter-from" className="block text-xs font-medium text-gray-500 mb-1">
              Zeitraum von
            </label>
            <input
              id="audit-filter-from"
              type="date"
              value={filterFrom}
              onChange={(e) => {
                setFilterFrom(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="audit-filter-to" className="block text-xs font-medium text-gray-500 mb-1">
              Zeitraum bis
            </label>
            <input
              id="audit-filter-to"
              type="date"
              value={filterTo}
              onChange={(e) => {
                setFilterTo(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="audit-filter-type" className="block text-xs font-medium text-gray-500 mb-1">
              Änderungstyp
            </label>
            <select
              id="audit-filter-type"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Alle</option>
              <option value="is_allocable">Umlagefähig</option>
              <option value="is_tax_deductible">Steuerlich abziehbar</option>
              <option value="requires_capitalization">Aktivierungspflichtig</option>
              <option value="is_financing_related">Finanzierungsbezogen</option>
            </select>
          </div>
        </div>

        <Table
          columns={columns}
          data={entries}
          keyExtractor={(entry) => entry.id}
          emptyMessage="Keine Audit-Log-Einträge vorhanden"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
            <p className="text-sm text-gray-600">
              Seite {page} von {totalPages} ({total} Einträge)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zurück
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weiter
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
