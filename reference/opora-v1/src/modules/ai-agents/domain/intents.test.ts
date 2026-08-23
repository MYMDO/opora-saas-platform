import { describe, expect, it } from 'vitest';
import { classifyIntent } from './intents';

describe('classifyIntent', () => {
  it('scores vat keywords', () => {
    const m = classifyIntent('Які ліміти ПДВ по контрагенту Технобуд?');
    expect(m.id).toBe('vat');
    expect(m.score).toBeGreaterThanOrEqual(2);
  });

  it('detects greeting in Ukrainian and English', () => {
    expect(classifyIntent('Вітаю!').id).toBe('greeting');
    expect(classifyIntent('hello there').id).toBe('greeting');
  });

  it('matches booking and energy domains', () => {
    expect(classifyIntent('чи можна бронювання для нового працівника?').id).toBe('booking');
    expect(classifyIntent('який заряд батареї зараз?').id).toBe('energy');
  });

  it('returns unknown for unrelated text', () => {
    expect(classifyIntent('яка погода у Львові?')).toEqual({ id: 'unknown', score: 0 });
  });
});
