import { useEffect } from 'react';
import type { Property } from '../../features/properties/types';

/**
 * Auto-selects the first (and only) property when only one property exists
 * and no property has been selected yet.
 * 
 * @param properties - List of loaded properties
 * @param currentPropertyId - Currently selected property ID in the form
 * @param setPropertyId - Setter to update the form's property_id
 */
export function useAutoSelectProperty(
  properties: Property[],
  currentPropertyId: string,
  setPropertyId: (id: string) => void
): void {
  useEffect(() => {
    if (properties.length === 1 && !currentPropertyId) {
      setPropertyId(properties[0].id);
    }
  }, [properties, currentPropertyId, setPropertyId]);
}
