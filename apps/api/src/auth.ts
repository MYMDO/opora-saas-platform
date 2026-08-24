/**
 * Мінімалістична автентифікація: HMAC-SHA256 токени через Web Crypto.
 * Працює на Workers і Node 22+ без зовнішніх залежностей.
 */

export interface TokenPayload {
  readonly userId: string;
  readonly email: string;
  readonly tenantSlug: string;
  readonly role: 'owner' | 'admin' | 'member';
  readonly exp: number;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return new Uint8Array(Array.from(binary, (c) => c.charCodeAt(0)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signToken(
  payload: Omit<TokenPayload, 'exp'>,
  secret: string,
): Promise<string> {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const body = token.slice(0, dotIdx);
  const sigStr = token.slice(dotIdx + 1);

  try {
    const key = await hmacKey(secret);
    const expected = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)),
    );
    const received = base64UrlDecode(sigStr);
    if (expected.length !== received.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= (expected[i] ?? 0) ^ (received[i] ?? 0);
    if (diff !== 0) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as TokenPayload;
    if (!payload.userId || !payload.tenantSlug || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
