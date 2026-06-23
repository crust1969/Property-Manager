import { useState, useEffect } from 'react';
import { t } from '../../i18n/de';
import { Button, Card } from '../../shared/components';
import { formatCurrencyWithSymbol, formatDate } from '../../shared/utils/formatting';
import { fetchProperties } from '../properties/api';
import { fetchLeases } from '../leases/api';
import { createBilling, downloadBillingPdf } from './api';
import { fetchCategories } from '../categories/api';
import type { Property } from '../properties/types';
import type { Lease } from '../leases/types';
import type { Category } from '../categories/types';
import type {
  UtilityBilling,
  CostPositionRow,
  AllocationKey,
  AllocationParams,
  ValidationErrors,
} from './types';

const ALLOCATION_KEYS: { value: AllocationKey; label: string }[] = [
  { value: 'fläche', label: t.nebenkosten.schluessel.flaeche },
  { value: 'personen', label: t.nebenkosten.schluessel.personen },
  { value: 'verbrauch', label: t.nebenkosten.schluessel.verbrauch },
  { value: 'direkt', label: t.nebenkosten.schluessel.direkt },
  { value: 'manuell', label: t.nebenkosten.schluessel.manuell },
];

function buildAllocationParams(key: AllocationKey): AllocationParams {
  switch (key) {
    case 'fläche':
      return { key: 'fläche', params: { tenant_area: '', total_area: '' } };
    case 'personen':
      return { key: 'personen', params: { tenant_persons: '', total_persons: '' } };
    case 'verbrauch':
      return { key: 'verbrauch', params: { tenant_consumption: '', total_consumption: '' } };
    case 'direkt':
      return { key: 'direkt', params: {} };
    case 'manuell':
      return { key: 'manuell', params: { manual_percentage: '' } };
  }
}

function createEmptyPosition(): CostPositionRow {
  return {
    category_id: '',
    amount: '',
    allocation_key: 'fläche',
    allocation_params: buildAllocationParams('fläche'),
  };
}

