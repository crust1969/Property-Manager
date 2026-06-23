-- 002_afa_positions.sql
-- Neue Tabelle für AfA-Positionen (Multi-Position Abschreibung)

-- AfA-Positionen
CREATE TABLE IF NOT EXISTS afa_positions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) >= 1 AND length(name) <= 100),
  method TEXT NOT NULL CHECK(method IN ('linear', 'degressiv')),
  basis INTEGER NOT NULL CHECK(basis > 0),
  rate REAL NOT NULL CHECK(rate >= 0.0001 AND rate <= 1.0),
  duration_years INTEGER CHECK(duration_years IS NULL OR (duration_years >= 1 AND duration_years <= 100)),
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(property_id, name)
);

CREATE INDEX IF NOT EXISTS idx_afa_positions_property_id ON afa_positions(property_id);

-- Bestehende AfA-Daten migrieren: "Gebäude"-Position für jede Anschaffung mit afa_basis > 0
INSERT INTO afa_positions (id, property_id, name, method, basis, rate, duration_years, start_date, created_at, updated_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  property_id,
  'Gebäude',
  'linear',
  afa_basis,
  COALESCE(afa_rate, 0.02),
  NULL,
  COALESCE(afa_start_date, purchase_date),
  datetime('now'),
  datetime('now')
FROM acquisitions
WHERE afa_basis > 0;
