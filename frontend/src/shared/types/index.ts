/** Basis-Paginierungs-Antwort */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** API-Fehler-Antwort */
export interface ApiErrorResponse {
  message: string;
  errors?: Record<string, string>;
}

/** Objekttypen */
export type PropertyType = 'Wohnung' | 'Haus' | 'Gewerbe' | 'Garage' | 'Grundstück';

/** Mietmodell */
export type RentModel = 'konstant' | 'staffel' | 'index' | 'manuell';

/** Sollstellungs-Status */
export type ReceivableStatus = 'offen' | 'bezahlt' | 'teilbezahlt' | 'überfällig' | 'storniert';

/** Kautionsstatus */
export type DepositStatus = 'hinterlegt' | 'teilweise_zurueckgezahlt' | 'vollstaendig_zurueckgezahlt' | 'verrechnet';

/** Buchungstyp */
export type BookingType = 'income' | 'expense' | 'non_cash' | 'deposit' | 'transfer';

/** Umlageschlüssel */
export type AllocationKey = 'fläche' | 'personen' | 'verbrauch' | 'direkt' | 'manuell';

/** Erinnerungs-Priorität */
export type ReminderPriority = 'hoch' | 'mittel' | 'niedrig';

/** Erinnerungs-Status */
export type ReminderStatus = 'offen' | 'erledigt' | 'verschoben';

/** Erinnerungs-Intervall */
export type ReminderRecurrence = 'einmalig' | 'täglich' | 'wöchentlich' | 'monatlich' | 'jährlich';
