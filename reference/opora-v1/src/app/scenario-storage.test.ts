import { describe, expect, it, vi } from 'vitest';
import { defaults, loadInitial, safeId, sanitizeArbitrageOverrides } from './scenario-storage';

function storageWith(value: string) {
  return { getItem: (key: string) => (key === 'opora-scenario-v1' ? value : null) };
}

describe('sanitizeArbitrageOverrides', () => {
  it('clamps values into safe ranges and floors cycles', () => {
    const o = sanitizeArbitrageOverrides({
      batteryCapacityKwh: 5_000_000,
      maxDodPercent: 150,
      roundTripEfficiencyPercent: 10,
      cyclesPerDay: 9.7,
      chargePriceUahPerKwh: -3,
    });
    expect(o.batteryCapacityKwh).toBe(1_000_000);
    expect(o.maxDodPercent).toBe(100);
    expect(o.roundTripEfficiencyPercent).toBe(20);
    expect(o.cyclesPerDay).toBe(6);
    expect(o.chargePriceUahPerKwh).toBe(0);
  });

  it('returns empty for non-objects', () => {
    expect(sanitizeArbitrageOverrides(null)).toEqual({});
    expect(sanitizeArbitrageOverrides('x')).toEqual({});
  });
});

describe('safeId', () => {
  it('keeps valid slug ids', () => {
    expect(safeId('emp-1')).toBe('emp-1');
    expect(safeId('A9_z')).toBe('A9_z');
  });

  it('regenerates invalid or missing ids', () => {
    const regenerated = safeId('not valid!');
    expect(regenerated).toMatch(/^[0-9a-f-]{36}$/);
    expect(safeId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('loadInitial', () => {
  it('returns defaults when storage is unavailable', () => {
    vi.stubGlobal('crypto', { ...crypto, randomUUID: () => 'uuid-generated' });
    expect(loadInitial()).toEqual(defaults());
  });

  it('recovers from corrupted JSON', () => {
    vi.stubGlobal('crypto', { ...crypto, randomUUID: () => 'uuid-generated' });
    expect(loadInitial(storageWith('{broken'))).toEqual(defaults());
  });

  it('normalizes legacy employee ids and clamps fields', async () => {
    const raw = JSON.stringify({
      finance: { adjustmentWindowDays: -5 },
      hr: {
        employees: [{ id: 'emp-1', name: 'Іван', monthlySalaryUah: 26_000 }],
        enterprise: { territoryType: 'space', hasCriticalEnterpriseStatus: 'yes' },
      },
      energy: { overrides: { maxDodPercent: 250 } },
    });
    vi.stubGlobal('crypto', { ...crypto, randomUUID: () => 'uuid-generated' });
    const s = loadInitial(storageWith(raw));
    expect(s.finance.adjustmentWindowDays).toBe(0);
    expect(s.hr.employees[0]?.id).toBe('emp-1');
    expect(s.hr.enterprise.territoryType).toBe('regular');
    expect(s.hr.enterprise.hasCriticalEnterpriseStatus).toBe(false);
    expect(s.energy.overrides.maxDodPercent).toBe(100);
  });

  it('drops contractor rows with broken numbers', async () => {
    const raw = JSON.stringify({
      finance: {
        contractors: [
          { id: 'c1', name: 'OK', usedUah: 100, limitUah: 200 },
          { id: 'c2', name: 'БРЕД', usedUah: 'багато', limitUah: null },
        ],
      },
    });
    vi.stubGlobal('crypto', { ...crypto, randomUUID: () => 'uuid-generated' });
    const s = loadInitial(storageWith(raw));
    expect(s.finance.contractors.map((c) => c.name)).toEqual(['OK']);
  });
});
