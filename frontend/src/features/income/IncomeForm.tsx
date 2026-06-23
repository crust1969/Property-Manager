import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { formatCurrency } from '../../shared/utils/formatting';
import { fetchCategories } from '../categories/api';
import { fetchProperties } from '../properties/api';
import { createIncome, updateIncome, fetchIncomeById } from './api';
import type { IncomeFormData, ValidationErrors, Category, Receivable } from './types';
import type { Property } from '../properties/types';
import { api } from '../../shared/api/client';

const INITIAL_FORM: IncomeFormData = {
  booking_date: '',
  total_amount: '',
  counterparty: '',
  category_id: '',
  description: '',
  property_id: '',
  receivable_id: '',
};

interface IncomeFormProps {
  mode: 'create' | 'edit';
}

export function IncomeForm({ mode }: IncomeFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<IncomeFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);

  useEffect(() => {
    loadReferenceData();
    if (mode === 'edit' && id) {
      loadIncomeData(id);
    }
  }, [mode, id]);

  useEffect(() => {
    if (formData.property_id) {
      loadReceivables(formData.property_id);
    } else {
      setReceivables([]);
    }
  }, [formData.property_id]);

  async function loadReferenceData() {
    try {
      const [cats, props] = await Promise.all([
        fetchCategories(),
        fetchProperties(),
      ]);
      setCategories(cats);
      setProperties(props);
    } catch {
      // Non-critical error
    }
  }

  async function loadReceivables(propertyId: string) {
    try {
      // Fetch open receivables for the selected property via leases
      const leases = await api.get<{ id: string }[]>('/leases', { propertyId });
      const allReceivables: Receivable[] = [];
      for (const lease of leases) {
        try {
          const recs = await api.get<Receivable[]>(`/leases/${lease.id}/receivables`);
          allReceivables.push(...recs.filter((r) => r.status !== 'storniert'));
        } catch {
          // Skip if unavailable
        }
      }
      setReceivables(allReceivables);
    } catch {
      setReceivables([]);
    }
  }

  async function loadIncomeData(incomeId: string) {
    setLoadingData(true);
    try {
      const income = await fetchIncomeById(incomeId);
      setFormData({
        booking_date: income.booking_date,
        total_amount: formatCurrency(income.total_amount),
        counterparty: income.counterparty,
        category_id: income.category_id,
        description: income.description || '',
        property_id: income.property_id,
        receivable_id: income.receivable_id || '',
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoadingData(false);
    }
  }

  function handleChange(field: keyof IncomeFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateForm(): ValidationErrors {
    const errs: ValidationErrors = {};
    if (!formData.booking_date) errs.booking_date = 'Buchungsdatum ist ein Pflichtfeld';
    if (!formData.total_amount.trim()) errs.total_amount = 'Betrag ist ein Pflichtfeld';
    if (!formData.counterparty.trim()) errs.counterparty = 'Gegenpartei ist ein Pflichtfeld';
    if (!formData.property_id) errs.property_id = 'Objekt ist ein Pflichtfeld';
    if (!formData.category_id) errs.category_id = 'Kategorie ist ein Pflichtfeld';
    if (formData.counterparty.length > 200) errs.counterparty = 'Maximal 200 Zeichen';
    if (formData.description.length > 500) errs.description = 'Maximal 500 Zeichen';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        await createIncome(formData);
      } else if (id) {
        await updateIncome(id, formData);
      }
      navigate('/einnahmen');
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

  const incomeCategories = categories.filter((c) => c.type === 'income' && c.is_active);

  if (loadingData) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t.common.laden}</p>
      </div>
    );
  }

  const title = mode === 'create' ? t.einnahmen.neuAnlegen : 'Einnahme bearbeiten';

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/einnahmen')}>
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

          {/* Objekt */}
          <div>
            <label htmlFor="income-property" className="block text-sm font-medium text-gray-700 mb-1">
              Objekt <span className="text-red-500">*</span>
            </label>
            <select
              id="income-property"
              value={formData.property_id}
              onChange={(e) => handleChange('property_id', e.target.value)}
              className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.property_id
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
              }`}
              aria-invalid={errors.property_id ? 'true' : undefined}
            >
              <option value="">— Objekt wählen —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.property_id && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.property_id}</p>
            )}
          </div>

          {/* Buchungsdatum */}
          <Input
            label={t.einnahmen.buchungsdatum}
            type="date"
            value={formData.booking_date}
            onChange={(e) => handleChange('booking_date', e.target.value)}
            error={errors.booking_date}
            required
          />

          {/* Betrag */}
          <Input
            label={t.einnahmen.betrag}
            value={formData.total_amount}
            onChange={(e) => handleChange('total_amount', e.target.value)}
            error={errors.total_amount}
            required
            inputMode="decimal"
            placeholder="z.B. 1.234,56"
          />

          {/* Gegenpartei */}
          <Input
            label={t.einnahmen.gegenpartei}
            value={formData.counterparty}
            onChange={(e) => handleChange('counterparty', e.target.value)}
            error={errors.counterparty}
            required
            maxLength={200}
          />

          {/* Kategorie */}
          <div>
            <label htmlFor="income-category" className="block text-sm font-medium text-gray-700 mb-1">
              {t.einnahmen.kategorie} <span className="text-red-500">*</span>
            </label>
            <select
              id="income-category"
              value={formData.category_id}
              onChange={(e) => handleChange('category_id', e.target.value)}
              className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.category_id
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
              }`}
              aria-invalid={errors.category_id ? 'true' : undefined}
            >
              <option value="">— Kategorie wählen —</option>
              {incomeCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {errors.category_id && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.category_id}</p>
            )}
          </div>

          {/* Sollstellung (optional) */}
          {receivables.length > 0 && (
            <div>
              <label htmlFor="income-receivable" className="block text-sm font-medium text-gray-700 mb-1">
                Zuordnung zu Sollstellung (optional)
              </label>
              <select
                id="income-receivable"
                value={formData.receivable_id}
                onChange={(e) => handleChange('receivable_id', e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— Keine Zuordnung —</option>
                {receivables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatCurrency(r.total_amount)} € — Fällig: {r.due_date} ({r.status})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Verknüpft diese Einnahme mit einer offenen Sollstellung
              </p>
            </div>
          )}

          {/* Beschreibung */}
          <div>
            <label htmlFor="income-description" className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <textarea
              id="income-description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              maxLength={500}
              className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.description
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
              }`}
              aria-invalid={errors.description ? 'true' : undefined}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.description}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">{formData.description.length}/500</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t.common.laden : t.common.speichern}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate('/einnahmen')}>
              {t.common.abbrechen}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
