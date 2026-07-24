CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  event_name TEXT NOT NULL,
  page TEXT,
  landing_page TEXT,
  referrer TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  term TEXT,
  content TEXT,
  gclid TEXT,
  fbclid TEXT,
  msclkid TEXT,
  service TEXT,
  link_url TEXT,
  link_text TEXT,
  phone_number TEXT,
  whatsapp_number TEXT,
  session_id TEXT,
  client_id TEXT,
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_events_occurred_at ON lead_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_event_name ON lead_events (event_name);
CREATE INDEX IF NOT EXISTS idx_lead_events_session_id ON lead_events (session_id);

ALTER TABLE leads ADD COLUMN landing_page TEXT;
ALTER TABLE leads ADD COLUMN referrer TEXT;
ALTER TABLE leads ADD COLUMN utm_source TEXT;
ALTER TABLE leads ADD COLUMN utm_medium TEXT;
ALTER TABLE leads ADD COLUMN utm_campaign TEXT;
ALTER TABLE leads ADD COLUMN utm_term TEXT;
ALTER TABLE leads ADD COLUMN utm_content TEXT;
ALTER TABLE leads ADD COLUMN gclid TEXT;
ALTER TABLE leads ADD COLUMN fbclid TEXT;
ALTER TABLE leads ADD COLUMN msclkid TEXT;
ALTER TABLE leads ADD COLUMN session_id TEXT;
ALTER TABLE leads ADD COLUMN client_id TEXT;
