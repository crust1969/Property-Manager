interface KpiCardProps {
  /** Title displayed above the value */
  title: string;
  /** Formatted value string (e.g. "1.234,56 €") */
  value: string;
  /** Optional subtitle shown below the value */
  subtitle?: string;
  /** Color indicator: green for positive, red for negative, neutral for default */
  color?: 'green' | 'red' | 'neutral';
}

export function KpiCard({ title, value, subtitle, color = 'neutral' }: KpiCardProps) {
  const borderColor =
    color === 'green'
      ? 'border-l-green-500'
      : color === 'red'
        ? 'border-l-red-500'
        : 'border-l-gray-300';

  const valueColor =
    color === 'green'
      ? 'text-green-700'
      : color === 'red'
        ? 'text-red-700'
        : 'text-gray-900';

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${borderColor} p-4 shadow-sm`}
      role="region"
      aria-label={title}
    >
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