export function UtilityBillingPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state
  const [propertyId, setPropertyId] = useState('');
  const [leaseId, setLeaseId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [positions, setPositions] = useState<CostPositionRow[]>([createEmptyPosition()]);

  // Result state
  const [billing, setBilling] = useState<UtilityBilling | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (propertyId) {
      fetchLeases(propertyId).then(setLeases).catch(() => setLeases([]));
    } else {
      setLeases([]);
      setLeaseId('');
    }
  }, [propertyId]);

  async function loadReferenceData() {
    try {
      const [props, cats] = await Promise.all([fetchProperties(), fetchCategories()]);
      setProperties(props);
      setCategories(cats.filter((c) => c.type === 'expense' && c.is_active));
    } catch {
      // Non-critical
    }
  }

  function addPosition() {
    setPositions([...positions, createEmptyPosition()]);
  }

  function removePosition(index: number) {
    if (positions.length <= 1) return;
    setPositions(positions.filter((_, i) => i !== index));
  }

  function updatePosition(index: number, field: keyof CostPositionRow, value: string) {
    const updated = [...positions];
    if (field === 'allocation_key') {
      const newKey = value as AllocationKey;
      updated[index] = {
        ...updated[index],
        allocation_key: newKey,
        allocation_params: buildAllocationParams(newKey),
      };
    } else if (field === 'category_id' || field === 'amount') {
      updated[index] = { ...updated[index], [field]: value };
    }
    setPositions(updated);
  }

  function updateAllocationParam(index: number, paramKey: string, value: string) {
    const updated = [...positions];
    const pos = updated[index];
    const params = { ...pos.allocation_params } as AllocationParams;
    (params.params as Record<string, string>)[paramKey] = value;
    updated[index] = { ...pos, allocation_params: params };
    setPositions(updated);
  }

  function validate(): boolean {
    const newErrors: ValidationErrors = {};
    if (!propertyId) newErrors.property_id = 'Objekt ist erforderlich';
    if (!leaseId) newErrors.lease_id = 'Mietvertrag ist erforderlich';
    if (!periodStart) newErrors.period_start = 'Startdatum ist erforderlich';
    if (!periodEnd) newErrors.period_end = 'Enddatum ist erforderlich';

    if (periodStart && periodEnd && periodStart >= periodEnd) {
      newErrors.period_end = 'Enddatum muss nach dem Startdatum liegen';
    }

    positions.forEach((pos, i) => {
      if (!pos.category_id) newErrors[`pos_${i}_category`] = 'Kategorie erforderlich';
      if (!pos.amount) newErrors[`pos_${i}_amount`] = 'Betrag erforderlich';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSubmitError(null);

    try {
      const result = await createBilling({
        property_id: propertyId,
        lease_id: leaseId,
        period_start: periodStart,
        period_end: periodEnd,
        positions,
      });
      setBilling(result);
      setShowForm(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Abrechnung');
    } finally {
      setLoading(false);
    }
  }

  async function handlePdfDownload() {
    if (!billing) return;
    setPdfLoading(true);
    try {
      await downloadBillingPdf(billing.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'PDF-Download fehlgeschlagen');
    } finally {
      setPdfLoading(false);
    }
  }

  function handleNewBilling() {
    setBilling(null);
    setShowForm(true);
    setPositions([createEmptyPosition()]);
    setPropertyId('');
    setLeaseId('');
    setPeriodStart('');
    setPeriodEnd('');
    setErrors({});
    setSubmitError(null);
  }

  function renderAllocationParams(pos: CostPositionRow, index: number) {
    const p = pos.allocation_params;

    switch (p.key) {
      case 'fläche':
        return (
          <div className="flex gap-2 mt-1">
            <div className="flex-1">
              <label className="block text-xs text-gray-500">Mieterfläche (m²)</label>
              <input
                type="text"
                value={p.params.tenant_area}
                onChange={(e) => updateAllocationParam(index, 'tenant_area', e.target.value)}
                placeholder="z.B. 65"
                className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500">Gesamtfläche (m²)</label>
              <input
                type="text"
                value={p.params.total_area}
                onChange={(e) => updateAllocationParam(index, 'total_area', e.target.value)}
                placeholder="z.B. 250"
                className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        );
      case 'personen':
        return (
          <div className="flex gap-2 mt-1">
            <div className="flex-1">
              <label className="block text-xs text-gray-500">Personen Mieter</label>
              <input
                type="text"
                value={p.params.tenant_persons}
                onChange={(e) => updateAllocationParam(index, 'tenant_persons', e.target.value)}
                placeholder="z.B. 2"
                className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500">Personen Gesamt</label>
              <input
                type="text"
                value={p.params.total_persons}
                onChange={(e) => updateAllocationParam(index, 'total_persons', e.target.value)}
                placeholder="z.B. 8"
                className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        );
      case 'verbrauch':
        return (
          <div className="flex gap-2 mt-1">
            <div className="flex-1">
              <label className="block text-xs text-gray-500">Verbrauch Mieter</label>
              <input
                type="text"
                value={p.params.tenant_consumption}
                onChange={(e) => updateAllocationParam(index, 'tenant_consumption', e.target.value)}
                placeholder="z.B. 120"
                className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500">Verbrauch Gesamt</label>
              <input
                type="text"
                value={p.params.total_consumption}
                onChange={(e) => updateAllocationParam(index, 'total_consumption', e.target.value)}
                placeholder="z.B. 500"
                className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        );
      case 'manuell':
        return (
          <div className="flex gap-2 mt-1">
            <div className="w-32">
              <label className="block text-xs text-gray-500">Anteil (%)</label>
              <input
                type="text"
                value={p.params.manual_percentage}
                onChange={(e) => updateAllocationParam(index, 'manual_percentage', e.target.value)}
                placeholder="z.B. 25"
                className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        );
      case 'direkt':
        return (
          <p className="text-xs text-gray-500 italic mt-1">
            Kosten werden vollständig dem Mieter zugeordnet.
          </p>
        );
    }
  }

  // Render billing result view
  if (!showForm && billing) {
    const hasIncompletePositions = billing.items.some((item) => !item.is_complete);
    const isGuthaben = billing.balance < 0;
    const balanceDisplay = Math.abs(billing.balance);

    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t.nebenkosten.titel}</h1>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleNewBilling}>
              {t.nebenkosten.neuAnlegen}
            </Button>
            <Button onClick={handlePdfDownload} disabled={pdfLoading}>
              {pdfLoading ? 'Wird heruntergeladen...' : 'PDF herunterladen'}
            </Button>
          </div>
        </div>

        {submitError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
            {submitError}
          </div>
        )}

        {/* Warning for incomplete positions */}
        {hasIncompletePositions && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-md text-sm" role="alert">
            ⚠️ Hinweis: Einige Kostenpositionen sind unvollständig (fehlende Verbrauchsdaten). 
            Bitte ergänzen Sie die fehlenden Daten für eine korrekte Abrechnung.
          </div>
        )}

        {/* Period & Summary */}
        <Card>
          <h2 className="text-lg font-semibold mb-3">{t.nebenkosten.abrechnungszeitraum}</h2>
          <p className="text-sm text-gray-600">
            {formatDate(billing.period_start)} — {formatDate(billing.period_end)}
          </p>
        </Card>

        {/* Cost Positions Table */}
        <Card>
          <h2 className="text-lg font-semibold mb-3">Kostenpositionen</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kategorie</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gesamtkosten</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t.nebenkosten.umlageschluessel}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Mieteranteil</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {billing.items.map((item) => {
                  const keyLabel = ALLOCATION_KEYS.find((k) => k.value === item.allocation_key)?.label || item.allocation_key;
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.category_name || item.category_id}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrencyWithSymbol(item.total_cost)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{keyLabel}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrencyWithSymbol(item.tenant_share)}</td>
                      <td className="px-4 py-2 text-center">
                        {item.is_complete ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            Vollständig
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                            Unvollständig
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Balance Summary */}
        <Card>
          <h2 className="text-lg font-semibold mb-3">Ergebnis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Umlagefähige Kosten (Mieteranteil)</p>
              <p className="text-lg font-semibold">{formatCurrencyWithSymbol(billing.tenant_share)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t.nebenkosten.vorauszahlungen}</p>
              <p className="text-lg font-semibold">{formatCurrencyWithSymbol(billing.prepayments)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Saldo</p>
              <p className={`text-xl font-bold ${isGuthaben ? 'text-green-600' : 'text-red-600'}`}>
                {isGuthaben ? t.nebenkosten.guthaben : t.nebenkosten.nachzahlung}: {formatCurrencyWithSymbol(balanceDisplay)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Render form view
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.nebenkosten.titel}</h1>
      </div>

      {submitError && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Property & Lease Selection */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Objekt und Mietvertrag</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="property_id" className="block text-sm font-medium text-gray-700 mb-1">
                Objekt *
              </label>
              <select
                id="property_id"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— Objekt wählen —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.property_id && <p className="text-red-600 text-xs mt-1">{errors.property_id}</p>}
            </div>

            <div>
              <label htmlFor="lease_id" className="block text-sm font-medium text-gray-700 mb-1">
                Mietvertrag *
              </label>
              <select
                id="lease_id"
                value={leaseId}
                onChange={(e) => setLeaseId(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={!propertyId}
              >
                <option value="">— Mietvertrag wählen —</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.start_date} — {l.end_date || 'unbefristet'} ({l.status})
                  </option>
                ))}
              </select>
              {errors.lease_id && <p className="text-red-600 text-xs mt-1">{errors.lease_id}</p>}
            </div>
          </div>
        </Card>

        {/* Period Selection */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">{t.nebenkosten.abrechnungszeitraum}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="period_start" className="block text-sm font-medium text-gray-700 mb-1">
                {t.nebenkosten.von} *
              </label>
              <input
                id="period_start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.period_start && <p className="text-red-600 text-xs mt-1">{errors.period_start}</p>}
            </div>

            <div>
              <label htmlFor="period_end" className="block text-sm font-medium text-gray-700 mb-1">
                {t.nebenkosten.bis} *
              </label>
              <input
                id="period_end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.period_end && <p className="text-red-600 text-xs mt-1">{errors.period_end}</p>}
            </div>
          </div>
        </Card>

        {/* Cost Positions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Kostenpositionen</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addPosition}>
              + Position hinzufügen
            </Button>
          </div>

          <div className="space-y-6">
            {positions.map((pos, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
                {positions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePosition(index)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-sm font-medium"
                    aria-label={`Position ${index + 1} entfernen`}
                  >
                    ✕
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kategorie *
                    </label>
                    <select
                      value={pos.category_id}
                      onChange={(e) => updatePosition(index, 'category_id', e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">— Kategorie —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {errors[`pos_${index}_category`] && (
                      <p className="text-red-600 text-xs mt-1">{errors[`pos_${index}_category`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Betrag (€) *
                    </label>
                    <input
                      type="text"
                      value={pos.amount}
                      onChange={(e) => updatePosition(index, 'amount', e.target.value)}
                      placeholder="z.B. 1.200,00"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {errors[`pos_${index}_amount`] && (
                      <p className="text-red-600 text-xs mt-1">{errors[`pos_${index}_amount`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.nebenkosten.umlageschluessel}
                    </label>
                    <select
                      value={pos.allocation_key}
                      onChange={(e) => updatePosition(index, 'allocation_key', e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {ALLOCATION_KEYS.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Allocation Parameters */}
                <div className="mt-2 pl-2 border-l-2 border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Parameter für Umlageschlüssel:</p>
                  {renderAllocationParams(pos, index)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Wird erstellt...' : 'Abrechnung erstellen'}
          </Button>
        </div>
      </form>
    </div>
  );
}
