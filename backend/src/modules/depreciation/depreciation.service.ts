import type { FastifyInstance } from 'fastify';
import { AcquisitionRepository, type AcquisitionRecord } from '../property/acquisition.repository.js';
import { PropertyRepository } from '../property/property.repository.js';
import { generateAfaPlan, generateAfaPlanByMethod, durationToRate, type AfaPlanEntry } from './afa.calculator.js';
import { PositionRepository, type AfaPositionRecord, type CreatePositionInput, type UpdatePositionInput } from './position.repository.js';

export interface AfaParameters {
  property_id: string;
  afa_basis: number;
  afa_rate: number | null;
  afa_start_date: string | null;
}

export interface UpdateAfaParametersInput {
  afa_rate: number;
  afa_start_date: string;
}

export interface CombinedAfaYearEntry {
  year: number;
  totalAmount: number;
  positions: { positionId: string; name: string; amount: number }[];
}

export interface CombinedAfaOverview {
  propertyId: string;
  years: CombinedAfaYearEntry[];
}

export class DepreciationService {
  private acquisitionRepository: AcquisitionRepository;
  private propertyRepository: PropertyRepository;
  private positionRepository: PositionRepository;

  constructor(private app: FastifyInstance) {
    this.acquisitionRepository = new AcquisitionRepository(app.db);
    this.propertyRepository = new PropertyRepository(app.db);
    this.positionRepository = new PositionRepository(app.db);
  }

