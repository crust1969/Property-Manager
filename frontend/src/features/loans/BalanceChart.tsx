import { formatCurrency, formatDate } from '../../shared/utils/formatting';
import { Card } from '../../shared/components';
import type { BalanceEntry } from './types';

interface BalanceChartProps {
  entries: BalanceEntry[];
  currentBalance: number; // in cents
}

export function BalanceChart({ entries, currentBalance }: BalanceChartProps) {
  return (
    <Card title="Restschuldverlauf">
      {/* Current balance prominently displayed */}
      <div className="mb-4 p-4 bg-primary-50 rounded-lg border border-primary-200">
        <p className="text-sm text-primary-600 font-medium">Aktuelle Restschuld</p>
        <p className="text-2xl font-bold text-primary-900">
          {formatCurrency(currentBalance)} €
        </p>
      </div>

      {/* Balance history table */}
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Restschuld</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-700">{formatDate(entry.payment_date)}</td>
                  <td className="py-2 px-3 text-right font-medium text-gray-900">
                    {formatCurrency(entry.remaining_balance)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-500 py-4">Noch keine Zahlungen erfasst</p>
      )}
    </Card>
  );
}
