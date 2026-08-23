import { describe, expect, it } from 'vitest';
import { limitLevel } from './taxRules';

describe('limitLevel', () => {
  it('is safe below 70%', () => {
    expect(limitLevel(69_999, 100_000)).toBe('safe');
    expect(limitLevel(0, 100_000)).toBe('safe');
  });

  it('warns from 70% to below 90%', () => {
    expect(limitLevel(70_000, 100_000)).toBe('warning');
    expect(limitLevel(89_999, 100_000)).toBe('warning');
  });

  it('flags danger from 90%', () => {
    expect(limitLevel(90_000, 100_000)).toBe('danger');
    expect(limitLevel(100_000, 100_000)).toBe('danger');
  });

  it('treats zero limit as safe', () => {
    expect(limitLevel(50_000, 0)).toBe('safe');
  });
});
