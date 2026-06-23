-- 001_initial_schema.sql
-- Initiales Datenbankschema für den Vermieter Kapitalanlagen Manager
-- Alle Geldbeträge als INTEGER (Cents), UUIDs als TEXT, Datumsangaben als TEXT (ISO 8601)

-- Benutzer
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(name) >= 1 AND length(name) <= 100),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Immobilienobjekte
CREATE TABLE properties (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) >= 1 AND length(name) <= 100),
  street TEXT NOT NULL CHECK(length(street) >= 1 AND length(street) <= 150),
  zip_code TEXT NOT NULL CHECK(length(zip_code) = 5 AND zip_code GLOB '[0-9][0-9][0-9][0-9][0-9]'),
  city TEXT NOT NULL CHECK(length(city) >= 1 AND length(city) <= 100),
  property_type TEXT NOT NULL CHECK(property_type IN ('Wohnung','Haus','Gewerbe','Garage','Grundstück')),
  living_area_sqm REAL NOT NULL CHECK(living_area_sqm >= 1 AND living_area_sqm <= 99999),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_properties_user_id ON properties(user_id);

-- Anschaffungsdaten
CREATE TABLE acquisitions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
  purchase_price INTEGER NOT NULL CHECK(purchase_price > 0),
  purchase_date TEXT NOT NULL,
  transfer_date TEXT,
  notary_cost INTEGER NOT NULL DEFAULT 0,
  transfer_tax INTEGER NOT NULL DEFAULT 0,
  land_registry_cost INTEGER NOT NULL DEFAULT 0,
  broker_cost INTEGER NOT NULL DEFAULT 0,
  building_share INTEGER NOT NULL,
  land_share INTEGER NOT NULL,
  afa_basis INTEGER NOT NULL,
  afa_rate REAL,
  afa_start_date TEXT
);

CREATE INDEX idx_acquisitions_property_id ON acquisitions(property_id);

-- Mieter
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK(length(first_name) >= 1 AND length(first_name) <= 50),
  last_name TEXT NOT NULL CHECK(length(last_name) >= 1 AND length(last_name) <= 50),
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_tenants_property_id ON tenants(property_id);

-- Mietverträge
CREATE TABLE leases (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT,
  cold_rent INTEGER NOT NULL CHECK(cold_rent > 0),
  operating_cost_advance INTEGER NOT NULL DEFAULT 0,
  heating_cost_advance INTEGER NOT NULL DEFAULT 0,
  due_day INTEGER NOT NULL CHECK(due_day >= 1 AND due_day <= 28),
  rent_model TEXT NOT NULL CHECK(rent_model IN ('konstant','staffel','index','manuell')),
  status TEXT NOT NULL CHECK(status IN ('aktiv','beendet')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_leases_property_id ON leases(property_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);

-- Sollstellungen (erwartete Mietzahlungen)
CREATE TABLE receivables (
  id TEXT PRIMARY KEY,
  lease_id TEXT NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  due_date TEXT NOT NULL,
  cold_rent INTEGER NOT NULL,
  operating_cost INTEGER NOT NULL,
  heating_cost INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('offen','bezahlt','teilbezahlt','überfällig','storniert'))
);

CREATE INDEX idx_receivables_lease_id ON receivables(lease_id);
CREATE INDEX idx_receivables_property_id ON receivables(property_id);
CREATE INDEX idx_receivables_due_date ON receivables(due_date);

-- Kautionen
CREATE TABLE deposits (
  id TEXT PRIMARY KEY,
  lease_id TEXT NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  received_date TEXT NOT NULL,
  account_reference TEXT NOT NULL CHECK(length(account_reference) <= 34),
  status TEXT NOT NULL CHECK(status IN ('hinterlegt','teilweise_zurueckgezahlt','vollstaendig_zurueckgezahlt','verrechnet')),
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_deposits_lease_id ON deposits(lease_id);
CREATE INDEX idx_deposits_property_id ON deposits(property_id);

-- Kategorien (Einnahmen/Ausgaben-Klassifikation)
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) >= 1 AND length(name) <= 100),
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  is_allocable INTEGER NOT NULL DEFAULT 0 CHECK(is_allocable IN (0, 1)),
  is_tax_deductible INTEGER NOT NULL DEFAULT 0 CHECK(is_tax_deductible IN (0, 1)),
  requires_capitalization INTEGER NOT NULL DEFAULT 0 CHECK(requires_capitalization IN (0, 1)),
  is_financing_related INTEGER NOT NULL DEFAULT 0 CHECK(is_financing_related IN (0, 1)),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK(is_system IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  UNIQUE(property_id, name, type)
);

