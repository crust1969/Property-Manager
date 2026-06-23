import { useState } from 'react';
import { Button, Input } from '../../shared/components';
import { formatCurrency, parseCurrencyInput } from '../../shared/utils/formatting';
import { processRefund } from './api';
import type { Deposit, RefundFormData, ValidationErrors } from './types';

interface RefundDialogProps {
  deposit: Deposit;
  onClose: () => void;
  onSuccess: (updated: Deposit) => void;
}

export function RefundDialog({ deposit, onClose, onSuccess }: RefundDialogProps) {
  const [formData, setFormData] = useState<RefundFormData>({
    refund_amount: '',
    refund_date: new Date().toISOString().split('T')[0],
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const remainingAmount = deposit.amount - deposit.refunded_amount;

  function handleChange(field: keyof RefundFormData, value: string) {
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
    if (!formData.refund_amount.trim()) {
      errs.refund_amount = 'Rückzahlungsbetrag ist ein Pflichtfeld';
    } else {
      const cents = parseCurrencyInput(formData.refund_amount);
      if (cents === null || cents <= 0) {
        errs.refund_amount = 'Ungültiger Betrag';
      } else if (cents > remainingAmount) {
        errs.refund_amount = `Betrag darf ${formatCurrency(remainingAmount)} € nicht überschreiten`;
      }
    }
    if (!formData.refund_date) {
      errs.refund_date = 'Rückzahlungsdatum ist ein Pflichtfeld';
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
      const refundCents = parseCurrencyInput(formData.refund_amount) ?? 0;
      const updated = await processRefund(deposit.id, {
        refund_amount: refundCents,
        refund_date: formData.refund_date,
      });
      onSuccess(updated);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler bei der Rückzahlung');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Kaution zurückzahlen</h2>

        {/* Summary */}
        <div className="mb-4 p-3 bg-gray-50 rounded-md text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Kautionsbetrag:</span>
            <span className="font-medium">{formatCurrency(deposit.amount)} €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Bereits zurückgezahlt:</span>
            <span className="font-medium">{formatCurrency(deposit.refunded_amount)} €</span>
          </div>
          <div className="flex justify-between border-t pt-1">
            <span className="text-gray-700 font-medium">Verbleibender Betrag:</span>
            <span className="font-bold text-primary-700">{formatCurrency(remainingAmount)} €</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {submitError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
              {submitError}
            </div>
          )}

          <Input
            label="Rückzahlungsbetrag (€)"
            value={formData.refund_amount}
            onChange={(e) => handleChange('refund_amount', e.target.value)}
            error={errors.refund_amount}
            required
            inputMode="decimal"
            placeholder="z.B. 1.500,00"
          />

          <Input
            label="Rückzahlungsdatum"
            type="date"
            value={formData.refund_date}
            onChange={(e) => handleChange('refund_date', e.target.value)}
            error={errors.refund_date}
            required
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Wird verarbeitet...' : 'Rückzahlung durchführen'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
