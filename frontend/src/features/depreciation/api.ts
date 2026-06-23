import { api } from '../../shared/api/client';
import type {
  AfaParameters,
  AfaPlanResponse,
  AfaPosition,
  CreatePositionInput,
  AfaPlanEntry,
  CombinedAfaOverview,
} from './types';

/** Fetch AfA parameters for a property */
export async function fetchAfaParameters(propertyId: string): Promise<AfaParameters> {
  return api.get<AfaParameters>(`/depreciation/${propertyId}`);
}

/** Update AfA parameters (rate + start date) for a property */
export async function updateAfaParameters(
  propertyId: string,
  data: { afa_rate: number; afa_start_date: string }
): Promise<AfaParameters> {
  return api.put<AfaParameters>(`/depreciation/${propertyId}`, data);
}

/** Fetch the full AfA plan for a property */
export async function fetchAfaPlan(propertyId: string): Promise<AfaPlanResponse> {
  return api.get<AfaPlanResponse>(`/depreciation/${propertyId}/plan`);
}

// --- Multi-position API ---

/** List all AfA positions for a property */
export async function listPositions(propertyId: string): Promise<AfaPosition[]> {
  return api.get<AfaPosition[]>(`/depreciation/${propertyId}/positions`);
}

/** Create a new AfA position */
export async function createPosition(
  propertyId: string,
  data: CreatePositionInput
): Promise<AfaPosition> {
  return api.post<AfaPosition>(`/depreciation/${propertyId}/positions`, data);
}

/** Update an existing AfA position */
export async function updatePosition(
  propertyId: string,
  positionId: string,
  data: Partial<CreatePositionInput>
): Promise<AfaPosition> {
  return api.put<AfaPosition>(`/depreciation/${propertyId}/positions/${positionId}`, data);
}

/** Delete an AfA position */
export async function deletePosition(propertyId: string, positionId: string): Promise<void> {
  return api.delete<void>(`/depreciation/${propertyId}/positions/${positionId}`);
}

/** Fetch the plan for a single AfA position */
export async function getPositionPlan(
  propertyId: string,
  positionId: string
): Promise<{ position: AfaPosition; plan: AfaPlanEntry[] }> {
  return api.get<{ position: AfaPosition; plan: AfaPlanEntry[] }>(
    `/depreciation/${propertyId}/positions/${positionId}/plan`
  );
}

/** Fetch the combined AfA overview for all positions of a property */
export async function getCombinedOverview(propertyId: string): Promise<CombinedAfaOverview> {
  return api.get<CombinedAfaOverview>(`/depreciation/${propertyId}/combined`);
}
