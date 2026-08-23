import type { Context } from 'hono';
import type { AppEnv } from '../index';

const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export const DEFAULT_TENANT = 'demo';

/** Free-Tier дисципліна: тенант поки що з заголовка; КЕП/BankID замінить резолвер у Фазі 2+. */
export function resolveTenant(c: Context<AppEnv>): string {
  const raw = c.req.header('X-Opora-Tenant') ?? DEFAULT_TENANT;
  return TENANT_RE.test(raw) ? raw : DEFAULT_TENANT;
}

export function corsFor(allowedOrigins: string | undefined) {
  const list = (allowedOrigins ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return async (c: Context<AppEnv>, next: () => Promise<void>) => {
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
