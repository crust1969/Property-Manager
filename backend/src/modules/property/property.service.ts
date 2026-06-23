import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { PropertyRepository, type PropertyRecord } from './property.repository.js';
import type { CreatePropertyInput, UpdatePropertyInput } from './property.validators.js';

const MAX_PROPERTIES_PER_USER = 100;

export class PropertyService {
  private repository: PropertyRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new PropertyRepository(app.db);
  }

  listProperties(userId: string): PropertyRecord[] {
    return this.repository.findAllByUserId(userId);
  }

  getProperty(id: string, userId: string): PropertyRecord {
    const property = this.repository.findById(id, userId);
    if (!property) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return property;
  }

  createProperty(userId: string, input: CreatePropertyInput): PropertyRecord {
    const count = this.repository.countByUserId(userId);
    if (count >= MAX_PROPERTIES_PER_USER) {
      const error = new Error('Maximale Anzahl von 100 Objekten erreicht') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    return this.repository.create(id, userId, input, now);
  }

  updateProperty(id: string, userId: string, input: UpdatePropertyInput): PropertyRecord {
    const now = new Date().toISOString();
    const updated = this.repository.update(id, userId, input, now);
    if (!updated) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return updated;
  }

  deleteProperty(id: string, userId: string): void {
    // Check the property exists
    const property = this.repository.findById(id, userId);
    if (!property) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Check for linked entities
    if (this.repository.hasBookings(id)) {
      const error = new Error('Objekt kann nicht gelöscht werden: es existieren noch verknüpfte Buchungen') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    if (this.repository.hasLeases(id)) {
      const error = new Error('Objekt kann nicht gelöscht werden: es existieren noch verknüpfte Mietverträge') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    if (this.repository.hasLoans(id)) {
      const error = new Error('Objekt kann nicht gelöscht werden: es existieren noch verknüpfte Darlehen') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    this.repository.delete(id, userId);
  }
}
