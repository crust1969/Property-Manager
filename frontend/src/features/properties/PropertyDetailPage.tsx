import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card } from '../../shared/components';
import { fetchProperty } from './api';
import { AcquisitionForm } from './AcquisitionForm';
import type { Property } from './types';

export function PropertyDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadProperty(id);
  }, [id]);

  async function loadProperty(propertyId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProperty(propertyId);
      setProperty(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t.common.laden}</p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error || 'Objekt nicht gefunden'}
        </div>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate('/objekte')}>
          ← {t.common.zurueck}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/objekte')}>
            ← {t.common.zurueck}
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{property.name}</h1>
        </div>
        <Button onClick={() => navigate(`/objekte/${property.id}/bearbeiten`)}>
          {t.common.bearbeiten}
        </Button>
      </div>

      {/* Stammdaten */}
      <Card title="Stammdaten">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-500">{t.objekte.bezeichnung}</dt>
            <dd className="text-gray-900">{property.name}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t.objekte.objekttyp}</dt>
            <dd className="text-gray-900">{property.property_type}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t.objekte.strasse}</dt>
            <dd className="text-gray-900">{property.street}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t.objekte.wohnflaeche}</dt>
            <dd className="text-gray-900">{property.living_area_sqm.toLocaleString('de-DE')} m²</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t.objekte.plz} / {t.objekte.ort}</dt>
            <dd className="text-gray-900">{property.zip_code} {property.city}</dd>
          </div>
        </dl>
      </Card>

      {/* Anschaffungsdaten */}
      {id && <AcquisitionForm propertyId={id} />}
    </div>
  );
}
