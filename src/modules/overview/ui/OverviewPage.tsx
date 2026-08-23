import { BatteryCharging, Bot, CheckCircle2, ShieldCheck, Wallet } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip, Dot, Eyebrow, KpiCard } from '../../../design-system/components';
import { formatNumberUa } from '../../../lib/format';
import { AI_WEEK, TODAY_AI_RESOLVED } from '../../ai-agents/index';
import { ENERGY_24H, getEnergySnapshot } from '../../energy/index';
import { getFinanceSnapshot } from '../../finance/index';
import {
  computeMonthlyBill,
  DEMO_PLAN_ID,
  DEMO_RESOLUTIONS_THIS_MONTH,
} from '../../billing/index';
import { DEMO_ENTERPRISE } from '../../hr/index';
import { buildDailyActions, MODULE_LABELS, type DailyAction } from '../domain/actions';
import { useScenario } from '../../../app/scenario';

const SEVERITY_STYLE = {
  danger: { color: 'var(--danger)', dim: 'var(--danger-dim)' },
  warning: { color: 'var(--energy)', dim: 'var(--energy-dim)' },
  info: { color: 'var(--ai)', dim: 'var(--ai-dim)' },
  ok: { color: 'var(--finance)', dim: 'var(--finance-dim)' },
} as const;

function ActionCard({ action }: { action: DailyAction }) {
  const s = SEVERITY_STYLE[action.severity];
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        alignItems: 'flex-start',
      }}
    >
      <Dot color={s.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500, lineHeight: 1.4 }}>
          {action.title}
        </div>
        {action.detail && (
          <div style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 3, lineHeight: 1.45 }}>
            {action.detail}
          </div>
        )}
        <div className="f-mono" style={{ fontSize: 10.5, color: 'var(--text-mute)', marginTop: 4 }}>
          {MODULE_LABELS[action.module]}
        </div>
      </div>
      {action.dueLabel && (
        <span
          className="chip f-mono"
          style={{ background: s.dim, color: s.color, flexShrink: 0 }}
        >
          {action.dueLabel}
        </span>
      )}
    </div>
  );
}

function CalmState({ compact }: { compact?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: compact ? '8px 0' : '18px 0',
        color: 'var(--text-dim)',
        fontSize: 13,
      }}
    >
      <CheckCircle2 size={16} color="var(--finance)" />
      {compact
        ? 'Інших сигналів немає.'
        : 'Критичних сигналів немає — операційна стійкість під контролем.'}
    </div>
  );
}

function BillingRow({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block' }} />
          <span style={{ fontSize: 13 }}>{label}</span>
        </div>
        <span className="f-mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {value}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 3, marginLeft: 14 }}>{note}</div>
    </div>
  );
}

