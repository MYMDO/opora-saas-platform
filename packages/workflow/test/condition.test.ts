import { describe, expect, it } from 'vitest';
import { parseSimpleEquality, conditionMatches } from '../src/condition';

describe('parseSimpleEquality', () => {
  it('парсить рядкові літерали', () => {
    expect(parseSimpleEquality("record.status == 'new'")).toEqual({
      field: 'status',
      value: 'new',
    });
  });

  it('парсить числа та boolean', () => {
    expect(parseSimpleEquality('record.estimate == 4.5')).toEqual({ field: 'estimate', value: 4.5 });
    expect(parseSimpleEquality('record.is_vip == true')).toEqual({ field: 'is_vip', value: true });
  });

  it('повертає null для складних виразів (поза граматикою v1)', () => {
    expect(parseSimpleEquality("record.a == 'x' && record.b == 'y'")).toBeNull();
    expect(parseSimpleEquality("firstAvailable('agent')")).toBeNull();
    expect(parseSimpleEquality('user.id == record.ownerId')).toBeNull();
  });
});

describe('conditionMatches', () => {
  it('порівнює значення поля запису', () => {
    expect(conditionMatches("record.status == 'new'", { status: 'new' })).toBe(true);
    expect(conditionMatches("record.status == 'new'", { status: 'done' })).toBe(false);
  });

  it('null для непідтримуваного виразу', () => {
    expect(conditionMatches("record.a && record.b", null)).toBeNull();
  });
});
