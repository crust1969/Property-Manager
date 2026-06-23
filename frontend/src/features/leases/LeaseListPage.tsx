import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Table, type Column } from '../../shared/components';
import { formatCurrencyWithSymbol, formatDate } from '../../shared/utils/formatting';
import { fetchLeases, deleteLease } from './api';
import { fetchProperties } from '../properties/api';
import { fetchTenants } from '../tenants/api';
import type { Lease } from './types';
import type { Property } from '../properties/types';
import type { Tenant } from '../tenants/types';

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'aktiv';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-800'
      }`}
    >
      {isActive ? 'Aktiv' : 'Beendet'}
    </span>
  );
}

export function LeaseListPage() {
  const navigate = useNavigate();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [leaseData, propertyData, tenantData] = await Promise.all([
        fetchLeases(),
        fetchProperties(),
        fetchTenants(),
      ]);
      setLeases(leaseData);
      setProperties(propertyData);
      setTenants(tenantData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  const filteredLeases = useMemo(() => {
    if (!propertyFilter) return leases;
    return leases.filter((lease) => lease.property_id === propertyFilter);
  }, [leases, propertyFilter]);

  function getPropertyName(propertyId: string): string {
    const property = properties.find((p) => p.id === propertyId);
    return property ? property.name : '—';
  }

  function getTenantName(tenantId: string): string {
    const tenant = tenants.find((ten) => ten.id === tenantId);
    return tenant ? `${tenant.first_name} ${tenant.last_name}` : '—';
  }

  const columns: Column<Lease>[] = [
    {
      key: 'property_id',
      header: 'Objekt',
      render: (lease) => getPropertyName(lease.property_id),
    },
    {
      key: 'tenant_id',
      header: 'Mieter',
      render: (lease) => getTenantName(lease.tenant_id),
    },
    {
      key: 'start_date',
      header: t.mietvertrag.mietbeginn,
      render: (lease) => formatDate(lease.start_date),
    },
    {
      key: 'end_date',
      header: t.mietvertrag.mietende,
      render: (lease) => lease.end_date ? formatDate(lease.end_date) : 'Unbefristet',
    },
    {
      key: 'cold_rent',
      header: t.mietvertrag.kaltmiete,
      className: 'text-right',
      render: (lease) => formatCurrencyWithSymbol(lease.cold_rent),
    },
    {
      key: 'status',
      header: t.mietvertrag.status,
      render: (lease) => <StatusBadge status={lease.status} />,
    },
    {
      key: 'actions',
      header: t.common.aktionen,
      className: 'w-48',
      render: (lease) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/mietvertraege/${lease.id}/bearbeiten`);
            }}
          >
            Bearbeiten
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(lease.id);
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
        <h1 className="text-2xl font-bold text-gray-900">{t.mietvertrag.titel}</h1>
        <Button onClick={() => navigate('/mietvertraege/neu')}>
          {t.mietvertrag.neuAnlegen}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        <div className="mb-4">
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="block w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            aria-label="Nach Objekt filtern"
          >
            <option value="">Alle Objekte</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <Table
          columns={columns}
          data={filteredLeases}
          keyExtractor={(lease) => lease.id}
          onRowClick={(lease) => navigate(`/mietvertraege/${lease.id}/bearbeiten`)}
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-gray-900 mb-2 font-medium">Mietvertrag löschen?</p>
            <p className="text-gray-600 text-sm mb-4">
              Der Mietvertrag und alle zugehörigen Sollstellungen werden unwiderruflich gelöscht.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
                Abbrechen
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await deleteLease(deleteConfirmId);
                    setLeases((prev) => prev.filter((l) => l.id !== deleteConfirmId));
                    setDeleteConfirmId(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
                    setDeleteConfirmId(null);
                  }
                }}
              >
                Löschen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
