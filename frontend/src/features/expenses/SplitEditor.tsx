import { useMemo } from 'react';
import { Button, Input } from '../../shared/components';
import { parseCurrencyInput, formatCurrency } from '../../shared/utils/formatting';
import type { SplitRow, Category } from './types';

interface SplitEditorProps {
  splits: SplitRow[];
  onChange: (splits: SplitRow[]) => void;
  totalAmountStr: string;
  categories: Category[];
  error?: string;
}

const MIN_SPLITS = 2;
const MAX_SPLITS = 20;

const EMPTY_SPLIT: SplitRow = {
  amount: '',
  category_id: '',
  is_allocable: false,
  is_tax_deductible: false,
  requires_capitalization: false,
  is_financing_related: false,
};

export function SplitEditor({ splits, onChange, totalAmountStr, categories, error }: SplitEditorProps) {
  const totalAmountCents = parseCurrencyInput(totalAmountStr) ?? 0;

  const splitSumCents = useMemo(() => {
    return splits.reduce((sum, s) => sum + (parseCurrencyInput(s.amount) ?? 0), 0);
  }, [splits]);

  const difference = splitSumCents - totalAmountCents;
  const isValid = difference === 0 && splits.length >= MIN_SPLITS;

  function handleSplitChange(index: number, field: keyof SplitRow, value: unknown) {
    const updated = [...splits];
    updated[index] = { ...updated[index], [field]: value };

    // When category changes, inherit flags
    if (field === 'category_id' && typeof value === 'string') {
      const cat = categories.find((c) => c.id === value);
      if (cat) {
        updated[index] = {
          ...updated[index],
          category_id: value,
          is_allocable: cat.is_allocable,
          is_tax_deductible: cat.is_tax_deductible,
          requires_capitalization: cat.requires_capitalization,
          is_financing_related: cat.is_financing_related,
        };
      }
    }

    onChange(updated);
  }

  function addSplit() {
    if (splits.length >= MAX_SPLITS) return;
    onChange([...splits, { ...EMPTY_SPLIT }]);
  }

  function removeSplit(index: number) {
    if (splits.length <= MIN_SPLITS) return;
    onChange(splits.filter((_, i) => i !== index));
  }

  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.is_active);

  return (
    <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Teilbuchungen</h3>
        <div className="text-sm text-gray-600">
          Summe: <span className={difference === 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {formatCurrency(splitSumCents)} €
          </span>
          {' / '}
          Gesamt: {formatCurrency(totalAmountCents)} €
        </div>
      </div>

      {difference !== 0 && totalAmountCents > 0 && (
        <div className="bg-red-50 text-red-700 p-2 rounded text-sm" role="alert">
          Differenz: {formatCurrency(Math.abs(difference))} € {difference > 0 ? '(zu viel)' : '(zu wenig)'}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-2 rounded text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {splits.map((split, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Teilbuchung {index + 1}</span>
              {splits.length > MIN_SPLITS && (
                <button
                  type="button"
                  onClick={() => removeSplit(index)}
                  className="text-red-500 hover:text-red-700 text-xs"
                  aria-label={`Teilbuchung ${index + 1} entfernen`}
                >
                  Entfernen
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Betrag (€)"
                value={split.amount}
                onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                placeholder="z.B. 100,00"
                inputMode="decimal"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategorie
                </label>
                <select
                  value={split.category_id}
                  onChange={(e) => handleSplitChange(index, 'category_id', e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  aria-label={`Kategorie für Teilbuchung ${index + 1}`}
                >
                  <option value="">— Kategorie wählen —</option>
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={split.is_allocable}
                  onChange={(e) => handleSplitChange(index, 'is_allocable', e.target.checked)}
                  className="rounded border-gray-300"
                />
                Umlagefähig
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={split.is_tax_deductible}
                  onChange={(e) => handleSplitChange(index, 'is_tax_deductible', e.target.checked)}
                  className="rounded border-gray-300"
                />
                Steuerlich abziehbar
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={split.requires_capitalization}
                  onChange={(e) => handleSplitChange(index, 'requires_capitalization', e.target.checked)}
                  className="rounded border-gray-300"
                />
                Aktivierungspflichtig
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={split.is_financing_related}
                  onChange={(e) => handleSplitChange(index, 'is_financing_related', e.target.checked)}
                  className="rounded border-gray-300"
                />
                Finanzierungsbezogen
              </label>
            </div>
          </div>
        ))}
      </div>

      {splits.length < MAX_SPLITS && (
        <Button type="button" variant="secondary" size="sm" onClick={addSplit}>
          + Teilbuchung hinzufügen
        </Button>
      )}

      {!isValid && splits.length >= MIN_SPLITS && totalAmountCents > 0 && difference !== 0 && (
        <p className="text-xs text-red-600">
          Die Summe der Teilbeträge muss dem Gesamtbetrag entsprechen.
        </p>
      )}
    </div>
  );
}
