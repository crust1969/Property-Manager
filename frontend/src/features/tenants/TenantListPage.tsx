import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input, Table, type Column } from '../../shared/components';
import { fetchTenants, deleteTenant } from './api';
import { fetchProperties } from '../properties/api';
import type { Tenant } from './types';
import type { Property } from '../properties/types';

export function TenantListPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [tenantData, propertyData] = await Promise.all([
        fetchTenants(),
        fetchProperties(),
      ]);
      setTenants(tenantData);
      setProperties(propertyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  const filteredTenants = useMemo(() => {
    let result = tenants;

    if (propertyFilter) {
      result = result.filter((tenant) => tenant.property_id === propertyFilter);
    }

    if (searchFilter.trim()) {
      const search = searchFilter.toLowerCase();
      result = result.filter(
        (tenant) =>
          tenant.first_name.toLowerCase().includes(search) ||
          tenant.last_name.toLowerCase().includes(search) ||
          (tenant.email && tenant.email.toLowerCase().includes(search)) ||
          (tenant.phone && tenant.phone.includes(search))
      );
    }

    return result;
  }, [tenants, searchFilter, propertyFilter]);

  function getPropertyName(propertyId: string): string {
    const property = properties.find((p) => p.id === propertyId);
    return property ? property.name : '—';
  }

  async function handleDelete(id: string) {
    try {
      await deleteTenant(id);
      setTenants((prev) => prev.filter((tenant) => tenant.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setDeleteConfirmId(null);
    }
  }

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (tenant) => `${tenant.first_name} ${tenant.last_name}`,
    },
    {
      key: 'email',
      header: t.mieter.emailAdresse,
      render: (tenant) => tenant.email || '—',
    },
    {
      key: 'phone',
      header: t.mieter.telefon,
      render: (tenant) => tenant.phone || '—',
    },
    {
      key: 'property_id',
      header: 'Objekt',
      render: (tenant) => getPropertyName(tenant.property_id),
    },
    {
      key: 'actions',
      header: t.common.aktionen,
      className: 'w-40',
      render: (tenant) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/mieter/${tenant.id}/bearbeiten`);
            }}
          >
            {t.common.bearbeiten}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(tenant.id);
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
        <h1 className="text-2xl font-bold text-gray-900">{t.mieter.titel}</h1>
        <Button onClick={() => navigate('/mieter/neu')}>
          {t.mieter.neuAnlegen}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder={`${t.common.suchen}...`}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Mieter suchen"
            />
          </div>
          <div className="w-64">
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
        </div>

        <Table
          columns={columns}
          data={filteredTenants}
          keyExtractor={(tenant) => tenant.id}
        />
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
