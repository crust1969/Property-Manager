import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { LeaseRepository, type LeaseRecord, type ReceivableRecord } from './lease.repository.js';
import type { CreateLeaseInput, UpdateLeaseInput, TerminateLeaseInput } from './lease.validators.js';

export class LeaseService {
  private repository: LeaseRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new LeaseRepository(app.db);
  }

  listLeases(userId: string, propertyId?: string): LeaseRecord[] {
    return this.repository.findAllByUserId(userId, propertyId);
  }

  getLease(id: string, userId: string): LeaseRecord {
    const lease = this.repository.findById(id, userId);
    if (!lease) {
      const error = new Error('Mietvertrag nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return lease;
  }

  createLease(userId: string, input: CreateLeaseInput): LeaseRecord {
    // Validate property belongs to user
    if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
      const error = new Error('Objekt nicht gefunden oder gehört nicht dem Benutzer') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate tenant exists for this property
    if (!this.repository.tenantExists(input.tenant_id, input.property_id)) {
      const error = new Error('Mieter nicht gefunden oder gehört nicht zum angegebenen Objekt') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const lease = this.repository.create(id, input, now);

    // Generate initial receivables for the active lease
    this.generateReceivables(lease);

    return lease;
  }

  updateLease(id: string, userId: string, input: UpdateLeaseInput): LeaseRecord {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Mietvertrag nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (existing.status === 'beendet') {
      const error = new Error('Ein beendeter Mietvertrag kann nicht bearbeitet werden') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Validate property belongs to user
    if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
      const error = new Error('Objekt nicht gefunden oder gehört nicht dem Benutzer') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate tenant exists for this property
    if (!this.repository.tenantExists(input.tenant_id, input.property_id)) {
      const error = new Error('Mieter nicht gefunden oder gehört nicht zum angegebenen Objekt') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const now = new Date().toISOString();
    const updated = this.repository.update(id, input, now);
    if (!updated) {
      const error = new Error('Mietvertrag nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return this.repository.findById(id, userId)!;
  }

  terminateLease(id: string, userId: string, input: TerminateLeaseInput): LeaseRecord {
    const existing = this.repository.findById(id, userId);
    if (!existing) {
      const error = new Error('Mietvertrag nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (existing.status === 'beendet') {
      const error = new Error('Mietvertrag ist bereits beendet') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const now = new Date().toISOString();
    this.repository.terminate(id, input.end_date, now);

    // Cancel all receivables after end_date
    this.repository.cancelReceivablesAfterDate(id, input.end_date);

    return this.repository.findById(id, userId)!;
  }

  getReceivables(leaseId: string, userId: string): ReceivableRecord[] {
    // Verify the lease belongs to the user
    const lease = this.repository.findById(leaseId, userId);
    if (!lease) {
      const error = new Error('Mietvertrag nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return this.repository.findReceivablesByLeaseId(leaseId);
  }

  /**
   * Generate receivables for an active lease.
   * Generates monthly receivables from the lease start date up to 3 months in the future,
   * at least 5 days before each due date.
   */
  generateReceivables(lease: LeaseRecord): void {
    if (lease.status !== 'aktiv') {
      return;
    }

    const existingDates = new Set(this.repository.findExistingReceivableDates(lease.id));
    const today = new Date();
    
    // Generate receivables up to 3 months from now
    const generationHorizon = new Date(today);
    generationHorizon.setMonth(generationHorizon.getMonth() + 3);

    const startDate = new Date(lease.start_date);
    const endDate = lease.end_date ? new Date(lease.end_date) : null;

    // Start generating from the lease start month
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (current <= generationHorizon) {
      const year = current.getFullYear();
      const month = current.getMonth();

      // Calculate due date for this month
      const dueDate = new Date(year, month, lease.due_day);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      // Only generate if:
      // 1. Due date is on or after lease start
      // 2. Due date is on or before lease end (if set)
      // 3. Receivable doesn't already exist
      // 4. We are within the 5-day-before-due generation window or it's for the future
      if (
        dueDate >= startDate &&
        (!endDate || dueDate <= endDate) &&
        !existingDates.has(dueDateStr)
      ) {
        const totalAmount = lease.cold_rent + lease.operating_cost_advance + lease.heating_cost_advance;

        const receivable: ReceivableRecord = {
          id: uuidv4(),
          lease_id: lease.id,
          property_id: lease.property_id,
          due_date: dueDateStr,
          cold_rent: lease.cold_rent,
          operating_cost: lease.operating_cost_advance,
          heating_cost: lease.heating_cost_advance,
          total_amount: totalAmount,
          paid_amount: 0,
          status: 'offen',
        };

        this.repository.createReceivable(receivable);
      }

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }
  }
}
