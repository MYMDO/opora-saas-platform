import { describe, expect, it } from 'vitest';
import { getEnergySnapshot } from '../../energy/index';
import { getFinanceSnapshot } from '../../finance/index';
import { buildAssistantReply, type AssistantContext } from './replies';

const ctx: AssistantContext = {
  finance: getFinanceSnapshot(),
  energy: getEnergySnapshot(),
  roster: { eligibleCount: 2, total: 5 },
  bookingRemainingSlots: 2,
};

const hanna = { id: 'hanna', name: 'Ганна' };
const solomiya = { id: 'solomiya', name: 'Соломія' };

describe('buildAssistantReply', () => {
  it('answers vat questions with live totals and the risky contractor', () => {
    const reply = buildAssistantReply(hanna, 'які ліміти ПДВ зараз?', ctx, 'fallback');
    expect(reply).toMatch(/612\s000/);
    expect(reply).toContain('Технобуд');
    expect(reply).not.toBe('fallback');
  });

  it('answers energy questions with SoC and savings', () => {
    const reply = buildAssistantReply(hanna, 'скільки економить батарея сьогодні?', ctx, 'x');
    expect(reply).toContain('82%');
    expect(reply).toMatch(/14\s727/);
  });

  it('booking answers include eligible counts and remaining slots', () => {
    const reply = buildAssistantReply(solomiya, 'можна бронювання для нового працівника?', ctx, 'x');
    expect(reply).toContain('2 з 5');
    expect(reply).toMatch(/Вільних слотів[^.]*:\s2/);
  });

  it('routes foreign intents to the owning agent', () => {
    const reply = buildAssistantReply(solomiya, 'які ліміти ПДВ?', ctx, 'fb');
    expect(reply).toContain('Ганна');
    const back = buildAssistantReply(hanna, 'питання про бронювання працівника', ctx, 'fb');
    expect(back).toContain('Соломія');
  });

  it('greets with the agent name', () => {
    const reply = buildAssistantReply(solomiya, 'Вітаю!', ctx, 'fb');
    expect(reply).toContain('Я Соломія');
  });

  it('falls back verbatim on unknown intent', () => {
    const reply = buildAssistantReply(hanna, 'котик', ctx, 'Уточніть, будь ласка, запит.');
    expect(reply).toBe('Уточніть, будь ласка, запит.');
  });
});
