import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Table, PropertyFilter, type Column } from '../../shared/components';
import { formatCurrency, formatDate } from '../../shared/utils/formatting';
import { usePropertyFilter } from '../../shared/hooks';
import { fetchIncome, deleteIncome } from './api';
import { SollIstComparison } from './SollIstComparison';
import type { Income, IncomeFilters } from './types';

export function IncomeListPage() {
  const navigate = useNavigate();
  const [income, setIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Filters
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const { properties, selectedPropertyId: filterPropertyId, setSelectedPropertyId: setFilterPropertyId } = usePropertyFilter();

  useEffect(() => {
    loadIncome();
  }, [filterYear, filterMonth, filterPropertyId]);

  async function loadIncome() {
    setLoading(true);
    setError(null);
    try {
      const filters: IncomeFilters = {};
      if (filterYear) filters.year = filterYear;
      if (filterMonth) filters.month = filterMonth;
      if (filterPropertyId) filters.propertyId = filterPropertyId;
      const data = await fetchIncome(filters);
      setIncome(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Einnahmen');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteIncome(id);
      setIncome((prev) => prev.filter((i) => i.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setDeleteConfirmId(null);
    }
  }

  // Generate year options (current year ± 5)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 5; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const monthOptions = [
    { value: '1', label: 'Januar' },
    { value: '2', label: 'Februar' },
    { value: '3', label: 'März' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mai' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Dezember' },
  ];

  const columns: Column<Income>[] = [
    {
      key: 'booking_date',
      header: t.einnahmen.buchungsdatum,
      className: 'w-28',
      render: (i) => formatDate(i.booking_date),
    },
    {
      key: 'total_amount',
      header: t.einnahmen.betrag,
      className: 'w-32 text-right',
      render: (i) => `${formatCurrency(i.total_amount)} €`,
    },
    {
      key: 'counterparty',
      header: t.einnahmen.gegenpartei,
      render: (i) => <span className="truncate block max-w-[200px]">{i.counterparty}</span>,
    },
    {
      key: 'category_name',
      header: t.einnahmen.kategorie,
      className: 'w-40',
      render: (i) => i.category_name || '—',
    },
    {
      key: 'receivable_id',
      header: 'Zuordnung',
      className: 'w-24 text-center',
      render: (i) => i.receivable_id ? (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600" title="Mit Sollstellung verknüpft">
          ✓ Soll
        </span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
    },
    {
      key: 'actions',
      header: t.common.aktionen,
      className: 'w-56',
      render: (i) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              navigate(`/einnahmen/${i.id}/bearbeiten`);
            }}
          >
            {t.common.bearbeiten}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              navigate('/einnahmen/neu', { state: { copyFromId: i.id } });
            }}
          >
            {t.common.kopieren}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              setDeleteConfirmId(i.id);
            }}
          >
            {t.common.loeschen}
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t.common.laden}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.einnahmen.titel}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowComparison(!showComparison)}
          >
            {showComparison ? 'Liste anzeigen' : 'Soll/Ist-Vergleich'}
          </Button>
          <Button onClick={() => navigate('/einnahmen/neu')}>
            {t.einnahmen.neuAnlegen}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <PropertyFilter
            id="filter-property"
            value={filterPropertyId}
            onChange={setFilterPropertyId}
            properties={properties}
          />

          <div>
            <label htmlFor="filter-year" className="block text-xs font-medium text-gray-500 mb-1">Jahr</label>
            <select
              id="filter-year"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Alle Jahre</option>
              {yearOptions.map((y) => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-month" className="block text-xs font-medium text-gray-500 mb-1">Monat</label>
            <select
              id="filter-month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Alle Monate</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conditional view: Table or Soll/Ist */}
        {showComparison ? (
          <SollIstComparison
            year={filterYear}
            month={filterMonth}
          />
        ) : (
          <>
            <Table
              columns={columns}
              data={income}
              keyExtractor={(i) => i.id}
              onRowClick={(i) => navigate(`/einnahmen/${i.id}/bearbeiten`)}
            />

            {income.length === 0 && !loading && (
              <p className="text-center text-gray-500 py-8">{t.common.keineEintraege}</p>
            )}
          </>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-gray-900 mb-4">{t.common.bestaetigungLoeschen}</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
                {t.common.abbrechen}
              </Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirmId)}>
                {t.common.loeschen}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