  /**
   * Get AfA parameters for a property.
   */
  getAfaParameters(propertyId: string, userId: string): AfaParameters {
    // Verify property belongs to user
    const property = this.propertyRepository.findById(propertyId, userId);
    if (!property) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const acquisition = this.acquisitionRepository.findByPropertyId(propertyId);
    if (!acquisition) {
      const error = new Error('Keine Anschaffungsdaten für dieses Objekt vorhanden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return {
      property_id: acquisition.property_id,
      afa_basis: acquisition.afa_basis,
      afa_rate: acquisition.afa_rate,
      afa_start_date: acquisition.afa_start_date,
    };
  }

  /**
   * Update AfA rate and start date for a property.
   */
  updateAfaParameters(propertyId: string, userId: string, input: UpdateAfaParametersInput): AfaParameters {
    // Verify property belongs to user
    const property = this.propertyRepository.findById(propertyId, userId);
    if (!property) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const acquisition = this.acquisitionRepository.findByPropertyId(propertyId);
    if (!acquisition) {
      const error = new Error('Keine Anschaffungsdaten für dieses Objekt vorhanden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate rate
    if (input.afa_rate < 0.0001 || input.afa_rate > 1.0) {
      const error = new Error('AfA-Satz muss zwischen 0,01% und 100% liegen') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Validate start date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.afa_start_date)) {
      const error = new Error('Ungültiges Datumsformat für AfA-Startdatum (erwartet: YYYY-MM-DD)') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Update in database
    this.app.db
      .prepare('UPDATE acquisitions SET afa_rate = ?, afa_start_date = ? WHERE property_id = ?')
      .run(input.afa_rate, input.afa_start_date, propertyId);

    return {
      property_id: propertyId,
      afa_basis: acquisition.afa_basis,
      afa_rate: input.afa_rate,
      afa_start_date: input.afa_start_date,
    };
  }

  /**
   * Generate the full AfA plan for a property.
   */
  getAfaPlan(propertyId: string, userId: string): { parameters: AfaParameters; plan: AfaPlanEntry[] } {
    // Verify property belongs to user
    const property = this.propertyRepository.findById(propertyId, userId);
    if (!property) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const acquisition = this.acquisitionRepository.findByPropertyId(propertyId);
    if (!acquisition) {
      const error = new Error('Keine Anschaffungsdaten für dieses Objekt vorhanden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Validate required parameters
    if (!acquisition.afa_rate || !acquisition.afa_start_date) {
      const error = new Error('AfA-Satz und Startdatum müssen gesetzt sein, um einen AfA-Plan zu generieren') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (acquisition.afa_basis <= 0) {
      const error = new Error('AfA-Bemessungsgrundlage muss größer als 0 sein') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (acquisition.afa_rate < 0.0001 || acquisition.afa_rate > 1.0) {
      const error = new Error('AfA-Satz muss zwischen 0,01% und 100% liegen') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const plan = generateAfaPlan(acquisition.afa_basis, acquisition.afa_rate, acquisition.afa_start_date);

    return {
      parameters: {
        property_id: propertyId,
        afa_basis: acquisition.afa_basis,
        afa_rate: acquisition.afa_rate,
        afa_start_date: acquisition.afa_start_date,
      },
      plan,
    };
  }

  // --- New multi-position methods ---

  /**
   * Verify property ownership, throw 403 if not owned by user.
   */
  private verifyPropertyOwnership(propertyId: string, userId: string): void {
    const property = this.propertyRepository.findById(propertyId, userId);
    if (!property) {
      const error = new Error('Zugriff verweigert') as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }
  }

  /**
   * List all AfA positions for a property.
   */
  listPositions(propertyId: string, userId: string): AfaPositionRecord[] {
    this.verifyPropertyOwnership(propertyId, userId);
    return this.positionRepository.findAllByPropertyId(propertyId);
  }

  /**
   * Create a new AfA position for a property.
   */
  createPosition(propertyId: string, userId: string, input: { name: string; method: 'linear' | 'degressiv'; basis: number; rate?: number; duration_years?: number; start_date: string }): AfaPositionRecord {
    this.verifyPropertyOwnership(propertyId, userId);

    // Check max 20 positions
    const count = this.positionRepository.countByPropertyId(propertyId);
    if (count >= 20) {
      const error = new Error('Maximal 20 AfA-Positionen pro Objekt erlaubt') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Check unique name
    if (this.positionRepository.nameExistsForProperty(propertyId, input.name)) {
      const error = new Error('Eine Position mit diesem Namen existiert bereits') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    // Determine rate: use provided rate, or convert duration_years to rate
    let rate: number;
    if (input.rate !== undefined) {
      rate = input.rate;
    } else if (input.duration_years !== undefined) {
      rate = durationToRate(input.duration_years);
    } else {
      const error = new Error('AfA-Satz oder Nutzungsdauer muss angegeben werden') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    return this.positionRepository.create({
      property_id: propertyId,
      name: input.name,
      method: input.method,
      basis: input.basis,
      rate,
      duration_years: input.duration_years ?? null,
      start_date: input.start_date,
    });
  }

  /**
   * Update an existing AfA position.
   */
  updatePosition(positionId: string, userId: string, input: { name?: string; method?: 'linear' | 'degressiv'; basis?: number; rate?: number; duration_years?: number | null; start_date?: string }): AfaPositionRecord {
    const position = this.positionRepository.findById(positionId);
    if (!position) {
      const error = new Error('AfA-Position nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Verify ownership via property
    this.verifyPropertyOwnership(position.property_id, userId);

    // Check unique name (excluding self)
    if (input.name !== undefined && this.positionRepository.nameExistsForProperty(position.property_id, input.name, positionId)) {
      const error = new Error('Eine Position mit diesem Namen existiert bereits') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    // Build update input
    const updateInput: UpdatePositionInput = {};
    if (input.name !== undefined) updateInput.name = input.name;
    if (input.method !== undefined) updateInput.method = input.method;
    if (input.basis !== undefined) updateInput.basis = input.basis;
    if (input.start_date !== undefined) updateInput.start_date = input.start_date;

    // Handle rate/duration_years
    if (input.rate !== undefined) {
      updateInput.rate = input.rate;
    } else if (input.duration_years !== undefined && input.duration_years !== null) {
      updateInput.rate = durationToRate(input.duration_years);
    }
    if (input.duration_years !== undefined) {
      updateInput.duration_years = input.duration_years;
    }

    return this.positionRepository.update(positionId, updateInput);
  }

  /**
   * Delete an AfA position.
   */
  deletePosition(positionId: string, userId: string): void {
    const position = this.positionRepository.findById(positionId);
    if (!position) {
      const error = new Error('AfA-Position nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Verify ownership via property
    this.verifyPropertyOwnership(position.property_id, userId);

    this.positionRepository.delete(positionId);
  }

  /**
   * Get the AfA plan for a single position.
   */
  getPositionPlan(positionId: string, userId: string): { position: AfaPositionRecord; plan: AfaPlanEntry[] } {
    const position = this.positionRepository.findById(positionId);
    if (!position) {
      const error = new Error('AfA-Position nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Verify ownership via property
    this.verifyPropertyOwnership(position.property_id, userId);

    const plan = generateAfaPlanByMethod(position.method, position.basis, position.rate, position.start_date);

    return { position, plan };
  }

  /**
   * Get the combined AfA overview for a property, aggregating all positions by year.
   */
  getCombinedOverview(propertyId: string, userId: string): CombinedAfaOverview {
    this.verifyPropertyOwnership(propertyId, userId);

    const positions = this.positionRepository.findAllByPropertyId(propertyId);

    // Generate plans for each position
    const positionPlans = positions.map(pos => ({
      position: pos,
      plan: generateAfaPlanByMethod(pos.method, pos.basis, pos.rate, pos.start_date),
    }));

    // Aggregate by year
    const yearMap = new Map<number, { totalAmount: number; positions: { positionId: string; name: string; amount: number }[] }>();

    for (const { position, plan } of positionPlans) {
      for (const entry of plan) {
        if (!yearMap.has(entry.year)) {
          yearMap.set(entry.year, { totalAmount: 0, positions: [] });
        }
        const yearEntry = yearMap.get(entry.year)!;
        yearEntry.totalAmount += entry.annualAmount;
        yearEntry.positions.push({
          positionId: position.id,
          name: position.name,
          amount: entry.annualAmount,
        });
      }
    }

    // Sort by year and build result
    const years: CombinedAfaYearEntry[] = Array.from(yearMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, data]) => ({
        year,
        totalAmount: data.totalAmount,
        positions: data.positions,
      }));

    return { propertyId, years };
  }
}
