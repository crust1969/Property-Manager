import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { ReminderRepository, type ReminderRecord, type ReminderFilters } from './reminder.repository.js';
import type { CreateReminderInput, UpdateReminderInput, PostponeReminderInput } from './reminder.validators.js';

export class ReminderService {
  private repository: ReminderRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new ReminderRepository(app.db);
  }

  listReminders(userId: string, filters: ReminderFilters): ReminderRecord[] {
    return this.repository.findAll(userId, filters);
  }

  getReminder(id: string, userId: string): ReminderRecord {
    const reminder = this.repository.findById(id, userId);
    if (!reminder) {
      const error = new Error('Erinnerung nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return reminder;
  }

  createReminder(userId: string, input: CreateReminderInput): ReminderRecord {
    // Validate property belongs to user if property_id is provided
    if (input.property_id) {
      if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
        const error = new Error('Objekt nicht gefunden oder gehört nicht dem Benutzer') as Error & { statusCode: number };
        error.statusCode = 404;
        throw error;
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const reminder: ReminderRecord = {
      id,
      user_id: userId,
      property_id: input.property_id ?? null,
      linked_entity_type: input.linked_entity_type ?? null,
      linked_entity_id: input.linked_entity_id ?? null,
      title: input.title,
      note: input.note ?? null,
      due_date: input.due_date,
      priority: input.priority,
      status: 'offen',
      recurrence: input.recurrence ?? 'einmalig',
      created_at: now,
      updated_at: now,
    };

    this.repository.create(reminder);
    return reminder;
  }

  updateReminder(id: string, userId: string, input: UpdateReminderInput): ReminderRecord {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Erinnerung nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate property belongs to user if property_id is being updated
    if (input.property_id) {
      if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
        const error = new Error('Objekt nicht gefunden oder gehört nicht dem Benutzer') as Error & { statusCode: number };
        error.statusCode = 404;
        throw error;
      }
    }

    const now = new Date().toISOString();
    this.repository.update(id, userId, { ...input, updated_at: now });

    return this.repository.findById(id, userId)!;
  }

  completeReminder(id: string, userId: string): ReminderRecord {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Erinnerung nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (existing.status === 'erledigt') {
      const error = new Error('Erinnerung ist bereits erledigt') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const now = new Date().toISOString();
    this.repository.update(id, userId, { status: 'erledigt', updated_at: now });

    // If recurring, auto-create next reminder
    if (existing.recurrence && existing.recurrence !== 'einmalig') {
      const nextDueDate = this.calculateNextDueDate(existing.due_date, existing.recurrence);
      const nextReminder: ReminderRecord = {
        id: uuidv4(),
        user_id: userId,
        property_id: existing.property_id,
        linked_entity_type: existing.linked_entity_type,
        linked_entity_id: existing.linked_entity_id,
        title: existing.title,
        note: existing.note,
        due_date: nextDueDate,
        priority: existing.priority,
        status: 'offen',
        recurrence: existing.recurrence,
        created_at: now,
        updated_at: now,
      };
      this.repository.create(nextReminder);
    }

    return this.repository.findById(id, userId)!;
  }

  postponeReminder(id: string, userId: string, input: PostponeReminderInput): ReminderRecord {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Erinnerung nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (existing.status === 'erledigt') {
      const error = new Error('Eine erledigte Erinnerung kann nicht verschoben werden') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const now = new Date().toISOString();
    this.repository.update(id, userId, {
      status: 'verschoben',
      due_date: input.due_date,
      updated_at: now,
    });

    return this.repository.findById(id, userId)!;
  }

  private calculateNextDueDate(currentDueDate: string, recurrence: string): string {
    const date = new Date(currentDueDate + 'T00:00:00');

    switch (recurrence) {
      case 'täglich':
        date.setDate(date.getDate() + 1);
        break;
      case 'wöchentlich':
        date.setDate(date.getDate() + 7);
        break;
      case 'monatlich':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'jährlich':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        break;
    }

    return date.toISOString().split('T')[0];
  }
}
