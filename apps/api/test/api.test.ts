import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src';
import { MemoryDataPort } from '@opora/data-runtime';
import { MemoryMetadataPort } from '@opora/metadata';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../packages/dsl/fixtures/service-desk.json'), 'utf-8'),
);

function makeClient(data?: MemoryDataPort, metadata?: MemoryMetadataPort) {
  data = data ?? new MemoryDataPort();
  metadata = metadata ?? new MemoryMetadataPort();
  const app = createApp({ metadata, data });
  return {
    request(path: string, init?: RequestInit) {
      return app.fetch(
        new Request(`https://api.test${path}`, init),
        {} as never,
        { waitUntil: () => {}, passThroughOnException: () => {} } as never,
      );
    },
    data,
  };
}

async function setupPublishedServiceDesk() {
  const c = makeClient();
  await c.request('/v1/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'service-desk', name: 'Service Desk' }),
  });
  await c.request('/v1/apps/service-desk/releases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fixture),
  });
  const pub = await c.request('/v1/apps/service-desk/releases/1/publish', { method: 'POST' });
  expect(pub.status).toBe(200);
  return c;
}

describe('opora-api — вертикальний зріз Service Desk', () => {
  it('повний цикл: app → release → publish → schema → CRUD ticket → audit/outbox', async () => {
    const c = await setupPublishedServiceDesk();

    const schema = await c.request('/v1/apps/service-desk/schema');
    expect(schema.status).toBe(200);
    const def = (await schema.json()) as { version: number; definition: { entities: unknown[] } };
    expect(def.version).toBe(1);
    expect(def.definition.entities.length).toBe(2);

    const created = await c.request('/v1/apps/service-desk/data/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Принтер не друкує',
        priority: 'high',
        requester: 'contact-42',
      }),
    });
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

    const unknownField = await c.request('/v1/apps/service-desk/data/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X', magic_field: 1 }),
    });
    expect(unknownField.status).toBe(400);
    const body1 = (await unknownField.json()) as { issues: Array<{ path: string }> };
    expect(body1.issues.some((i) => i.path === 'magic_field')).toBe(true);

    const missingTitle = await c.request('/v1/apps/service-desk/data/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: 'low' }),
    });
    expect(missingTitle.status).toBe(400);
  });

  it('межа орендаря: інший тенант не бачить і не може змінити чужі записи', async () => {
    const c = await setupPublishedServiceDesk();
    const created = await c.request('/v1/apps/service-desk/data/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Opora-Tenant': 'acme' },
      body: JSON.stringify({ title: 'ACME-квиток' }),
    });
    const rec = (await created.json()) as { record: { id: string } };

    const foreignList = await c.request('/v1/apps/service-desk/data/ticket');
    const foreignBody = (await foreignList.json()) as { records: Array<{ id: string }> };
    expect(foreignBody.records.map((r) => r.id)).not.toContain(rec.record.id);

    const foreignPatch = await c.request(`/v1/apps/service-desk/data/ticket/${rec.record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'злом' }),
    });
    expect(foreignPatch.status).toBe(404);
  });

  it('draft без publish недоступний рантайму', async () => {
    const c = makeClient();
    await c.request('/v1/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'draft-only', name: 'Draft Only' }),
    });
    await c.request('/v1/apps/draft-only/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixture),
    });

    expect((await c.request('/v1/apps/draft-only/schema')).status).toBe(404);
    expect(
      (await c.request('/v1/apps/draft-only/data/ticket')).status,
    ).toBe(404);
  });

  it('невалідне визначення релізу → 400 з issues', async () => {
    const c = makeClient();
    await c.request('/v1/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'broken', name: 'Broken' }),
    });
    const res = await c.request('/v1/apps/broken/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: { slug: 'broken-app', name: 'Broken App' }, entities: [], pages: [] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; issues: unknown[] };
    expect(body.code).toBe('invalid_definition');
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('health відповідає без залежностей', async () => {
    const res = await makeClient().request('/v1/health');
    expect(res.status).toBe(200);
  });
});

describe('CORS', () => {
  it('preflight для дозволеного origin → 204 + заголовки', async () => {
    const data = new MemoryDataPort();
    const metadata = new MemoryMetadataPort();
    const app = createApp({
      metadata,
      data,
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
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://opora-runtime.pages.dev',
    );
  });

  it('невідомий origin — без CORS заголовків', async () => {
    const app = createApp({
      metadata: new MemoryMetadataPort(),
      data: new MemoryDataPort(),
      allowedOrigins: 'https://good.example',
    });
    const res = await app.fetch(
      new Request('https://x/v1/health', { headers: { Origin: 'https://evil.example' } }),
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
