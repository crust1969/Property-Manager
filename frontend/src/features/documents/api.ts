import { api } from '../../shared/api/client';
import type { Document } from './types';

/** Fetch documents with optional search and property filter */
export async function fetchDocuments(search?: string, propertyId?: string): Promise<Document[]> {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (propertyId) params.propertyId = propertyId;
  return api.get<Document[]>('/documents', params);
}

/** Upload a document file with optional keywords */
export async function uploadDocument(file: File, keywords?: string): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  if (keywords) {
    formData.append('keywords', keywords);
  }
  return api.upload<Document>('/documents/upload', formData);
}

/** Delete a document by ID */
export async function deleteDocument(id: string): Promise<void> {
  return api.delete(`/documents/${id}`);
}

/** Link a document to an entity */
export async function linkDocument(
  id: string,
  entityType: string,
  entityId: string
): Promise<void> {
  return api.post(`/documents/${id}/link`, {
    entity_type: entityType,
    entity_id: entityId,
  });
}
