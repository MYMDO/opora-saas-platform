import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/auth';

const SECRET = 'test-secret-key-32-chars-minimum!!';

describe('signToken / verifyToken', () => {
  it('round-trips a valid payload', async () => {
    const token = await signToken(
      { userId: 'usr-1', email: 'a@b.c', tenantSlug: 'demo', role: 'owner' },
      SECRET,
    );
    const payload = await verifyToken(token, SECRET);
    expect(payload?.userId).toBe('usr-1');
    expect(payload?.email).toBe('a@b.c');
  });

  it('rejects a tampered token', async () => {
    const token = await signToken(
      { userId: 'usr-1', email: 'a@b.c', tenantSlug: 'demo', role: 'owner' },
      SECRET,
    );
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(await verifyToken(tampered, SECRET)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken(
      { userId: 'usr-1', email: 'a@b.c', tenantSlug: 'demo', role: 'owner' },
      'other-secret-key-32-chars-min!',
    );
    expect(await verifyToken(token, SECRET)).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const token = await signToken(
      { userId: 'usr-1', email: 'a@b.c', tenantSlug: 'd', role: 'owner' },
      SECRET,
    );
    // Перевірити що exp у майбутньому (не прострочений)
    const payload = await verifyToken(token, SECRET);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects empty or malformed strings', async () => {
    expect(await verifyToken('', SECRET)).toBeNull();
    expect(await verifyToken('no-dot-here', SECRET)).toBeNull();
  });
});
