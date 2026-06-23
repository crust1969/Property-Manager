import { useState } from 'react';
import { Modal, Button, Input } from '../../shared/components';

interface PostponeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newDueDate: string) => void;
  loading?: boolean;
}

export function PostponeDialog({ isOpen, onClose, onConfirm, loading }: PostponeDialogProps) {
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState('');

  function handleConfirm() {
    if (!newDate) {
      setError('Bitte wählen Sie ein neues Datum');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(newDate);
    selected.setHours(0, 0, 0, 0);

    if (selected <= today) {
      setError('Das neue Datum muss nach dem heutigen Tag liegen');
      return;
    }

    setError('');
    onConfirm(newDate);
  }

  function handleClose() {
    setNewDate('');
    setError('');
    onClose();
  }

  // Minimum date is tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Erinnerung verschieben"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Wird verschoben...' : 'Verschieben'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Wählen Sie ein neues Fälligkeitsdatum für die Erinnerung. Der Status wird auf „verschoben" gesetzt.
        </p>
        <Input
          label="Neues Fälligkeitsdatum"
          type="date"
          value={newDate}
          onChange={(e) => {
            setNewDate(e.target.value);
            setError('');
          }}
          min={minDate}
          error={error}
          required
        />
      </div>
    </Modal>
  );
}
