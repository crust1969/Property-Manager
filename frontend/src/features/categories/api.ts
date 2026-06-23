import { api } from '../../shared/api/client';
import type { Category, CategoryFormData } from './types';

/** Fetch all categories, optionally filtered by property */
export async function fetchCategories(propertyId?: string): Promise<Category[]> {
  const params: Record<string, string> = {};
  if (propertyId) params.propertyId = propertyId;
  return api.get<Category[]>('/categories', params);
}

/** Create a new user-defined category */
export async function createCategory(data: CategoryFormData): Promise<Category> {
  return api.post<Category>('/categories', {
    name: data.name.trim(),
    type: data.type,
    property_id: data.property_id || null,
    is_allocable: data.is_allocable,
    is_tax_deductible: data.is_tax_deductible,
    requires_capitalization: data.requires_capitalization,
    is_financing_related: data.is_financing_related,
  });
}

/** Update an existing user-defined category */
export async function updateCategory(id: string, data: CategoryFormData): Promise<Category> {
  return api.put<Category>(`/categories/${id}`, {
    name: data.name.trim(),
    type: data.type,
    property_id: data.property_id || null,
    is_allocable: data.is_allocable,
    is_tax_deductible: data.is_tax_deductible,
    requires_capitalization: data.requires_capitalization,
    is_financing_related: data.is_financing_related,
  });
}

/** Deactivate a category (soft-delete) */
export async function deactivateCategory(id: string): Promise<void> {
  return api.post(`/categories/${id}/deactivate`);
}
