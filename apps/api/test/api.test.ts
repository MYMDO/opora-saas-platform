import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { signToken } from '../src/auth';
import { createApp } from '../src';
import type { ApiDeps } from '../src';
import { MemoryOutboxDrainPort, MemoryWorkflowRunsPort } from '../src/runs';
import type { SharedOutboxRow } from '../src/runs';
import { MemoryDataPort } from '@opora/data-runtime';
import { MemoryMetadataPort } from '@opora/metadata';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../packages/dsl/fixtures/service-desk.json'), 'utf-8'),
);

function jsonInit(method: string, body?: unknown, tenant = 'demo'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Opora-Tenant': tenant },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function makeClient(opts?: {
  metadata?: MemoryMetadataPort;
  data?: MemoryDataPort;
  automation?: ApiDeps['automation'];
  drainKey?: string;
  authSecret?: string;
}) {
  const metadata = opts?.metadata ?? new MemoryMetadataPort();
  const data = opts?.data ?? new MemoryDataPort();
  const app = createApp({
    metadata,
    data,
    automation: opts?.automation,
    drainKey: opts?.drainKey,
    authSecret: opts?.authSecret,
  });
  return {
    request(path: string, init?: RequestInit): Promise<Response> {
      return app.fetch(
        new Request(`https://api.test${path}`, init),
        {} as never,
        { waitUntil: () => {}, passThroughOnException: () => {} } as never,
      ) as Promise<Response>;
    },
    data,
  };
}

async function setupPublishedServiceDesk(tenant = 'demo') {
  const c = makeClient();
  await c.request('/v1/apps', jsonInit('POST', { slug: 'service-desk', name: 'Service Desk' }, tenant));
  await c.request('/v1/apps/service-desk/releases', jsonInit('POST', fixture, tenant));
  await c.request('/v1/apps/service-desk/releases/1/publish', jsonInit('POST', undefined, tenant));
  return c;
}

async function setupAdminClient() {
    const SECRET = 'audit-test-secret-32-chars!';
    const c = makeClient({ authSecret: SECRET });
    // Публікуємо service-desk щоб були дані для аудиту
    await c.request('/v1/apps', jsonInit('POST', { slug: 'service-desk', name: 'Service Desk' }));
    await c.request('/v1/apps/service-desk/releases', jsonInit('POST', fixture));
    await c.request('/v1/apps/service-desk/releases/1/publish', { method: 'POST' });
    // Отримуємо токен
    const tokenRes = await c.request('/v1/auth/token', jsonInit('POST', { email: 'admin@test.ua' }));
    const { token } = (await tokenRes.json()) as { token: string };
  return {
    c,
    request(path: string, init?: RequestInit): Promise<Response> {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return c.request(path, { ...init, headers: Object.fromEntries(headers) });
    },
  };
}

/* ----------------------- вертикальний зріз Service Desk ----------------------- */

