import { Card } from '../../shared/components';
import { formatCurrency } from '../../shared/utils/formatting';
import type { CombinedAfaOverview } from './types';

interface CombinedOverviewProps {
  overview: CombinedAfaOverview | null;
  loading?: boolean;
}

export function CombinedOverview({ overview, loading }: CombinedOverviewProps) {
  if (loading) {
    return (
      <Card title="Gesamt-Übersicht">
        <p className="text-gray-500 text-sm">Lade Übersicht...</p>
      </Card>
    );
  }

  if (!overview || overview.years.length === 0) {
    return (
      <Card title="Gesamt-Übersicht">
        <p className="text-center py-8 text-gray-500">
          Keine AfA-Daten vorhanden.
        </p>
      </Card>
    );
  }

  // Gather unique position names across all years for column headers
  const positionNames = new Map<string, string>();
  for (const year of overview.years) {
    for (const pos of year.positions) {
      if (!positionNames.has(pos.positionId)) {
        positionNames.set(pos.positionId, pos.name);
      }
    }
  }
  const positionColumns = Array.from(positionNames.entries());

  return (
    <Card title="Gesamt-Übersicht">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">Jahr</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-right">Gesamt-AfA</th>
              {positionColumns.map(([id, name]) => (
                <th key={id} className="px-4 py-3 font-medium text-gray-700 text-right">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {overview.years.map((yearEntry) => (
              <tr key={yearEntry.year}>
                <td className="px-4 py-3">{yearEntry.year}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(yearEntry.totalAmount)} €
                </td>
                {positionColumns.map(([posId]) => {
                  const posData = yearEntry.positions.find((p) => p.positionId === posId);
                  const amount = posData?.amount ?? 0;
                  return (
                    <td key={posId} className="px-4 py-3 text-right">
                      {amount > 0 ? `${formatCurrency(amount)} €` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
