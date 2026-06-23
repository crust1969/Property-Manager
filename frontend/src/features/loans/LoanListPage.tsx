import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Table, PropertyFilter, type Column } from '../../shared/components';
import { formatCurrency, formatPercent } from '../../shared/utils/formatting';
import { usePropertyFilter } from '../../shared/hooks';
import { fetchLoans, deleteLoan } from './api';
import type { Loan } from './types';

export function LoanListPage() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { properties, selectedPropertyId: filterPropertyId, setSelectedPropertyId: setFilterPropertyId } = usePropertyFilter();

  useEffect(() => {
    loadLoans();
  }, [filterPropertyId]);

  async function loadLoans() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLoans(filterPropertyId || undefined);
      setLoans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Darlehen');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLoan(id);
      setLoans((prev) => prev.filter((l) => l.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setDeleteConfirmId(null);
    }
  }

  function getStatus(loan: Loan): string {
    if (loan.status) {
      return loan.status === 'aktiv' ? 'Aktiv' : 'Abgeschlossen';
    }
    const today = new Date().toISOString().slice(0, 10);
    return loan.end_date < today ? 'Abgeschlossen' : 'Aktiv';
  }

  const columns: Column<Loan>[] = [
    {
      key: 'lender',
      header: t.darlehen.darlehensgeber,
      render: (l) => <span className="font-medium">{l.lender}</span>,
    },
    {
      key: 'contract_number',
      header: t.darlehen.vertragsnummer,
      className: 'w-36',
      render: (l) => l.contract_number || '—',
    },
    {
      key: 'loan_amount',
      header: t.darlehen.darlehenssumme,
      className: 'w-36 text-right',
      render: (l) => `${formatCurrency(l.loan_amount)} €`,
    },
    {
      key: 'interest_rate',
      header: t.darlehen.zinssatz,
      className: 'w-24 text-right',
      render: (l) => formatPercent(l.interest_rate),
    },
    {
      key: 'remaining_balance',
      header: t.darlehen.restschuld,
      className: 'w-36 text-right',
      render: (l) => l.remaining_balance != null ? `${formatCurrency(l.remaining_balance)} €` : '—',
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-28',
      render: (l) => {
        const status = getStatus(l);
        const isActive = status === 'Aktiv';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: t.common.aktionen,
      className: 'w-40',
      render: (l) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              navigate(`/darlehen/${l.id}`);
            }}
          >
            Details
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              setDeleteConfirmId(l.id);
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
        <h1 className="text-2xl font-bold text-gray-900">{t.darlehen.titel}</h1>
        <Button onClick={() => navigate('/darlehen/neu')}>
          {t.darlehen.neuAnlegen}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        {/* Filter */}
        <div className="mb-4">
          <PropertyFilter
            id="filter-property"
            value={filterPropertyId}
            onChange={setFilterPropertyId}
            properties={properties}
            className="max-w-xs"
          />
        </div>

        <Table
          columns={columns}
          data={loans}
          keyExtractor={(l) => l.id}
          onRowClick={(l) => navigate(`/darlehen/${l.id}`)}
        />

        {loans.length === 0 && !loading && (
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
