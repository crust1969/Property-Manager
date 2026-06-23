import { useState, useEffect, useMemo } from 'react';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { fetchAcquisition, saveAcquisition } from './api';
import { validateAcquisitionForm, calculateAfaBasis } from './validation';
import { formatCurrency, formatCurrencyWithSymbol } from '../../shared/utils/formatting';
import type { AcquisitionFormData, ValidationErrors } from './types';

const INITIAL_FORM: AcquisitionFormData = {
  purchase_price: '',
  purchase_date: '',
  transfer_date: '',
  notary_cost: '',
  transfer_tax: '',
  land_registry_cost: '',
  broker_cost: '',
  building_share: '',
  land_share: '',
};

interface AcquisitionFormProps {
  propertyId: string;
}

export function AcquisitionForm({ propertyId }: AcquisitionFormProps) {
  const [formData, setFormData] = useState<AcquisitionFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadAcquisitionData();
  }, [propertyId]);

  async function loadAcquisitionData() {
    setLoadingData(true);
    try {
      const data = await fetchAcquisition(propertyId);
      if (data) {
        setFormData({
          purchase_price: data.purchase_price ? formatCurrency(data.purchase_price) : '',
          purchase_date: data.purchase_date || '',
          transfer_date: data.transfer_date || '',
          notary_cost: data.notary_cost ? formatCurrency(data.notary_cost) : '',
          transfer_tax: data.transfer_tax ? formatCurrency(data.transfer_tax) : '',
          land_registry_cost: data.land_registry_cost ? formatCurrency(data.land_registry_cost) : '',
          broker_cost: data.broker_cost ? formatCurrency(data.broker_cost) : '',
          building_share: data.building_share ? formatCurrency(data.building_share) : '',
          land_share: data.land_share ? formatCurrency(data.land_share) : '',
        });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoadingData(false);
    }
  }

  function handleChange(field: keyof AcquisitionFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccessMsg(null);
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  // Live-calculated AfA basis (Requirement 3.5)
  const afaBasis = useMemo(() => calculateAfaBasis(formData), [formData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMsg(null);

    const validationErrors = validateAcquisitionForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await saveAcquisition(propertyId, formData);
      setSuccessMsg(t.common.erfolgGespeichert);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const apiErrors = (err as { errors?: Record<string, string> }).errors;
        if (apiErrors) {
          setErrors(apiErrors);
        }
      }
      setSubmitError(err instanceof Error ? err.message : t.common.fehlerBeiSpeichern);
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div className="py-4">
        <p className="text-gray-500">{t.common.laden}</p>
      </div>
    );
  }

  return (
    <Card title="Anschaffungsdaten & Kaufpreisaufteilung">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
            {submitError}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm" role="status">
            {successMsg}
          </div>
        )}

        {/* Kaufpreis und Datum */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 mb-3">Kaufdaten</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Kaufpreis (€)"
              value={formData.purchase_price}
              onChange={(e) => handleChange('purchase_price', e.target.value)}
              error={errors.purchase_price}
              required
              placeholder="z.B. 250.000,00"
              inputMode="decimal"
            />
            <Input
              label="Kaufdatum"
              type="date"
              value={formData.purchase_date}
              onChange={(e) => handleChange('purchase_date', e.target.value)}
              error={errors.purchase_date}
              required
            />
            <Input
              label="Übergabedatum"
              type="date"
              value={formData.transfer_date}
              onChange={(e) => handleChange('transfer_date', e.target.value)}
              error={errors.transfer_date}
            />
          </div>
        </fieldset>

        {/* Nebenkosten */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 mb-3">Kaufnebenkosten</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Notarkosten (€)"
              value={formData.notary_cost}
              onChange={(e) => handleChange('notary_cost', e.target.value)}
              error={errors.notary_cost}
              placeholder="0,00"
              inputMode="decimal"
            />
            <Input
              label="Grunderwerbsteuer (€)"
              value={formData.transfer_tax}
              onChange={(e) => handleChange('transfer_tax', e.target.value)}
              error={errors.transfer_tax}
              placeholder="0,00"
              inputMode="decimal"
            />
            <Input
              label="Grundbuchkosten (€)"
              value={formData.land_registry_cost}
              onChange={(e) => handleChange('land_registry_cost', e.target.value)}
              error={errors.land_registry_cost}
              placeholder="0,00"
              inputMode="decimal"
            />
            <Input
              label="Maklerkosten (€)"
              value={formData.broker_cost}
              onChange={(e) => handleChange('broker_cost', e.target.value)}
              error={errors.broker_cost}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
        </fieldset>

        {/* Kaufpreisaufteilung */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 mb-3">
            Kaufpreisaufteilung (Gebäude / Grund und Boden)
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Gebäudeanteil (€)"
              value={formData.building_share}
              onChange={(e) => handleChange('building_share', e.target.value)}
              error={errors.building_share}
              required
              placeholder="z.B. 200.000,00"
              inputMode="decimal"
            />
            <Input
              label="Grund-und-Boden-Anteil (€)"
              value={formData.land_share}
              onChange={(e) => handleChange('land_share', e.target.value)}
              error={errors.land_share}
              required
              placeholder="z.B. 50.000,00"
              inputMode="decimal"
            />
          </div>
        </fieldset>

        {/* Live AfA-Bemessungsgrundlage */}
        <div className="bg-primary-50 border border-primary-200 rounded-md p-4">
          <p className="text-sm font-medium text-primary-800">
            AfA-Bemessungsgrundlage (berechnet)
          </p>
          <p className="text-2xl font-bold text-primary-900 mt-1" aria-live="polite">
            {afaBasis !== null ? formatCurrencyWithSymbol(afaBasis) : '— €'}
          </p>
          <p className="text-xs text-primary-600 mt-1">
            = Gebäudeanteil + anteilige Nebenkosten (Gebäudeanteil/Kaufpreis)
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? t.common.laden : t.common.speichern}
          </Button>
        </div>
      </form>
    </Card>
  );
}
