import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { createProperty, updateProperty, fetchProperty } from './api';
import { validatePropertyForm } from './validation';
import type { PropertyFormData, ValidationErrors } from './types';
import type { PropertyType } from '../../shared/types';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'Wohnung', label: t.objekte.typen.wohnung },
  { value: 'Haus', label: t.objekte.typen.haus },
  { value: 'Gewerbe', label: t.objekte.typen.gewerbe },
  { value: 'Garage', label: t.objekte.typen.garage },
  { value: 'Grundstück', label: t.objekte.typen.grundstueck },
];

const INITIAL_FORM: PropertyFormData = {
  name: '',
  street: '',
  zip_code: '',
  city: '',
  property_type: '',
  living_area_sqm: '',
};

interface PropertyFormProps {
  mode: 'create' | 'edit';
}

export function PropertyForm({ mode }: PropertyFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<PropertyFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && id) {
      loadPropertyData(id);
    }
  }, [mode, id]);

  async function loadPropertyData(propertyId: string) {
    setLoadingData(true);
    try {
      const property = await fetchProperty(propertyId);
      setFormData({
        name: property.name,
        street: property.street,
        zip_code: property.zip_code,
        city: property.city,
        property_type: property.property_type,
        living_area_sqm: property.living_area_sqm.toString().replace('.', ','),
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoadingData(false);
    }
  }

  function handleChange(field: keyof PropertyFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
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

    const validationErrors = validatePropertyForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        const created = await createProperty(formData);
        navigate(`/objekte/${created.id}`);
      } else if (id) {
        await updateProperty(id, formData);
        navigate(`/objekte/${id}`);
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

  const title = mode === 'create' ? t.objekte.neuAnlegen : 'Objekt bearbeiten';

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/objekte')}>
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

          <Input
            label={t.objekte.bezeichnung}
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            required
            maxLength={100}
          />

          <Input
            label={t.objekte.strasse}
            value={formData.street}
            onChange={(e) => handleChange('street', e.target.value)}
            error={errors.street}
            required
            maxLength={150}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.objekte.plz}
              value={formData.zip_code}
              onChange={(e) => handleChange('zip_code', e.target.value)}
              error={errors.zip_code}
              required
              maxLength={5}
              inputMode="numeric"
            />
            <Input
              label={t.objekte.ort}
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              error={errors.city}
              required
              maxLength={100}
            />
          </div>

          <div>
            <label
              htmlFor="property-type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t.objekte.objekttyp}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              id="property-type"
              value={formData.property_type}
              onChange={(e) => handleChange('property_type', e.target.value)}
              className={`
                block w-full rounded-md border px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-offset-0
                ${
                  errors.property_type
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }
              `.trim()}
              aria-invalid={errors.property_type ? 'true' : undefined}
            >
              <option value="">— Bitte wählen —</option>
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
            {errors.property_type && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.property_type}
              </p>
            )}
          </div>

          <Input
            label={t.objekte.wohnflaeche}
            value={formData.living_area_sqm}
            onChange={(e) => handleChange('living_area_sqm', e.target.value)}
            error={errors.living_area_sqm}
            required
            inputMode="decimal"
            placeholder="z.B. 75,5"
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t.common.laden : t.common.speichern}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate('/objekte')}>
              {t.common.abbrechen}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
