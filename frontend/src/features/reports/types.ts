/** Report types available in the system */
export type ReportType =
  | 'steuerlich'
  | 'werbungskosten'
  | 'afa-plan'
  | 'zins-tilgung'
  | 'mieteingaenge'
  | 'belegvollstaendigkeit';

/** Export/display formats */
export type ReportFormat = 'json' | 'csv' | 'pdf';

/** Display labels for report types (German) */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  'steuerlich': 'Jahresübersicht steuerlich',
  'werbungskosten': 'Werbungskosten',
  'afa-plan': 'AfA-Plan',
  'zins-tilgung': 'Zins-/Tilgungsübersicht',
  'mieteingaenge': 'Mieteingangsstatus',
  'belegvollstaendigkeit': 'Belegvollständigkeit',
};

/** Display labels for format options */
export const FORMAT_LABELS: Record<ReportFormat, string> = {
  json: 'JSON (Vorschau)',
  csv: 'CSV',
  pdf: 'PDF',
};

/** Filters for report generation */
export interface ReportFilters {
  type: ReportType;
  propertyId?: string;
  year: string;
  format: ReportFormat;
}

/** Generic report response wrapper */
export interface ReportResponse<T = unknown> {
  type: ReportType;
  year: number;
  property_id?: string;
  property_name?: string;
  generated_at: string;
  data: T;
  message?: string;
}

/** Jahresübersicht steuerlich row */
export interface TaxOverviewRow {
  category: string;
  amount: number; // cents
  is_tax_deductible: boolean;
  note?: string;
}

/** Werbungskosten row */
export interface DeductibleCostRow {
  category: string;
  amount: number; // cents
  is_allocable: boolean;
  requires_capitalization: boolean;
}

/** AfA-Plan entry */
export interface AfaPlanReportEntry {
  year: number;
  annual_amount: number; // cents
  cumulative_amount: number; // cents
  residual_value: number; // cents
}

/** Zins-/Tilgungsübersicht row */
export interface LoanOverviewRow {
  loan_id: string;
  lender: string;
  payment_date: string;
  interest_amount: number; // cents
  repayment_amount: number; // cents
  fee_amount: number; // cents
  extra_repayment: number; // cents
  total: number; // cents
}

/** Mieteingangsstatus row */
export interface RentStatusRow {
  month: string;
  tenant_name: string;
  expected_amount: number; // cents
  paid_amount: number; // cents
  status: 'offen' | 'bezahlt' | 'teilbezahlt' | 'überfällig';
}

/** Belegvollständigkeit row */
export interface DocumentCompletenessRow {
  booking_id: string;
  booking_date: string;
  description: string;
  amount: number; // cents
  has_document: boolean;
}
