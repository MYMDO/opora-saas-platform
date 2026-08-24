import { Hono } from 'hono';
import type { EntityDefinition } from '@opora/dsl';
import type { MetadataPort } from '@opora/metadata';
import type { DataPort } from '@opora/data-runtime';
import { RecordNotFoundError, ValidationError } from '@opora/data-runtime';

export interface ApiDeps {
  metadata: MetadataPort;
  data: DataPort;
  /** Кома-розділений allow-list Origin для CORS */
  allowedOrigins?: string;
}

type Env = {
  Variables: {
    tenantId: string;
    entityDef: EntityDefinition;
    releaseVersion: number;
  };
};

const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const SLUG_RE = /^[a-z][a-z0-9-]{1,62}$/;

interface CtxLike {
  req: {
    header(n: string): string | undefined;
    method: string;
    param(k: string): string | undefined;
  };
  header(k: string, v: string): void;
  body(data: null, status: number): Response;
  json(body: unknown, status?: number): Response;
}

function corsMiddleware(allowedOrigins: string | undefined) {
  const list = (allowedOrigins ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  return async (c: CtxLike, next: () => Promise<void>) => {
    const origin = c.req.header('Origin');
    if (origin && list.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type,X-Opora-Tenant');
      c.header('Vary', 'Origin');
      c.header('Access-Control-Max-Age', '86400');
    }
    if (c.req.method === 'OPTIONS') return c.body(null, 204);
    await next();
  };
}

function resolveTenant(c: CtxLike): string {
  const raw = c.req.header('X-Opora-Tenant') ?? 'demo';
  return TENANT_RE.test(raw) ? raw : 'demo';
}

function mapMetaError(c: CtxLike, e: unknown): Response {
  const err = e as { code?: string; message: string; issues?: unknown };
  if (typeof err.code === 'string') {
    const status =
      err.code === 'already_exists' ? 409 : err.code === 'invalid_definition' ? 400 : 404;
    return c.json({ error: err.message, code: err.code, issues: err.issues }, status);
  }
  console.error('[opora-api]', e);
  return c.json({ error: 'Внутрішня помилка сервера' }, 500);
}

function mapDataError(c: CtxLike, e: unknown): Response {
  if (e instanceof RecordNotFoundError) return c.json({ error: e.message }, 404);
  if (e instanceof ValidationError) return c.json({ error: 'Некоректні дані', issues: e.issues }, 400);
  console.error('[opora-api]', e);
  return c.json({ error: 'Внутрішня помилка сервера' }, 500);
}

function parseFilters(query: URLSearchParams): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const [k, v] of query.entries()) {
    if (k !== 'limit') filters[k] = v;
  }
  return filters;
}

const LIMIT_MAX = 100;

export function createApp(deps: ApiDeps) {
  const app = new Hono<Env>();

  app.use('/v1/*', corsMiddleware(deps.allowedOrigins));
  app.use('/v1/*', async (c, next) => {
    c.set('tenantId', resolveTenant(c));
    c.header('Cache-Control', 'no-store');
    await next();
  });

  app.get('/v1/health', (c) => c.json({ ok: true, service: 'opora-api' }));

  app.post('/v1/apps', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') return c.json({ error: 'очікується JSON обʼєкт' }, 400);
    const { slug, name } = body as Record<string, string>;
    if (!slug || !SLUG_RE.test(slug)) return c.json({ error: 'некоректний slug' }, 400);
    if (!name?.trim()) return c.json({ error: 'некоректна назва' }, 400);
    try {
      return c.json({ app: await deps.metadata.createApp(slug, name.trim()) }, 201);
    } catch (e) {
      return mapMetaError(c, e);
    }
  });

  app.get('/v1/apps', async (c) => c.json({ apps: await deps.metadata.listApps() }));

  app.post('/v1/apps/:slug/releases', async (c) => {
    const slug = c.req.param('slug');
    if (!slug) return c.json({ error: 'немає slug' }, 400);
    const definition = await c.req.json().catch(() => null);
    try {
      return c.json({ release: await deps.metadata.createDraft(slug, definition) }, 201);
    } catch (e) {
      return mapMetaError(c, e);
    }
  });

  app.post('/v1/apps/:slug/releases/:version/publish', async (c) => {
    const version = Number(c.req.param('version'));
    if (!Number.isInteger(version)) return c.json({ error: 'некоректна версія' }, 400);
    try {
      const release = await deps.metadata.publish(c.req.param('slug'), version);
      return c.json({ release });
    } catch (e) {
      return mapMetaError(c, e);
    }
  });

  app.get('/v1/apps/:slug/schema', async (c) => {
    const slug = c.req.param('slug');
    if (!slug) return c.json({ error: 'немає slug' }, 400);
    const active = await deps.metadata.getActive(slug);
    if (!active) return c.json({ error: 'Активний реліз відсутній' }, 404);
    return c.json({ version: active.version, definition: active.definition });
  });

  /* ------------------------------ data runtime ---------------------------- */

  const data = new Hono<Env>();

  data.use('*', async (c, next) => {
    const appSlug = c.req.param('appSlug');
    const entityName = c.req.param('entity');
    if (!appSlug || !entityName) return c.json({ error: 'немає шляху сутності' }, 400);
    const active = await deps.metadata.getActive(appSlug);
    if (!active) return c.json({ error: 'Активний реліз відсутній' }, 404);
    const def = active.definition.entities.find((e) => e.apiName === entityName);
    if (!def) return c.json({ error: `Сутність "${entityName}" не знайдена` }, 404);
    c.set('entityDef', def);
    c.set('releaseVersion', active.version);
    await next();
  });

  function dataCtx(c: { req: { param(k: string): string | undefined }; get(k: 'tenantId'): string }) {
    return {
      tenantId: c.get('tenantId'),
      appSlug: c.req.param('appSlug') ?? '',
      actorId: null,
    };
  }

  data.get('/', async (c) => {
    const def = c.get('entityDef');
    const url = new URL(c.req.url);
    const limitRaw = Number(url.searchParams.get('limit')) || LIMIT_MAX;
    const page = await deps.data.list(dataCtx(c), def, {
      filters: parseFilters(url.searchParams),
      limit: Math.min(Math.max(limitRaw, 1), LIMIT_MAX),
    });
    return c.json({
      records: page.rows,
      releaseVersion: c.get('releaseVersion'),
    });
  });

  data.post('/', async (c) => {
    const def = c.get('entityDef');
    const body = await c.req.json().catch(() => null);
    try {
      const rec = await deps.data.create(dataCtx(c), def, body);
      return c.json({ record: rec }, 201);
    } catch (e) {
      return mapDataError(c, e);
    }
  });

  data.get('/:id', async (c) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'немає id' }, 400);
    const rec = await deps.data.get(dataCtx(c), c.get('entityDef'), id);
    return rec ? c.json({ record: rec }) : c.json({ error: 'Не знайдено' }, 404);
  });

  data.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json().catch(() => null);
    if (!id) return c.json({ error: 'немає id' }, 400);
    try {
      const rec = await deps.data.update(dataCtx(c), c.get('entityDef'), id, patch);
      return c.json({ record: rec });
    } catch (e) {
      return mapDataError(c, e);
    }
  });

  data.delete('/:id', async (c) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'немає id' }, 400);
    try {
      await deps.data.softDelete(dataCtx(c), c.get('entityDef'), id);
      return c.json({ ok: true });
    } catch (e) {
      return mapDataError(c, e);
    }
  });

  app.route('/v1/apps/:appSlug/data/:entity', data);

  return app;
}
