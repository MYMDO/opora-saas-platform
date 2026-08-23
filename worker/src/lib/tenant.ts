import type { Context } from 'hono';

const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export const DEFAULT_TENANT = 'demo';

/** Free-Tier дисципліна: тенант поки що з заголовка; КЕП/BankID замінить резолвер у Фазі 2+. */
export function resolveTenant(c: Context): string {
  const raw = c.req.header('X-Opora-Tenant') ?? DEFAULT_TENANT;
  return TENANT_RE.test(raw) ? raw : DEFAULT_TENANT;
}

export function corsFor(allowedOrigins: string | undefined) {
  const list = (allowedOrigins ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return async (
    c: { req: { header(n: string): string | undefined }; res: { headers: Headers } },
    next: () => Promise<void>,
  ) => {
    await next();
    const origin = c.req.header('Origin');
    if (origin && list.includes(origin)) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type,X-Opora-Tenant');
      c.res.headers.set('Vary', 'Origin');
      c.res.headers.set('Access-Control-Max-Age', '86400');
    }
  };
}
