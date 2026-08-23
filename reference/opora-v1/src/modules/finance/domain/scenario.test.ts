import { describe, expect, it } from 'vitest';
import {
  addContractor,
  defaultFinanceScenario,
  listedTotalUah,
  removeContractor,
  UNLISTED_CONTRACTORS_BASE_UAH,
  updateContractor,
} from './scenario';

describe('finance scenario ops', () => {
  it('defaults mirror the fixture list and adjustment window', () => {
    const s = defaultFinanceScenario();
    expect(s.contractors).toHaveLength(4);
    expect(s.contractors[0]?.name).toBe('ТОВ «Технобуд»');
    expect(s.adjustmentWindowDays).toBe(12);
  });

  it('updates a row immutably', () => {
    const rows = defaultFinanceScenario().contractors;
    const next = updateContractor(rows, 0, { usedUah: 99_999 });
    expect(next[0]?.usedUah).toBe(99_999);
    expect(rows[0]?.usedUah).toBe(97_500);
  });

  it('adds a trimmed contractor and ignores blank names', () => {
    const rows = defaultFinanceScenario().contractors;
    expect(addContractor(rows, '  ТОВ «Новий» ', 100_000)).toHaveLength(5);
    expect(addContractor(rows, '   ', 100_000)).toHaveLength(4);
  });

  it('removes by index only', () => {
    const rows = defaultFinanceScenario().contractors;
    const next = removeContractor(rows, 2);
    expect(next).toHaveLength(3);
    expect(next.map((r) => r.name)).not.toContain('ФОП Коваленко І. В.');
  });

  it('keeps the unlisted base coherent with fixtures', () => {
    const s = defaultFinanceScenario();
    expect(UNLISTED_CONTRACTORS_BASE_UAH).toBe(366_200);
    expect(UNLISTED_CONTRACTORS_BASE_UAH + listedTotalUah(s.contractors)).toBe(612_000);
  });
});
