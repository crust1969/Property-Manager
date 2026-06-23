import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Input } from '../../shared/components';
import { createCategory, updateCategory, fetchCategories } from './api';
import { fetchProperties } from '../properties/api';
import type { CategoryFormData, ValidationErrors, CategoryType } from './types';
import type { Property } from '../properties/types';

const INITIAL_FORM: CategoryFormData = {
  name: '',
  type: '',
  property_id: '',
  is_allocable: false,
  is_tax_deductible: false,
  requires_capitalization: false,
  is_financing_related: false,
};

interface CategoryFormProps {
  mode: 'create' | 'edit';
}

function validateForm(data: CategoryFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.name.trim()) {
    errors.name = 'Pflichtfeld';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Maximal 100 Zeichen';
  }

  if (!data.type) {
    errors.type = 'Pflichtfeld';
  }

  return errors;
}

export function CategoryForm({ mode }: CategoryFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<CategoryFormData>(INITIAL_FORM);
  const [properties, setProperties] = useState<Property[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
    if (mode === 'edit' && id) {
      loadCategoryData(id);
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

  async function loadCategoryData(categoryId: string) {
    setLoadingData(true);
    try {
      const categories = await fetchCategories();
      const category = categories.find((c) => c.id === categoryId);
      if (!category) {
        setSubmitError('Kategorie nicht gefunden');
        return;
      }
      if (category.is_system) {
        setSubmitError('Systemkategorien können nicht bearbeitet werden');
        return;
      }
      setFormData({
        name: category.name,
        type: category.type,
        property_id: category.property_id || '',
        is_allocable: category.is_allocable,
        is_tax_deductible: category.is_tax_deductible,
        requires_capitalization: category.requires_capitalization,
        is_financing_related: category.is_financing_related,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoadingData(false);
    }
  }

  function handleChange(field: keyof CategoryFormData, value: string | boolean) {
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
        await createCategory(formData as CategoryFormData & { type: CategoryType });
        navigate('/kategorien');
      } else if (id) {
        await updateCategory(id, formData as CategoryFormData & { type: CategoryType });
        navigate('/kategorien');
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const apiErrors = (err as { errors?: Record<string, string> }).errors;
        if (apiErrors) {
          setErrors(apiErrors);
        }
      }
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Wird geladen...</p>
      </div>
    );
  }

  const title = mode === 'create' ? 'Neue Kategorie anlegen' : 'Kategorie bearbeiten';

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/kategorien')}>
          ← Zurück
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
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            required
            maxLength={100}
            placeholder="z.B. Hausverwaltung"
          />

          <div>
            <label
              htmlFor="type-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Typ
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              id="type-select"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className={`
                block w-full rounded-md border px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-offset-0
                ${
                  errors.type
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }
              `.trim()}
              aria-invalid={errors.type ? 'true' : undefined}
            >
              <option value="">— Bitte wählen —</option>
              <option value="income">Einnahme</option>
              <option value="expense">Ausgabe</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.type}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="property-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Objekt (optional)
            </label>
            <select
              id="property-select"
              value={formData.property_id}
              onChange={(e) => handleChange('property_id', e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Alle Objekte (global)</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Leer lassen für eine objektübergreifende Kategorie
            </p>
          </div>

          {/* Classification Flags */}
          <fieldset className="border border-gray-200 rounded-md p-4">
            <legend className="text-sm font-medium text-gray-700 px-2">
              Klassifikations-Flags
            </legend>
            <p className="text-xs text-gray-500 mb-3">
              Diese Flags werden als Standardvorbelegung bei neuen Buchungen mit dieser Kategorie verwendet.
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_allocable}
                  onChange={(e) => handleChange('is_allocable', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Umlagefähig</span>
                  <p className="text-xs text-gray-500">Kann auf Mieter umgelegt werden (Nebenkosten)</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_tax_deductible}
                  onChange={(e) => handleChange('is_tax_deductible', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Steuerlich abziehbar</span>
                  <p className="text-xs text-gray-500">Absetzbar als Werbungskosten in der Steuererklärung</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_capitalization}
                  onChange={(e) => handleChange('requires_capitalization', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Aktivierungspflichtig</span>
                  <p className="text-xs text-gray-500">Muss über die Nutzungsdauer abgeschrieben werden</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_financing_related}
                  onChange={(e) => handleChange('is_financing_related', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Finanzierungsbezogen</span>
                  <p className="text-xs text-gray-500">Kosten im Zusammenhang mit Darlehen/Finanzierung</p>
                </div>
              </label>
            </div>
          </fieldset>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Wird geladen...' : 'Speichern'}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate('/kategorien')}>
              Abbrechen
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
