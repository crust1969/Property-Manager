import { useState, useEffect } from 'react';
import { fetchProperties } from '../../features/properties/api';
import type { Property } from '../../features/properties/types';

export interface UsePropertyFilterResult {
  /** List of all available properties for the current user */
  properties: Property[];
  /** Currently selected property ID, or empty string for "Alle Objekte" */
  selectedPropertyId: string;
  /** Set the selected property ID (empty string = all) */
  setSelectedPropertyId: (id: string) => void;
  /** Whether the properties are still loading */
  loading: boolean;
}

/**
 * Reusable hook for the Objektfilter (property filter) dropdown.
 * Auto-loads properties on mount and provides filter state.
 * Default: "" (Alle Objekte / all properties).
 */
export function usePropertyFilter(): UsePropertyFilterResult {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const props = await fetchProperties();
        if (!cancelled) {
          setProperties(props);
        }
      } catch {
        // Non-critical: filter won't work but page still loads
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return {
    properties,
    selectedPropertyId,
    setSelectedPropertyId,
    loading,
  };
}
