import { useState, useMemo } from 'react';
import { t } from '../../i18n/de';
import { Button, Input, Modal } from '../../shared/components';
import { parseCurrencyInput, formatCurrency } from '../../shared/utils/formatting';
import { recordPayment } from './api';
import type { PaymentFormData, ValidationErrors } from './types';

const INITIAL_FORM: PaymentFormData = {
  payment_date: '',
  interest_amount: '',
  repayment_amount: '',
  fee_amount: '',
  extra_repayment: '',
};

interface PaymentFormProps {
  loanId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentForm({ loanId, isOpen, onClose, onSuccess }: PaymentFormProps) {
  const [formData, setFormData] = useState<PaymentFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalCents = useMemo(() => {
    const interest = parseCurrencyInput(formData.interest_amount) ?? 0;
    const repayment = parseCurrencyInput(formData.repayment_amount) ?? 0;
    const fees = parseCurrencyInput(formData.fee_amount) ?? 0;
    const extra = parseCurrencyInput(formData.extra_repayment) ?? 0;
    return interest + repayment + fees + extra;
  }, [formData.interest_amount, formData.repayment_amount, formData.fee_amount, formData.extra_repayment]);

  function handleChange(field: keyof PaymentFormData, value: string) {
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
    if (!formData.payment_date) errs.payment_date = 'Zahlungsdatum ist ein Pflichtfeld';
    if (!formData.interest_amount.trim() && !formData.repayment_amount.trim()) {
      errs.interest_amount = 'Mindestens Zinsanteil oder Tilgungsanteil angeben';
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
      await recordPayment(loanId, formData);
      setFormData(INITIAL_FORM);
      setErrors({});
      onSuccess();
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

  function handleClose() {
    setFormData(INITIAL_FORM);
    setErrors({});
    setSubmitError(null);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t.darlehen.zahlung}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            {t.common.abbrechen}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t.common.laden : t.common.speichern}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {submitError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
            {submitError}
          </div>
        )}

        {/* Zahlungsdatum */}
        <Input
          label="Zahlungsdatum"
          type="date"
          value={formData.payment_date}
          onChange={(e) => handleChange('payment_date', e.target.value)}
          error={errors.payment_date}
          required
        />

        {/* Zinsanteil */}
        <Input
          label={t.darlehen.zinsanteil}
          value={formData.interest_amount}
          onChange={(e) => handleChange('interest_amount', e.target.value)}
          error={errors.interest_amount}
          inputMode="decimal"
          placeholder="z.B. 520,83"
        />

        {/* Tilgungsanteil */}
        <Input
          label={t.darlehen.tilgungsanteil}
          value={formData.repayment_amount}
          onChange={(e) => handleChange('repayment_amount', e.target.value)}
          error={errors.repayment_amount}
          inputMode="decimal"
          placeholder="z.B. 208,33"
        />

        {/* Gebühren */}
        <Input
          label={t.darlehen.gebuehren}
          value={formData.fee_amount}
          onChange={(e) => handleChange('fee_amount', e.target.value)}
          error={errors.fee_amount}
          inputMode="decimal"
          placeholder="z.B. 0,00"
        />

        {/* Sondertilgung */}
        <Input
          label={t.darlehen.sondertilgung}
          value={formData.extra_repayment}
          onChange={(e) => handleChange('extra_repayment', e.target.value)}
          error={errors.extra_repayment}
          inputMode="decimal"
          placeholder="z.B. 5.000,00"
        />

        {/* Total */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Gesamt:</span>
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(totalCents)} €
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
