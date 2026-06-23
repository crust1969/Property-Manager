import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { closeDatabase } from '../../database/index.js';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let app: FastifyInstance;
let accessToken: string;
let tmpDir: string;
let propertyId: string;

async function registerAndLogin(appInstance: FastifyInstance, email = 'reminder-test@example.com') {
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

function futureDate(daysAhead = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

function pastDate(daysAgo = 7): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function validReminderPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Mieterhöhung prüfen',
    due_date: futureDate(30),
    priority: 'mittel',
    recurrence: 'einmalig',
    ...overrides,
  };
}

describe('Reminder CRUD', () => {
  beforeAll(async () => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reminder-test-'));
    process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
    app = await buildApp();
    await app.ready();
    accessToken = await registerAndLogin(app);

    // Create a property for linking
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/v1/properties',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Testwohnung',
        street: 'Teststraße 1',
        zip_code: '10115',
        city: 'Berlin',
        property_type: 'Wohnung',
        living_area_sqm: 75,
      },
    });
    propertyId = JSON.parse(propRes.body).id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/reminders', () => {
    it('should create a reminder with status offen', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.title).toBe('Mieterhöhung prüfen');
      expect(body.priority).toBe('mittel');
      expect(body.status).toBe('offen');
      expect(body.recurrence).toBe('einmalig');
    });

    it('should create a reminder linked to a property', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ property_id: propertyId }),
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.property_id).toBe(propertyId);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        payload: validReminderPayload(),
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject title longer than 100 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ title: 'A'.repeat(101) }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject empty title', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ title: '' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject due_date in the past', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ due_date: pastDate() }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should accept due_date of today', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ due_date: todayDate() }),
      });
      expect(res.statusCode).toBe(201);
    });

    it('should reject invalid priority', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ priority: 'ungültig' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid recurrence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ recurrence: 'alle2wochen' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject non-existent property_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ property_id: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/reminders', () => {
    it('should list all reminders for user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should filter by propertyId', async () => {
      // Create reminder with property
      await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ property_id: propertyId, title: 'Filtered reminder' }),
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reminders?propertyId=${propertyId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const reminder of body) {
        expect(reminder.property_id).toBe(propertyId);
      }
    });

    it('should filter by status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reminders?status=offen',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const reminder of body) {
        expect(reminder.status).toBe('offen');
      }
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reminders',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/reminders/:id', () => {
    it('should update a reminder', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/reminders/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { title: 'Neuer Titel', priority: 'hoch' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.title).toBe('Neuer Titel');
      expect(body.priority).toBe('hoch');
    });

    it('should return 404 for non-existent reminder', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/reminders/non-existent-id',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { title: 'Test' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/reminders/some-id',
        payload: { title: 'Test' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/reminders/:id/complete', () => {
    it('should mark a reminder as erledigt', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/complete`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('erledigt');
    });

    it('should auto-create next reminder for recurring (monatlich)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({
          title: 'Monatliche Prüfung',
          recurrence: 'monatlich',
          due_date: futureDate(5),
        }),
      });
      const created = JSON.parse(createRes.body);

      // Complete the reminder
      await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/complete`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // List all reminders and find the auto-created one
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/reminders?status=offen',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const reminders = JSON.parse(listRes.body);
      const nextReminder = reminders.find(
        (r: { title: string; id: string }) => r.title === 'Monatliche Prüfung' && r.id !== created.id
      );

      expect(nextReminder).toBeDefined();
      expect(nextReminder.status).toBe('offen');
      expect(nextReminder.recurrence).toBe('monatlich');
      // Next due date should be ~1 month after original
      const originalDate = new Date(created.due_date);
      const nextDate = new Date(nextReminder.due_date);
      expect(nextDate.getTime()).toBeGreaterThan(originalDate.getTime());
    });

    it('should auto-create next reminder for recurring (wöchentlich)', async () => {
      const dueDate = futureDate(3);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({
          title: 'Wöchentliche Aufgabe',
          recurrence: 'wöchentlich',
          due_date: dueDate,
        }),
      });
      const created = JSON.parse(createRes.body);

      await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/complete`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/reminders?status=offen',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const reminders = JSON.parse(listRes.body);
      const nextReminder = reminders.find(
        (r: { title: string; id: string }) => r.title === 'Wöchentliche Aufgabe' && r.id !== created.id
      );

      expect(nextReminder).toBeDefined();
      // Next due date should be 7 days after original
      const expectedNext = new Date(dueDate + 'T00:00:00');
      expectedNext.setDate(expectedNext.getDate() + 7);
      expect(nextReminder.due_date).toBe(expectedNext.toISOString().split('T')[0]);
    });

    it('should NOT auto-create next reminder for einmalig', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({
          title: 'Einmalige Sonderaufgabe',
          recurrence: 'einmalig',
        }),
      });
      const created = JSON.parse(createRes.body);

      await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/complete`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const reminders = JSON.parse(listRes.body);
      const sameTitle = reminders.filter(
        (r: { title: string }) => r.title === 'Einmalige Sonderaufgabe'
      );
      // Only the original should exist
      expect(sameTitle.length).toBe(1);
    });

    it('should reject completing an already completed reminder', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ title: 'Bereits erledigt' }),
      });
      const created = JSON.parse(createRes.body);

      // Complete first time
      await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/complete`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // Try to complete again
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/complete`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders/some-id/complete',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/reminders/:id/postpone', () => {
    it('should postpone a reminder with new due date', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload(),
      });
      const created = JSON.parse(createRes.body);
      const newDueDate = futureDate(60);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/postpone`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { due_date: newDueDate },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('verschoben');
      expect(body.due_date).toBe(newDueDate);
    });

    it('should reject postpone with past due date', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/postpone`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { due_date: pastDate() },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject postpone with today as due date (must be future)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload(),
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/postpone`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { due_date: todayDate() },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject postponing a completed reminder', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: validReminderPayload({ title: 'Zum Verschieben erledigt' }),
      });
      const created = JSON.parse(createRes.body);

      // Complete it first
      await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/complete`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // Try to postpone
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reminders/${created.id}/postpone`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { due_date: futureDate(30) },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders/some-id/postpone',
        payload: { due_date: futureDate(30) },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
