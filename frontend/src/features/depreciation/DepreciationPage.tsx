import { useState, useEffect } from 'react';
import { fetchProperties } from '../properties/api';
import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  getPositionPlan,
  getCombinedOverview,
} from './api';
import { PositionList } from './PositionList';
import { PositionPlanView } from './PositionPlanView';
import { CombinedOverview } from './CombinedOverview';
import type { Property } from '../properties/types';
import type { AfaPosition, AfaPlanEntry, CreatePositionInput, CombinedAfaOverview } from './types';

type Tab = 'positionen' | 'uebersicht';

export function DepreciationPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [positions, setPositions] = useState<AfaPosition[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<AfaPosition | null>(null);
  const [positionPlan, setPositionPlan] = useState<AfaPlanEntry[]>([]);
  const [combinedOverview, setCombinedOverview] = useState<CombinedAfaOverview | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('positionen');
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      loadPositions(selectedPropertyId);
      setSelectedPosition(null);
      setPositionPlan([]);
      setCombinedOverview(null);
    } else {
      setPositions([]);
      setSelectedPosition(null);
      setPositionPlan([]);
      setCombinedOverview(null);
      setError(null);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    if (selectedPropertyId && activeTab === 'uebersicht') {
      loadCombinedOverview(selectedPropertyId);
    }
  }, [activeTab, selectedPropertyId]);

  async function loadProperties() {
    try {
      const data = await fetchProperties();
      setProperties(data);
      if (data.length === 1) {
        setSelectedPropertyId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Objekte');
    }
  }

  async function loadPositions(propertyId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await listPositions(propertyId);
      setPositions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Positionen');
    } finally {
      setLoading(false);
    }
  }

  async function loadCombinedOverview(propertyId: string) {
    setOverviewLoading(true);
    try {
      const data = await getCombinedOverview(propertyId);
      setCombinedOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Übersicht');
    } finally {
      setOverviewLoading(false);
    }
  }

  async function handleCreatePosition(data: CreatePositionInput) {
    setError(null);
    try {
      await createPosition(selectedPropertyId, data);
      await loadPositions(selectedPropertyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen der Position');
      throw err;
    }
  }

  async function handleUpdatePosition(positionId: string, data: Partial<CreatePositionInput>) {
    setError(null);
    try {
      await updatePosition(selectedPropertyId, positionId, data);
      await loadPositions(selectedPropertyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Position');
      throw err;
    }
  }

  async function handleDeletePosition(positionId: string) {
    setError(null);
    try {
      await deletePosition(selectedPropertyId, positionId);
      if (selectedPosition?.id === positionId) {
        setSelectedPosition(null);
        setPositionPlan([]);
      }
      await loadPositions(selectedPropertyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen der Position');
      throw err;
    }
  }

  async function handleSelectPosition(position: AfaPosition) {
    setSelectedPosition(position);
    setPlanLoading(true);
    try {
      const result = await getPositionPlan(selectedPropertyId, position.id);
      setPositionPlan(result.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Plans');
    } finally {
      setPlanLoading(false);
    }
  }

  const tabClasses = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-primary-600 text-primary-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Absetzung für Abnutzung (AfA)
      </h1>

      {/* Property Selector */}
      <div>
        <label htmlFor="property-select" className="block text-sm font-medium text-gray-700 mb-1">
          Objekt auswählen
        </label>
        <select
          id="property-select"
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
        >
          <option value="">— Bitte Objekt wählen —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.street}, {p.zip_code} {p.city})
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Content */}
      {selectedPropertyId && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-2" aria-label="AfA Navigation">
              <button
                className={tabClasses('positionen')}
                onClick={() => { setActiveTab('positionen'); setSelectedPosition(null); }}
              >
                Positionen
              </button>
              <button
                className={tabClasses('uebersicht')}
                onClick={() => setActiveTab('uebersicht')}
              >
                Gesamt-Übersicht
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'positionen' && (
            <>
              {selectedPosition ? (
                <PositionPlanView
                  position={selectedPosition}
                  plan={positionPlan}
                  onBack={() => { setSelectedPosition(null); setPositionPlan([]); }}
                  loading={planLoading}
                />
              ) : (
                <PositionList
                  positions={positions}
                  onCreatePosition={handleCreatePosition}
                  onUpdatePosition={handleUpdatePosition}
                  onDeletePosition={handleDeletePosition}
                  onSelectPosition={handleSelectPosition}
                  loading={loading}
                />
              )}
            </>
          )}

          {activeTab === 'uebersicht' && (
            <CombinedOverview
              overview={combinedOverview}
              loading={overviewLoading}
            />
          )}
        </>
      )}
    </div>
  );
}
