-- 003_loan_interest_only.sql
-- Tilgungsfreie Zeit: Anzahl Monate am Anfang ohne Tilgung (nur Zinszahlung)
ALTER TABLE loans ADD COLUMN interest_only_months INTEGER DEFAULT 0;
