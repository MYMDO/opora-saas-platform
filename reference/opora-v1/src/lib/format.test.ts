import { describe, expect, it } from 'vitest';
import { formatDateUa, formatDecimalUa, formatNumberUa } from './format';

describe('format helpers', () => {
  it('renders numbers with uk-UA group separator', () => {
    expect(formatNumberUa(14727)).toMatch(/14[\s\u00A0]727/);
  });

  it('uses decimal comma', () => {
    expect(formatDecimalUa(3.386)).toBe('3,4');
    expect(formatDecimalUa(2.5)).toBe('2,5');
  });

  it('formats ISO dates as dd.mm.yyyy', () => {
    expect(formatDateUa('2026-08-01')).toBe('01.08.2026');
    expect(formatDateUa('2026-12-31')).toBe('31.12.2026');
  });
});
