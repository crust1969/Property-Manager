import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../shared/components';
import { formatCurrency, parseCurrencyInput, formatNumber } from '../../shared/utils/formatting';
import { usePropertyFilter } from '../../shared/hooks';
import { api } from '../../shared/api/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SimulationYearEntry {
  year: number;
  rentalIncome: number;
  depreciation: number;
  loanInterest: number;
  nonAllocableCosts: number;
  taxDeductibleTotal: number;
  taxableResult: number;
  taxEffect: number;
  annuity: number;
  cashflow: number;
}

interface SimulationResult {
  input: {
    propertyId: string;
    taxRate: number;
    annualNonAllocableCosts: number;
    years: number;
  };
  entries: SimulationYearEntry[];
  totalCashflow: number;
  totalTaxEffect: number;
}

interface ProfitabilityScenario {
  appreciationRate: number;
  estimatedSalePrice: number;
  remainingLoanBalance: number;
  equityAtSale: number;
  totalProfit: number;
  eigenkapitalRendite: number;
  roi: number;
  annualizedReturn: number;
}

interface ProfitabilityResult {
  input: {
    propertyId: string;
    equityInvested: number;
    purchasePrice: number;
    annualAppreciationRates: number[];
    years: number;
    totalCashflow: number;
    remainingLoanBalance: number;
  };
  scenarios: ProfitabilityScenario[];
  formulas: {
    salePrice: string;
    equityAtSale: string;
    totalProfit: string;
    eigenkapitalRendite: string;
    roi: string;
    annualizedReturn: string;
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SimulationPage() {
  const { properties, selectedPropertyId, setSelectedPropertyId } = usePropertyFilter();
  const [taxRateInput, setTaxRateInput] = useState('44');
  const [nonAllocableCostsInput, setNonAllocableCostsInput] = useState('3.600,00');
  const [yearsInput, setYearsInput] = useState('10');
  const [rentIncreaseInput, setRentIncreaseInput] = useState('3');
  const [rentIncreaseEveryInput, setRentIncreaseEveryInput] = useState('3');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profitability state
  const [equityInput, setEquityInput] = useState('60.000,00');
  const [purchasePriceInput, setPurchasePriceInput] = useState('');
  const [appreciationRows, setAppreciationRows] = useState<string[]>(['10', '20', '30', '40', '50']);
  const [profitabilityResult, setProfitabilityResult] = useState<ProfitabilityResult | null>(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [profitabilityError, setProfitabilityError] = useState<string | null>(null);
  const [showFormulas, setShowFormulas] = useState(false);

  async function handleCalculate() {
    setError(null);
    setResult(null);
    setProfitabilityResult(null);

    if (!selectedPropertyId) {
      setError('Bitte wählen Sie ein Objekt aus.');
      return;
    }

    const taxRate = parseFloat(taxRateInput.replace(',', '.'));
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      setError('Bitte geben Sie einen gültigen Steuersatz zwischen 0 und 100 ein.');
      return;
    }

    const nonAllocableCosts = parseCurrencyInput(nonAllocableCostsInput);
    if (nonAllocableCosts === null || nonAllocableCosts < 0) {
      setError('Bitte geben Sie gültige nicht umlagefähige Nebenkosten ein.');
      return;
    }

    const years = parseInt(yearsInput, 10);
    if (isNaN(years) || years < 1 || years > 30) {
      setError('Bitte geben Sie einen Zeitraum zwischen 1 und 30 Jahren ein.');
      return;
    }

    const rentIncrease = parseFloat(rentIncreaseInput.replace(',', '.'));
    const rentIncreaseEvery = parseInt(rentIncreaseEveryInput, 10);

    setLoading(true);
    try {
      const data = await api.post<SimulationResult>('/reports/simulation', {
        propertyId: selectedPropertyId,
        taxRate: taxRate / 100,
        annualNonAllocableCosts: nonAllocableCosts,
        years,
        rentIncreasePercent: (!isNaN(rentIncrease) && rentIncrease > 0) ? rentIncrease / 100 : 0,
        rentIncreaseEveryYears: (!isNaN(rentIncreaseEvery) && rentIncreaseEvery > 0) ? rentIncreaseEvery : 0,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Simulation');
    } finally {
      setLoading(false);
    }
  }

  function handleAddAppreciationRow() {
    setAppreciationRows([...appreciationRows, '']);
  }

  function handleRemoveAppreciationRow(index: number) {
    setAppreciationRows(appreciationRows.filter((_, i) => i !== index));
  }

  function handleAppreciationChange(index: number, value: string) {
    const updated = [...appreciationRows];
    updated[index] = value;
    setAppreciationRows(updated);
  }

  async function handleCalculateProfitability() {
    setProfitabilityError(null);
    setProfitabilityResult(null);

    if (!result || !selectedPropertyId) return;

    const equity = parseCurrencyInput(equityInput);
    if (equity === null || equity <= 0) {
      setProfitabilityError('Bitte geben Sie ein gültiges Eigenkapital ein.');
      return;
    }

    const purchasePrice = parseCurrencyInput(purchasePriceInput);
    if (purchasePrice === null || purchasePrice <= 0) {
      setProfitabilityError('Bitte geben Sie einen gültigen Kaufpreis ein.');
      return;
    }

    const rates: number[] = [];
    for (const row of appreciationRows) {
      const val = parseFloat(row.replace(',', '.'));
      if (isNaN(val) || val < -100 || val > 100) {
        setProfitabilityError('Bitte geben Sie gültige Wertsteigerungsraten ein (0-100%).');
        return;
      }
      rates.push(val / 100);
    }

    if (rates.length === 0) {
      setProfitabilityError('Bitte fügen Sie mindestens eine Wertsteigerungsrate hinzu.');
      return;
    }

    // Calculate remaining loan balance from the simulation data
    // Total annuity - total interest = total repayment over simulation period
    const totalAnnuity = result.entries.reduce((s, e) => s + e.annuity, 0);
    const totalInterest = result.entries.reduce((s, e) => s + e.loanInterest, 0);
    const totalRepayment = totalAnnuity - totalInterest;
    // Remaining loan balance = purchase price - equity - total repayment
    // More accurate: total loan = purchase price - equity, remaining = loan - repayment
    const totalLoan = purchasePrice - equity;
    const remainingLoanBalance = Math.max(0, totalLoan - totalRepayment);

    setProfitabilityLoading(true);
    try {
      const data = await api.post<ProfitabilityResult>('/reports/profitability', {
        propertyId: selectedPropertyId,
        equityInvested: equity,
        purchasePrice,
        annualAppreciationRates: rates,
        years: result.input.years,
        totalCashflow: result.totalCashflow,
        remainingLoanBalance,
      });
      setProfitabilityResult(data);
    } catch (err) {
      setProfitabilityError(err instanceof Error ? err.message : 'Fehler bei der Rentabilitätsberechnung');
    } finally {
      setProfitabilityLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cashflow-Simulation</h1>
        <div className="flex items-center gap-3 print:hidden">
          {result && (
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              📄 Als PDF drucken
            </button>
          )}
          <Link
            to="/berichte"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Zurück zu Berichte
          </Link>
        </div>
      </div>

      {/* Input form */}
      <Card title="Simulationsparameter">
        <div className="print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Property */}
          <div>
            <label htmlFor="sim-property" className="block text-sm font-medium text-gray-700 mb-1">
              Objekt
            </label>
            <select
              id="sim-property"
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">— Bitte wählen —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tax rate */}
          <div>
            <label htmlFor="sim-tax-rate" className="block text-sm font-medium text-gray-700 mb-1">
              Steuersatz (%)
            </label>
            <input
              id="sim-tax-rate"
              type="text"
              value={taxRateInput}
              onChange={(e) => setTaxRateInput(e.target.value)}
              placeholder="44"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Non-allocable costs */}
          <div>
            <label htmlFor="sim-nk" className="block text-sm font-medium text-gray-700 mb-1">
              Jährl. nicht umlagefähige NK (EUR)
            </label>
            <input
              id="sim-nk"
              type="text"
              value={nonAllocableCostsInput}
              onChange={(e) => setNonAllocableCostsInput(e.target.value)}
              placeholder="3.600,00"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Years */}
          <div>
            <label htmlFor="sim-years" className="block text-sm font-medium text-gray-700 mb-1">
              Simulationszeitraum (Jahre)
            </label>
            <input
              id="sim-years"
              type="text"
              value={yearsInput}
              onChange={(e) => setYearsInput(e.target.value)}
              placeholder="10"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Mietanpassung */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="sim-rent-increase" className="block text-sm font-medium text-gray-700 mb-1">
              Mietanpassung (%)
            </label>
            <input
              id="sim-rent-increase"
              type="text"
              value={rentIncreaseInput}
              onChange={(e) => setRentIncreaseInput(e.target.value)}
              placeholder="3"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Erhöhung der Miete in %</p>
          </div>
          <div>
            <label htmlFor="sim-rent-increase-every" className="block text-sm font-medium text-gray-700 mb-1">
              Mietanpassung alle ... Jahre
            </label>
            <input
              id="sim-rent-increase-every"
              type="text"
              value={rentIncreaseEveryInput}
              onChange={(e) => setRentIncreaseEveryInput(e.target.value)}
              placeholder="3"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">0 = keine Anpassung</p>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Berechnung läuft...' : 'Simulation berechnen'}
          </button>
        </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Print-only: Parameter summary for PDF */}
          <div className="hidden print:block border border-gray-200 rounded-md p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-2">Simulationsparameter</h2>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-700">
              <div><span className="font-medium">Steuersatz:</span> {taxRateInput} %</div>
              <div><span className="font-medium">Nicht umlagefähige NK:</span> {nonAllocableCostsInput} € p.a.</div>
              <div><span className="font-medium">Zeitraum:</span> {yearsInput} Jahre</div>
              <div><span className="font-medium">Mietanpassung:</span> {rentIncreaseInput} % alle {rentIncreaseEveryInput} Jahre</div>
              {equityInput && <div><span className="font-medium">Eigenkapital:</span> {equityInput} €</div>}
              {purchasePriceInput && <div><span className="font-medium">Kaufpreis:</span> {purchasePriceInput} €</div>}
            </div>
          </div>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              label="Gesamt-Cashflow"
              sublabel={`über ${result.input.years} Jahre`}
              value={result.totalCashflow}
            />
            <SummaryCard
              label="Gesamte Steuerersparnis"
              sublabel={`über ${result.input.years} Jahre`}
              value={result.totalTaxEffect}
            />
            <SummaryCard
              label="Ø Jährlicher Cashflow"
              sublabel="pro Jahr"
              value={Math.round(result.totalCashflow / result.input.years)}
            />
          </div>

          {/* Results table */}
          <Card title="Simulation — Jahresübersicht">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 px-2 font-medium text-gray-700">Jahr</th>
                    <th className="py-2 px-2 font-medium text-gray-700 text-right">Mieteinnahmen</th>
                    <th className="py-2 px-2 font-medium text-gray-700 text-right">AfA</th>
                    <th className="py-2 px-2 font-medium text-gray-700 text-right">Zinsen</th>
                    <th className="py-2 px-2 font-medium text-gray-700 text-right">NK (n.u.)</th>
                    <th className="py-2 px-2 font-medium text-gray-700 text-right">Absetzbar</th>
                    <th className="py-2 px-2 font-medium text-gray-700 text-right">Steuereffekt</th>
                    <th className="py-2 px-2 font-medium text-gray-700 text-right">Annuität</th>
                    <th className="py-2 px-2 font-medium text-gray-700 text-right">Cashflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.entries.map((entry) => (
                    <tr key={entry.year} className="hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium">{entry.year}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(entry.rentalIncome)} €</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(entry.depreciation)} €</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(entry.loanInterest)} €</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(entry.nonAllocableCosts)} €</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(entry.taxDeductibleTotal)} €</td>
                      <td className={`py-2 px-2 text-right font-medium ${entry.taxEffect >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(entry.taxEffect)} €
                      </td>
                      <td className="py-2 px-2 text-right">{formatCurrency(entry.annuity)} €</td>
                      <td className={`py-2 px-2 text-right font-bold ${entry.cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(entry.cashflow)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
                    <td className="py-2 px-2">Summe</td>
                    <td className="py-2 px-2 text-right">
                      {formatCurrency(result.entries.reduce((s, e) => s + e.rentalIncome, 0))} €
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatCurrency(result.entries.reduce((s, e) => s + e.depreciation, 0))} €
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatCurrency(result.entries.reduce((s, e) => s + e.loanInterest, 0))} €
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatCurrency(result.entries.reduce((s, e) => s + e.nonAllocableCosts, 0))} €
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatCurrency(result.entries.reduce((s, e) => s + e.taxDeductibleTotal, 0))} €
                    </td>
                    <td className={`py-2 px-2 text-right ${result.totalTaxEffect >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(result.totalTaxEffect)} €
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatCurrency(result.entries.reduce((s, e) => s + e.annuity, 0))} €
                    </td>
                    <td className={`py-2 px-2 text-right ${result.totalCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(result.totalCashflow)} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Rentabilitätsanalyse */}
          <Card title="Rentabilitätsanalyse">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prof-equity" className="block text-sm font-medium text-gray-700 mb-1">
                    Eigenkapital (EUR)
                  </label>
                  <input
                    id="prof-equity"
                    type="text"
                    value={equityInput}
                    onChange={(e) => setEquityInput(e.target.value)}
                    placeholder="60.000,00"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prof-purchase-price" className="block text-sm font-medium text-gray-700 mb-1">
                    Kaufpreis (EUR)
                  </label>
                  <input
                    id="prof-purchase-price"
                    type="text"
                    value={purchasePriceInput}
                    onChange={(e) => setPurchasePriceInput(e.target.value)}
                    placeholder="250.000,00"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Appreciation rows */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Wertsteigerung nach {result?.input.years || 10} Jahren (% gesamt)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Verschiedene Szenarien: z.B. 20% = Kaufpreis steigt um 20% über den gesamten Zeitraum
                </p>
                <div className="space-y-2">
                  {appreciationRows.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row}
                        onChange={(e) => handleAppreciationChange(index, e.target.value)}
                        placeholder="3"
                        className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        aria-label={`Wertsteigerung Szenario ${index + 1}`}
                      />
                      <span className="text-sm text-gray-500">%</span>
                      {appreciationRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAppreciationRow(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          aria-label={`Szenario ${index + 1} entfernen`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddAppreciationRow}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  + Szenario hinzufügen
                </button>
              </div>

              <div>
                <button
                  onClick={handleCalculateProfitability}
                  disabled={profitabilityLoading}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {profitabilityLoading ? 'Berechnung läuft...' : 'Rentabilität berechnen'}
                </button>
              </div>
            </div>
          </Card>

          {/* Profitability error */}
          {profitabilityError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
              {profitabilityError}
            </div>
          )}

          {/* Profitability results */}
          {profitabilityResult && (
            <>
              <Card title="Ergebnis — Rentabilitätsanalyse">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 px-2 font-medium text-gray-700">Wertsteigerung gesamt</th>
                        <th className="py-2 px-2 font-medium text-gray-700 text-right">Verkaufspreis</th>
                        <th className="py-2 px-2 font-medium text-gray-700 text-right">Restschuld</th>
                        <th className="py-2 px-2 font-medium text-gray-700 text-right">EK bei Verkauf</th>
                        <th className="py-2 px-2 font-medium text-gray-700 text-right">Gesamtgewinn</th>
                        <th className="py-2 px-2 font-medium text-gray-700 text-right">EK-Rendite</th>
                        <th className="py-2 px-2 font-medium text-gray-700 text-right">ROI</th>
                        <th className="py-2 px-2 font-medium text-gray-700 text-right">Rendite p.a.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {profitabilityResult.scenarios.map((scenario) => (
                        <tr key={scenario.appreciationRate} className="hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium">
                            {formatNumber(scenario.appreciationRate * 100, 1)} %
                          </td>
                          <td className="py-2 px-2 text-right">
                            {formatCurrency(scenario.estimatedSalePrice)} €
                          </td>
                          <td className="py-2 px-2 text-right">
                            {formatCurrency(scenario.remainingLoanBalance)} €
                          </td>
                          <td className={`py-2 px-2 text-right ${scenario.equityAtSale >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(scenario.equityAtSale)} €
                          </td>
                          <td className={`py-2 px-2 text-right font-bold ${scenario.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(scenario.totalProfit)} €
                          </td>
                          <td className={`py-2 px-2 text-right ${scenario.eigenkapitalRendite >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(scenario.eigenkapitalRendite, 2)} %
                          </td>
                          <td className={`py-2 px-2 text-right ${scenario.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(scenario.roi, 2)} %
                          </td>
                          <td className={`py-2 px-2 text-right ${scenario.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(scenario.annualizedReturn, 2)} %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Formulas section (collapsible) */}
              <Card title="Berechnungsformeln">
                <button
                  type="button"
                  onClick={() => setShowFormulas(!showFormulas)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  aria-expanded={showFormulas}
                >
                  {showFormulas ? '▼' : '▶'} Formeln {showFormulas ? 'ausblenden' : 'anzeigen'}
                </button>
                {showFormulas && (
                  <ul className="mt-3 space-y-2 text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-md">
                    <li>{profitabilityResult.formulas.salePrice}</li>
                    <li>{profitabilityResult.formulas.equityAtSale}</li>
                    <li>{profitabilityResult.formulas.totalProfit}</li>
                    <li>{profitabilityResult.formulas.eigenkapitalRendite}</li>
                    <li>{profitabilityResult.formulas.roi}</li>
                    <li>{profitabilityResult.formulas.annualizedReturn}</li>
                  </ul>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────────────────

function SummaryCard({ label, sublabel, value }: { label: string; sublabel: string; value: number }) {
  const isPositive = value >= 0;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xs text-gray-400">{sublabel}</p>
      <p className={`mt-1 text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {formatCurrency(value)} €
      </p>
    </div>
  );
}
