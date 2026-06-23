import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { AcquisitionRepository, type AcquisitionRecord } from './acquisition.repository.js';
import { PropertyRepository } from './property.repository.js';
import { calculateAfaBasis, type PutAcquisitionInput } from './acquisition.validators.js';

export class AcquisitionService {
  private acquisitionRepository: AcquisitionRepository;
  private propertyRepository: PropertyRepository;

  constructor(private app: FastifyInstance) {
    this.acquisitionRepository = new AcquisitionRepository(app.db);
    this.propertyRepository = new PropertyRepository(app.db);
  }

  getAcquisition(propertyId: string, userId: string): AcquisitionRecord | null {
    // Verify property belongs to user
    const property = this.propertyRepository.findById(propertyId, userId);
    if (!property) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const acquisition = this.acquisitionRepository.findByPropertyId(propertyId);
    return acquisition ?? null;
  }

  putAcquisition(propertyId: string, userId: string, input: PutAcquisitionInput): AcquisitionRecord {
    // Verify property belongs to user
    const property = this.propertyRepository.findById(propertyId, userId);
    if (!property) {
      const error = new Error('Objekt nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Calculate AfA basis
    const afaBasis = calculateAfaBasis(input);

    const data = {
      id: uuidv4(),
      property_id: propertyId,
      purchase_price: input.purchase_price,
      purchase_date: input.purchase_date,
      transfer_date: input.transfer_date ?? null,
      notary_cost: input.notary_cost,
      transfer_tax: input.transfer_tax,
      land_registry_cost: input.land_registry_cost,
      broker_cost: input.broker_cost,
      building_share: input.building_share,
      land_share: input.land_share,
      afa_basis: afaBasis,
      afa_rate: input.afa_rate ?? null,
      afa_start_date: input.afa_start_date ?? null,
    };

    return this.acquisitionRepository.upsert(data);
  }
}
