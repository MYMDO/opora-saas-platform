-- Міграція 0001: ядро сценарію (Free Tier: D1/SQLite, без RLS —
-- ізоляція тенантів на рівні запитів; гроші зберігаємо в цілих ₴)

CREATE TABLE IF NOT EXISTS contractors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'demo',
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  used_uah INTEGER NOT NULL DEFAULT 0 CHECK (used_uah >= 0),
  limit_uah INTEGER NOT NULL CHECK (limit_uah > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_contractors_tenant ON contractors (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'demo',
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  monthly_salary_uah INTEGER NOT NULL DEFAULT 0 CHECK (monthly_salary_uah >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS enterprise_booking (
  tenant_id TEXT PRIMARY KEY,
  territory_type TEXT NOT NULL DEFAULT 'regular' CHECK (territory_type IN ('regular', 'frontline')),
  has_critical_status INTEGER NOT NULL DEFAULT 0,
  is_critical_industry INTEGER NOT NULL DEFAULT 0,
  has_tax_debt INTEGER NOT NULL DEFAULT 0,
  obligated_count INTEGER NOT NULL DEFAULT 0 CHECK (obligated_count >= 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0)
);

INSERT OR IGNORE INTO enterprise_booking (tenant_id) VALUES ('demo');
