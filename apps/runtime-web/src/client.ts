/** Тонкий клієнт Runtime API (published schema + records). */

export const API_BASE: string = ((import.meta.env?.VITE_API_BASE as string | undefined) ?? '').trim();

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Opora-Tenant': resolveTenant(), ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
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
  view: { kind: string; columns?: string[]; fields?: string[] };
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

/* ---------------------------- виклики ----------------------------- */

export const client = {
  getSchema: (slug: string) =>
    req<PublishedSchema>(`/v1/apps/${slug}/schema`),
  listRecords: (slug: string, entity: string, filters?: Record<string, string>) => {
    const qs = filters ? `?${new URLSearchParams(filters)}` : '';
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
};
