import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { TenantRepository, type TenantRecord } from './tenant.repository.js';
import type { CreateTenantInput, UpdateTenantInput } from './tenant.validators.js';

export class TenantService {
  private repository: TenantRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new TenantRepository(app.db);
  }

  listTenants(userId: string, propertyId?: string): TenantRecord[] {
    return this.repository.findAllByUserId(userId, propertyId);
  }

  getTenant(id: string, userId: string): TenantRecord {
    const tenant = this.repository.findById(id, userId);
    if (!tenant) {
      const error = new Error('Mieter nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return tenant;
  }

  createTenant(userId: string, input: CreateTenantInput): TenantRecord {
    // Verify property belongs to user
    if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    return this.repository.create(id, input, now);
  }

  updateTenant(id: string, userId: string, input: UpdateTenantInput): TenantRecord {
    const now = new Date().toISOString();
    const updated = this.repository.update(id, userId, input, now);
    if (!updated) {
      const error = new Error('Mieter nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return updated;
  }

  deleteTenant(id: string, userId: string): void {
    // Check the tenant exists and belongs to user
    const tenant = this.repository.findById(id, userId);
    if (!tenant) {
      const error = new Error('Mieter nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Check for active lease
    if (this.repository.hasActiveLease(id)) {
      const error = new Error(
        'Mieter kann nicht gelöscht werden: es besteht ein aktiver Mietvertrag'
      ) as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    this.repository.delete(id);
  }
}
