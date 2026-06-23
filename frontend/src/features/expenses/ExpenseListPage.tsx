import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Table, PropertyFilter, type Column } from '../../shared/components';
import { formatCurrency, formatDate } from '../../shared/utils/formatting';
import { usePropertyFilter } from '../../shared/hooks';
import { fetchExpenses, deleteExpense } from './api';
import { fetchCategories } from '../categories/api';
import type { Expense, ExpenseFilters } from './types';
import type { Category } from '../categories/types';

export function ExpenseListPage() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filters
  const [filterYear, setFilterYear] = useState<string>('');
  const { properties, selectedPropertyId: filterPropertyId, setSelectedPropertyId: setFilterPropertyId } = usePropertyFilter();
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [filterFlag, setFilterFlag] = useState<string>('');

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [filterYear, filterPropertyId, filterCategoryId, filterFlag]);

  async function loadReferenceData() {
    try {
      const cats = await fetchCategories();
      setCategories(cats);
    } catch {
      // Non-critical
    }
  }

  async function loadExpenses() {
    setLoading(true);
    setError(null);
    try {
      const filters: ExpenseFilters = {};
      if (filterYear) filters.year = filterYear;
      if (filterPropertyId) filters.propertyId = filterPropertyId;
      if (filterCategoryId) filters.categoryId = filterCategoryId;
      if (filterFlag === 'is_allocable') filters.is_allocable = 'true';
      if (filterFlag === 'is_tax_deductible') filters.is_tax_deductible = 'true';
      if (filterFlag === 'requires_capitalization') filters.requires_capitalization = 'true';
      if (filterFlag === 'is_financing_related') filters.is_financing_related = 'true';

      const data = await fetchExpenses(filters);
      setExpenses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Ausgaben');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
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

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  function renderFlagBadges(expense: Expense) {
    const badges = [];
    if (expense.is_allocable) {
      badges.push(<span key="alloc" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">UF</span>);
    }
    if (expense.is_tax_deductible) {
      badges.push(<span key="tax" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">SA</span>);
    }
    if (expense.requires_capitalization) {
      badges.push(<span key="cap" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">AP</span>);
    }
    if (expense.is_financing_related) {
      badges.push(<span key="fin" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">FB</span>);
    }
    return <div className="flex gap-1 flex-wrap">{badges}</div>;
  }

  const columns: Column<Expense>[] = [
    {
      key: 'booking_date',
      header: t.ausgaben.buchungsdatum,
      className: 'w-28',
      render: (e) => formatDate(e.booking_date),
    },
    {
      key: 'total_amount',
      header: t.ausgaben.betrag,
      className: 'w-32 text-right',
      render: (e) => `${formatCurrency(e.total_amount)} €`,
    },
    {
      key: 'counterparty',
      header: t.ausgaben.gegenpartei,
      render: (e) => <span className="truncate block max-w-[200px]">{e.counterparty}</span>,
    },
    {
      key: 'category_name',
      header: t.ausgaben.kategorie,
      className: 'w-40',
      render: (e) => e.category_name || '—',
    },
    {
      key: 'flags',
      header: 'Flags',
      className: 'w-32',
      render: renderFlagBadges,
    },
    {
      key: 'documents',
      header: 'Belege',
      className: 'w-16 text-center',
      render: (e) => e.document_count > 0 ? (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600" title={`${e.document_count} Beleg(e)`}>
          📎 {e.document_count}
        </span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
    },
    {
      key: 'actions',
      header: t.common.aktionen,
      className: 'w-40',
      render: (e) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              navigate(`/ausgaben/${e.id}/bearbeiten`);
            }}
          >
            {t.common.bearbeiten}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              setDeleteConfirmId(e.id);
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
        <h1 className="text-2xl font-bold text-gray-900">{t.ausgaben.titel}</h1>
        <Button onClick={() => navigate('/ausgaben/neu')}>
          {t.ausgaben.neuAnlegen}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

          <PropertyFilter
            id="filter-property"
            value={filterPropertyId}
            onChange={setFilterPropertyId}
            properties={properties}
          />

          <div>
            <label htmlFor="filter-category" className="block text-xs font-medium text-gray-500 mb-1">Kategorie</label>
            <select
              id="filter-category"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Alle Kategorien</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-flag" className="block text-xs font-medium text-gray-500 mb-1">Klassifikation</label>
            <select
              id="filter-flag"
              value={filterFlag}
              onChange={(e) => setFilterFlag(e.target.value)}
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

        {/* Legend for flag badges */}
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-500">
          <span><span className="inline-block w-5 text-center px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">UF</span> = Umlagefähig</span>
          <span><span className="inline-block w-5 text-center px-1 py-0.5 rounded bg-green-100 text-green-700 font-medium">SA</span> = Steuerlich abziehbar</span>
          <span><span className="inline-block w-5 text-center px-1 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">AP</span> = Aktivierungspflichtig</span>
          <span><span className="inline-block w-5 text-center px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">FB</span> = Finanzierungsbezogen</span>
        </div>

        <Table
          columns={columns}
          data={expenses}
          keyExtractor={(e) => e.id}
          onRowClick={(e) => navigate(`/ausgaben/${e.id}/bearbeiten`)}
        />

        {expenses.length === 0 && !loading && (
          <p className="text-center text-gray-500 py-8">{t.common.keineEintraege}</p>
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
