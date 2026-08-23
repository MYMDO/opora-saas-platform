import { formatNumberUa } from '../../../lib/format';
import type { FinanceSnapshot } from '../../finance/index';
import type { EnergySnapshot } from '../../energy/index';
import { classifyIntent, type IntentId } from './intents';

export interface AssistantContext {
  readonly finance: FinanceSnapshot;
  readonly energy: EnergySnapshot;
  readonly roster: { readonly eligibleCount: number; readonly total: number };
  readonly bookingRemainingSlots: number;
}

export interface AgentRef {
  readonly id: string;
  readonly name: string;
}

const INTENT_OWNER: Record<Exclude<IntentId, 'greeting' | 'unknown'>, string> = {
  vat: 'Ганна',
  energy: 'Ганна',
  booking: 'Соломія',
  billing: 'Тарас',
};

const STRENGTHS: Record<string, string> = {
  solomiya: 'бронювання та онбординг працівників',
  taras: 'тарифікація платформи і кваліфікація лідів',
  hanna: 'ліміти ПДВ, стан енергії та типові звернення',
};

function vatReply(ctx: AssistantContext): string {
  const { totals, contractors } = ctx.finance;
  const risky = contractors.filter((c) => c.level !== 'safe');
  const danger = contractors.find((c) => c.level === 'danger');
  let reply = `Загальний обсяг постачання — ${formatNumberUa(totals.usedUah)} ₴ з ${formatNumberUa(totals.limitUah)} ₴ безумовного ліміту.`;
  if (danger) {
    reply += ` Увага: ${danger.name} — ${formatNumberUa(danger.usedUah)} ₴ з ${formatNumberUa(danger.limitUah)} ₴, ризик блокування ПН. Утримайтеся від нових постачань на цього контрагента.`;
  } else if (risky.length > 0) {
    reply += ` Жовта зона: ${risky.map((c) => c.name).join(', ')} — слідкуйте за обсягами до кінця місяця.`;
  } else {
    reply += ' Усі контрагенти в безпечній зоні.';
  }
  return reply;
}

function energyReply(ctx: AssistantContext): string {
  const e = ctx.energy;
  let reply = `BESS заряджена до ${e.socPercent}%, економія сьогодні — ${formatNumberUa(e.savedTodayUah)} ₴.`;
  reply +=
    e.paybackYears == null
      ? ' За поточних параметрів окупності немає — перевірте тарифи в калькуляторі.'
      : ` Окупність інвестиції — близько ${e.paybackYears.toFixed(1).replace('.', ',')} року.`;
  return reply;
}

function bookingReply(ctx: AssistantContext): string {
  if (ctx.roster.total === 0) {
    return 'Реєстр працівників порожній — додайте їх у розділ «Бронювання», і я перевірю відповідність КМУ №692.';
  }
  const thresholdNote =
    ctx.bookingRemainingSlots > 0
      ? `Вільних слотів бронювання: ${ctx.bookingRemainingSlots}.`
      : 'Ліміт бронювання вичерпано — нові заявки буде відхилено.';
  return `Зараз відповідають порогу ${ctx.roster.eligibleCount} з ${ctx.roster.total} працівників. ${thresholdNote}`;
}

function billingReply(ctx: AssistantContext): string {
  return `Діє гібридна модель: фіксована підписка + оплата за вирішені звернення + частка від верифікованої економії енергії (${formatNumberUa(ctx.energy.savedTodayUah)} ₴ лише за сьогодні). Детальна розбивка рахунку — на головному екрані, картка «Тарифікація».`;
}

function greetingReply(agent: AgentRef): string {
  return `Вітаю! Я ${agent.name}. Підкажу щодо ${(STRENGTHS[agent.id] ?? 'роботи платформи').toLowerCase()}.`;
}

function redirectReply(agent: AgentRef, intent: IntentId): string {
  const owner = INTENT_OWNER[intent as Exclude<IntentId, 'greeting' | 'unknown'>];
  return `Це питання — до агента ${owner}, передам діалог їй. Сам же я найсильніший у ${(STRENGTHS[agent.id] ?? 'підтримці').toLowerCase()}.`;
}

export function buildAssistantReply(
  agent: AgentRef,
  text: string,
  ctx: AssistantContext,
  fallbackReply: string,
): string {
  const intent = classifyIntent(text);
  switch (intent.id) {
    case 'greeting':
      return greetingReply(agent);
    case 'vat':
      return agent.id === 'hanna' ? vatReply(ctx) : redirectReply(agent, intent.id);
    case 'energy':
      return agent.id === 'hanna' ? energyReply(ctx) : redirectReply(agent, intent.id);
    case 'booking':
      return agent.id === 'solomiya' ? bookingReply(ctx) : redirectReply(agent, intent.id);
    case 'billing':
      return agent.id === 'taras' ? billingReply(ctx) : redirectReply(agent, intent.id);
    case 'unknown':
      return fallbackReply;
  }
}
