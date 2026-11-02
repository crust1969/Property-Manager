import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { createDeposit } from './api';
import { api } from '../../shared/api/client';
import type { DepositFormData, ValidationErrors } from './types';

interface Lease {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  cold_rent: number;
  status: string;
  tenant_name?: string;
  property_name?: string;
}

const INITIAL_FORM: DepositFormData = {
  lease_id: '',
  amount: '',
  received_date: '',
  account_reference: '',
};

export function DepositForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<DepositFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);

  useEffect(() => {
    loadLeases();
  }, []);

  async function loadLeases() {
    try {
      const [leaseData, tenantData, propertyData] = await Promise.all([
        api.get<Lease[]>('/leases'),
        api.get<{ id: string; first_name: string; last_name: string }[]>('/tenants'),
        api.get<{ id: string; name: string }[]>('/properties'),
      ]);

      // Enrich leases with tenant and property names
      const enriched = leaseData
        .filter((l) => l.status === 'aktiv')
        .map((l) => {
          const tenant = tenantData.find((ten) => ten.id === l.tenant_id);
          const property = propertyData.find((p) => p.id === l.property_id);
          return {
            ...l,
            tenant_name: tenant ? `${tenant.first_name} ${tenant.last_name}` : l.tenant_id,
            property_name: property ? property.name : l.property_id,
          };
        });

      setLeases(enriched);
    } catch {
      // Non-critical
    }
  }

  function handleChange(field: keyof DepositFormData, value: string) {
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
    if (!formData.lease_id) errs.lease_id = 'Mietvertrag ist ein Pflichtfeld';
    if (!formData.amount.trim()) errs.amount = 'Betrag ist ein Pflichtfeld';
    if (!formData.received_date) errs.received_date = 'Eingangsdatum ist ein Pflichtfeld';
    if (!formData.account_reference.trim()) errs.account_reference = 'Kontoreferenz ist ein Pflichtfeld';
    if (formData.account_reference.length > 34) errs.account_reference = 'Maximal 34 Zeichen';
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
      await createDeposit(formData);
      navigate('/kautionen');
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

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/kautionen')}>
          ← {t.common.zurueck}
        </Button>
      </div>

      <Card title="Neue Kaution erfassen">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {submitError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
              {submitError}
            </div>
          )}

          {/* Mietvertrag */}
          <div>
            <label htmlFor="deposit-lease" className="block text-sm font-medium text-gray-700 mb-1">
              Mietvertrag <span className="text-red-500">*</span>
            </label>
            <select
              id="deposit-lease"
              value={formData.lease_id}
              onChange={(e) => handleChange('lease_id', e.target.value)}
              className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.lease_id
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
              }`}
              aria-invalid={errors.lease_id ? 'true' : undefined}
            >
              <option value="">— Mietvertrag wählen —</option>
              {leases.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.property_name} — {l.tenant_name} (ab {l.start_date})
                </option>
              ))}
            </select>
            {errors.lease_id && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.lease_id}</p>
            )}
          </div>

          {/* Betrag */}
          <Input
            label="Kautionsbetrag (€)"
            value={formData.amount}
            onChange={(e) => handleChange('amount', e.target.value)}
            error={errors.amount}
            required
            inputMode="decimal"
            placeholder="z.B. 2.400,00"
          />

          {/* Eingangsdatum */}
          <Input
            label="Eingangsdatum"
            type="date"
            value={formData.received_date}
            onChange={(e) => handleChange('received_date', e.target.value)}
            error={errors.received_date}
            required
          />

          {/* Kontoreferenz */}
          <Input
            label="Kontoreferenz (IBAN / Konto)"
            value={formData.account_reference}
            onChange={(e) => handleChange('account_reference', e.target.value)}
            error={errors.account_reference}
            required
            maxLength={34}
            placeholder="z.B. DE89 3704 0044 0532 0130 00"
          />

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? t.common.laden : t.common.speichern}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate('/kautionen')}>
              {t.common.abbrechen}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
