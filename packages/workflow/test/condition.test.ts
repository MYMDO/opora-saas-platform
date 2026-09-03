import { describe, expect, it } from 'vitest';
import { parseSimpleEquality, parseCondition, conditionMatches } from '../src/condition';

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

describe('parseCondition (v2: оператори порівняння)', () => {
  it('парсить !=, <, <=, >, >=', () => {
    expect(parseCondition("record.status != 'done'")).toEqual({ field: 'status', op: '!=', value: 'done' });
    expect(parseCondition('record.qty < 10')).toEqual({ field: 'qty', op: '<', value: 10 });
    expect(parseCondition('record.qty <= 10')).toEqual({ field: 'qty', op: '<=', value: 10 });
    expect(parseCondition('record.qty > 10')).toEqual({ field: 'qty', op: '>', value: 10 });
    expect(parseCondition('record.qty >= 10')).toEqual({ field: 'qty', op: '>=', value: 10 });
  });

  it('parseSimpleEquality приймає лише ==', () => {
    expect(parseSimpleEquality('record.qty < 10')).toBeNull();
    expect(parseSimpleEquality("record.status != 'done'")).toBeNull();
  });
});

describe('conditionMatches (v2: семантика)', () => {
  it('числові порівняння', () => {
    expect(conditionMatches('record.qty < 10', { qty: 5 })).toBe(true);
    expect(conditionMatches('record.qty < 10', { qty: 10 })).toBe(false);
    expect(conditionMatches('record.qty >= 10', { qty: 10 })).toBe(true);
    expect(conditionMatches('record.qty > 10', { qty: 9.99 })).toBe(false);
  });

  it('нерівність для рядків і boolean', () => {
    expect(conditionMatches("record.status != 'done'", { status: 'new' })).toBe(true);
    expect(conditionMatches("record.status != 'done'", { status: 'done' })).toBe(false);
    expect(conditionMatches('record.is_vip != true', { is_vip: false })).toBe(true);
  });

  it('відсутнє поле або невідповідність типів — false, не виняток', () => {
    expect(conditionMatches('record.qty < 10', {})).toBe(false);
    expect(conditionMatches('record.qty < 10', null)).toBe(false);
    expect(conditionMatches('record.qty < 10', { qty: 'багато' })).toBe(false);
    expect(conditionMatches('record.qty < 10', { qty: '5' })).toBe(false);
  });
});
