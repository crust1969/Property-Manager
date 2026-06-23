export interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  keywords: string;
  uploaded_at: string;
  links?: DocumentLink[];
}

export interface DocumentLink {
  id: string;
  document_id: string;
  entity_type: string;
  entity_id: string;
}
