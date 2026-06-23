/** AfA parameters returned by the API */
export interface AfaParameters {
  property_id: string;
  afa_basis: number;        // in cents
  afa_rate: number | null;  // decimal, e.g. 0.02 for 2%
  afa_start_date: string | null; // ISO date YYYY-MM-DD
}

/** Single entry in the AfA plan */
export interface AfaPlanEntry {
  year: number;
  annualAmount: number;     // Jahres-AfA in cents
  cumulativeAmount: number; // Kumulierte AfA in cents
  residualValue: number;    // Restwert in cents
}

/** Response from the AfA plan endpoint */
export interface AfaPlanResponse {
  parameters: AfaParameters;
  plan: AfaPlanEntry[];
}

/** AfA position record */
export interface AfaPosition {
  id: string;
  property_id: string;
  name: string;
  method: 'linear' | 'degressiv';
  basis: number; // cents
  rate: number; // decimal
  duration_years: number | null;
  start_date: string;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new AfA position */
export interface CreatePositionInput {
  name: string;
  method: 'linear' | 'degressiv';
  basis: number; // cents
  rate?: number;
  duration_years?: number;
  start_date: string;
}

/** Single year entry in the combined AfA overview */
export interface CombinedAfaYearEntry {
  year: number;
  totalAmount: number;
  positions: { positionId: string; name: string; amount: number }[];
}

/** Combined AfA overview for all positions of a property */
export interface CombinedAfaOverview {
  propertyId: string;
  years: CombinedAfaYearEntry[];
}
