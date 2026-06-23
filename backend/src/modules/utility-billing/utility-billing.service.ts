import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { UtilityBillingRepository, type UtilityBillingRecord, type UtilityBillingItemRecord } from './utility-billing.repository.js';

export type AllocationKey = 'fläche' | 'personen' | 'verbrauch' | 'direkt' | 'manuell';

export interface CostPositionInput {
  category_id: string;
  total_cost: number;
  allocation_key: AllocationKey;
  /** Required for 'fläche' key */
  tenant_area?: number;
  total_area?: number;
  /** Required for 'personen' key */
  tenant_persons?: number;
  total_persons?: number;
  /** Required for 'verbrauch' key */
  tenant_consumption?: number;
  total_consumption?: number;
  /** Required for 'manuell' key */
  manual_percentage?: number;
}

export interface CreateBillingRequest {
  property_id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  cost_positions: CostPositionInput[];
}

export interface BillingResult {
  id: string;
  property_id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  total_allocable_costs: number;
  tenant_share: number;
  prepayments: number;
  balance: number;
  status: string;
  created_at: string;
  items: BillingItemResult[];
  warnings: string[];
}

export interface BillingItemResult {
  id: string;
  billing_id: string;
  category_id: string;
  category_name: string;
  total_cost: number;
  allocation_key: string;
  tenant_share: number;
  is_complete: boolean;
}

/**
 * Calculate tenant share based on allocation key.
 */
export function calculateTenantShare(
  totalCost: number,
  allocationKey: AllocationKey,
  params: {
    tenant_area?: number;
    total_area?: number;
    tenant_persons?: number;
    total_persons?: number;
    tenant_consumption?: number;
    total_consumption?: number;
    manual_percentage?: number;
  }
): { share: number; isComplete: boolean } {
  switch (allocationKey) {
    case 'fläche': {
      const tenantArea = params.tenant_area ?? 0;
      const totalArea = params.total_area ?? 0;
      if (totalArea <= 0) return { share: 0, isComplete: false };
      return { share: Math.round(totalCost * (tenantArea / totalArea)), isComplete: true };
    }
    case 'personen': {
      const tenantPersons = params.tenant_persons ?? 0;
      const totalPersons = params.total_persons ?? 0;
      if (totalPersons <= 0) return { share: 0, isComplete: false };
      return { share: Math.round(totalCost * (tenantPersons / totalPersons)), isComplete: true };
    }
    case 'verbrauch': {
      const tenantConsumption = params.tenant_consumption ?? 0;
      const totalConsumption = params.total_consumption ?? 0;
      if (totalConsumption <= 0) return { share: 0, isComplete: false };
      return { share: Math.round(totalCost * (tenantConsumption / totalConsumption)), isComplete: true };
    }
    case 'direkt': {
      return { share: totalCost, isComplete: true };
    }
    case 'manuell': {
      const percentage = params.manual_percentage ?? 0;
      if (percentage <= 0 || percentage > 100) return { share: 0, isComplete: false };
      return { share: Math.round(totalCost * (percentage / 100)), isComplete: true };
    }
    default:
      return { share: 0, isComplete: false };
  }
}

/**
 * Calculate the saldo (balance) from the billing.
 * Positive = Nachzahlung (tenant owes), Negative = Guthaben (tenant gets refund).
 */
export function calculateSaldo(tenantShareTotal: number, prepaymentsTotal: number): number {
  return tenantShareTotal - prepaymentsTotal;
}

export class UtilityBillingService {
  private repository: UtilityBillingRepository;

  constructor(private app: FastifyInstance) {
    this.repository = new UtilityBillingRepository(app.db);
  }

