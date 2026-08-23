import { Hono } from 'hono';
import { corsFor, resolveTenant } from './lib/tenant';
import { financeRoutes } from './routes/finance';
import { hrRoutes } from './routes/hr';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
}

export type AppEnv = { Bindings: Env; Variables: { tenant: string } };

export function createApp(env: Env) {
  const app = new Hono<AppEnv>();

  app.use('/v1/*', corsFor(env.ALLOWED_ORIGINS));
  app.use('/v1/*', async (c, next) => {
    c.set('tenant', resolveTenant(c));
    await next();
  });

  app.use('/v1/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });

  app.get('/v1/health', async (c) => {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
    return c.json({ ok: true, service: 'opora-api', ts: new Date().toISOString() });
  });

  app.route('/v1/finance', financeRoutes());
  app.route('/v1/hr', hrRoutes());

  app.onError((err, c) => {
    console.error('[opora-api]', err);
    return c.json({ error: 'Внутрішня помилка сервера' }, 500);
  });

  app.notFound((c) => c.json({ error: 'Маршрут не знайдено' }, 404));

  return app;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return createApp(env).fetch(req, env, ctx);
  },
};
