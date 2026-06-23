import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { formatCurrency } from '../../shared/utils/formatting';
import { createLease, updateLease, fetchLease } from './api';
import { fetchProperties } from '../properties/api';
import { fetchTenants } from '../tenants/api';
import type { LeaseFormData, RentModel, ValidationErrors } from './types';
import type { Property } from '../properties/types';
import type { Tenant } from '../tenants/types';

const RENT_MODELS: { value: RentModel; label: string }[] = [
  { value: 'konstant', label: t.mietvertrag.modelle.konstant },
  { value: 'staffel', label: t.mietvertrag.modelle.staffel },
  { value: 'index', label: t.mietvertrag.modelle.index },
  { value: 'manuell', label: t.mietvertrag.modelle.manuell },
];

const INITIAL_FORM: LeaseFormData = {
  property_id: '',
  tenant_id: '',
  start_date: '',
  end_date: '',
  cold_rent: '',
  operating_cost_advance: '',
  heating_cost_advance: '',
  due_day: '1',
  rent_model: '',
};

interface LeaseFormProps {
  mode: 'create' | 'edit';
}

function validateForm(data: LeaseFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.property_id) {
    errors.property_id = t.common.pflichtfeld;
  }
  if (!data.tenant_id) {
    errors.tenant_id = t.common.pflichtfeld;
  }
  if (!data.start_date) {
    errors.start_date = t.common.pflichtfeld;
  }
  if (!data.cold_rent.trim()) {
    errors.cold_rent = t.common.pflichtfeld;
  }
  if (!data.rent_model) {
    errors.rent_model = t.common.pflichtfeld;
  }

  const dueDay = parseInt(data.due_day, 10);
  if (isNaN(dueDay) || dueDay < 1 || dueDay > 28) {
    errors.due_day = 'Fälligkeitstag muss zwischen 1 und 28 liegen';
  }

  return errors;
}

export function LeaseForm({ mode }: LeaseFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<LeaseFormData>(INITIAL_FORM);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    loadReferenceData();
    if (mode === 'edit' && id) {
      loadLeaseData(id);
    }
  }, [mode, id]);

  async function loadReferenceData() {
    try {
      const [propertyData, tenantData] = await Promise.all([
        fetchProperties(),
        fetchTenants(),
      ]);
      setProperties(propertyData);
      setTenants(tenantData);
    } catch {
      // Reference data will just be empty
    }
  }

  async function loadLeaseData(leaseId: string) {
    setLoadingData(true);
    try {
      const lease = await fetchLease(leaseId);
      setFormData({
        property_id: lease.property_id,
        tenant_id: lease.tenant_id,
        start_date: lease.start_date,
        end_date: lease.end_date || '',
        cold_rent: formatCurrency(lease.cold_rent),
        operating_cost_advance: formatCurrency(lease.operating_cost_advance),
        heating_cost_advance: formatCurrency(lease.heating_cost_advance),
        due_day: lease.due_day.toString(),
        rent_model: lease.rent_model,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoadingData(false);
    }
  }

  function handleChange(field: keyof LeaseFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        await createLease(formData);
        navigate('/mietvertraege');
      } else if (id) {
        await updateLease(id, formData);
        navigate('/mietvertraege');
      }
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
      <div className="p-6">
        <p className="text-gray-500">{t.common.laden}</p>
      </div>
    );
  }

  const title = mode === 'create' ? t.mietvertrag.neuAnlegen : 'Mietvertrag bearbeiten';

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/mietvertraege')}>
          ← {t.common.zurueck}
        </Button>
      </div>

      <Card title={title}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {submitError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
              {submitError}
            </div>
          )}

          {/* Objekt-Auswahl */}
          <div>
            <label
              htmlFor="lease-property"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Objekt
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              id="lease-property"
              value={formData.property_id}
              onChange={(e) => handleChange('property_id', e.target.value)}
              className={`
                block w-full rounded-md border px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-offset-0
                ${
                  errors.property_id
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }
              `.trim()}
              aria-invalid={errors.property_id ? 'true' : undefined}
            >
              <option value="">— Bitte wählen —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.property_id && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.property_id}
              </p>
            )}
          </div>

          {/* Mieter-Auswahl */}
          <div>
            <label
              htmlFor="lease-tenant"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Mieter
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              id="lease-tenant"
              value={formData.tenant_id}
              onChange={(e) => handleChange('tenant_id', e.target.value)}
              className={`
                block w-full rounded-md border px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-offset-0
                ${
                  errors.tenant_id
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }
              `.trim()}
              aria-invalid={errors.tenant_id ? 'true' : undefined}
            >
              <option value="">— Bitte wählen —</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.first_name} {tenant.last_name}
                </option>
              ))}
            </select>
            {errors.tenant_id && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.tenant_id}
              </p>
            )}
          </div>

          {/* Vertragslaufzeit */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.mietvertrag.mietbeginn}
              type="date"
              value={formData.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
              error={errors.start_date}
              required
            />
            <Input
              label={t.mietvertrag.mietende}
              type="date"
              value={formData.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
              error={errors.end_date}
              helpText="Leer lassen für unbefristeten Vertrag"
            />
          </div>

          {/* Miete */}
          <Input
            label={t.mietvertrag.kaltmiete}
            value={formData.cold_rent}
            onChange={(e) => handleChange('cold_rent', e.target.value)}
            error={errors.cold_rent}
            required
            inputMode="decimal"
            placeholder="z.B. 850,00"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.mietvertrag.betriebskostenvorauszahlung}
              value={formData.operating_cost_advance}
              onChange={(e) => handleChange('operating_cost_advance', e.target.value)}
              error={errors.operating_cost_advance}
              inputMode="decimal"
              placeholder="z.B. 150,00"
            />
            <Input
              label={t.mietvertrag.heizkostenvorauszahlung}
              value={formData.heating_cost_advance}
              onChange={(e) => handleChange('heating_cost_advance', e.target.value)}
              error={errors.heating_cost_advance}
              inputMode="decimal"
              placeholder="z.B. 80,00"
            />
          </div>

          {/* Fälligkeitstag */}
          <Input
            label={t.mietvertrag.faelligkeitstag}
            type="number"
            min={1}
            max={28}
            value={formData.due_day}
            onChange={(e) => handleChange('due_day', e.target.value)}
            error={errors.due_day}
            required
            helpText="Tag des Monats (1–28)"
          />

          {/* Mietmodell */}
          <div>
            <label
              htmlFor="rent-model"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t.mietvertrag.mietmodell}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              id="rent-model"
              value={formData.rent_model}
              onChange={(e) => handleChange('rent_model', e.target.value)}
              className={`
                block w-full rounded-md border px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-offset-0
                ${
                  errors.rent_model
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }
              `.trim()}
              aria-invalid={errors.rent_model ? 'true' : undefined}
            >
              <option value="">— Bitte wählen —</option>
              {RENT_MODELS.map((rm) => (
                <option key={rm.value} value={rm.value}>
                  {rm.label}
                </option>
              ))}
            </select>
            {errors.rent_model && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.rent_model}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t.common.laden : t.common.speichern}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate('/mietvertraege')}>
              {t.common.abbrechen}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
