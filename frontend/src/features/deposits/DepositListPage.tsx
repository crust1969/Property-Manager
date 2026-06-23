import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Table, type Column } from '../../shared/components';
import { formatCurrency, formatDate } from '../../shared/utils/formatting';
import { fetchDeposits, deleteDeposit } from './api';
import { RefundDialog } from './RefundDialog';
import { api } from '../../shared/api/client';
import type { Deposit, DepositStatus, DepositFilters } from './types';

interface Lease {
  id: string;
  tenant_id: string;
  property_id: string;
  start_date: string;
  status: string;
}

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
}

interface Property {
  id: string;
  name: string;
}

function getStatusBadge(status: DepositStatus) {
  const styles: Record<DepositStatus, { bg: string; text: string; label: string }> = {
    hinterlegt: { bg: 'bg-green-100', text: 'text-green-700', label: 'Hinterlegt' },
    teilweise_zurueckgezahlt: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Teilweise zurückgezahlt' },
    vollstaendig_zurueckgezahlt: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Vollständig zurückgezahlt' },
    verrechnet: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Verrechnet' },
  };

  const style = styles[status] || styles.hinterlegt;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export function DepositListPage() {
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundDeposit, setRefundDeposit] = useState<Deposit | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filters
  const [filterLeaseId, setFilterLeaseId] = useState<string>('');

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadDeposits();
  }, [filterLeaseId]);

  async function loadReferenceData() {
    try {
      const [leaseData, tenantData, propertyData] = await Promise.all([
        api.get<Lease[]>('/leases'),
        api.get<Tenant[]>('/tenants'),
        api.get<Property[]>('/properties'),
      ]);
      setLeases(leaseData);
      setTenants(tenantData);
      setProperties(propertyData);
    } catch {
      // Non-critical
    }
  }

  async function loadDeposits() {
    setLoading(true);
    setError(null);
    try {
      const filters: DepositFilters = {};
      if (filterLeaseId) filters.leaseId = filterLeaseId;
      const data = await fetchDeposits(filters);
      // Compute remaining_amount client-side if not provided
      const withRemaining = data.map((d) => ({
        ...d,
        remaining_amount: d.remaining_amount ?? (d.amount - d.refunded_amount),
      }));
      setDeposits(withRemaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Kautionen');
    } finally {
      setLoading(false);
    }
  }

  function handleRefundSuccess(updated: Deposit) {
    setDeposits((prev) =>
      prev.map((d) =>
        d.id === updated.id
          ? { ...updated, remaining_amount: updated.amount - updated.refunded_amount }
          : d
      )
    );
    setRefundDeposit(null);
  }

  function getTenantName(leaseId: string): string {
    const lease = leases.find((l) => l.id === leaseId);
    if (!lease) return '—';
    const tenant = tenants.find((ten) => ten.id === lease.tenant_id);
    return tenant ? `${tenant.first_name} ${tenant.last_name}` : '—';
  }

  function getPropertyName(leaseId: string): string {
    const lease = leases.find((l) => l.id === leaseId);
    if (!lease) return '—';
    const property = properties.find((p) => p.id === lease.property_id);
    return property ? property.name : '—';
  }

  async function handleDelete(id: string) {
    try {
      await deleteDeposit(id);
      setDeposits((prev) => prev.filter((d) => d.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setDeleteConfirmId(null);
    }
  }

  const columns: Column<Deposit>[] = [
    {
      key: 'property',
      header: 'Objekt',
      className: 'w-32',
      render: (d) => getPropertyName(d.lease_id),
    },
    {
      key: 'tenant',
      header: 'Mieter',
      className: 'w-36',
      render: (d) => getTenantName(d.lease_id),
    },
    {
      key: 'received_date',
      header: 'Eingangsdatum',
      className: 'w-28',
      render: (d) => formatDate(d.received_date),
    },
    {
      key: 'amount',
      header: 'Kautionsbetrag',
      className: 'w-32 text-right',
      render: (d) => `${formatCurrency(d.amount)} €`,
    },
    {
      key: 'remaining_amount',
      header: 'Verbleibend',
      className: 'w-32 text-right',
      render: (d) => `${formatCurrency(d.remaining_amount)} €`,
    },
    {
      key: 'account_reference',
      header: 'Kontoreferenz',
      className: 'w-40',
      render: (d) => <span className="truncate block max-w-[160px]">{d.account_reference}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-48',
      render: (d) => getStatusBadge(d.status),
    },
    {
      key: 'actions',
      header: t.common.aktionen,
      className: 'w-48',
      render: (d) => (
        <div className="flex gap-2">
          {(d.status === 'hinterlegt' || d.status === 'teilweise_zurueckgezahlt') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(ev) => {
                ev.stopPropagation();
                setRefundDeposit(d);
              }}
            >
              Rückzahlung
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              setDeleteConfirmId(d.id);
            }}
          >
            Löschen
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
        <h1 className="text-2xl font-bold text-gray-900">Kautionen</h1>
        <Button onClick={() => navigate('/kautionen/neu')}>
          Neue Kaution erfassen
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        {/* Filter by lease */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label htmlFor="filter-lease" className="block text-xs font-medium text-gray-500 mb-1">Mietvertrag</label>
            <select
              id="filter-lease"
              value={filterLeaseId}
              onChange={(e) => setFilterLeaseId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Alle Mietverträge</option>
              {leases.map((l) => {
                const tenant = tenants.find((ten) => ten.id === l.tenant_id);
                const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}` : l.id;
                return (
                  <option key={l.id} value={l.id}>
                    {tenantName} — ab {l.start_date}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Info banner for deposit separation */}
        <div className="mb-4 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
          <strong>Hinweis:</strong> Kautionen werden separat von regulären Einnahmen verwaltet.
          Die Kaution ist ein treuhänderisch verwaltetes Guthaben des Mieters.
        </div>

        <Table
          columns={columns}
          data={deposits}
          keyExtractor={(d) => d.id}
        />

        {deposits.length === 0 && !loading && (
          <p className="text-center text-gray-500 py-8">{t.common.keineEintraege}</p>
        )}
      </Card>

      {/* Refund Dialog */}
      {refundDeposit && (
        <RefundDialog
          deposit={refundDeposit}
          onClose={() => setRefundDeposit(null)}
          onSuccess={handleRefundSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-gray-900 mb-2 font-medium">Kaution löschen?</p>
            <p className="text-gray-600 text-sm mb-4">
              Die Kaution wird unwiderruflich gelöscht.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirmId)}>
                Löschen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
