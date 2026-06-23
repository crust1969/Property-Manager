import type Database from 'better-sqlite3';

export interface AcquisitionRecord {
  id: string;
  property_id: string;
  purchase_price: number;
  purchase_date: string;
  transfer_date: string | null;
  notary_cost: number;
  transfer_tax: number;
  land_registry_cost: number;
  broker_cost: number;
  building_share: number;
  land_share: number;
  afa_basis: number;
  afa_rate: number | null;
  afa_start_date: string | null;
}

export interface UpsertAcquisitionData {
  id: string;
  property_id: string;
  purchase_price: number;
  purchase_date: string;
  transfer_date: string | null;
  notary_cost: number;
  transfer_tax: number;
  land_registry_cost: number;
  broker_cost: number;
  building_share: number;
  land_share: number;
  afa_basis: number;
  afa_rate: number | null;
  afa_start_date: string | null;
}

export class AcquisitionRepository {
  constructor(private db: Database.Database) {}

  findByPropertyId(propertyId: string): AcquisitionRecord | undefined {
    return this.db
      .prepare('SELECT * FROM acquisitions WHERE property_id = ?')
      .get(propertyId) as AcquisitionRecord | undefined;
  }

  upsert(data: UpsertAcquisitionData): AcquisitionRecord {
    const existing = this.findByPropertyId(data.property_id);

    if (existing) {
      this.db
        .prepare(
          `UPDATE acquisitions SET
            purchase_price = ?,
            purchase_date = ?,
            transfer_date = ?,
            notary_cost = ?,
            transfer_tax = ?,
            land_registry_cost = ?,
            broker_cost = ?,
            building_share = ?,
            land_share = ?,
            afa_basis = ?,
            afa_rate = ?,
            afa_start_date = ?
          WHERE property_id = ?`
        )
        .run(
          data.purchase_price,
          data.purchase_date,
          data.transfer_date,
          data.notary_cost,
          data.transfer_tax,
          data.land_registry_cost,
          data.broker_cost,
          data.building_share,
          data.land_share,
          data.afa_basis,
          data.afa_rate,
          data.afa_start_date,
          data.property_id
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO acquisitions (id, property_id, purchase_price, purchase_date, transfer_date, notary_cost, transfer_tax, land_registry_cost, broker_cost, building_share, land_share, afa_basis, afa_rate, afa_start_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.id,
          data.property_id,
          data.purchase_price,
          data.purchase_date,
          data.transfer_date,
          data.notary_cost,
          data.transfer_tax,
          data.land_registry_cost,
          data.broker_cost,
          data.building_share,
          data.land_share,
          data.afa_basis,
          data.afa_rate,
          data.afa_start_date
        );
    }

    return this.findByPropertyId(data.property_id)!;
  }
}
