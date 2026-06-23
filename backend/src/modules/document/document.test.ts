import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let app: FastifyInstance;
let accessToken: string;
let testPropertyId: string;
let tmpDir: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'doc-test@example.com') {
  const registerRes = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password123', name: 'Test User' },
  });

  if (registerRes.statusCode === 201) {
    const body = JSON.parse(registerRes.body);
    return body.accessToken as string;
  }

  const loginRes = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'password123' },
  });
  const body = JSON.parse(loginRes.body);
  return body.accessToken as string;
}

async function createProperty(appInstance: FastifyInstance, token: string, name = 'Testobjekt') {
  const res = await appInstance.inject({
    method: 'POST',
    url: '/api/v1/properties',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name,
      street: 'Musterstraße 1',
      zip_code: '12345',
      city: 'Berlin',
      property_type: 'Wohnung',
      living_area_sqm: 75,
    },
  });
  return JSON.parse(res.body);
}

function createMultipartPayload(
  filename: string,
  mimetype: string,
  content: Buffer,
  keywords?: string[]
) {
  const boundary = '----FormBoundary' + Date.now().toString(16);
  const parts: Buffer[] = [];

  // File part
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimetype}\r\n\r\n`
  ));
  parts.push(content);
  parts.push(Buffer.from('\r\n'));

  // Keywords part
  if (keywords) {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="keywords"\r\n\r\n` +
      JSON.stringify(keywords) + '\r\n'
    ));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('Document Module', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
    app = await buildApp();
    await app.ready();
    accessToken = await registerAndLogin(app);
    const property = await createProperty(app, accessToken);
    testPropertyId = property.id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/documents/upload', () => {
    it('should upload a PDF file', async () => {
      const fileContent = Buffer.from('%PDF-1.4 test content');
      const { body, contentType } = createMultipartPayload(
        'test.pdf',
        'application/pdf',
        fileContent,
        ['mietvertrag', 'berlin']
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const doc = JSON.parse(res.body);
      expect(doc.id).toBeDefined();
      expect(doc.filename).toBe('test.pdf');
      expect(doc.file_type).toBe('pdf');
      expect(doc.file_size).toBe(fileContent.length);
      expect(doc.storage_path).toContain('uploads/');
      expect(doc.storage_path).toContain('.pdf');
    });

    it('should upload a JPEG file', async () => {
      const fileContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...Array(100).fill(0)]);
      const { body, contentType } = createMultipartPayload(
        'photo.jpg',
        'image/jpeg',
        fileContent
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const doc = JSON.parse(res.body);
      expect(doc.file_type).toBe('jpeg');
    });

    it('should upload a PNG file', async () => {
      const fileContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...Array(100).fill(0)]);
      const { body, contentType } = createMultipartPayload(
        'image.png',
        'image/png',
        fileContent
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const doc = JSON.parse(res.body);
      expect(doc.file_type).toBe('png');
    });

    it('should reject unsupported file type', async () => {
      const fileContent = Buffer.from('not a supported file');
      const { body, contentType } = createMultipartPayload(
        'document.doc',
        'application/msword',
        fileContent
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });

      expect(res.statusCode).toBe(400);
      const resBody = JSON.parse(res.body);
      expect(resBody.message).toContain('Nicht unterstützter Dateityp');
    });

    it('should reject file exceeding 20 MB', async () => {
      // Create a buffer slightly over 20 MB
      const fileContent = Buffer.alloc(20 * 1024 * 1024 + 1, 'x');
      const { body, contentType } = createMultipartPayload(
        'large.pdf',
        'application/pdf',
        fileContent
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });

      // The multipart plugin may reject this at the limit level (413) or our service (400)
      expect([400, 413]).toContain(res.statusCode);
    });

    it('should reject without authentication', async () => {
      const fileContent = Buffer.from('%PDF-1.4 test');
      const { body, contentType } = createMultipartPayload(
        'test.pdf',
        'application/pdf',
        fileContent
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: { 'content-type': contentType },
        payload: body,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/documents', () => {
    it('should list documents for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const docs = JSON.parse(res.body);
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBeGreaterThan(0);
    });

    it('should search documents by keyword', async () => {
      // Upload a document with specific keywords
      const fileContent = Buffer.from('%PDF-1.4 content');
      const { body, contentType } = createMultipartPayload(
        'searchable.pdf',
        'application/pdf',
        fileContent,
        ['steuererklaerung', 'wichtig']
      );

      await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents?search=steuererklaerung',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const docs = JSON.parse(res.body);
      expect(docs.length).toBeGreaterThan(0);
      expect(docs.some((d: { keywords: string }) => d.keywords.includes('steuererklaerung'))).toBe(true);
    });

    it('should search documents by file type', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents?search=pdf',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const docs = JSON.parse(res.body);
      expect(docs.length).toBeGreaterThan(0);
      expect(docs.every((d: { file_type: string }) => d.file_type === 'pdf')).toBe(true);
    });

    it('should not list documents of other users', async () => {
      const otherToken = await registerAndLogin(app, 'other-doc@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents',
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const docs = JSON.parse(res.body);
      expect(docs.length).toBe(0);
    });
  });

  describe('GET /api/v1/documents/:id', () => {
    it('should get document details with links', async () => {
      // Upload a document first
      const fileContent = Buffer.from('%PDF-1.4 detail test');
      const { body, contentType } = createMultipartPayload(
        'detail.pdf',
        'application/pdf',
        fileContent,
        ['detail']
      );

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });
      const uploaded = JSON.parse(uploadRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/documents/${uploaded.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const doc = JSON.parse(res.body);
      expect(doc.id).toBe(uploaded.id);
      expect(doc.filename).toBe('detail.pdf');
      expect(doc.links).toBeDefined();
      expect(Array.isArray(doc.links)).toBe(true);
    });

    it('should return 404 for non-existent document', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/documents/:id/link', () => {
    it('should link document to a property', async () => {
      // Upload a document
      const fileContent = Buffer.from('%PDF-1.4 link test');
      const { body, contentType } = createMultipartPayload(
        'link.pdf',
        'application/pdf',
        fileContent
      );

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });
      const uploaded = JSON.parse(uploadRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/documents/${uploaded.id}/link`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          entity_type: 'property',
          entity_id: testPropertyId,
        },
      });

      expect(res.statusCode).toBe(201);
      const link = JSON.parse(res.body);
      expect(link.id).toBeDefined();
      expect(link.document_id).toBe(uploaded.id);
      expect(link.entity_type).toBe('property');
      expect(link.entity_id).toBe(testPropertyId);
    });

    it('should link document to a lease', async () => {
      const fileContent = Buffer.from('%PDF-1.4 lease link');
      const { body, contentType } = createMultipartPayload(
        'lease-link.pdf',
        'application/pdf',
        fileContent
      );

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });
      const uploaded = JSON.parse(uploadRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/documents/${uploaded.id}/link`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          entity_type: 'lease',
          entity_id: 'some-lease-id',
        },
      });

      expect(res.statusCode).toBe(201);
      const link = JSON.parse(res.body);
      expect(link.entity_type).toBe('lease');
    });

    it('should reject invalid entity type', async () => {
      const fileContent = Buffer.from('%PDF-1.4 invalid link');
      const { body, contentType } = createMultipartPayload(
        'invalid-link.pdf',
        'application/pdf',
        fileContent
      );

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });
      const uploaded = JSON.parse(uploadRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/documents/${uploaded.id}/link`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          entity_type: 'invalid_type',
          entity_id: 'some-id',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject when max links reached', async () => {
      const fileContent = Buffer.from('%PDF-1.4 max links');
      const { body, contentType } = createMultipartPayload(
        'max-links.pdf',
        'application/pdf',
        fileContent
      );

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });
      const uploaded = JSON.parse(uploadRes.body);

      // Create 10 links
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/documents/${uploaded.id}/link`,
          headers: { authorization: `Bearer ${accessToken}` },
          payload: {
            entity_type: 'property',
            entity_id: `property-${i}`,
          },
        });
      }

      // 11th link should fail
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/documents/${uploaded.id}/link`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          entity_type: 'property',
          entity_id: 'property-overflow',
        },
      });

      expect(res.statusCode).toBe(400);
      const resBody = JSON.parse(res.body);
      expect(resBody.message).toContain('Maximal 10');
    });

    it('should return 404 for non-existent document', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/non-existent-id/link',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          entity_type: 'property',
          entity_id: testPropertyId,
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/documents/:id', () => {
    it('should delete a document and its file', async () => {
      // Upload a document
      const fileContent = Buffer.from('%PDF-1.4 delete test');
      const { body, contentType } = createMultipartPayload(
        'delete-me.pdf',
        'application/pdf',
        fileContent
      );

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });
      const uploaded = JSON.parse(uploadRes.body);

      // Delete it
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/documents/${uploaded.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it's gone from DB
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/documents/${uploaded.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 for non-existent document', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/documents/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should not allow deleting another user\'s document', async () => {
      // Upload a document
      const fileContent = Buffer.from('%PDF-1.4 protected');
      const { body, contentType } = createMultipartPayload(
        'protected.pdf',
        'application/pdf',
        fileContent
      );

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/upload',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': contentType,
        },
        payload: body,
      });
      const uploaded = JSON.parse(uploadRes.body);

      // Try to delete with another user
      const otherToken = await registerAndLogin(app, 'intruder-doc@example.com');
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/documents/${uploaded.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
