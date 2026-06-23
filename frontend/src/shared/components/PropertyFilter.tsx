import type { Property } from '../../features/properties/types';

interface PropertyFilterProps {
  /** ID for the select element (accessibility) */
  id?: string;
  /** Label text displayed above the dropdown */
  label?: string;
  /** Currently selected property ID (empty = all) */
  value: string;
  /** Callback when selection changes */
  onChange: (propertyId: string) => void;
  /** List of available properties */
  properties: Property[];
  /** Additional CSS classes for the wrapper div */
  className?: string;
}

/**
 * Reusable Objektfilter dropdown component.
 * Default option is "Alle Objekte" (empty string value).
 */
export function PropertyFilter({
  id = 'property-filter',
  label = 'Objekt',
  value,
  onChange,
  properties,
  className = '',
}: PropertyFilterProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-gray-500 mb-1"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">Alle Objekte</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
