import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { useAutoSelectProperty } from '../../shared/hooks';
import { createTenant, updateTenant, fetchTenant } from './api';
import { fetchProperties } from '../properties/api';
import type { TenantFormData, ValidationErrors } from './types';
import type { Property } from '../properties/types';

const INITIAL_FORM: TenantFormData = {
  property_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
};

interface TenantFormProps {
  mode: 'create' | 'edit';
}

function validateForm(data: TenantFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.property_id) {
    errors.property_id = t.common.pflichtfeld;
  }
  if (!data.first_name.trim()) {
    errors.first_name = t.common.pflichtfeld;
  } else if (data.first_name.trim().length > 50) {
    errors.first_name = t.validierung.maxZeichen(50);
  }
  if (!data.last_name.trim()) {
    errors.last_name = t.common.pflichtfeld;
  } else if (data.last_name.trim().length > 50) {
    errors.last_name = t.validierung.maxZeichen(50);
  }

  return errors;
}

export function TenantForm({ mode }: TenantFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<TenantFormData>(INITIAL_FORM);
  const [properties, setProperties] = useState<Property[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setPropertyId = useCallback((propId: string) => {
    setFormData(prev => ({ ...prev, property_id: propId }));
  }, []);

  useAutoSelectProperty(properties, formData.property_id, setPropertyId);

  useEffect(() => {
    loadProperties();
    if (mode === 'edit' && id) {
      loadTenantData(id);
    }
  }, [mode, id]);

  async function loadProperties() {
    try {
      const data = await fetchProperties();
      setProperties(data);
    } catch {
      // Properties will just be empty
    }
  }

  async function loadTenantData(tenantId: string) {
    setLoadingData(true);
    try {
      const tenant = await fetchTenant(tenantId);
      setFormData({
        property_id: tenant.property_id,
        first_name: tenant.first_name,
        last_name: tenant.last_name,
        email: tenant.email || '',
        phone: tenant.phone || '',
        address: tenant.address || '',
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoadingData(false);
    }
  }

  function handleChange(field: keyof TenantFormData, value: string) {
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
        await createTenant(formData);
        navigate('/mieter');
      } else if (id) {
        await updateTenant(id, formData);
        navigate('/mieter');
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

  const title = mode === 'create' ? t.mieter.neuAnlegen : 'Mieter bearbeiten';

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/mieter')}>
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

          <div>
            <label
              htmlFor="property-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Objekt
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              id="property-select"
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.mieter.vorname}
              value={formData.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              error={errors.first_name}
              required
              maxLength={50}
            />
            <Input
              label={t.mieter.nachname}
              value={formData.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              error={errors.last_name}
              required
              maxLength={50}
            />
          </div>

          <Input
            label={t.mieter.emailAdresse}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
            type="email"
          />

          <Input
            label={t.mieter.telefon}
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            error={errors.phone}
            type="tel"
          />

          <Input
            label={t.mieter.anschrift}
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            error={errors.address}
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t.common.laden : t.common.speichern}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate('/mieter')}>
              {t.common.abbrechen}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
