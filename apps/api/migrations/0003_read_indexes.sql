-- Індекси читань: журнал runs за тенантом + фільтр аудиту за дією

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_action ON audit_events (tenant_id, action);
