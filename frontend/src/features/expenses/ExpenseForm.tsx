import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { formatCurrency } from '../../shared/utils/formatting';
import { fetchCategories } from '../categories/api';
import { fetchProperties } from '../properties/api';
import { createExpense, updateExpense, fetchExpense, createSplit, updateSplit } from './api';
import { SplitEditor } from './SplitEditor';
import { DocumentUpload } from './DocumentUpload';
import { linkDocument } from './api';
import type { ExpenseFormData, SplitRow, ValidationErrors, Category } from './types';
import type { Property } from '../properties/types';

const INITIAL_FORM: ExpenseFormData = {
  booking_date: '',
  total_amount: '',
  counterparty: '',
  category_id: '',
  description: '',
  property_id: '',
  use_split: false,
};

const INITIAL_SPLIT: SplitRow[] = [
  { amount: '', category_id: '', is_allocable: false, is_tax_deductible: false, requires_capitalization: false, is_financing_related: false },
  { amount: '', category_id: '', is_allocable: false, is_tax_deductible: false, requires_capitalization: false, is_financing_related: false },
];

interface ExpenseFormProps {
  mode: 'create' | 'edit';
}

export function ExpenseForm({ mode }: ExpenseFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<ExpenseFormData>(INITIAL_FORM);
  const [splits, setSplits] = useState<SplitRow[]>(INITIAL_SPLIT);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [uploadedDocIds, setUploadedDocIds] = useState<string[]>([]);

  useEffect(() => {
    loadReferenceData();
    if (mode === 'edit' && id) {
      loadExpenseData(id);
    }
  }, [mode, id]);

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

  async function loadExpenseData(expenseId: string) {
    setLoadingData(true);
    try {
      const expense = await fetchExpense(expenseId);
      setFormData({
        booking_date: expense.booking_date || '',
        total_amount: formatCurrency(expense.total_amount),
        counterparty: expense.counterparty || '',
        category_id: expense.category_id || '',
        description: expense.description || '',
        property_id: expense.property_id || '',
        use_split: expense.has_splits ?? false,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoadingData(false);
    }
  }

  function handleChange(field: keyof ExpenseFormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (typeof value === 'string' && errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    // When category changes, show inherited flags info
    if (field === 'category_id' && typeof value === 'string' && !formData.use_split) {
      const cat = categories.find((c) => c.id === value);
      if (cat) {
        // Flag inheritance is shown via badges below the dropdown
      }
    }
  }

  function validateForm(): ValidationErrors {
    const errs: ValidationErrors = {};
    if (!formData.booking_date) errs.booking_date = 'Buchungsdatum ist ein Pflichtfeld';
    if (!formData.total_amount.trim()) errs.total_amount = 'Betrag ist ein Pflichtfeld';
    if (!formData.counterparty.trim()) errs.counterparty = 'Gegenpartei ist ein Pflichtfeld';
    if (!formData.property_id) errs.property_id = 'Objekt ist ein Pflichtfeld';
    if (!formData.use_split && !formData.category_id) errs.category_id = 'Kategorie ist ein Pflichtfeld';
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
      let expenseId: string;

      if (mode === 'create') {
        const created = await createExpense(formData);
        expenseId = created.id;
      } else if (id) {
        await updateExpense(id, formData);
        expenseId = id;
      } else {
        return;
      }

      // Save splits if in split mode
      if (formData.use_split && splits.length >= 2) {
        if (mode === 'create') {
          await createSplit(expenseId, splits);
        } else {
          await updateSplit(expenseId, splits);
        }
      }

      // Link uploaded documents
      for (const docId of uploadedDocIds) {
        await linkDocument(docId, 'booking', expenseId);
      }

      navigate('/ausgaben');
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

  function handleFilesUploaded(files: { file: File; documentId: string }[]) {
    setUploadedDocIds((prev) => [...prev, ...files.map((f) => f.documentId)]);
  }

  const selectedCategory = categories.find((c) => c.id === formData.category_id);
  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.is_active);

  if (loadingData) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t.common.laden}</p>
      </div>
    );
  }

  const title = mode === 'create' ? t.ausgaben.neuAnlegen : 'Ausgabe bearbeiten';

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/ausgaben')}>
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
            <label htmlFor="expense-property" className="block text-sm font-medium text-gray-700 mb-1">
              Objekt <span className="text-red-500">*</span>
            </label>
            <select
              id="expense-property"
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
            label={t.ausgaben.buchungsdatum}
            type="date"
            value={formData.booking_date}
            onChange={(e) => handleChange('booking_date', e.target.value)}
            error={errors.booking_date}
            required
          />

          {/* Betrag */}
          <Input
            label={t.ausgaben.betrag}
            value={formData.total_amount}
            onChange={(e) => handleChange('total_amount', e.target.value)}
            error={errors.total_amount}
            required
            inputMode="decimal"
            placeholder="z.B. 1.234,56"
          />

          {/* Gegenpartei */}
          <Input
            label={t.ausgaben.gegenpartei}
            value={formData.counterparty}
            onChange={(e) => handleChange('counterparty', e.target.value)}
            error={errors.counterparty}
            required
            maxLength={200}
          />

          {/* Split toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use-split"
              checked={formData.use_split}
              onChange={(e) => handleChange('use_split', e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="use-split" className="text-sm text-gray-700 cursor-pointer">
              {t.ausgaben.splitBuchung} (Buchung in Teilbeträge aufteilen)
            </label>
          </div>

          {/* Kategorie (only when NOT in split mode) */}
          {!formData.use_split && (
            <div>
              <label htmlFor="expense-category" className="block text-sm font-medium text-gray-700 mb-1">
                {t.ausgaben.kategorie} <span className="text-red-500">*</span>
              </label>
              <select
                id="expense-category"
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
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {errors.category_id && (
                <p className="mt-1 text-sm text-red-600" role="alert">{errors.category_id}</p>
              )}

              {/* Inherited flags display */}
              {selectedCategory && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedCategory.is_allocable && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Umlagefähig</span>
                  )}
                  {selectedCategory.is_tax_deductible && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Steuerlich abziehbar</span>
                  )}
                  {selectedCategory.requires_capitalization && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Aktivierungspflichtig</span>
                  )}
                  {selectedCategory.is_financing_related && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">Finanzierungsbezogen</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Split Editor */}
          {formData.use_split && (
            <SplitEditor
              splits={splits}
              onChange={setSplits}
              totalAmountStr={formData.total_amount}
              categories={categories}
              error={errors.splits}
            />
          )}

          {/* Beschreibung */}
          <div>
            <label htmlFor="expense-description" className="block text-sm font-medium text-gray-700 mb-1">
              {t.ausgaben.beschreibung}
            </label>
            <textarea
              id="expense-description"
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

          {/* Document Upload */}
          <DocumentUpload onFilesUploaded={handleFilesUploaded} />

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t.common.laden : t.common.speichern}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate('/ausgaben')}>
              {t.common.abbrechen}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
