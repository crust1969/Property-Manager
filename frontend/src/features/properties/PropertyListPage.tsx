import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input, Table, type Column } from '../../shared/components';
import { fetchProperties, deleteProperty } from './api';
import type { Property } from './types';

export function PropertyListPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProperties();
      setProperties(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  const filteredProperties = useMemo(() => {
    if (!filter.trim()) return properties;
    const search = filter.toLowerCase();
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.city.toLowerCase().includes(search) ||
        p.street.toLowerCase().includes(search) ||
        p.zip_code.includes(search) ||
        p.property_type.toLowerCase().includes(search)
    );
  }, [properties, filter]);

  async function handleDelete(id: string) {
    try {
      await deleteProperty(id);
      setProperties((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setDeleteConfirmId(null);
    }
  }

  const columns: Column<Property>[] = [
    { key: 'name', header: t.objekte.bezeichnung },
    { key: 'street', header: t.objekte.strasse },
    { key: 'zip_code', header: t.objekte.plz, className: 'w-24' },
    { key: 'city', header: t.objekte.ort },
    { key: 'property_type', header: t.objekte.objekttyp, className: 'w-32' },
    {
      key: 'living_area_sqm',
      header: t.objekte.wohnflaeche,
      className: 'w-32 text-right',
      render: (p) => `${p.living_area_sqm.toLocaleString('de-DE')} m²`,
    },
    {
      key: 'actions',
      header: t.common.aktionen,
      className: 'w-40',
      render: (p) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/objekte/${p.id}/bearbeiten`);
            }}
          >
            {t.common.bearbeiten}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(p.id);
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
        <h1 className="text-2xl font-bold text-gray-900">{t.objekte.titel}</h1>
        <Button onClick={() => navigate('/objekte/neu')}>
          {t.objekte.neuAnlegen}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        <div className="mb-4">
          <Input
            placeholder={`${t.common.suchen}...`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Objekte filtern"
          />
        </div>

        <Table
          columns={columns}
          data={filteredProperties}
          keyExtractor={(p) => p.id}
          onRowClick={(p) => navigate(`/objekte/${p.id}`)}
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
