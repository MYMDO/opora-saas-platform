/** Тонкий клієнт Runtime API (published schema + records). */

export const API_BASE: string = ((import.meta.env?.VITE_API_BASE as string | undefined) ?? '').trim();

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('opora-auth-token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Opora-Tenant': resolveTenant(), ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      issues?: Array<{ message?: string }>;
    } | null;
    const detail = body?.issues?.map((i) => i.message).filter(Boolean).join('; ');
    const message = [body?.error, detail].filter(Boolean).join(': ') || `API ${path} → ${res.status}`;
    const err = new Error(message) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function resolveTenant(): string {
  const fromHash = /^#\/t\/([a-z0-9-]+)/.exec(window.location.hash)?.[1];
  return fromHash ?? 'demo';
}

/* ------------------------------ типи ------------------------------ */

export interface FieldVM {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export interface EntityVM {
  apiName: string;
  label: string;
  fields: FieldVM[];
}

export interface PageVM {
  path: string;
  label: string;
  entity: string;
  view: { kind: string; columns?: string[]; fields?: string[]; groupBy?: string };
}

export interface PublishedSchema {
  version: number;
  definition: {
    app: { slug: string; name: string };
    entities: EntityVM[];
    pages: PageVM[];
  };
}

export interface RecordRow {
  id: string;
  data: Record<string, unknown>;
}

export interface AppMeta {
  slug: string;
  name: string;
  activeVersion: number | null;
}

export interface ReleaseMeta {
  version: number;
  status: string;
  publishedAt: string | null;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorId: string | null;
  action: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  occurredAt: string;
}

export interface WorkflowRun {
  idempotencyKey: string;
  tenantId: string;
  workflowOn: string;
  status: 'running' | 'ok' | 'error' | 'skipped';
  error?: string | null;
  createdAt: string;
  finishedAt?: string | null;
}

/* ---------------------------- виклики ----------------------------- */

export const client = {
  getSchema: (slug: string) =>
    req<PublishedSchema>(`/v1/apps/${slug}/schema`),
  issueToken: (email: string) =>
    req<{ token: string; userId: string }>(`/v1/auth/token`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  listApps: () => req<{ apps: AppMeta[] }>(`/v1/apps`).then((r) => r.apps),
  createApp: (slug: string, name: string) =>
    req<{ app: AppMeta }>(`/v1/apps`, {
      method: 'POST',
      body: JSON.stringify({ slug, name }),
    }).then((r) => r.app),
  listReleases: (slug: string) =>
    req<{ releases: ReleaseMeta[] }>(`/v1/apps/${slug}/releases`).then((r) => r.releases),
  createDraft: (slug: string, definition: unknown) =>
    req<{ release: ReleaseMeta }>(`/v1/apps/${slug}/releases`, {
      method: 'POST',
      body: JSON.stringify(definition),
    }).then((r) => r.release),
  publishRelease: (slug: string, version: number) =>
    req<{ release: ReleaseMeta }>(`/v1/apps/${slug}/releases/${version}/publish`, {
      method: 'POST',
    }).then((r) => r.release),
  listRecords: (
    slug: string,
    entity: string,
    opts?: {
      filters?: Record<string, string>;
      offset?: number;
      limit?: number;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      q?: string;
    },
  ) => {
    const params = new URLSearchParams();
    if (opts?.filters) for (const [k, v] of Object.entries(opts.filters)) params.set(k, v);
    if (opts?.offset !== undefined) params.set('_offset', String(opts.offset));
    if (opts?.limit !== undefined) params.set('_limit', String(opts.limit));
    if (opts?.sortBy) {
      params.set('_sort', opts.sortBy);
      if (opts.sortDir) params.set('_dir', opts.sortDir);
    }
    if (opts?.q?.trim()) params.set('_q', opts.q.trim());
    const qs = params.toString() ? `?${params}` : '';
    return req<{ records: RecordRow[] }>(
      `/v1/apps/${slug}/data/${entity}${qs}`,
    ).then((r) => r.records);
  },
  createRecord: (slug: string, entity: string, data: Record<string, unknown>) =>
    req<{ record: RecordRow }>(`/v1/apps/${slug}/data/${entity}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.record),
  updateRecord: (slug: string, entity: string, id: string, patch: Record<string, unknown>) =>
    req<{ record: RecordRow }>(`/v1/apps/${slug}/data/${entity}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.record),
  deleteRecord: (slug: string, entity: string, id: string) =>
    req<{ ok: boolean }>(`/v1/apps/${slug}/data/${entity}/${id}`, { method: 'DELETE' }),
  getAudit: (opts?: { limit?: number; action?: string }) => {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts?.action) params.set('action', opts.action);
    const qs = params.toString() ? `?${params}` : '';
    return req<{ events: AuditEvent[] }>(`/v1/audit${qs}`).then((r) => r.events);
  },
  getWorkflowRuns: (limit = 50) =>
    req<{ runs: WorkflowRun[] }>(`/v1/workflow-runs?limit=${limit}`).then((r) => r.runs),
  getStats: (slug: string, entity: string, groupBy: string) =>
    req<{ groups: Array<{ value: string | number | boolean | null; count: number }> }>(
      `/v1/apps/${slug}/data/${entity}/stats?groupBy=${encodeURIComponent(groupBy)}`,
    ).then((r) => r.groups),
  getConnections: () =>
    req<{ connections: Array<{ slug: string; configured: boolean }> }>('/v1/connections').then(
      (r) => r.connections,
    ),
};
