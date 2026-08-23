import { describe, expect, it } from 'vitest';
import { daysUntil, deadlineTone } from './deadlines';

describe('daysUntil', () => {
  it('returns 1 for tomorrow', () => {
    const now = new Date(2026, 6, 31);
    expect(daysUntil('2026-08-01', now)).toBe(1);
  });

  it('returns 0 on the due date', () => {
    const now = new Date(2026, 7, 1);
    expect(daysUntil('2026-08-01', now)).toBe(0);
  });

  it('returns negative for past dates', () => {
    const now = new Date(2026, 7, 2);
    expect(daysUntil('2026-08-01', now)).toBe(-1);
  });
});

describe('deadlineTone', () => {
  it('marks five or fewer days as danger', () => {
    expect(deadlineTone(5)).toBe('danger');
    expect(deadlineTone(0)).toBe('danger');
  });

  it('keeps six or more days neutral', () => {
    expect(deadlineTone(6)).toBe('neutral');
    expect(deadlineTone(30)).toBe('neutral');
  });
});
