import { describe, expect, it } from 'vitest';
import { parseTabFromHash, tabToHash } from './routing';

describe('parseTabFromHash', () => {
  it('parses known tabs', () => {
    expect(parseTabFromHash('#/energy')).toBe('energy');
    expect(parseTabFromHash('#/finance')).toBe('finance');
    expect(parseTabFromHash('#ai')).toBe('ai');
  });

  it('falls back to overview for empty, bare, or unknown hashes', () => {
    expect(parseTabFromHash('')).toBe('overview');
    expect(parseTabFromHash('#/')).toBe('overview');
    expect(parseTabFromHash('#/bogus')).toBe('overview');
  });
});

describe('tabToHash', () => {
  it('round-trips every tab', () => {
    for (const tab of ['overview', 'ai', 'energy', 'finance'] as const) {
      expect(parseTabFromHash(tabToHash(tab))).toBe(tab);
    }
  });

  it('uses a bare hash for the default tab', () => {
    expect(tabToHash('overview')).toBe('#/');
  });
});
