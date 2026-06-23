import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Input } from '../../shared/components';
import { fetchDocuments, uploadDocument, deleteDocument } from './api';
import type { Document } from './types';

const ACCEPTED_TYPES = '.pdf,.jpeg,.jpg,.png';
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatFileType(type: string): string {
  return type.toUpperCase();
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments(search || undefined);
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Dokumente');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      loadDocuments(searchFilter.trim());
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchFilter(e.target.value);
    if (e.target.value === '') {
      loadDocuments();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Die Datei überschreitet die maximale Größe von ${MAX_SIZE_MB} MB`);
      return;
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Ungültiger Dateityp. Erlaubt: PDF, JPEG, PNG');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      await loadDocuments(searchFilter.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setDeleteConfirmId(null);
    }
  }

  if (loading && documents.length === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dokumente</h1>
        <div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Wird hochgeladen...' : 'Dokument hochladen'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        <div className="mb-4">
          <Input
            placeholder="Nach Schlagwörtern suchen... (Enter zum Suchen)"
            value={searchFilter}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            aria-label="Dokumente nach Schlagwörtern suchen"
          />
        </div>

        {documents.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">Keine Dokumente vorhanden</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dateiname
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Größe
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hochgeladen am
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schlagwörter
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {doc.filename}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatFileType(doc.file_type)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {doc.keywords || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <a
                          href={`/api/v1/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                          onClick={(e) => {
                            e.preventDefault();
                            const token = localStorage.getItem('auth_token');
                            window.open(`/api/v1/documents/${doc.id}/download?token=${token}`, '_blank');
                          }}
                        >
                          Anzeigen
                        </a>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteConfirmId(doc.id)}
                        >
                          Löschen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-gray-900 mb-2 font-medium">Dokument löschen?</p>
            <p className="text-gray-600 text-sm mb-4">
              Das Dokument wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirmId)}>
                Löschen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
