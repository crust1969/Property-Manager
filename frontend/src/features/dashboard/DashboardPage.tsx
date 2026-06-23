import { useState, useEffect } from 'react';
import { t } from '../../i18n/de';
import { formatCurrency } from '../../shared/utils/formatting';
import { usePropertyFilter } from '../../shared/hooks';
import { PropertyFilter } from '../../shared/components';
import { fetchDashboard } from './api';
import { KpiCard } from './KpiCard';
import type { DashboardKPIs } from './types';

export function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { properties, selectedPropertyId, setSelectedPropertyId } = usePropertyFilter();

  useEffect(() => {
    loadDashboard();
  }, [selectedPropertyId]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboard(selectedPropertyId || undefined);
      setKpis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Dashboards');
    } finally {
      setLoading(false);
    }
  }

  const cashflowColor = (kpis?.cashflow_ytd ?? 0) >= 0 ? 'green' : 'red';

  return (
    <div className="p-6 space-y-6">
      {/* Header with filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.nav.dashboard}</h1>
        <PropertyFilter
          id="dashboard-property-filter"
          value={selectedPropertyId}
          onChange={setSelectedPropertyId}
          properties={properties}
          className="max-w-xs w-64"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <p className="text-gray-500">{t.common.laden}</p>
      )}

      {/* KPI Cards */}
      {!loading && kpis && (
        <>
          <section aria-label="Kennzahlen">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title={t.dashboard.mieteingaengeOffen}
                value={`${formatCurrency(kpis.mieteingaenge.offen_summe)} €`}
                subtitle={`${kpis.mieteingaenge.offen_anzahl} offen`}
              />
              <KpiCard
                title={t.dashboard.mieteingaengeBezahlt}
                value={`${formatCurrency(kpis.mieteingaenge.bezahlt_summe)} €`}
                subtitle={`${kpis.mieteingaenge.bezahlt_anzahl} bezahlt`}
                color="green"
              />
              <KpiCard
                title={t.dashboard.einnahmenYTD}
                value={`${formatCurrency(kpis.einnahmen_ytd)} €`}
                color="green"
              />
              <KpiCard
                title={t.dashboard.ausgabenYTD}
                value={`${formatCurrency(kpis.ausgaben_ytd)} €`}
                color="red"
              />
              <KpiCard
                title={t.dashboard.werbungskostenYTD}
                value={`${formatCurrency(kpis.werbungskosten_ytd)} €`}
              />
              <KpiCard
                title={t.dashboard.afaYTD}
                value={`${formatCurrency(kpis.afa_ytd)} €`}
              />
              <KpiCard
                title={t.dashboard.zinsenYTD}
                value={`${formatCurrency(kpis.zinsen_ytd)} €`}
              />
              <KpiCard
                title={t.dashboard.cashflowYTD}
                value={`${formatCurrency(kpis.cashflow_ytd)} €`}
                color={cashflowColor}
              />
            </div>
          </section>

          {/* Handlungsbedarf */}
          <section aria-label="Handlungsbedarf">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              {t.dashboard.handlungsbedarf}
            </h2>
            {kpis.handlungsbedarf.offene_erinnerungen === 0 &&
             kpis.handlungsbedarf.fehlende_belege === 0 &&
             kpis.handlungsbedarf.ungeklaerte_buchungen === 0 ? (
              <p className="text-gray-500 text-sm">Keine offenen Punkte</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <HandlungsbedarfCard
                  title={t.dashboard.offeneErinnerungen}
                  count={kpis.handlungsbedarf.offene_erinnerungen}
                />
                <HandlungsbedarfCard
                  title={t.dashboard.fehlendesBelege}
                  count={kpis.handlungsbedarf.fehlende_belege}
                />
                <HandlungsbedarfCard
                  title={t.dashboard.ungeklaerteBuchungen}
                  count={kpis.handlungsbedarf.ungeklaerte_buchungen}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function HandlungsbedarfCard({ title, count }: { title: string; count: number }) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
      role="region"
      aria-label={title}
    >
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
        {count}
      </p>
    </div>
  );
}
