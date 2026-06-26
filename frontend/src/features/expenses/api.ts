import { api } from '../../shared/api/client';
import { parseCurrencyInput } from '../../shared/utils/formatting';
import type { Expense, ExpenseFormData, SplitRow, BookingSplit, Document, ExpenseFilters } from './types';

/** Fetch expenses with optional filters */
export async function fetchExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  const params: Record<string, string> = {};
  if (filters.propertyId) params.propertyId = filters.propertyId;
  if (filters.year) params.year = filters.year;
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.is_allocable) params.flags = 'is_allocable';
  if (filters.is_tax_deductible) params.flags = 'is_tax_deductible';
  if (filters.requires_capitalization) params.flags = 'requires_capitalization';
  if (filters.is_financing_related) params.flags = 'is_financing_related';
  return api.get<Expense[]>('/expenses', params);
}

/** Fetch a single expense by ID */
export async function fetchExpense(id: string): Promise<Expense> {
  const raw = await api.get<{
    id: string;
    property_id: string;
    user_id: string;
    type: string;
    booking_date: string;
    total_amount: number;
    counterparty: string | null;
    description: string | null;
    category_name: string | null;
    document_count: number;
    splits: Array<{
      category_id: string;
      is_allocable: boolean;
      is_tax_deductible: boolean;
      requires_capitalization: boolean;
      is_financing_related: boolean;
    }>;
    created_at: string;
    updated_at: string;
  }>(`/expenses/${id}`);

  const firstSplit = raw.splits?.[0];

  return {
    id: raw.id,
    property_id: raw.property_id,
    user_id: raw.user_id,
    type: 'expense',
    booking_date: raw.booking_date,
    total_amount: raw.total_amount,
    counterparty: raw.counterparty || '',
    description: raw.description || '',
    category_id: firstSplit?.category_id || '',
    category_name: raw.category_name || undefined,
    is_allocable: firstSplit?.is_allocable ?? false,
    is_tax_deductible: firstSplit?.is_tax_deductible ?? false,
    requires_capitalization: firstSplit?.requires_capitalization ?? false,
    is_financing_related: firstSplit?.is_financing_related ?? false,
    has_splits: (raw.splits?.length ?? 0) > 1,
    document_count: raw.document_count ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

/** Create a new expense */
export async function createExpense(data: ExpenseFormData): Promise<Expense> {
  const totalAmount = parseCurrencyInput(data.total_amount) ?? 0;
  return api.post<Expense>('/expenses', {
    property_id: data.property_id,
    booking_date: data.booking_date,
    total_amount: totalAmount,
    counterparty: data.counterparty.trim() || null,
    description: data.description.trim() || null,
    splits: [
      {
        amount: totalAmount,
        category_id: data.category_id,
      },
    ],
  });
}

/** Update an existing expense */
export async function updateExpense(id: string, data: ExpenseFormData): Promise<Expense> {
  const totalAmount = parseCurrencyInput(data.total_amount) ?? 0;
  return api.put<Expense>(`/expenses/${id}`, {
    booking_date: data.booking_date,
    total_amount: totalAmount,
    counterparty: data.counterparty.trim() || null,
    description: data.description.trim() || null,
    splits: [
      {
        amount: totalAmount,
        category_id: data.category_id,
      },
    ],
  });
}

/** Delete an expense */
export async function deleteExpense(id: string): Promise<void> {
  return api.delete(`/expenses/${id}`);
}

/** Create split bookings for an expense */
export async function createSplit(expenseId: string, splits: SplitRow[]): Promise<BookingSplit[]> {
  return api.post<BookingSplit[]>(`/expenses/${expenseId}/split`, {
    splits: splits.map((s) => ({
      amount: parseCurrencyInput(s.amount) ?? 0,
      category_id: s.category_id,
      is_allocable: s.is_allocable,
      is_tax_deductible: s.is_tax_deductible,
      requires_capitalization: s.requires_capitalization,
      is_financing_related: s.is_financing_related,
    })),
  });
}

/** Update split bookings for an expense */
export async function updateSplit(expenseId: string, splits: SplitRow[]): Promise<BookingSplit[]> {
  return api.put<BookingSplit[]>(`/expenses/${expenseId}/split`, {
    splits: splits.map((s) => ({
      id: s.id,
      amount: parseCurrencyInput(s.amount) ?? 0,
      category_id: s.category_id,
      is_allocable: s.is_allocable,
      is_tax_deductible: s.is_tax_deductible,
      requires_capitalization: s.requires_capitalization,
      is_financing_related: s.is_financing_related,
    })),
  });
}

/** Upload a document */
export async function uploadDocument(file: File, metadata?: { keywords?: string[] }): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata?.keywords) {
    formData.append('keywords', JSON.stringify(metadata.keywords));
  }
  return api.upload<Document>('/documents/upload', formData);
}

/** Link a document to an entity */
export async function linkDocument(
  documentId: string,
  entityType: 'property' | 'booking' | 'loan' | 'lease',
  entityId: string
): Promise<void> {
  return api.post(`/documents/${documentId}/link`, {
    entity_type: entityType,
    entity_id: entityId,
  });
}
