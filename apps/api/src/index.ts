import { Hono } from 'hono';
import type { EntityDefinition } from '@opora/dsl';
import type { MetadataPort } from '@opora/metadata';
import type { DataPort } from '@opora/data-runtime';
import { RecordNotFoundError, ValidationError } from '@opora/data-runtime';

import { AutomationService } from './automation';
import type { OutboxDrainPort, WorkflowRunsPort } from './runs';
import { verifyToken } from './auth';

export interface ApiDeps {
  metadata: MetadataPort;
  data: DataPort;
  /** Кома-розділений allow-list Origin для CORS */
  allowedOrigins?: string;
  /** Наявність цих портів увімкнює /v1/automation/drain та /v1/workflow-runs */
  automation?: {
    outbox: OutboxDrainPort;
    runs: WorkflowRunsPort;
    resolveConnection(connection: string): string | null;
    webhookPost(url: string, body: unknown): Promise<{ ok: boolean; status?: number; error?: string }>;
  };
  /** Ключ захисту drain-endpoint; обовʼязковий у prod */
  drainKey?: string;
  /** Секрет для HMAC-підпису токенів (обовʼязковий для auth) */
  authSecret?: string;
}


type Env = {
  Variables: {
    tenantId: string;
    entityDef: EntityDefinition;
    releaseVersion: number;
    actorId: string | null;
    role: 'owner' | 'admin' | 'member';
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
      c.header('Access-Control-Allow-Headers', 'Content-Type,X-Opora-Tenant,Authorization');
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

function parseFilters(query: URLSearchParams): Record<string, string | number | boolean> {
  const filters: Record<string, string | number | boolean> = {};
  for (const [k, v] of query.entries()) {
    if (!k.startsWith('_') && k !== 'limit') filters[k] = v;
  }
  return filters;
}

const LIMIT_MAX = 100;

export function createApp(deps: ApiDeps) {
  const app = new Hono<Env>();

  app.use('/v1/*', corsMiddleware(deps.allowedOrigins));
  app.use('/v1/*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ') && deps.authSecret) {
      const payload = await verifyToken(authHeader.slice(7), deps.authSecret);
      if (payload) {
        c.set('tenantId', payload.tenantSlug);
        c.set('actorId', payload.userId);
        c.set('role', payload.role === 'admin' || payload.role === 'owner' ? payload.role : 'member');
        await next();
        return;
      }
    }
    c.set('tenantId', resolveTenant(c));
    c.set('actorId', null);
    c.set('role', 'member');
    c.header('Cache-Control', 'no-store');
    await next();
  });

  app.get('/v1/health', (c) => c.json({ ok: true, service: 'opora-api' }));

  /* --------------------------------- auth ---------------------------------- */

  app.post('/v1/auth/token', async (c) => {
    const authSecret = deps.authSecret;
    if (!authSecret) return c.json({ error: 'auth не налаштовано' }, 501);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') return c.json({ error: 'очікується JSON' }, 400);
    const { email, tenantSlug } = body as Record<string, string>;
    if (!email || !/^[^@]+@[^@]+$/.test(email)) return c.json({ error: 'некоректний email' }, 400);

    const slug = tenantSlug && SLUG_RE.test(tenantSlug) ? tenantSlug : 'demo';
    const userId = `usr-${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

    const token = await import('./auth').then((m) =>
      m.signToken({ userId, email, tenantSlug: slug, role: 'owner' }, authSecret),
    );
    return c.json({ token, userId, tenantSlug: slug }, 201);
  });

  app.get('/v1/me', async (c) => {
    if (!c.get('actorId')) return c.json({ error: 'не автентифіковано' }, 401);
    return c.json({
      actorId: c.get('actorId'),
      tenantId: c.get('tenantId'),
    });
  });

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

  app.get('/v1/apps/:slug/releases', async (c) => {
    try {
      return c.json({ releases: await deps.metadata.listReleases(c.req.param('slug')) });
    } catch (e) {
      return mapMetaError(c, e);
    }
  });

  app.patch('/v1/apps/:slug/releases/:version', async (c) => {
    const version = Number(c.req.param('version'));
    const definition = await c.req.json().catch(() => null);
    if (!Number.isInteger(version)) return c.json({ error: 'некоректна версія' }, 400);
    try {
      await deps.metadata.updateDraft(c.req.param('slug'), version, definition);
      return c.json({ ok: true });
    } catch (e) {
      return mapMetaError(c, e);
    }
  });

  app.get('/v1/audit', async (c) => {
    if (!isPrivileged(c)) return c.json({ error: 'потрібна роль admin або owner' }, 403);
    const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
    const action = c.req.query('action') || undefined;
    const events = await deps.data.audit(
      { tenantId: c.get('tenantId'), appSlug: '', actorId: null },
      { limit, action },
    );
    return c.json({ events });
  });

  app.get('/v1/apps/:slug/schema', async (c) => {
    const slug = c.req.param('slug');
    if (!slug) return c.json({ error: 'немає slug' }, 400);
    const active = await deps.metadata.getActive(slug);
    if (!active) return c.json({ error: 'Активний реліз відсутній' }, 404);
    return c.json({ version: active.version, definition: active.definition });
  });

  app.get('/v1/workflow-runs', async (c) => {
    if (!deps.automation) return c.json({ error: 'автоматизації не налаштовані' }, 501);
    if (!isPrivileged(c)) return c.json({ error: 'потрібна роль admin або owner' }, 403);
    const limit = Number(c.req.query('limit')) || 50;
    return c.json({ runs: await deps.automation.runs.list(c.get('tenantId'), limit) });
  });

  app.get('/v1/connections', async (c) => {
    if (!deps.automation) return c.json({ error: 'автоматизації не налаштовані' }, 501);
    if (!isPrivileged(c)) return c.json({ error: 'потрібна роль admin або owner' }, 403);
    const slugs = new Set<string>();
    for (const app of await deps.metadata.listApps()) {
      const active = await deps.metadata.getActive(app.slug).catch(() => null);
      for (const w of active?.definition.workflows ?? []) {
        for (const s of w.steps ?? []) {
          if (s.type === 'webhook' && s.connection) slugs.add(s.connection);
        }
      }
    }
    return c.json({
      connections: [...slugs].sort().map((slug) => ({
        slug,
        configured: deps.automation!.resolveConnection(slug) !== null,
      })),
    });
  });

  app.post('/v1/automation/drain', async (c) => {
    if (!deps.automation) return c.json({ error: 'автоматизації не налаштовані' }, 501);
    if (deps.drainKey && c.req.header('X-Drain-Key') !== deps.drainKey) {
      return c.json({ error: 'невірний ключ дрену' }, 401);
    }
    const service = new AutomationService({
      metadata: deps.metadata,
      data: deps.data,
      outbox: deps.automation.outbox,
      runs: deps.automation.runs,
      resolveConnection: deps.automation.resolveConnection,
      webhookPost: deps.automation.webhookPost,
      log: (line) => console.log('[drain]', line),
    });
    return c.json(await service.drain());
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

  function dataCtx(c: { get(k: string): unknown; req: { param(k: string): string | undefined } }): {
    tenantId: string;
    appSlug: string;
    actorId: string | null;
  } {
    return {
      tenantId: c.get('tenantId') as string,
      appSlug: c.req.param('appSlug') ?? '',
      actorId: (c.get('actorId') as string | null) ?? null,
    };
  }

  function isPrivileged(c: { get(k: string): unknown }): boolean {
    const role = c.get('role');
    return role === 'admin' || role === 'owner';
  }

  data.get('/', async (c) => {
    const def = c.get('entityDef');
    const url = new URL(c.req.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? url.searchParams.get('_limit')) || LIMIT_MAX;
    const sortRaw = url.searchParams.get('_sort') ?? '';
    const sortBy = /^[a-zA-Z][a-zA-Z0-9_]*$/.test(sortRaw) ? sortRaw : undefined;
    const filters = parseFilters(url.searchParams);
    const fieldTypes = new Map(def.fields.map((f) => [f.name, f.type]));
    for (const [k, v] of Object.entries(filters)) {
      const t = fieldTypes.get(k);
      if (t === 'number' && typeof v === 'string') {
        const n = Number(v);
        if (v.trim() === '' || !Number.isFinite(n)) return c.json({ error: `фільтр ${k}: потрібне число` }, 400);
        filters[k] = n;
      } else if (t === 'boolean' && typeof v === 'string') {
        if (v !== 'true' && v !== 'false') return c.json({ error: `фільтр ${k}: потрібне true або false` }, 400);
        filters[k] = v === 'true';
      }
    }
    if (!isPrivileged(c)) {
      const uid = c.get('actorId');
      if (uid) filters.owner_id = uid;
    }
    const page = await deps.data.list(dataCtx(c), def, {
      filters,
      limit: Math.min(Math.max(limitRaw, 1), LIMIT_MAX),
      offset: Math.max(Number(url.searchParams.get('_offset')) || 0, 0),
      sortBy,
      sortDir: url.searchParams.get('_dir') === 'desc' ? 'desc' : 'asc',
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

    if (!isPrivileged(c)) {
      const rec = await deps.data.get(dataCtx(c), c.get('entityDef'), id);
      if (!rec) return c.json({ error: 'Не знайдено' }, 404);
      if (rec.ownerId && rec.ownerId !== c.get('actorId')) {
        return c.json({ error: 'Немає доступу до цього запису' }, 403);
      }
    }

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

    if (!isPrivileged(c)) {
      const rec = await deps.data.get(dataCtx(c), c.get('entityDef'), id);
      if (!rec) return c.json({ error: 'Не знайдено' }, 404);
      if (rec.ownerId && rec.ownerId !== c.get('actorId')) {
        return c.json({ error: 'Немає доступу до цього запису' }, 403);
      }
    }

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
