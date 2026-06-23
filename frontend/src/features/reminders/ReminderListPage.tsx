import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Table, PropertyFilter, type Column } from '../../shared/components';
import { formatDate } from '../../shared/utils/formatting';
import { usePropertyFilter } from '../../shared/hooks';
import { fetchReminders, completeReminder, postponeReminder } from './api';
import { PostponeDialog } from './PostponeDialog';
import type { Reminder, ReminderFilters, ReminderPriority } from './types';

const PRIORITY_ORDER: Record<ReminderPriority, number> = {
  hoch: 0,
  mittel: 1,
  niedrig: 2,
};

function isOverdue(dueDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

export function ReminderListPage() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const { properties, selectedPropertyId: filterPropertyId, setSelectedPropertyId: setFilterPropertyId } = usePropertyFilter();
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Postpone dialog state
  const [postponeId, setPostponeId] = useState<string | null>(null);
  const [postponeLoading, setPostponeLoading] = useState(false);

  useEffect(() => {
    loadReminders();
  }, [filterPropertyId, filterStatus]);

  async function loadReminders() {
    setLoading(true);
    setError(null);
    try {
      const filters: ReminderFilters = {};
      if (filterPropertyId) filters.propertyId = filterPropertyId;
      if (filterStatus) filters.status = filterStatus;

      const data = await fetchReminders(filters);
      setReminders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Erinnerungen');
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(id: string) {
    try {
      await completeReminder(id);
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Abschließen');
    }
  }

  async function handlePostpone(newDueDate: string) {
    if (!postponeId) return;
    setPostponeLoading(true);
    try {
      await postponeReminder(postponeId, newDueDate);
      setPostponeId(null);
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Verschieben');
    } finally {
      setPostponeLoading(false);
    }
  }

  // Sort: overdue first, then by priority, then by date
  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => {
      const aOverdue = isOverdue(a.due_date) && a.status === 'offen' ? 0 : 1;
      const bOverdue = isOverdue(b.due_date) && b.status === 'offen' ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;

      const aPriority = PRIORITY_ORDER[a.priority];
      const bPriority = PRIORITY_ORDER[b.priority];
      if (aPriority !== bPriority) return aPriority - bPriority;

      return a.due_date.localeCompare(b.due_date);
    });
  }, [reminders]);

  function renderPriorityBadge(priority: ReminderPriority) {
    const styles: Record<ReminderPriority, string> = {
      hoch: 'bg-red-100 text-red-700',
      mittel: 'bg-yellow-100 text-yellow-700',
      niedrig: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[priority]}`}>
        {t.erinnerungen.prioritaeten[priority]}
      </span>
    );
  }

  function renderStatusBadge(reminder: Reminder) {
    const overdue = isOverdue(reminder.due_date) && reminder.status === 'offen';
    if (overdue) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          Überfällig
        </span>
      );
    }

    const styles: Record<string, string> = {
      offen: 'bg-blue-100 text-blue-700',
      erledigt: 'bg-green-100 text-green-700',
      verschoben: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[reminder.status] || ''}`}>
        {t.erinnerungen.stati[reminder.status]}
      </span>
    );
  }

  function renderRecurrence(recurrence: string) {
    const labels: Record<string, string> = {
      einmalig: t.erinnerungen.intervalle.einmalig,
      'täglich': t.erinnerungen.intervalle.taeglich,
      'wöchentlich': t.erinnerungen.intervalle.woechentlich,
      monatlich: t.erinnerungen.intervalle.monatlich,
      'jährlich': t.erinnerungen.intervalle.jaehrlich,
    };
    return labels[recurrence] || recurrence;
  }

  const columns: Column<Reminder>[] = [
    {
      key: 'title',
      header: t.erinnerungen.titelFeld,
      render: (r) => (
        <span className={`font-medium ${isOverdue(r.due_date) && r.status === 'offen' ? 'text-red-700' : ''}`}>
          {r.title}
        </span>
      ),
    },
    {
      key: 'due_date',
      header: t.erinnerungen.faelligkeitsdatum,
      className: 'w-36',
      render: (r) => (
        <span className={isOverdue(r.due_date) && r.status === 'offen' ? 'text-red-600 font-medium' : ''}>
          {formatDate(r.due_date)}
        </span>
      ),
    },
    {
      key: 'priority',
      header: t.erinnerungen.prioritaet,
      className: 'w-24',
      render: (r) => renderPriorityBadge(r.priority),
    },
    {
      key: 'status',
      header: t.erinnerungen.status,
      className: 'w-28',
      render: (r) => renderStatusBadge(r),
    },
    {
      key: 'recurrence',
      header: t.erinnerungen.intervall,
      className: 'w-28',
      render: (r) => renderRecurrence(r.recurrence),
    },
    {
      key: 'actions',
      header: t.common.aktionen,
      className: 'w-48',
      render: (r) => (
        <div className="flex gap-2">
          {r.status === 'offen' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(ev) => {
                  ev.stopPropagation();
                  handleComplete(r.id);
                }}
              >
                Erledigen
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setPostponeId(r.id);
                }}
              >
                Verschieben
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              navigate(`/erinnerungen/${r.id}/bearbeiten`);
            }}
          >
            {t.common.bearbeiten}
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t.common.laden}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.erinnerungen.titel}</h1>
        <Button onClick={() => navigate('/erinnerungen/neu')}>
          {t.erinnerungen.neuAnlegen}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <PropertyFilter
            id="filter-property"
            value={filterPropertyId}
            onChange={setFilterPropertyId}
            properties={properties}
          />

          <div>
            <label htmlFor="filter-status" className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Alle</option>
              <option value="offen">{t.erinnerungen.stati.offen}</option>
              <option value="erledigt">{t.erinnerungen.stati.erledigt}</option>
              <option value="verschoben">{t.erinnerungen.stati.verschoben}</option>
            </select>
          </div>
        </div>

        <Table
          columns={columns}
          data={sortedReminders}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => navigate(`/erinnerungen/${r.id}/bearbeiten`)}
        />
      </Card>

      {/* Postpone Dialog */}
      <PostponeDialog
        isOpen={postponeId !== null}
        onClose={() => setPostponeId(null)}
        onConfirm={handlePostpone}
        loading={postponeLoading}
      />
    </div>
  );
}
