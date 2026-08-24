-- Автоматизації: outbox-дрен + журнал виконань workflow (блюпринт §6/§9 Етап 3)

ALTER TABLE outbox_events ADD COLUMN app_slug TEXT NOT NULL DEFAULT '';
ALTER TABLE outbox_events ADD COLUMN processed_at TEXT;
ALTER TABLE outbox_events ADD COLUMN process_status TEXT CHECK (process_status IN ('done', 'skipped', 'error'));
ALTER TABLE outbox_events ADD COLUMN process_error TEXT;

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events (processed_at);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  workflow_on TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error', 'skipped')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_key ON workflow_runs (idempotency_key);