export function OverviewPage() {
  const { finance: scenario } = useScenario();
  const finance = getFinanceSnapshot(scenario);
  const energy = getEnergySnapshot();

  const actions = buildDailyActions({
    finance,
    batterySocPercent: energy.socPercent,
    booking: DEMO_ENTERPRISE,
    aiResolvedToday: TODAY_AI_RESOLVED,
  });
  const topActions = actions.slice(0, 3);
  const restActions = actions.slice(3);

  const monthlySavingsUah = Math.round((energy.savedTodayUah * 365) / 12);
  const bill = computeMonthlyBill(DEMO_PLAN_ID, {
    resolutionsThisMonth: DEMO_RESOLUTIONS_THIS_MONTH,
    verifiedMonthlySavingsUah: monthlySavingsUah,
  });

  const emsNote =
    bill.ems.kind === 'savings-share'
      ? `${bill.ems.sharePercent}% від верифікованої економії ${formatNumberUa(bill.ems.savingsBasisUah)} ₴`
      : bill.ems.kind === 'fixed-monthly'
        ? 'Фіксована плата за EMS Lite'
        : `${formatNumberUa(bill.ems.capacityKwh)} кВт·год ємності під керуванням`;

  const billingRows = [
    {
      label: `Базова підписка (${bill.plan.label})`,
      value: `${formatNumberUa(bill.platformFeeUah)} ₴`,
      note: 'Фіксована плата за інфраструктуру та ISO 27001',
      color: '#C9CDD2',
    },
    {
      label: 'ШІ-модуль — оплата за результат',
      value: `${formatNumberUa(bill.aiOutcome.amountUah)} ₴`,
      note: `${formatNumberUa(bill.aiOutcome.billableResolutions)} звернень × ${formatNumberUa(bill.plan.pricePerResolutionUah)} ₴ · ${formatNumberUa(bill.plan.includedResolutions)} включено у підписку`,
      color: 'var(--ai)',
    },
    {
      label: 'Енергомодуль — оплата за використання',
      value: `${formatNumberUa(bill.ems.amountUah)} ₴`,
      note: emsNote,
      color: 'var(--energy)',
    },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="panel" style={{ padding: 18 }}>
        <Eyebrow>Сьогодні варто зробити</Eyebrow>
        {topActions.length === 0 ? (
          <CalmState />
        ) : (
          topActions.map((a) => <ActionCard key={a.id} action={a} />)
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard
          icon={Bot}
          label="Звернень оброблено ШІ сьогодні"
          value={String(TODAY_AI_RESOLVED)}
          sub="93% без ескалації на людину"
          color="var(--ai)"
          dim="var(--ai-dim)"
        />
        <KpiCard
          icon={BatteryCharging}
          label="Заряд BESS зараз"
          value={`${energy.socPercent}%`}
          sub={`Економія сьогодні — ${formatNumberUa(energy.savedTodayUah)} ₴`}
          color="var(--energy)"
          dim="var(--energy-dim)"
        />
        <KpiCard
          icon={ShieldCheck}
          label="Податковий ризик"
          value={`${finance.risk.scorePercent}%`}
          sub={`${finance.risk.label} · ${finance.contractors.filter((c) => c.level !== 'safe').length} контрагент потребує уваги`}
          color="var(--finance)"
          dim="var(--finance-dim)"
        />
        <KpiCard
          icon={Wallet}
          label="Витрати платформи цього місяця"
          value={`${formatNumberUa(bill.totalUah)} ₴`}
          sub="База + оплата за результат + за використання"
          color="#C9CDD2"
          dim="rgba(201,205,210,0.12)"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)',
          gap: 16,
        }}
        className="opora-grid-2"
      >
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--energy)">Енергія · останні 24 години</Eyebrow>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600 }}>
            Генерація, споживання, заряд батареї
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ENERGY_24H} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="h" tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis yAxisId="p" tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <YAxis yAxisId="b" orientation="right" domain={[0, 100]} tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<ChartTooltip unit=" кВт" />} />
                <Area yAxisId="p" type="monotone" dataKey="gen" name="Генерація" stroke="var(--energy)" fill="var(--energy-dim)" strokeWidth={2} />
                <Line yAxisId="p" type="monotone" dataKey="cons" name="Споживання" stroke="#C9CDD2" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                <Line yAxisId="b" type="monotone" dataKey="batt" name="Заряд, %" stroke="var(--ai)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
          <Eyebrow>Стрічка подій</Eyebrow>
          <div style={{ flex: 1 }}>
            {restActions.length === 0 ? (
              <CalmState compact />
            ) : (
              restActions.map((a) => <ActionCard key={a.id} action={a} />)
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }} className="opora-grid-2">
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--ai)">ШІ-агенти · тиждень</Eyebrow>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Оброблені звернення
          </div>
          <div style={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={AI_WEEK} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="resolved" name="Вирішено" fill="var(--ai)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="escalated" name="Ескальовано" fill="var(--border-light)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--finance)">Тарифікація · гібридна модель</Eyebrow>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Розбивка витрат цього місяця
          </div>
          {billingRows.map((r) => (
            <BillingRow key={r.label} {...r} />
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingTop: 10,
            }}
          >
            <span className="f-display" style={{ fontSize: 14, fontWeight: 700 }}>
              Разом за місяць
            </span>
            <span className="f-mono" style={{ fontSize: 15, fontWeight: 700 }}>
              {formatNumberUa(bill.totalUah)} ₴
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
