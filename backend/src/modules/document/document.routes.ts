import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { DocumentService } from './document.service.js';
import { linkDocumentSchema, searchDocumentsSchema, uploadMetadataSchema, MAX_FILE_SIZE } from './document.validators.js';

export async function documentRoutes(app: FastifyInstance) {
  // Register multipart plugin for this scope
  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });

  const documentService = new DocumentService(app);

  // POST /api/v1/documents/upload — Upload a document
  app.post('/upload', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;

    const data = await request.file();
    if (!data) {
      const error = new Error('Keine Datei hochgeladen') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Read file buffer
    const fileBuffer = await data.toBuffer();

    // Parse keywords from fields
    let keywords: string[] = [];
    if (data.fields.keywords) {
      const keywordsField = data.fields.keywords;
      if ('value' in keywordsField) {
        try {
          const parsed = JSON.parse(keywordsField.value as string);
          const validated = uploadMetadataSchema.parse({ keywords: parsed });
          keywords = validated.keywords;
        } catch {
          // If JSON parse fails, treat as single keyword
          keywords = [(keywordsField.value as string)];
        }
      }
    }

    const document = await documentService.uploadDocument(
      userId,
      fileBuffer,
      data.filename,
      data.mimetype,
      keywords
    );

    return reply.status(201).send(document);
  });

  // GET /api/v1/documents — List/search documents
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const query = searchDocumentsSchema.parse(request.query);
    return documentService.listDocuments(userId, query.search, query.propertyId);
  });

  // GET /api/v1/documents/:id — Get document details
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    return documentService.getDocument(id, userId);
  });

  // GET /api/v1/documents/:id/download — Download/view the file
  app.get('/:id/download', async (request, reply) => {
    // Accept token from Authorization header OR query param
    let userId: string;
    try {
      const authHeader = request.headers.authorization;
      const queryToken = (request.query as { token?: string }).token;
      const token = authHeader?.replace('Bearer ', '') || queryToken;

      if (!token) {
        const error = new Error('Nicht authentifiziert') as Error & { statusCode: number };
        error.statusCode = 401;
        throw error;
      }

      const decoded = app.jwt.verify<{ userId: string }>(token);
      userId = decoded.userId;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err) throw err;
      const error = new Error('Nicht authentifiziert') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    const { id } = request.params as { id: string };
    const doc = documentService.getDocument(id, userId);

    const fs = await import('node:fs');
    const path = await import('node:path');
    const uploadsDir = path.default.resolve(process.cwd(), 'uploads');
    const filePath = path.default.join(uploadsDir, path.default.basename(doc.storage_path));

    if (!fs.default.existsSync(filePath)) {
      const error = new Error('Datei nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };

    const contentType = mimeTypes[doc.file_type] || 'application/octet-stream';
    const fileBuffer = fs.default.readFileSync(filePath);

    return reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', `inline; filename="${doc.filename}"`)
      .send(fileBuffer);
  });

  // DELETE /api/v1/documents/:id — Delete document
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    documentService.deleteDocument(id, userId);
    return reply.status(204).send();
  });

  // POST /api/v1/documents/:id/link — Link document to entity
  app.post('/:id/link', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const body = linkDocumentSchema.parse(request.body);
    const link = documentService.linkDocument(id, userId, body);
    return reply.status(201).send(link);
  });
}
