import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '../../shared/components';
import { fetchCategories, deactivateCategory } from './api';
import { fetchProperties } from '../properties/api';
import type { Category } from './types';
import type { Property } from '../properties/types';

const FLAG_LABELS = {
  is_allocable: 'Umlagefähig',
  is_tax_deductible: 'Steuerlich abziehbar',
  requires_capitalization: 'Aktivierungspflichtig',
  is_financing_related: 'Finanzierungsbezogen',
} as const;

const TYPE_LABELS: Record<string, string> = {
  income: 'Einnahme',
  expense: 'Ausgabe',
};

export function CategoryListPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'income' | 'expense'>('');
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [categoryData, propertyData] = await Promise.all([
        fetchCategories(),
        fetchProperties(),
      ]);
      setCategories(categoryData);
      setProperties(propertyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  const filteredCategories = useMemo(() => {
    let result = categories;

    if (propertyFilter) {
      result = result.filter(
        (cat) => cat.property_id === propertyFilter || cat.is_system
      );
    }

    if (typeFilter) {
      result = result.filter((cat) => cat.type === typeFilter);
    }

    if (searchFilter.trim()) {
      const search = searchFilter.toLowerCase();
      result = result.filter((cat) => cat.name.toLowerCase().includes(search));
    }

    // Sort: system categories first, then user-defined; active before inactive
    result = [...result].sort((a, b) => {
      if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.name.localeCompare(b.name, 'de');
    });

    return result;
  }, [categories, searchFilter, propertyFilter, typeFilter]);

  function getPropertyName(propertyId: string | null): string {
    if (!propertyId) return 'Alle Objekte';
    const property = properties.find((p) => p.id === propertyId);
    return property ? property.name : '—';
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateCategory(id);
      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? { ...cat, is_active: false } : cat))
      );
      setDeactivateConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Deaktivieren');
      setDeactivateConfirmId(null);
    }
  }

  function renderFlagBadges(category: Category) {
    const flags = [
      { key: 'is_allocable' as const, active: category.is_allocable },
      { key: 'is_tax_deductible' as const, active: category.is_tax_deductible },
      { key: 'requires_capitalization' as const, active: category.requires_capitalization },
      { key: 'is_financing_related' as const, active: category.is_financing_related },
    ];

    const activeFlags = flags.filter((f) => f.active);
    if (activeFlags.length === 0) return <span className="text-gray-400">—</span>;

    return (
      <div className="flex flex-wrap gap-1">
        {activeFlags.map((f) => (
          <span
            key={f.key}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
          >
            {FLAG_LABELS[f.key]}
          </span>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kategorien</h1>
        <Button onClick={() => navigate('/kategorien/neu')}>
          Neue Kategorie anlegen
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
              placeholder="Suchen..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Kategorien suchen"
            />
          </div>
          <div className="w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as '' | 'income' | 'expense')}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              aria-label="Nach Typ filtern"
            >
              <option value="">Alle Typen</option>
              <option value="income">Einnahme</option>
              <option value="expense">Ausgabe</option>
            </select>
          </div>
          <div className="w-48">
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

        {filteredCategories.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">Keine Einträge vorhanden</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Objekt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Flags
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCategories.map((category) => (
                  <tr
                    key={category.id}
                    className={`${!category.is_active ? 'opacity-50' : ''} hover:bg-gray-50`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        {category.name}
                        {category.is_system && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            System
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {TYPE_LABELS[category.type] || category.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {getPropertyName(category.property_id)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {renderFlagBadges(category)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {category.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Aktiv
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Inaktiv
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {category.is_system ? (
                        <span className="text-gray-400 text-xs">Nicht bearbeitbar</span>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/kategorien/${category.id}/bearbeiten`)}
                          >
                            Bearbeiten
                          </Button>
                          {category.is_active && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setDeactivateConfirmId(category.id)}
                            >
                              Deaktivieren
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Deactivate Confirmation Dialog */}
      {deactivateConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-gray-900 mb-2 font-medium">Kategorie deaktivieren?</p>
            <p className="text-gray-600 text-sm mb-4">
              Bestehende Buchungen mit dieser Kategorie bleiben unverändert. Die Kategorie steht bei
              Neuzuordnungen nicht mehr zur Auswahl.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeactivateConfirmId(null)}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={() => handleDeactivate(deactivateConfirmId)}>
                Deaktivieren
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