describe('opora-api — вертикальний зріз Service Desk', () => {
  it('повний цикл: app → release → publish → schema → CRUD ticket → audit/outbox', async () => {
    const c = await setupPublishedServiceDesk();

    const schema = await c.request('/v1/apps/service-desk/schema');
    expect(schema.status).toBe(200);
    const def = (await schema.json()) as { version: number; definition: { entities: unknown[] } };
    expect(def.version).toBe(1);
    expect(def.definition.entities.length).toBe(2);

    const created = await c.request('/v1/apps/service-desk/data/ticket', jsonInit('POST', {
      title: 'Принтер не друкує',
      priority: 'high',
      requester: 'contact-42',
    }));
    expect(created.status).toBe(201);
    const record = (await created.json()) as { record: { id: string; data: Record<string, unknown> } };
    expect(record.record.data).toMatchObject({ title: 'Принтер не друкує', status: 'new' });

    const list = await c.request('/v1/apps/service-desk/data/ticket?status=new');
    const listed = (await list.json()) as { records: Array<{ data: { title: string } }> };
    expect(listed.records.map((r) => r.data.title)).toContain('Принтер не друкує');

    const patched = await c.request(`/v1/apps/service-desk/data/ticket/${record.record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: 'low' }),
    });
    expect(patched.status).toBe(200);

    expect(c.data.state.audit.map((a) => a.action)).toEqual(['create', 'update']);
    expect(c.data.state.outbox[0]?.eventType).toBe('ticket.created');
  });

  it('валідація: невідоме поле та пропущений required дають 400 з issues', async () => {
    const c = await setupPublishedServiceDesk();

    const unknownField = await c.request(
      '/v1/apps/service-desk/data/ticket',
      jsonInit('POST', { title: 'X', magic_field: 1 }),
    );
    expect(unknownField.status).toBe(400);
    const body1 = (await unknownField.json()) as { issues: Array<{ path: string }> };
    expect(body1.issues.some((i) => i.path === 'magic_field')).toBe(true);

    const missingTitle = await c.request(
      '/v1/apps/service-desk/data/ticket',
      jsonInit('POST', { priority: 'low' }),
    );
    expect(missingTitle.status).toBe(400);
  });

  it('межа орендаря: інший тенант не бачить і не може змінити чужі записи', async () => {
    const c = await setupPublishedServiceDesk();
    const created = await c.request(
      '/v1/apps/service-desk/data/ticket',
      jsonInit('POST', { title: 'ACME-квиток' }, 'acme'),
    );
    const rec = (await created.json()) as { record: { id: string } };

    const foreignList = await c.request('/v1/apps/service-desk/data/ticket');
    const foreignBody = (await foreignList.json()) as { records: Array<{ id: string }> };
    expect(foreignBody.records.map((r) => r.id)).not.toContain(rec.record.id);

    const foreignPatch = await c.request(
      `/v1/apps/service-desk/data/ticket/${rec.record.id}`,
      jsonInit('PATCH', { title: 'злом' }),
    );
    expect(foreignPatch.status).toBe(404);
  });

  it('draft без publish недоступний рантайму', async () => {
    const c = makeClient();
    await c.request('/v1/apps', jsonInit('POST', { slug: 'draft-only', name: 'Draft Only' }));
    await c.request('/v1/apps/draft-only/releases', jsonInit('POST', fixture));

    expect((await c.request('/v1/apps/draft-only/schema')).status).toBe(404);
    expect((await c.request('/v1/apps/draft-only/data/ticket')).status).toBe(404);
  });

  it('невалідне визначення релізу → 400 з issues', async () => {
    const c = makeClient();
    await c.request('/v1/apps', jsonInit('POST', { slug: 'broken', name: 'Broken' }));
    const res = await c.request(
      '/v1/apps/broken/releases',
      jsonInit('POST', { app: { slug: 'broken-app', name: 'Broken App' }, entities: [], pages: [] }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; issues: unknown[] };
    expect(body.code).toBe('invalid_definition');
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('health відповідає без залежностей', async () => {
    expect((await makeClient().request('/v1/health')).status).toBe(200);
  });
});

/* --------------------------------- CORS --------------------------------- */

describe('CORS', () => {
  it('preflight для дозволеного origin → 204 + заголовки', async () => {
    const app = createApp({
      metadata: new MemoryMetadataPort(),
      data: new MemoryDataPort(),
      allowedOrigins: 'https://opora-runtime.pages.dev',
    });
    const res = await app.fetch(
      new Request('https://x/v1/apps/service-desk/schema', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://opora-runtime.pages.dev',
          'Access-Control-Request-Method': 'GET',
        },
      }),
      {} as never,
      { waitUntil: () => {}, passThroughOnException: () => {} } as never,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://opora-runtime.pages.dev',
    );
  });

  it('невідомий origin — без CORS заголовків', async () => {
    const res = await makeClient().request('/v1/health', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

/* ----------------------------- автоматизації ---------------------------- */

interface Harness {
  request(path: string, init?: RequestInit): Promise<Response>;
  outbox: MemoryOutboxDrainPort;
  runs: MemoryWorkflowRunsPort;
  posts: Array<{ url: string; body: unknown }>;
  drain(): Promise<{
    status: number;
    body: { processed: number; ok: number; skipped: number; error: number };
  }>;
}

async function harnessWithWebhookWorkflow(): Promise<Harness> {
  const sharedOutbox: SharedOutboxRow[] = [];
  const data = new MemoryDataPort({ outbox: sharedOutbox });
  const metadata = new MemoryMetadataPort();
  const outbox = new MemoryOutboxDrainPort(sharedOutbox);
  const runs = new MemoryWorkflowRunsPort();
  const posts: Array<{ url: string; body: unknown }> = [];

  const c = makeClient({
    metadata,
    data,
    automation: {
      outbox,
      runs,
      resolveConnection: (slug: string) =>
        slug === 'test-hook' ? 'https://hooks.test/catch' : null,
      webhookPost: async (url: string, body: unknown) => {
        posts.push({ url, body });
        return { ok: true, status: 200 };
      },
    },
    drainKey: 'secret-key',
  });

  const def = structuredClone(fixture) as {
    workflows: Array<{ on: string; steps: Array<Record<string, unknown>> }>;
  };
  def.workflows.push({
    on: 'ticket.created',
    steps: [{ type: 'webhook', connection: 'test-hook', event: 'ticket.created' }],
  });

  await c.request('/v1/apps', jsonInit('POST', { slug: 'hooked-app', name: 'Hooked App' }));
  await c.request('/v1/apps/hooked-app/releases', jsonInit('POST', def));
  await c.request('/v1/apps/hooked-app/releases/1/publish', { method: 'POST' });

  return {
    request: (path, init) => c.request(path, init),
    outbox,
    runs,
    posts,
    drain: async () => {
      const res = await c.request('/v1/automation/drain', {
        method: 'POST',
        headers: { 'X-Drain-Key': 'secret-key' },
      });
      return {
        status: res.status,
        body: (await res.json()) as { processed: number; ok: number; skipped: number; error: number },
      };
    },
  };
}

describe('automation drain', () => {
  it('виконує webhook один раз на подію та логує run', async () => {
    const h = await harnessWithWebhookWorkflow();
    await h.request('/v1/apps/hooked-app/data/ticket', jsonInit('POST', { title: 'Перша заявка' }));

    expect(h.posts).toHaveLength(0);
    const report = await h.drain();
    // 2 workflow на ticket.created → 2 виконання з однієї події
    expect(report.body.processed).toBeGreaterThanOrEqual(1);
    expect(report.body.ok).toBeGreaterThanOrEqual(1);
    expect(h.posts).toHaveLength(1);
    expect(h.posts[0]?.url).toBe('https://hooks.test/catch');
    expect((h.posts[0]?.body as { event?: string }).event).toBe('ticket.created');

    const runs = await h.runs.list(10);
    // Обидва workflow виконано: slack-internal (skipped webhook) + test-hook (posted)
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.status === 'ok')).toBe(true);
    expect(runs.map((r) => r.workflowOn)).toEqual(['ticket.created', 'ticket.created']);
  });

  it('ідемпотентність: повторний дрен не дублює webhook', async () => {
    const h = await harnessWithWebhookWorkflow();
    await h.request('/v1/apps/hooked-app/data/ticket', jsonInit('POST', { title: 'Друга заявка' }));
    await h.drain();
    const afterFirst = h.posts.length;
    await h.drain();
    expect(h.posts.length).toBe(afterFirst);
  });

  it('невірний ключ дрену → 401', async () => {
    const h = await harnessWithWebhookWorkflow();
    const res = await h.request('/v1/automation/drain', {
      method: 'POST',
      headers: { 'X-Drain-Key': 'wrong' },
    });
    expect(res.status).toBe(401);
  });

  it('no-store на /v1/* відповідях', async () => {
    const res = await makeClient().request('/v1/health');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

/* ------------------------- record-level access control ------------------------ */

describe('record-level access control', () => {
  it('owner може редагувати свій запис, інший тенант — ні', async () => {
    const c = await setupPublishedServiceDesk();
    
    // Створюємо запис під acme
    const created = await c.request(
      '/v1/apps/service-desk/data/ticket',
      jsonInit('POST', { title: 'ACME-квиток' }, 'acme'),
    );
    expect(created.status).toBe(201);
    const rec = (await created.json()) as { record: { id: string } };

    // Власник (acme) може патчити
    const ownPatch = await c.request(
      `/v1/apps/service-desk/data/ticket/${rec.record.id}`,
      jsonInit('PATCH', { title: 'Оновлено' }, 'acme'),
    );
    expect(ownPatch.status).toBe(200);

    // Інший тенант (demo) отримує 404 на чужому записі
    const foreignPatch = await c.request(
      `/v1/apps/service-desk/data/ticket/${rec.record.id}`,
      jsonInit('PATCH', { title: 'злом' }),
    );
    expect(foreignPatch.status).toBe(404);
  });

  it('list фільтрує записи за тенантом навіть без явного ownerId', async () => {
    const c = await setupPublishedServiceDesk();
    
    await c.request('/v1/apps/service-desk/data/ticket', jsonInit('POST', { title: 'Demo-квиток' }));
    await c.request('/v1/apps/service-desk/data/ticket', jsonInit('POST', { title: 'ACME-квиток' }, 'acme'));

    const demoList = await c.request('/v1/apps/service-desk/data/ticket');
    const demoBody = (await demoList.json()) as { records: Array<{ data: { title: string } }> };
    const titles = demoBody.records.map((r) => r.data.title);
    expect(titles).toContain('Demo-квиток');
    expect(titles).not.toContain('ACME-квиток');

    const acmeList = await c.request('/v1/apps/service-desk/data/ticket', {
      headers: { 'X-Opora-Tenant': 'acme' },
    });
    const acmeBody = (await acmeList.json()) as { records: Array<{ data: { title: string } }> };
    expect(acmeBody.records.map((r) => r.data.title)).toContain('ACME-квиток');
    expect(acmeBody.records.map((r) => r.data.title)).not.toContain('Demo-квиток');
  });

  it('audit event містить actorId після auth-запиту', async () => {
    const SECRET = 'secret-key-32-chars-minimum!!';
    const c = makeClient({ authSecret: SECRET });
    // Створюємо app
    await c.request('/v1/apps', jsonInit('POST', { slug: 'sd-audit', name: 'SD Audit' }));
    await c.request('/v1/apps/sd-audit/releases', jsonInit('POST', fixture));
    await c.request('/v1/apps/sd-audit/releases/1/publish', { method: 'POST' });

    // Створюємо запис з Bearer token
    const token = await signToken({ userId: 'usr-test', email: 'test@x.ua', tenantSlug: 'demo', role: 'admin' }, SECRET);
    const res = await c.request('/v1/apps/sd-audit/data/ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: 'Audit test' }),
    });
    expect(res.status).toBe(201);

    // Перевіряємо що actorId потрапив у audit
    const auditEntry = c.data.state.audit.find((a) => a.actorId === 'usr-test');
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.action).toBe('create');
  });
});

/* --------------------------------- audit trail -------------------------------- */

describe('audit trail', () => {
  it('повертає події для адміна, відсортовані від нових', async () => {
    const { request } = await setupAdminClient();
    await request('/v1/apps/service-desk/data/ticket', jsonInit('POST', { title: 'T1' }));
    await request('/v1/apps/service-desk/data/ticket', jsonInit('POST', { title: 'T2' }));

    const res = await request('/v1/audit?limit=10');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Array<{ action: string; after: { title?: string } }> };
    expect(body.events.length).toBeGreaterThanOrEqual(2);
    expect(body.events[0]?.after?.title).toBe('T2');
  });

  it('фільтрує за дією', async () => {
    const { request } = await setupAdminClient();
    await request('/v1/apps/service-desk/data/ticket', jsonInit('POST', { title: 'X' }));

    const res = await request('/v1/audit?action=create&limit=10');
    const body = (await res.json()) as { events: Array<{ action: string }> };
    expect(body.events.every((e) => e.action === 'create')).toBe(true);
  });

  it('забороняє доступ без admin/owner ролі', async () => {
    const res = await makeClient().request('/v1/audit');
    expect(res.status).toBe(403);
  });
});