  /**
   * Create a utility billing with cost positions and allocation calculations.
   */
  create(input: CreateBillingRequest, userId: string): BillingResult {
    // Validate property belongs to user
    if (!this.repository.propertyBelongsToUser(input.property_id, userId)) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate lease exists and belongs to property
    if (!this.repository.leaseExists(input.lease_id, input.property_id)) {
      const error = new Error('Mietvertrag nicht gefunden oder gehört nicht zum Objekt') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate period (1-12 months)
    this.validatePeriod(input.period_start, input.period_end);

    // Validate cost_positions not empty
    if (!input.cost_positions || input.cost_positions.length === 0) {
      const error = new Error('Mindestens eine Kostenposition ist erforderlich') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const warnings: string[] = [];
    const items: { categoryId: string; totalCost: number; allocationKey: AllocationKey; tenantShare: number; isComplete: boolean }[] = [];

    // Calculate tenant shares for each cost position
    let totalAllocableCosts = 0;
    let tenantShareTotal = 0;

    for (const position of input.cost_positions) {
      const result = calculateTenantShare(position.total_cost, position.allocation_key, {
        tenant_area: position.tenant_area,
        total_area: position.total_area,
        tenant_persons: position.tenant_persons,
        total_persons: position.total_persons,
        tenant_consumption: position.tenant_consumption,
        total_consumption: position.total_consumption,
        manual_percentage: position.manual_percentage,
      });

      if (!result.isComplete) {
        const categoryName = this.repository.getCategoryName(position.category_id);
        if (position.allocation_key === 'verbrauch') {
          warnings.push(`Kostenposition "${categoryName}": Keine Verbrauchsdaten vorhanden — Position als unvollständig markiert.`);
        } else {
          warnings.push(`Kostenposition "${categoryName}": Berechnung unvollständig — fehlende Daten für Umlageschlüssel "${position.allocation_key}".`);
        }
      }

      totalAllocableCosts += position.total_cost;
      tenantShareTotal += result.share;

      items.push({
        categoryId: position.category_id,
        totalCost: position.total_cost,
        allocationKey: position.allocation_key,
        tenantShare: result.share,
        isComplete: result.isComplete,
      });
    }

    // Get prepayments
    const prepayments = this.repository.getPrepayments(input.lease_id, input.period_start, input.period_end);

    if (prepayments === 0) {
      warnings.push('Keine Vorauszahlungen für den Abrechnungszeitraum erfasst — Vorauszahlungen mit 0,00 EUR angesetzt.');
    }

    // Calculate saldo
    const balance = calculateSaldo(tenantShareTotal, prepayments);

    const now = new Date().toISOString();
    const billingId = uuidv4();

    // Create the billing record
    const billing = this.repository.create({
      id: billingId,
      property_id: input.property_id,
      lease_id: input.lease_id,
      period_start: input.period_start,
      period_end: input.period_end,
      total_allocable_costs: totalAllocableCosts,
      tenant_share: tenantShareTotal,
      prepayments,
      balance,
      status: 'entwurf',
      created_at: now,
    });

    // Create billing items
    const billingItems: BillingItemResult[] = [];
    for (const item of items) {
      const itemId = uuidv4();
      this.repository.createItem({
        id: itemId,
        billing_id: billingId,
        category_id: item.categoryId,
        total_cost: item.totalCost,
        allocation_key: item.allocationKey,
        tenant_share: item.tenantShare,
        is_complete: item.isComplete ? 1 : 0,
      });

      billingItems.push({
        id: itemId,
        billing_id: billingId,
        category_id: item.categoryId,
        category_name: this.repository.getCategoryName(item.categoryId),
        total_cost: item.totalCost,
        allocation_key: item.allocationKey,
        tenant_share: item.tenantShare,
        is_complete: item.isComplete,
      });
    }

    return {
      id: billing.id,
      property_id: billing.property_id,
      lease_id: billing.lease_id,
      period_start: billing.period_start,
      period_end: billing.period_end,
      total_allocable_costs: totalAllocableCosts,
      tenant_share: tenantShareTotal,
      prepayments,
      balance,
      status: billing.status,
      created_at: billing.created_at,
      items: billingItems,
      warnings,
    };
  }

  /**
   * Get billing by ID with items.
   */
  getById(id: string, userId: string): BillingResult {
    const billing = this.repository.findById(id);
    if (!billing) {
      const error = new Error('Nebenkostenabrechnung nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Verify access
    if (!this.repository.propertyBelongsToUser(billing.property_id, userId)) {
      const error = new Error('Nebenkostenabrechnung nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const items = this.repository.findItemsByBillingId(id);
    const billingItems: BillingItemResult[] = items.map(item => ({
      id: item.id,
      billing_id: item.billing_id,
      category_id: item.category_id,
      category_name: this.repository.getCategoryName(item.category_id),
      total_cost: item.total_cost,
      allocation_key: item.allocation_key,
      tenant_share: item.tenant_share,
      is_complete: item.is_complete === 1,
    }));

    return {
      id: billing.id,
      property_id: billing.property_id,
      lease_id: billing.lease_id,
      period_start: billing.period_start,
      period_end: billing.period_end,
      total_allocable_costs: billing.total_allocable_costs ?? 0,
      tenant_share: billing.tenant_share ?? 0,
      prepayments: billing.prepayments ?? 0,
      balance: billing.balance ?? 0,
      status: billing.status,
      created_at: billing.created_at,
      items: billingItems,
      warnings: [],
    };
  }

  /**
   * Generate PDF for a billing.
   */
  async generatePdf(id: string, userId: string): Promise<Buffer> {
    const billing = this.getById(id, userId);

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Title
      doc.fontSize(18).text('Nebenkostenabrechnung', { align: 'center' });
      doc.moveDown();

      // Period
      doc.fontSize(12).text(`Abrechnungszeitraum: ${billing.period_start} bis ${billing.period_end}`);
      doc.moveDown();

      // Cost positions table
      doc.fontSize(14).text('Kostenpositionen', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(10);
      for (const item of billing.items) {
        const completeMark = item.is_complete ? '' : ' [unvollständig]';
        doc.text(
          `${item.category_name} — Gesamtkosten: ${this.formatCents(item.total_cost)} EUR | ` +
          `Umlageschlüssel: ${item.allocation_key} | ` +
          `Mieteranteil: ${this.formatCents(item.tenant_share)} EUR${completeMark}`
        );
      }
      doc.moveDown();

      // Summary
      doc.fontSize(14).text('Zusammenfassung', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Umlagefähige Gesamtkosten: ${this.formatCents(billing.total_allocable_costs)} EUR`);
      doc.text(`Mieteranteil gesamt: ${this.formatCents(billing.tenant_share)} EUR`);
      doc.text(`Vorauszahlungen: ${this.formatCents(billing.prepayments)} EUR`);
      doc.moveDown();

      // Result
      const balanceLabel = billing.balance >= 0 ? 'Nachzahlung' : 'Guthaben';
      const balanceAmount = Math.abs(billing.balance);
      doc.fontSize(14).text(`Ergebnis: ${balanceLabel} ${this.formatCents(balanceAmount)} EUR`, { bold: true } as any);

      doc.end();
    });
  }

  private formatCents(cents: number): string {
    const euros = cents / 100;
    return euros.toFixed(2).replace('.', ',');
  }

  private validatePeriod(periodStart: string, periodEnd: string): void {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const error = new Error('Ungültiges Datumsformat für Abrechnungszeitraum') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (end <= start) {
      const error = new Error('Enddatum muss nach Startdatum liegen') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Calculate difference in months
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (months < 1 || months > 12) {
      const error = new Error('Abrechnungszeitraum muss zwischen 1 und 12 Monaten betragen') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }
  }
}