CREATE INDEX idx_categories_property_id ON categories(property_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(type);

-- Buchungen (Einnahmen & Ausgaben)
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('income','expense','non_cash','deposit','transfer')),
  booking_date TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  counterparty TEXT CHECK(counterparty IS NULL OR length(counterparty) <= 200),
  description TEXT CHECK(description IS NULL OR length(description) <= 500),
  receivable_id TEXT REFERENCES receivables(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_bookings_property_id ON bookings(property_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_receivable_id ON bookings(receivable_id);

-- Teilbuchungen (Split-Buchungen)
CREATE TABLE booking_splits (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  is_allocable INTEGER NOT NULL CHECK(is_allocable IN (0, 1)),
  is_tax_deductible INTEGER NOT NULL CHECK(is_tax_deductible IN (0, 1)),
  requires_capitalization INTEGER NOT NULL CHECK(requires_capitalization IN (0, 1)),
  is_financing_related INTEGER NOT NULL CHECK(is_financing_related IN (0, 1)),
  overridden_flags TEXT DEFAULT '[]'
);

CREATE INDEX idx_booking_splits_booking_id ON booking_splits(booking_id);
CREATE INDEX idx_booking_splits_category_id ON booking_splits(category_id);

-- Darlehen
CREATE TABLE loans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lender TEXT NOT NULL CHECK(length(lender) >= 1 AND length(lender) <= 100),
  contract_number TEXT CHECK(contract_number IS NULL OR length(contract_number) <= 50),
  loan_amount INTEGER NOT NULL,
  interest_rate REAL NOT NULL CHECK(interest_rate >= 0 AND interest_rate <= 99.99),
  repayment_rate REAL NOT NULL CHECK(repayment_rate >= 0 AND repayment_rate <= 99.99),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  fixed_interest_months INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_loans_property_id ON loans(property_id);

-- Darlehenszahlungen
CREATE TABLE loan_payments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  payment_date TEXT NOT NULL,
  interest_amount INTEGER NOT NULL,
  repayment_amount INTEGER NOT NULL,
  fee_amount INTEGER NOT NULL DEFAULT 0,
  extra_repayment INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_payment_date ON loan_payments(payment_date);

-- Dokumente
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL CHECK(length(filename) >= 1 AND length(filename) <= 255),
  file_type TEXT NOT NULL CHECK(file_type IN ('pdf','jpeg','png')),
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  keywords TEXT DEFAULT '[]',
  uploaded_at TEXT NOT NULL
);

CREATE INDEX idx_documents_user_id ON documents(user_id);

-- Dokumentenverknüpfungen
CREATE TABLE document_links (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('property','booking','loan','lease')),
  entity_id TEXT NOT NULL
);

CREATE INDEX idx_document_links_document_id ON document_links(document_id);
CREATE INDEX idx_document_links_entity ON document_links(entity_type, entity_id);

-- Erinnerungen
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  linked_entity_type TEXT CHECK(linked_entity_type IN ('lease','loan')),
  linked_entity_id TEXT,
  title TEXT NOT NULL CHECK(length(title) >= 1 AND length(title) <= 100),
  note TEXT,
  due_date TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('hoch','mittel','niedrig')),
  status TEXT NOT NULL CHECK(status IN ('offen','erledigt','verschoben')),
  recurrence TEXT CHECK(recurrence IN ('einmalig','täglich','wöchentlich','monatlich','jährlich')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_property_id ON reminders(property_id);
CREATE INDEX idx_reminders_due_date ON reminders(due_date);
CREATE INDEX idx_reminders_status ON reminders(status);

-- Audit-Log (Klassifikationsänderungen)
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  booking_split_id TEXT NOT NULL REFERENCES booking_splits(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_flag TEXT NOT NULL,
  previous_value INTEGER NOT NULL CHECK(previous_value IN (0, 1)),
  new_value INTEGER NOT NULL CHECK(new_value IN (0, 1)),
  reason TEXT NOT NULL CHECK(length(reason) >= 1 AND length(reason) <= 500),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_log_booking_split_id ON audit_log(booking_split_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Nebenkostenabrechnungen
CREATE TABLE utility_billings (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lease_id TEXT NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_allocable_costs INTEGER,
  tenant_share INTEGER,
  prepayments INTEGER,
  balance INTEGER,
  status TEXT CHECK(status IN ('entwurf','abgeschlossen')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_utility_billings_property_id ON utility_billings(property_id);
CREATE INDEX idx_utility_billings_lease_id ON utility_billings(lease_id);

-- Nebenkostenabrechnungs-Positionen
CREATE TABLE utility_billing_items (
  id TEXT PRIMARY KEY,
  billing_id TEXT NOT NULL REFERENCES utility_billings(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  total_cost INTEGER NOT NULL,
  allocation_key TEXT NOT NULL CHECK(allocation_key IN ('fläche','personen','verbrauch','direkt','manuell')),
  tenant_share INTEGER NOT NULL,
  is_complete INTEGER NOT NULL DEFAULT 1 CHECK(is_complete IN (0, 1))
);

CREATE INDEX idx_utility_billing_items_billing_id ON utility_billing_items(billing_id);
CREATE INDEX idx_utility_billing_items_category_id ON utility_billing_items(category_id);
