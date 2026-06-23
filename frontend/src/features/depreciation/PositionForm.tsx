import { useState, useEffect } from 'react';
import { Button, Input } from '../../shared/components';
import { formatCurrency, parseCurrencyInput } from '../../shared/utils/formatting';
import type { AfaPosition, CreatePositionInput } from './types';

interface PositionFormProps {
  mode: 'create' | 'edit';
  position?: AfaPosition;
  onSubmit: (data: CreatePositionInput) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

interface FormErrors {
  name?: string;
  method?: string;
  basis?: string;
  rate?: string;
  duration_years?: string;
  start_date?: string;
}

type LinearInput = 'rate' | 'duration';

export function PositionForm({ mode, position, onSubmit, onCancel, loading }: PositionFormProps) {
  const [name, setName] = useState('');
  const [method, setMethod] = useState<'linear' | 'degressiv'>('linear');
  const [basisStr, setBasisStr] = useState('');
  const [rateStr, setRateStr] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [startDate, setStartDate] = useState('');
  const [linearInput, setLinearInput] = useState<LinearInput>('rate');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (mode === 'edit' && position) {
      setName(position.name);
      setMethod(position.method);
      setBasisStr(formatCurrency(position.basis));
      setRateStr(String((position.rate * 100).toFixed(2)).replace('.', ','));
      setStartDate(position.start_date);
      if (position.duration_years) {
        setDurationStr(String(position.duration_years));
        setLinearInput('duration');
      } else {
        setLinearInput('rate');
      }
    }
  }, [mode, position]);

  function validate(): FormErrors {
    const errs: FormErrors = {};

    if (!name.trim()) {
      errs.name = 'Positionsname ist erforderlich';
    } else if (name.trim().length > 100) {
      errs.name = 'Positionsname darf maximal 100 Zeichen lang sein';
    }

    const basisCents = parseCurrencyInput(basisStr);
    if (basisCents === null || basisCents <= 0) {
      errs.basis = 'Bemessungsgrundlage muss größer als 0 sein';
    }

    if (!startDate) {
      errs.start_date = 'Startdatum ist erforderlich';
    }

    if (method === 'degressiv' || (method === 'linear' && linearInput === 'rate')) {
      const rateVal = parseFloat(rateStr.replace(',', '.'));
      if (isNaN(rateVal) || rateVal <= 0 || rateVal > 100) {
        errs.rate = 'AfA-Satz muss zwischen 0,01% und 100% liegen';
      }
    }

    if (method === 'linear' && linearInput === 'duration') {
      const dur = parseInt(durationStr, 10);
      if (isNaN(dur) || dur < 1 || dur > 100) {
        errs.duration_years = 'Nutzungsdauer muss zwischen 1 und 100 Jahren liegen';
      }
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const basisCents = parseCurrencyInput(basisStr)!;
    const data: CreatePositionInput = {
      name: name.trim(),
      method,
      basis: basisCents,
      start_date: startDate,
    };

    if (method === 'degressiv' || (method === 'linear' && linearInput === 'rate')) {
      data.rate = parseFloat(rateStr.replace(',', '.')) / 100;
    }

    if (method === 'linear' && linearInput === 'duration') {
      data.duration_years = parseInt(durationStr, 10);
    }

    await onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Positionsname"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="z.B. Gebäude, Einbauküche"
        error={errors.name}
        required
      />

      <div>
        <label htmlFor="method-select" className="block text-sm font-medium text-gray-700 mb-1">
          Abschreibungsmethode<span className="text-red-500 ml-1">*</span>
        </label>
        <select
          id="method-select"
          value={method}
          onChange={(e) => setMethod(e.target.value as 'linear' | 'degressiv')}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="linear">Linear</option>
          <option value="degressiv">Degressiv</option>
        </select>
        {errors.method && (
          <p className="mt-1 text-sm text-red-600" role="alert">{errors.method}</p>
        )}
      </div>

      <Input
        label="Bemessungsgrundlage (EUR)"
        value={basisStr}
        onChange={(e) => setBasisStr(e.target.value)}
        placeholder="z.B. 250.000,00"
        error={errors.basis}
        required
      />

      {method === 'linear' && (
        <div className="space-y-3">
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              AfA-Berechnung über
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="linearInput"
                  value="rate"
                  checked={linearInput === 'rate'}
                  onChange={() => setLinearInput('rate')}
                  className="text-primary-600 focus:ring-primary-500"
                />
                AfA-Satz (%)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="linearInput"
                  value="duration"
                  checked={linearInput === 'duration'}
                  onChange={() => setLinearInput('duration')}
                  className="text-primary-600 focus:ring-primary-500"
                />
                Nutzungsdauer (Jahre)
              </label>
            </div>
          </fieldset>

          {linearInput === 'rate' && (
            <Input
              label="AfA-Satz (%)"
              value={rateStr}
              onChange={(e) => setRateStr(e.target.value)}
              placeholder="z.B. 2,00"
              error={errors.rate}
              required
            />
          )}

          {linearInput === 'duration' && (
            <Input
              label="Nutzungsdauer (Jahre)"
              type="number"
              min={1}
              max={100}
              value={durationStr}
              onChange={(e) => setDurationStr(e.target.value)}
              placeholder="z.B. 50"
              error={errors.duration_years}
              required
            />
          )}
        </div>
      )}

      {method === 'degressiv' && (
        <Input
          label="AfA-Satz (%)"
          value={rateStr}
          onChange={(e) => setRateStr(e.target.value)}
          placeholder="z.B. 5,00"
          error={errors.rate}
          required
        />
      )}

      <Input
        label="Startdatum"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        error={errors.start_date}
        required
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Speichern...' : mode === 'create' ? 'Anlegen' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}
