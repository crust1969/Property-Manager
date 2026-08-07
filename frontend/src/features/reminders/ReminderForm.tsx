import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Input } from '../../shared/components';
import { useAutoSelectProperty } from '../../shared/hooks';
import { createReminder, updateReminder, fetchReminders } from './api';
import { fetchProperties } from '../properties/api';
import type { ReminderFormData, ValidationErrors, Reminder } from './types';
import type { Property } from '../properties/types';

interface ReminderFormProps {
  mode: 'create' | 'edit';
}

const defaultFormData: ReminderFormData = {
  title: '',
  due_date: '',
  priority: 'mittel',
  recurrence: 'einmalig',
  note: '',
  property_id: '',
  linked_entity_type: '',
  linked_entity_id: '',
};

export function ReminderForm({ mode }: ReminderFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<ReminderFormData>(defaultFormData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setPropertyId = useCallback((propId: string) => {
    setFormData(prev => ({ ...prev, property_id: propId }));
  }, []);

  useAutoSelectProperty(properties, formData.property_id, setPropertyId);

  useEffect(() => {
    loadProperties();
    if (mode === 'edit' && id) {
      loadReminder(id);
    }
  }, [mode, id]);

  async function loadProperties() {
    try {
      const props = await fetchProperties();
      setProperties(props);
    } catch {
      // Non-critical
    }
  }

  async function loadReminder(reminderId: string) {
    try {
      const reminders = await fetchReminders();
      const reminder = reminders.find((r: Reminder) => r.id === reminderId);
      if (reminder) {
        setFormData({
          title: reminder.title,
          due_date: reminder.due_date,
          priority: reminder.priority,
          recurrence: reminder.recurrence,
          note: reminder.note || '',
          property_id: reminder.property_id || '',
          linked_entity_type: reminder.linked_entity_type || '',
          linked_entity_id: reminder.linked_entity_id || '',
        });
      }
    } catch {
      setSubmitError('Fehler beim Laden der Erinnerung');
    }
  }

  function validate(): boolean {
    const newErrors: ValidationErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Titel ist ein Pflichtfeld';
    } else if (formData.title.trim().length > 100) {
      newErrors.title = 'Titel darf maximal 100 Zeichen lang sein';
    }

    if (!formData.due_date) {
      newErrors.due_date = 'Fälligkeitsdatum ist ein Pflichtfeld';
    } else if (mode === 'create') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(formData.due_date);
      selected.setHours(0, 0, 0, 0);
      if (selected < today) {
        newErrors.due_date = 'Fälligkeitsdatum darf nicht in der Vergangenheit liegen';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSubmitError(null);

    try {
      if (mode === 'create') {
        await createReminder(formData);
      } else if (id) {
        await updateReminder(id, formData);
      }
      navigate('/erinnerungen');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof ReminderFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/erinnerungen')}>
          ← {t.common.zurueck}
        </Button>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {mode === 'create' ? t.erinnerungen.neuAnlegen : 'Erinnerung bearbeiten'}
      </h1>

      {submitError && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4" role="alert">
          {submitError}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Titel */}
          <Input
            label={t.erinnerungen.titelFeld}
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            error={errors.title}
            required
            maxLength={100}
            placeholder="z.B. Nebenkostenabrechnung erstellen"
          />

          {/* Fälligkeitsdatum */}
          <Input
            label={t.erinnerungen.faelligkeitsdatum}
            type="date"
            value={formData.due_date}
            onChange={(e) => handleChange('due_date', e.target.value)}
            error={errors.due_date}
            required
          />

          {/* Priorität */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              {t.erinnerungen.prioritaet} <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="hoch">{t.erinnerungen.prioritaeten.hoch}</option>
              <option value="mittel">{t.erinnerungen.prioritaeten.mittel}</option>
              <option value="niedrig">{t.erinnerungen.prioritaeten.niedrig}</option>
            </select>
          </div>

          {/* Wiederholung */}
          <div>
            <label htmlFor="recurrence" className="block text-sm font-medium text-gray-700 mb-1">
              {t.erinnerungen.intervall}
            </label>
            <select
              id="recurrence"
              value={formData.recurrence}
              onChange={(e) => handleChange('recurrence', e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="einmalig">{t.erinnerungen.intervalle.einmalig}</option>
              <option value="täglich">{t.erinnerungen.intervalle.taeglich}</option>
              <option value="wöchentlich">{t.erinnerungen.intervalle.woechentlich}</option>
              <option value="monatlich">{t.erinnerungen.intervalle.monatlich}</option>
              <option value="jährlich">{t.erinnerungen.intervalle.jaehrlich}</option>
            </select>
          </div>

          {/* Notiz */}
          <div>
            <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
              {t.erinnerungen.notiz}
            </label>
            <textarea
              id="note"
              value={formData.note}
              onChange={(e) => handleChange('note', e.target.value)}
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400"
              placeholder="Optionale Notiz zur Erinnerung..."
            />
          </div>

          {/* Objekt-Verknüpfung */}
          <div>
            <label htmlFor="property_id" className="block text-sm font-medium text-gray-700 mb-1">
              Objekt (optional)
            </label>
            <select
              id="property_id"
              value={formData.property_id}
              onChange={(e) => handleChange('property_id', e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Kein Objekt</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Bezugsobjekt */}
          <div>
            <label htmlFor="linked_entity_type" className="block text-sm font-medium text-gray-700 mb-1">
              Bezugsobjekt (optional)
            </label>
            <select
              id="linked_entity_type"
              value={formData.linked_entity_type}
              onChange={(e) => {
                handleChange('linked_entity_type', e.target.value);
                handleChange('linked_entity_id', '');
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Kein Bezug</option>
              <option value="lease">Mietvertrag</option>
              <option value="loan">Darlehen</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" type="button" onClick={() => navigate('/erinnerungen')}>
              {t.common.abbrechen}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t.common.laden : t.common.speichern}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
