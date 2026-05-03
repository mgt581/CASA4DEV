CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  postcode TEXT,
  service TEXT,
  timeframe TEXT,
  message TEXT,
  page TEXT,
  source TEXT,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_errors TEXT,
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_submitted_at ON leads (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_marketing_consent ON leads (marketing_consent);
