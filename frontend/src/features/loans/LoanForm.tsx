import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { formatCurrency, formatNumber } from '../../shared/utils/formatting';
import { fetchProperties } from '../properties/api';
import { createLoan, updateLoan, fetchLoan } from './api';
import type { LoanFormData, ValidationErrors } from './types';
import type { Property } from '../properties/types';

const INITIAL_FORM: LoanFormData = {
  property_id: '',
  lender: '',
  contract_number: '',
  loan_amount: '',
  interest_rate: '',
  repayment_rate: '',
  start_date: '',
  end_date: '',
  fixed_interest_months: '',
  interest_only_months: '',
};

interface LoanFormProps {
  mode: 'create' | 'edit';
}

export function LoanForm({ mode }: LoanFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<LoanFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    loadProperties();
    if (mode === 'edit' && id) {
      loadLoanData(id);
    }
  }, [mode, id]);

  async function loadProperties() {
    try {
      const props = await fetchProperties();
      setProperties(props);
    } catch {
      // Non-critical
    }
  }

  async function loadLoanData(loanId: string) {
    setLoadingData(true);
    try {
      const loan = await fetchLoan(loanId);
      setFormData({
        property_id: loan.property_id,
        lender: loan.lender,
        contract_number: loan.contract_number,
        loan_amount: formatCurrency(loan.loan_amount),
        interest_rate: formatNumber(loan.interest_rate, 2),
        repayment_rate: formatNumber(loan.repayment_rate, 2),
        start_date: loan.start_date,
        end_date: loan.end_date,
        fixed_interest_months: loan.fixed_interest_months?.toString() ?? '',
        interest_only_months: loan.interest_only_months ? loan.interest_only_months.toString() : '',
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoadingData(false);
    }
  }

  function handleChange(field: keyof LoanFormData, value: string) {
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
    if (!formData.property_id) errs.property_id = 'Objekt ist ein Pflichtfeld';
    if (!formData.lender.trim()) errs.lender = 'Darlehensgeber ist ein Pflichtfeld';
    if (formData.lender.length > 100) errs.lender = 'Maximal 100 Zeichen';
    if (formData.contract_number.length > 50) errs.contract_number = 'Maximal 50 Zeichen';
    if (!formData.loan_amount.trim()) errs.loan_amount = 'Darlehenssumme ist ein Pflichtfeld';
    if (!formData.interest_rate.trim()) errs.interest_rate = 'Zinssatz ist ein Pflichtfeld';
    if (!formData.repayment_rate.trim()) errs.repayment_rate = 'Tilgungssatz ist ein Pflichtfeld';
    if (!formData.start_date) errs.start_date = 'Startdatum ist ein Pflichtfeld';
    if (!formData.end_date) errs.end_date = 'Enddatum ist ein Pflichtfeld';
    if (formData.start_date && formData.end_date && formData.end_date <= formData.start_date) {
      errs.end_date = 'Enddatum muss nach dem Startdatum liegen';
    }
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
        await createLoan(formData);
      } else if (id) {
        await updateLoan(id, formData);
      }
      navigate('/darlehen');
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

  const title = mode === 'create' ? t.darlehen.neuAnlegen : 'Darlehen bearbeiten';

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/darlehen')}>
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
            <label htmlFor="loan-property" className="block text-sm font-medium text-gray-700 mb-1">
              Objekt <span className="text-red-500">*</span>
            </label>
            <select
              id="loan-property"
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

          {/* Darlehensgeber */}
          <Input
            label={t.darlehen.darlehensgeber}
            value={formData.lender}
            onChange={(e) => handleChange('lender', e.target.value)}
            error={errors.lender}
            required
            maxLength={100}
          />

          {/* Vertragsnummer */}
          <Input
            label={t.darlehen.vertragsnummer}
            value={formData.contract_number}
            onChange={(e) => handleChange('contract_number', e.target.value)}
            error={errors.contract_number}
            maxLength={50}
          />

          {/* Darlehenssumme */}
          <Input
            label={t.darlehen.darlehenssumme}
            value={formData.loan_amount}
            onChange={(e) => handleChange('loan_amount', e.target.value)}
            error={errors.loan_amount}
            required
            inputMode="decimal"
            placeholder="z.B. 250.000,00"
          />

          {/* Zinssatz and Tilgungssatz in a row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t.darlehen.zinssatz}
              value={formData.interest_rate}
              onChange={(e) => handleChange('interest_rate', e.target.value)}
              error={errors.interest_rate}
              required
              inputMode="decimal"
              placeholder="z.B. 2,50"
            />
            <Input
              label={t.darlehen.tilgungssatz}
              value={formData.repayment_rate}
              onChange={(e) => handleChange('repayment_rate', e.target.value)}
              error={errors.repayment_rate}
              required
              inputMode="decimal"
              placeholder="z.B. 1,00"
            />
          </div>

          {/* Startdatum and Enddatum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t.darlehen.startdatum}
              type="date"
              value={formData.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
              error={errors.start_date}
              required
            />
            <Input
              label={t.darlehen.enddatum}
              type="date"
              value={formData.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
              error={errors.end_date}
              required
            />
          </div>

          {/* Sollzinsbindung */}
          <Input
            label="Sollzinsbindung (Monate)"
            type="number"
            value={formData.fixed_interest_months}
            onChange={(e) => handleChange('fixed_interest_months', e.target.value)}
            error={errors.fixed_interest_months}
            placeholder="z.B. 120"
            min="1"
          />

          {/* Tilgungsfreie Monate */}
          <div>
            <Input
              label="Tilgungsfreie Monate"
              type="number"
              value={formData.interest_only_months}
              onChange={(e) => handleChange('interest_only_months', e.target.value)}
              error={errors.interest_only_months}
              placeholder="z.B. 24"
              min="0"
              max="120"
            />
            <p className="mt-1 text-xs text-gray-500">
              Anzahl Monate am Anfang ohne Tilgung (nur Zinszahlung)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t.common.laden : t.common.speichern}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate('/darlehen')}>
              {t.common.abbrechen}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
