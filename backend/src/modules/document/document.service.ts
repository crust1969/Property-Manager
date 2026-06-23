import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { DocumentRepository, type DocumentRecord, type DocumentLinkRecord } from './document.repository.js';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILENAME_LENGTH,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MAX_LINKS_PER_DOCUMENT,
  type LinkDocumentInput,
} from './document.validators.js';

export interface DocumentWithLinks extends DocumentRecord {
  links: DocumentLinkRecord[];
}

export class DocumentService {
  private repository: DocumentRepository;
  private uploadsDir: string;

  constructor(private app: FastifyInstance, uploadsDir?: string) {
    this.repository = new DocumentRepository(app.db);
    this.uploadsDir = uploadsDir ?? path.resolve(process.cwd(), 'uploads');
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async uploadDocument(
    userId: string,
    fileBuffer: Buffer,
    filename: string,
    mimetype: string,
    keywords: string[] = []
  ): Promise<DocumentRecord> {
    // Validate file type
    const fileType = ALLOWED_MIME_TYPES[mimetype];
    if (!fileType) {
      const error = new Error(
        'Nicht unterstützter Dateityp. Erlaubt sind: PDF, JPEG, PNG'
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      const error = new Error(
        'Datei überschreitet die maximale Größe von 20 MB'
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Validate filename length
    if (filename.length > MAX_FILENAME_LENGTH) {
      const error = new Error(
        `Dateiname darf maximal ${MAX_FILENAME_LENGTH} Zeichen lang sein`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Validate keywords
    if (keywords.length > MAX_KEYWORDS) {
      const error = new Error(
        `Maximal ${MAX_KEYWORDS} Schlagwörter erlaubt`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    for (const keyword of keywords) {
      if (keyword.length > MAX_KEYWORD_LENGTH) {
        const error = new Error(
          `Schlagwort darf maximal ${MAX_KEYWORD_LENGTH} Zeichen lang sein`
        ) as Error & { statusCode: number };
        error.statusCode = 400;
        throw error;
      }
    }

    // Generate unique storage path
    const id = uuidv4();
    const extension = fileType;
    const storagePath = `uploads/${id}.${extension}`;
    const fullPath = path.join(this.uploadsDir, `${id}.${extension}`);

    // Write file to disk
    fs.writeFileSync(fullPath, fileBuffer);

    // Save metadata to DB
    const now = new Date().toISOString();
    return this.repository.create(id, userId, filename, fileType, fileBuffer.length, storagePath, keywords, now);
  }

  getDocument(id: string, userId: string): DocumentWithLinks {
    const document = this.repository.findById(id, userId);
    if (!document) {
      const error = new Error('Dokument nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    const links = this.repository.findLinksByDocumentId(id);
    return { ...document, links };
  }

  listDocuments(userId: string, search?: string, propertyId?: string): DocumentRecord[] {
    return this.repository.findAll(userId, search, propertyId);
  }

  deleteDocument(id: string, userId: string): void {
    const document = this.repository.findById(id, userId);
    if (!document) {
      const error = new Error('Dokument nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Delete file from filesystem
    const fullPath = path.resolve(this.uploadsDir, path.basename(document.storage_path));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Delete DB record (cascades to document_links)
    this.repository.delete(id);
  }

  linkDocument(documentId: string, userId: string, input: LinkDocumentInput): DocumentLinkRecord {
    // Verify document exists and belongs to user
    const document = this.repository.findById(documentId, userId);
    if (!document) {
      const error = new Error('Dokument nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Check max links
    const linkCount = this.repository.countLinksByDocumentId(documentId);
    if (linkCount >= MAX_LINKS_PER_DOCUMENT) {
      const error = new Error(
        `Maximal ${MAX_LINKS_PER_DOCUMENT} Verknüpfungen pro Dokument erlaubt`
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const linkId = uuidv4();
    return this.repository.createLink(linkId, documentId, input.entity_type, input.entity_id);
  }
}
