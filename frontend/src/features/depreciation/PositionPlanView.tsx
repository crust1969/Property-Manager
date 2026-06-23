import { Card, Table, Button, type Column } from '../../shared/components';
import { formatCurrency } from '../../shared/utils/formatting';
import type { AfaPosition, AfaPlanEntry } from './types';

interface PositionPlanViewProps {
  position: AfaPosition;
  plan: AfaPlanEntry[];
  onBack: () => void;
  loading?: boolean;
}

export function PositionPlanView({ position, plan, onBack, loading }: PositionPlanViewProps) {
  const columns: Column<AfaPlanEntry>[] = [
    {
      key: 'year',
      header: 'Jahr',
      className: 'w-20',
      render: (entry) => String(entry.year),
    },
    {
      key: 'annualAmount',
      header: 'Jahresbetrag (EUR)',
      className: 'w-36 text-right',
      render: (entry) => `${formatCurrency(entry.annualAmount)} €`,
    },
    {
      key: 'cumulativeAmount',
      header: 'Kumuliert (EUR)',
      className: 'w-36 text-right',
      render: (entry) => `${formatCurrency(entry.cumulativeAmount)} €`,
    },
    {
      key: 'residualValue',
      header: 'Restwert (EUR)',
      className: 'w-36 text-right',
      render: (entry) => `${formatCurrency(entry.residualValue)} €`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Zurück
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">
          {position.name}
        </h2>
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            position.method === 'linear'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-purple-100 text-purple-800'
          }`}
        >
          {position.method === 'linear' ? 'Linear' : 'Degressiv'}
        </span>
      </div>

      <Card title="AfA-Plan">
        {loading ? (
          <p className="text-gray-500 text-sm">Lade AfA-Plan...</p>
        ) : (
          <Table
            columns={columns}
            data={plan}
            keyExtractor={(entry) => String(entry.year)}
            emptyMessage="Kein AfA-Plan verfügbar."
          />
        )}
      </Card>
    </div>
  );
}
