import { describe, expect, it } from 'vitest';
import { createApp, type Env } from '../src/index';
import { FakeD1 } from './fakeD1';

function client(db: FakeD1, extraEnv: Partial<Env> = {}) {
  const env = { DB: db, ...extraEnv } as unknown as Env;
  const app = createApp(env);
  return {
    request(path: string, init?: RequestInit) {
      return app.request(`https://api.test${path}`, init, env);
    },
  };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonInit(method: string, body?: unknown, tenant = 'demo'): RequestInit {
  return {
    method,
    headers: { ...JSON_HEADERS, 'X-Opora-Tenant': tenant },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

describe('opora-api', () => {
  it('health passes a DB probe', async () => {
    const c = client(
      new FakeD1([{ test: (s) => s.includes('SELECT 1'), handle: () => ({ ok: 1 }) }]),
    );
    const res = await c.request('/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, service: 'opora-api' });
  });

  it('answers CORS preflight for allowed origins and skips the DB', async () => {
    const res = await client(new FakeD1([]), {
      ALLOWED_ORIGINS: 'https://opora-saas-platform.pages.dev',
    }).request('/v1/finance/contractors', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://opora-saas-platform.pages.dev',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://opora-saas-platform.pages.dev',
    );
  });

  it('omits CORS headers for unknown origins', async () => {
    const res = await client(new FakeD1([])).request('/v1/finance/contractors', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('lists contractors scoped to the tenant', async () => {
    const row = { id: 'c1', name: 'ТОВ «А»', used_uah: 90_000, limit_uah: 100_000 };
    const db = new FakeD1([
      {
        test: (s) => s.includes('FROM contractors') && s.trim().startsWith('SELECT'),
        handle: () => [row],
      },
    ]);
    const res = await client(db).request('/v1/finance/contractors', jsonInit('GET', undefined, 'acme'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      contractors: [{ id: 'c1', name: 'ТОВ «А»', usedUah: 90_000, limitUah: 100_000 }],
    });
    expect(db.calls('FROM contractors')[0]?.params[0]).toBe('acme');
  });

  it('creates a contractor with defaults and returns 201', async () => {
    const db = new FakeD1([
      { test: (s) => s.includes("FROM contractors WHERE id = ?"), handle: () => null },
      {
        test: (s) => s.includes('INSERT INTO contractors'),
        handle: (p) => ({ id: p[0], name: p[2], used_uah: p[3], limit_uah: p[4] }),
      },
    ]);
    const res = await client(db).request(
      '/v1/finance/contractors',
      jsonInit('POST', { name: '  ТОВ «Новий» ', limitUah: 100_000 }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      contractor: { id: expect.any(String), name: 'ТОВ «Новий»', usedUah: 0, limitUah: 100_000 },
    });
  });

  it('accepts a client-generated uuid and conflicts on duplicate', async () => {
    const fixedId = '11111111-2222-4333-8444-555555555555';
    let exists = false;
    const db = new FakeD1([
      {
        test: (s) => s.includes('FROM contractors WHERE id = ?'),
        handle: () => (exists ? { tenant_id: 'demo' } : null),
      },
      {
        test: (s) => s.includes('INSERT INTO contractors'),
        handle: (p) => {
          exists = true;
          return { id: p[0], name: p[2], used_uah: p[3], limit_uah: p[4] };
        },
      },
    ]);
    const c = client(db);
    const first = await c.request(
      '/v1/finance/contractors',
      jsonInit('POST', { id: fixedId, name: 'Seed', limitUah: 100_000 }),
    );
    expect(first.status).toBe(201);
    const second = await c.request(
      '/v1/finance/contractors',
      jsonInit('POST', { id: fixedId, name: 'Дубль', limitUah: 100_000 }),
    );
    expect(second.status).toBe(409);
  });

  it('rejects invalid contractor payloads with 400 and issues', async () => {
    const res = await client(new FakeD1([])).request(
      '/v1/finance/contractors',
      jsonInit('POST', { name: '', limitUah: -5 }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: string[] };
    expect(body.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 404 when patching a missing contractor', async () => {
    const res = await client(
      new FakeD1([{ test: (s) => s.includes('UPDATE contractors'), handle: () => null }]),
    ).request('/v1/finance/contractors/c-x', jsonInit('PATCH', { usedUah: 1_000 }));
    expect(res.status).toBe(404);
  });

  it('patches only provided fields', async () => {
    const db = new FakeD1([
      {
        test: (s) => s.includes('UPDATE contractors'),
        handle: (p) => ({ id: 'c1', name: p[2] === undefined ? 'ТОВ «А»' : p[2], used_uah: p[0], limit_uah: 100_000 }),
      },
    ]);
    const res = await client(db).request(
      '/v1/finance/contractors/c1',
      jsonInit('PATCH', { usedUah: 5_500 }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { contractor: { usedUah: number } };
    expect(body.contractor.usedUah).toBe(5_500);
    expect(db.calls('UPDATE contractors')[0]?.params).toEqual([5_500, 'demo', 'c1']);
  });

  it('deletes a contractor of the calling tenant', async () => {
    const db = new FakeD1([
      { test: (s) => s.includes('DELETE FROM contractors'), handle: (p) => ({ id: p[1] }) },
    ]);
    const res = await client(db).request('/v1/finance/contractors/c1', jsonInit('DELETE'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('stores enterprise booking context via upsert', async () => {
    const db = new FakeD1([
      { test: (s) => s.includes('ON CONFLICT(tenant_id)'), handle: () => null },
    ]);
    const res = await client(db).request(
      '/v1/hr/enterprise',
      jsonInit('PUT', {
        territoryType: 'frontline',
        hasCriticalStatus: true,
        isCriticalIndustry: false,
        hasTaxDebt: false,
        obligatedCount: 20,
        bookedCount: 8,
      }),
    );
    expect(res.status).toBe(200);
    expect(db.calls('INSERT INTO enterprise_booking')[0]?.params.slice(0, 7)).toEqual([
      'demo',
      'frontline',
      1,
      0,
      0,
      20,
      8,
    ]);
  });

  it('reads back enterprise context in camelCase', async () => {
    const db = new FakeD1([
      {
        test: (s) => s.includes('FROM enterprise_booking'),
        handle: () => ({
          territory_type: 'regular',
          has_critical_status: 1,
          is_critical_industry: 0,
          has_tax_debt: 0,
          obligated_count: 20,
          booked_count: 8,
        }),
      },
    ]);
    const res = await client(db).request('/v1/hr/enterprise');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      enterprise: {
        territoryType: 'regular',
        hasCriticalEnterpriseStatus: true,
        isCriticalIndustry: false,
        hasTaxDebt: false,
        militaryObligatedCount: 20,
        alreadyBookedCount: 8,
      },
    });
  });

  it('rejects bad employee salary with 400', async () => {
    const res = await client(new FakeD1([])).request(
      '/v1/hr/employees',
      jsonInit('POST', { name: 'Іван', monthlySalaryUah: -3 }),
    );
    expect(res.status).toBe(400);
  });

  it('falls back to demo tenant on malformed header values', async () => {
    const db = new FakeD1([{ test: (s) => s.includes('FROM contractors'), handle: () => [] }]);
    await client(db).request('/v1/finance/contractors', {
      headers: { 'X-Opora-Tenant': 'NOT VALID!!' },
    });
    expect(db.calls('FROM contractors')[0]?.params[0]).toBe('demo');
  });
});
