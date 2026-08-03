import { useState, useEffect } from 'react';
import { Card } from '../../shared/components';
import { formatCurrency, formatDate } from '../../shared/utils/formatting';
import { fetchComparison } from './api';
import { api } from '../../shared/api/client';
import type { ComparisonEntry, ReceivableStatus } from './types';

interface Lease {
  id: string;
  tenant_id: string;
  property_id: string;
  start_date: string;
  cold_rent: number;
  status: string;
}

interface SollIstComparisonProps {
  leaseId?: string;
  year?: string;
  month?: string;
}

function getStatusBadge(status: ReceivableStatus) {
  const styles: Record<ReceivableStatus, { bg: string; text: string; label: string }> = {
    bezahlt: { bg: 'bg-green-100', text: 'text-green-700', label: 'Bezahlt' },
    teilbezahlt: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Teilbezahlt' },
    überfällig: { bg: 'bg-red-100', text: 'text-red-700', label: 'Überfällig' },
    offen: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Offen' },
    storniert: { bg: 'bg-gray-200', text: 'text-gray-500', label: 'Storniert' },
  };

  const style = styles[status] || styles.offen;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function getDifferenzStyle(differenz: number): string {
  if (differenz === 0) return 'text-green-700';
  if (differenz > 0) return 'text-red-700';
  return 'text-blue-700';
}

export function SollIstComparison({ leaseId: propLeaseId, year, month }: SollIstComparisonProps) {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState(propLeaseId || '');
  const [entries, setEntries] = useState<ComparisonEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeases();
  }, []);

  useEffect(() => {
    if (selectedLeaseId && year && month) {
      loadComparison();
    } else {
      setEntries([]);
    }
  }, [selectedLeaseId, year, month]);

  async function loadLeases() {
    try {
      const data = await api.get<Lease[]>('/leases');
      setLeases(data.filter((l) => l.status === 'aktiv'));
      if (data.length === 1) {
        setSelectedLeaseId(data[0].id);
      }
    } catch { /* non-critical */ }
  }

  async function loadComparison() {
    if (!selectedLeaseId || !year || !month) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComparison({ leaseId: selectedLeaseId, year, month });
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Soll/Ist-Vergleichs');
    } finally {
      setLoading(false);
    }
  }

  if (!year || !month) {
    return (
      <Card title="Soll/Ist-Vergleich">
        <p className="text-center text-gray-500 py-4 text-sm">
          Bitte Jahr und Monat wählen, um den Soll/Ist-Vergleich anzuzeigen.
        </p>
      </Card>
    );
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Wird geladen...</p>;
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
        {error}
      </div>
    );
  }

  const totalSoll = entries.reduce((sum, e) => sum + e.soll_amount, 0);
  const totalIst = entries.reduce((sum, e) => sum + e.ist_amount, 0);
  const totalDifferenz = totalSoll - totalIst;

  return (
    <Card title="Soll/Ist-Vergleich">
      {/* Lease selector */}
      {!propLeaseId && (
        <div className="mb-4">
          <label htmlFor="soll-ist-lease" className="block text-xs font-medium text-gray-500 mb-1">
            Mietvertrag
          </label>
          <select
            id="soll-ist-lease"
            value={selectedLeaseId}
            onChange={(e) => setSelectedLeaseId(e.target.value)}
            className="block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">— Mietvertrag wählen —</option>
            {leases.map((l) => (
              <option key={l.id} value={l.id}>
                ab {l.start_date} — {formatCurrency(l.cold_rent)} € Kaltmiete
              </option>
            ))}
          </select>
        </div>
      )}

      {!selectedLeaseId && (
        <p className="text-center text-gray-500 py-4 text-sm">
          Bitte wählen Sie einen Mietvertrag aus.
        </p>
      )}

      {selectedLeaseId && entries.length === 0 && !loading && (
        <p className="text-center text-gray-500 py-4 text-sm">
          Keine Sollstellungen für diesen Zeitraum vorhanden
        </p>
      )}

      {entries.length > 0 && (
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Fälligkeit</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">Soll (€)</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">Ist (€)</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">Differenz (€)</th>
              <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <tr key={entry.receivable_id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{formatDate(entry.due_date)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(entry.soll_amount)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(entry.ist_amount)}</td>
                <td className={`px-4 py-2 text-right font-medium ${getDifferenzStyle(entry.differenz)}`}>
                  {entry.differenz > 0 ? '+' : ''}{formatCurrency(entry.differenz)}
                </td>
                <td className="px-4 py-2 text-center">{getStatusBadge(entry.status)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-medium">
            <tr>
              <td className="px-4 py-2">Gesamt</td>
              <td className="px-4 py-2 text-right">{formatCurrency(totalSoll)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(totalIst)}</td>
              <td className={`px-4 py-2 text-right ${getDifferenzStyle(totalDifferenz)}`}>
                {totalDifferenz > 0 ? '+' : ''}{formatCurrency(totalDifferenz)}
              </td>
              <td className="px-4 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 border-t pt-3">
        <span>{getStatusBadge('bezahlt')} Vollständig bezahlt</span>
        <span>{getStatusBadge('teilbezahlt')} Teilweise bezahlt</span>
        <span>{getStatusBadge('überfällig')} Zahlung überfällig</span>
        <span>{getStatusBadge('offen')} Noch offen</span>
      </div>
      )}
    </Card>
  );
}
