import { useState } from 'react';
import { Button, Card, Table, Modal, type Column } from '../../shared/components';
import { formatCurrency, formatDate } from '../../shared/utils/formatting';
import { PositionForm } from './PositionForm';
import type { AfaPosition, CreatePositionInput } from './types';

interface PositionListProps {
  positions: AfaPosition[];
  onCreatePosition: (data: CreatePositionInput) => Promise<void>;
  onUpdatePosition: (positionId: string, data: Partial<CreatePositionInput>) => Promise<void>;
  onDeletePosition: (positionId: string) => Promise<void>;
  onSelectPosition: (position: AfaPosition) => void;
  loading?: boolean;
}

export function PositionList({
  positions,
  onCreatePosition,
  onUpdatePosition,
  onDeletePosition,
  onSelectPosition,
  loading,
}: PositionListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<AfaPosition | null>(null);
  const [deletingPosition, setDeletingPosition] = useState<AfaPosition | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  async function handleCreate(data: CreatePositionInput) {
    setFormLoading(true);
    try {
      await onCreatePosition(data);
      setShowCreateForm(false);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate(data: CreatePositionInput) {
    if (!editingPosition) return;
    setFormLoading(true);
    try {
      await onUpdatePosition(editingPosition.id, data);
      setEditingPosition(null);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingPosition) return;
    setFormLoading(true);
    try {
      await onDeletePosition(deletingPosition.id);
      setDeletingPosition(null);
    } finally {
      setFormLoading(false);
    }
  }

  const columns: Column<AfaPosition>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (pos) => (
        <button
          onClick={() => onSelectPosition(pos)}
          className="text-primary-600 hover:text-primary-800 font-medium hover:underline"
        >
          {pos.name}
        </button>
      ),
    },
    {
      key: 'method',
      header: 'Methode',
      render: (pos) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            pos.method === 'linear'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-purple-100 text-purple-800'
          }`}
        >
          {pos.method === 'linear' ? 'Linear' : 'Degressiv'}
        </span>
      ),
    },
    {
      key: 'basis',
      header: 'Basis (EUR)',
      className: 'text-right',
      render: (pos) => `${formatCurrency(pos.basis)} €`,
    },
    {
      key: 'rate',
      header: 'Satz (%)',
      className: 'text-right',
      render: (pos) => `${(pos.rate * 100).toFixed(2).replace('.', ',')} %`,
    },
    {
      key: 'start_date',
      header: 'Start',
      render: (pos) => formatDate(pos.start_date),
    },
    {
      key: 'actions',
      header: 'Aktionen',
      render: (pos) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setEditingPosition(pos); }}
            className="text-gray-500 hover:text-primary-600 text-sm"
            title="Bearbeiten"
          >
            ✏️
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeletingPosition(pos); }}
            className="text-gray-500 hover:text-red-600 text-sm"
            title="Löschen"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        title="AfA-Positionen"
        actions={
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            Neue Position anlegen
          </Button>
        }
      >
        {loading ? (
          <p className="text-gray-500 text-sm">Lade Positionen...</p>
        ) : (
          <Table
            columns={columns}
            data={positions}
            keyExtractor={(pos) => pos.id}
            emptyMessage="Keine AfA-Positionen vorhanden."
          />
        )}
      </Card>

      {/* Create Form Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        title="Neue AfA-Position anlegen"
      >
        <PositionForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          loading={formLoading}
        />
      </Modal>

      {/* Edit Form Modal */}
      <Modal
        isOpen={!!editingPosition}
        onClose={() => setEditingPosition(null)}
        title="AfA-Position bearbeiten"
      >
        {editingPosition && (
          <PositionForm
            mode="edit"
            position={editingPosition}
            onSubmit={handleUpdate}
            onCancel={() => setEditingPosition(null)}
            loading={formLoading}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingPosition}
        onClose={() => setDeletingPosition(null)}
        title="Position löschen"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingPosition(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={formLoading}>
              {formLoading ? 'Löschen...' : 'Löschen'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Möchten Sie die Position <strong>{deletingPosition?.name}</strong> wirklich löschen?
          Dieser Vorgang kann nicht rückgängig gemacht werden.
        </p>
      </Modal>
    </div>
  );
}
