import { quotaSlots, remainingBookingSlots, type EnterpriseBookingContext } from '../../hr/index';
import type { FinanceSnapshot } from '../../finance/index';

export type ActionSeverity = 'danger' | 'warning' | 'info' | 'ok';
export type ActionModule = 'finance' | 'energy' | 'hr' | 'ai';

export const MODULE_LABELS: Record<ActionModule, string> = {
  finance: 'Фінанси',
  energy: 'Енергія',
  hr: 'Кадри',
  ai: 'ШІ-агенти',
};

export interface DailyAction {
  readonly id: string;
  readonly severity: ActionSeverity;
  readonly module: ActionModule;
  readonly title: string;
  readonly detail?: string;
  readonly dueLabel?: string;
}

export interface DailyActionsInput {
  readonly finance: Pick<FinanceSnapshot, 'contractors' | 'deadlines' | 'risk'>;
  readonly batterySocPercent: number;
  readonly booking: EnterpriseBookingContext;
  readonly aiResolvedToday: number;
}

const SEVERITY_RANK: Record<ActionSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

function contractorActions(finance: DailyActionsInput['finance']): DailyAction[] {
  const out: DailyAction[] = [];
  for (const c of finance.contractors) {
    if (c.level === 'safe') continue;
    out.push({
      id: `contractor:${c.name}`,
      severity: c.level === 'danger' ? 'danger' : 'warning',
      module: 'finance',
      title:
        c.level === 'danger'
          ? `${c.name} — ${c.usedUah.toLocaleString('uk-UA')} ₴ з ${c.limitUah.toLocaleString('uk-UA')} ₴: ризик блокування ПН`
          : `${c.name} — ліміт використано понад 70%`,
      detail:
        c.level === 'danger'
          ? 'Утримайтеся від нових постачань на цього контрагента або розподіліть їх між іншими.'
          : 'Слідкуйте за обсягом постачання до кінця місяця.',
      dueLabel: c.level === 'danger' ? 'зараз' : undefined,
    });
  }
  return out;
}

function deadlineActions(finance: DailyActionsInput['finance']): DailyAction[] {
  return finance.deadlines
    .filter((d) => d.daysLeft <= 14)
    .map((d) => ({
      id: `deadline:${d.id}`,
      severity: d.daysLeft <= 5 ? ('danger' as const) : ('warning' as const),
      module: 'finance' as const,
      title: d.title,
      detail: `Строк — ${d.dueDateIso}`,
      dueLabel: `${d.daysLeft} дн.`,
    }));
}

function bookingActions(booking: EnterpriseBookingContext): DailyAction[] {
  const quota = quotaSlots(booking);
  const remaining = remainingBookingSlots(booking);
  if (quota <= 0) return [];
  if (remaining <= 0) {
    return [
      {
        id: 'booking-quota-exhausted',
        severity: 'warning',
        module: 'hr',
        title: `Ліміт бронювання вичерпано (${booking.alreadyBookedCount}/${quota})`,
        detail: 'Нові заявки буде відхилено — перевірте статус критичної галузі або зніміть частину бронювань.',
      },
    ];
  }
  if (remaining <= 2) {
    return [
      {
        id: 'booking-quota-low',
        severity: 'info',
        module: 'hr',
        title: `Ліміт бронювання майже вичерпано: вільних ${remaining} з ${quota}`,
        detail: 'Заплануйте пріоритети бронювання до наступного перегляду квот.',
      },
    ];
  }
  return [];
}

export function buildDailyActions(input: DailyActionsInput): DailyAction[] {
  const items: DailyAction[] = [
    ...contractorActions(input.finance),
    ...deadlineActions(input.finance),
  ];

  if (input.finance.risk.label === 'високий') {
    items.push({
      id: 'tax-risk-high',
      severity: 'warning',
      module: 'finance',
      title: `Податковий ризик ${input.finance.risk.scorePercent}% — рівень «високий»`,
      detail: 'Перевірте ліміти контрагентів та історію реєстрації перед новими постачаннями.',
    });
  }

  if (input.batterySocPercent >= 75) {
    items.push({
      id: 'bess-reserve',
      severity: 'info',
      module: 'energy',
      title: `BESS заряджена до ${input.batterySocPercent}%`,
      detail: 'Резерв достатній для вечірнього піку — тримайте розряд на високому тарифі.',
    });
  }

  items.push(...bookingActions(input.booking));

  if (input.aiResolvedToday > 0) {
    items.push({
      id: 'ai-daily-ok',
      severity: 'ok',
      module: 'ai',
      title: `Агенти закрили ${input.aiResolvedToday} звернень сьогодні без ескалації`,
      detail: 'Рутина працює 24/7 — команда сфокусована на складних кейсах.',
    });
  }

  return items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
