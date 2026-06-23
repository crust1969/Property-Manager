import { useState, useRef, useCallback } from 'react';
import { Button } from '../../shared/components';

interface UploadedFile {
  file: File;
  preview?: string;
  progress: number;
  uploaded: boolean;
  error?: string;
  documentId?: string;
}

interface DocumentUploadProps {
  onFilesUploaded: (files: { file: File; documentId: string }[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpeg', '.jpg', '.png'];
const MAX_FILES_DEFAULT = 10;
const MAX_SIZE_DEFAULT = 10; // MB

export function DocumentUpload({
  onFilesUploaded,
  maxFiles = MAX_FILES_DEFAULT,
  maxSizeMB = MAX_SIZE_DEFAULT,
}: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `"${file.name}" hat einen ungültigen Dateityp. Erlaubt: PDF, JPEG, PNG`;
    }
    if (file.size > maxSizeBytes) {
      return `"${file.name}" überschreitet die maximale Dateigröße von ${maxSizeMB} MB`;
    }
    return null;
  }, [maxSizeBytes, maxSizeMB]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(newFiles);

    if (files.length + fileArray.length > maxFiles) {
      setError(`Maximal ${maxFiles} Dateien pro Buchung erlaubt`);
      return;
    }

    const validFiles: UploadedFile[] = [];
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      const preview = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined;

      validFiles.push({ file, preview, progress: 0, uploaded: false });
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, [files.length, maxFiles, validateFile]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // Reset input value so same file can be selected again
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated.splice(index, 1);
      return updated;
    });
  }

  async function handleUpload() {
    const { uploadDocument } = await import('./api');
    const uploadedFiles: { file: File; documentId: string }[] = [];

    const updatedFiles = [...files];
    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].uploaded) continue;

      try {
        // Simulate progress
        updatedFiles[i] = { ...updatedFiles[i], progress: 50 };
        setFiles([...updatedFiles]);

        const doc = await uploadDocument(updatedFiles[i].file);
        updatedFiles[i] = { ...updatedFiles[i], progress: 100, uploaded: true, documentId: doc.id };
        uploadedFiles.push({ file: updatedFiles[i].file, documentId: doc.id });
        setFiles([...updatedFiles]);
      } catch (err) {
        updatedFiles[i] = {
          ...updatedFiles[i],
          progress: 0,
          error: err instanceof Error ? err.message : 'Upload fehlgeschlagen',
        };
        setFiles([...updatedFiles]);
      }
    }

    if (uploadedFiles.length > 0) {
      onFilesUploaded(uploadedFiles);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const hasUnuploadedFiles = files.some((f) => !f.uploaded && !f.error);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Belege / Dokumente
      </label>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}
        `.trim()}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Dateien hier ablegen oder klicken zum Auswählen"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
      >
        <div className="space-y-2">
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-600">
            Dateien hier ablegen oder <span className="text-primary-600 font-medium">durchsuchen</span>
          </p>
          <p className="text-xs text-gray-400">
            PDF, JPEG, PNG — max. {maxSizeMB} MB pro Datei, max. {maxFiles} Dateien
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleFileInput}
        className="hidden"
        aria-hidden="true"
      />

      {error && (
        <div className="bg-red-50 text-red-700 p-2 rounded text-sm" role="alert">
          {error}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, index) => (
            <div key={index} className="flex items-center gap-3 bg-white border border-gray-200 rounded p-2">
              {/* Preview/Icon */}
              <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                {f.preview ? (
                  <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{f.file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(f.file.size)}</p>
                {f.progress > 0 && f.progress < 100 && (
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-primary-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
                {f.error && <p className="text-xs text-red-600 mt-0.5">{f.error}</p>}
                {f.uploaded && <p className="text-xs text-green-600 mt-0.5">✓ Hochgeladen</p>}
              </div>

              {/* Remove button */}
              {!f.uploaded && (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-500 p-1"
                  aria-label={`${f.file.name} entfernen`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {hasUnuploadedFiles && (
        <Button type="button" size="sm" onClick={handleUpload}>
          Hochladen
        </Button>
      )}
    </div>
  );
}
