import type Database from 'better-sqlite3';

export interface DocumentRecord {
  id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  keywords: string; // JSON array
  uploaded_at: string;
}

export interface DocumentLinkRecord {
  id: string;
  document_id: string;
  entity_type: string;
  entity_id: string;
}

export class DocumentRepository {
  constructor(private db: Database.Database) {}

  create(
    id: string,
    userId: string,
    filename: string,
    fileType: string,
    fileSize: number,
    storagePath: string,
    keywords: string[],
    uploadedAt: string
  ): DocumentRecord {
    this.db
      .prepare(
        `INSERT INTO documents (id, user_id, filename, file_type, file_size, storage_path, keywords, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, userId, filename, fileType, fileSize, storagePath, JSON.stringify(keywords), uploadedAt);

    return this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRecord;
  }

  findById(id: string, userId: string): DocumentRecord | undefined {
    return this.db
      .prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?')
      .get(id, userId) as DocumentRecord | undefined;
  }

  findAll(userId: string, search?: string, propertyId?: string): DocumentRecord[] {
    if (propertyId && search) {
      // Filter by property (via document_links) and search in keywords/file_type
      return this.db
        .prepare(
          `SELECT DISTINCT d.* FROM documents d
           LEFT JOIN document_links dl ON d.id = dl.document_id
           WHERE d.user_id = ?
             AND (dl.entity_type = 'property' AND dl.entity_id = ?)
             AND (d.keywords LIKE ? OR d.file_type LIKE ?)
           ORDER BY d.uploaded_at DESC`
        )
        .all(userId, propertyId, `%${search}%`, `%${search}%`) as DocumentRecord[];
    }

    if (propertyId) {
      return this.db
        .prepare(
          `SELECT DISTINCT d.* FROM documents d
           LEFT JOIN document_links dl ON d.id = dl.document_id
           WHERE d.user_id = ?
             AND dl.entity_type = 'property' AND dl.entity_id = ?
           ORDER BY d.uploaded_at DESC`
        )
        .all(userId, propertyId) as DocumentRecord[];
    }

    if (search) {
      return this.db
        .prepare(
          `SELECT * FROM documents
           WHERE user_id = ?
             AND (keywords LIKE ? OR file_type LIKE ?)
           ORDER BY uploaded_at DESC`
        )
        .all(userId, `%${search}%`, `%${search}%`) as DocumentRecord[];
    }

    return this.db
      .prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC')
      .all(userId) as DocumentRecord[];
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Document Links
  createLink(id: string, documentId: string, entityType: string, entityId: string): DocumentLinkRecord {
    this.db
      .prepare(
        `INSERT INTO document_links (id, document_id, entity_type, entity_id)
         VALUES (?, ?, ?, ?)`
      )
      .run(id, documentId, entityType, entityId);

    return this.db.prepare('SELECT * FROM document_links WHERE id = ?').get(id) as DocumentLinkRecord;
  }

  findLinksByDocumentId(documentId: string): DocumentLinkRecord[] {
    return this.db
      .prepare('SELECT * FROM document_links WHERE document_id = ?')
      .all(documentId) as DocumentLinkRecord[];
  }

  countLinksByDocumentId(documentId: string): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM document_links WHERE document_id = ?')
      .get(documentId) as { count: number };
    return result.count;
  }
}
