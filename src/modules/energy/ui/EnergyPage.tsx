import { type CSSProperties } from 'react';
import { BatteryCharging, Clock, RotateCcw, Sun, TrendingDown } from 'lucide-react';
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
import { ChartTooltip, Eyebrow, KpiCard } from '../../../design-system/components';
import {
  computeBreakEvenDischargeUahPerKwh,
  DEFAULT_ARBITRAGE,
  DEMO_BESS,
  ENERGY_24H,
  getEnergySnapshot,
  MARKET_TARIFFS,
  MPC_EXPLANATION,
  WEEK_SAVINGS,
  type ArbitrageParams,
} from '../index';
import { formatDecimalUa, formatNumberUa } from '../../../lib/format';
import { useScenario } from '../../../app/scenario';

const resetButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 8px',
  cursor: 'pointer',
  color: 'var(--text-mute)',
  fontSize: 11,
  flexShrink: 0,
};

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 13,
};

function ArbitrageRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: color,
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{label}</span>
      </div>
      <span className="f-mono" style={{ fontSize: 13, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  onChange: (v: number) => void;
}

function NumberField({ label, value, min, max, step, onChange }: NumberFieldProps) {
  return (
    <label style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label}
      <input
        type="number"
        className="input-row"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          const clamped = Math.max(min, Number.isFinite(n) ? n : min);
          onChange(max == null ? clamped : Math.min(clamped, max));
        }}
        style={inputStyle}
      />
    </label>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-mute)' }}>{label}</span>
      <span className="f-mono" style={{ fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

export function EnergyPage() {
  const { scenario, updateEnergy, resetScenario } = useScenario();
  const { overrides, investmentUah } = scenario.energy;

  const params: ArbitrageParams = {
    ...DEFAULT_ARBITRAGE,
    batteryCapacityKwh: DEMO_BESS.capacityKwh,
    ...overrides,
  };

  const patch = (p: Partial<ArbitrageParams>) => updateEnergy({ overrides: p });

  const snap = getEnergySnapshot(params, investmentUah);
  const breakEven = computeBreakEvenDischargeUahPerKwh(params);
  const profitable = params.dischargePriceUahPerKwh > breakEven;

  const arbitrageRows = [
    {
      label: 'Нічний тариф (заряджання)',
      value: `${formatDecimalUa(params.chargePriceUahPerKwh)} ₴/кВт·год`,
      color: 'var(--ai)',
    },
    {
      label: 'Ринковий тариф вдень',
      value: `${formatDecimalUa(MARKET_TARIFFS.dayUahPerKwh)} ₴/кВт·год`,
      color: '#C9CDD2',
    },
    {
      label: 'Піковий тариф (розряджання)',
      value: `${formatDecimalUa(params.dischargePriceUahPerKwh)} ₴/кВт·год`,
      color: 'var(--energy)',
    },
    {
      label: 'Поріг рентабельності розряджання',
      value: `${formatDecimalUa(breakEven, 2)} ₴/кВт·год`,
      color: profitable ? 'var(--finance)' : 'var(--danger)',
    },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard
          icon={BatteryCharging}
          label="Заряд BESS"
          value={`${snap.socPercent}%`}
          sub={`${formatNumberUa(params.batteryCapacityKwh)} кВт·год · DoD ${formatDecimalUa(params.maxDodPercent, 0)}%`}
          color="var(--energy)"
          dim="var(--energy-dim)"
        />
        <KpiCard
          icon={Sun}
          label="Генерація сьогодні"
          value={`${snap.generationTodayKwh} кВт·год`}
          sub="СЕС 30 кВт, пікове сонце 12:00–15:00"
          color="var(--energy)"
          dim="var(--energy-dim)"
        />
        <KpiCard
          icon={TrendingDown}
          label="Економія сьогодні"
          value={`${formatNumberUa(snap.savedTodayUah)} ₴`}
          sub={`Арбітраж: ${formatDecimalUa(params.cyclesPerDay, 0)} цикли × ${formatNumberUa(params.batteryCapacityKwh * (params.maxDodPercent / 100))} кВт·год корисних`}
          color="var(--finance)"
          dim="var(--finance-dim)"
        />
        <KpiCard
          icon={Clock}
          label="Окупність інвестиції"
          value={snap.paybackYears == null ? '—' : `${formatDecimalUa(snap.paybackYears)} року`}
          sub={`Інвестиція ${formatNumberUa(investmentUah)} ₴`}
          color="#C9CDD2"
          dim="rgba(201,205,210,0.12)"
        />
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Eyebrow color="var(--ai)">Інтерактивна модель</Eyebrow>
          <button onClick={resetScenario} title="Повернути демо-дані" aria-label="Скинути сценарій" style={resetButtonStyle}>
            <RotateCcw size={11} /> Скинути
          </button>
        </div>
        <div className="f-display" style={{ fontSize: 15, fontWeight: 600 }}>
          Калькулятор економіки BESS
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 14 }}>
          Змініть параметри обладнання чи тарифів — KPI та окупність перерахуються миттєво
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)',
            gap: 16,
          }}
          className="opora-grid-2"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10,
              alignContent: 'start',
            }}
          >
            <NumberField
              label="Ємність батареї, кВт·год"
              value={params.batteryCapacityKwh}
              min={0}
              step={100}
              onChange={(v) => patch({ batteryCapacityKwh: v })}
            />
            <NumberField
              label="Глибина розряду (DoD), %"
              value={params.maxDodPercent}
              min={10}
              max={100}
              step={5}
              onChange={(v) => patch({ maxDodPercent: v })}
            />
            <NumberField
              label="Кругова ефективність, %"
              value={params.roundTripEfficiencyPercent}
              min={30}
              max={100}
              step={1}
              onChange={(v) => patch({ roundTripEfficiencyPercent: v })}
            />
            <NumberField
              label="Циклів на добу"
              value={params.cyclesPerDay}
              min={0}
              max={6}
              step={1}
              onChange={(v) => patch({ cyclesPerDay: Math.floor(v) })}
            />
            <NumberField
              label="Нічний тариф, ₴/кВт·год"
              value={params.chargePriceUahPerKwh}
              min={0}
              step={0.1}
              onChange={(v) => patch({ chargePriceUahPerKwh: v })}
            />
            <NumberField
              label="Піковий тариф, ₴/кВт·год"
              value={params.dischargePriceUahPerKwh}
              min={0}
              step={0.1}
              onChange={(v) => patch({ dischargePriceUahPerKwh: v })}
            />
            <NumberField
              label="Деградація, ₴/кВт·год"
              value={params.degradationCostUahPerKwh}
              min={0}
              step={0.05}
              onChange={(v) => patch({ degradationCostUahPerKwh: v })}
            />
            <NumberField
              label="Інвестиція, ₴"
              value={investmentUah}
              min={0}
              step={100_000}
              onChange={(v) => updateEnergy({ investmentUah: v })}
            />
          </div>

          <div className="panel-2" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ResultRow label="Економія за добу" value={`${formatNumberUa(snap.savedTodayUah)} ₴`} />
            <ResultRow
              label="Економія за рік"
              value={`${formatNumberUa(snap.savedTodayUah * 365)} ₴`}
            />
            <ResultRow
              label="Окупність"
              value={
                snap.paybackYears == null ? '—' : `${formatDecimalUa(snap.paybackYears)} року`
              }
            />
            <span
              className="chip f-mono"
              style={{
                alignSelf: 'flex-start',
                marginTop: 2,
                background: profitable ? 'var(--finance-dim)' : 'var(--danger-dim)',
                color: profitable ? 'var(--finance)' : 'var(--danger)',
              }}
            >
              {profitable ? 'Арбітраж рентабельний' : 'Пік нижче порогу рентабельності'}
            </span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <Eyebrow color="var(--energy)">Профіль доби</Eyebrow>
        <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          Генерація, споживання та заряд батареї
        </div>
        <div style={{ height: 240 }}>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)',
          gap: 16,
        }}
        className="opora-grid-2"
      >
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--finance)">Тиждень</Eyebrow>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Вартість електроенергії: без EMS проти з EMS
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEK_SAVINGS} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip unit=" ₴" />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="without" name="Без EMS" fill="var(--border-light)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="with" name="З EMS" fill="var(--energy)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow>Логіка арбітражу тарифів</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {arbitrageRows.map((r) => (
              <ArbitrageRow key={r.label} {...r} />
            ))}
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-mute)',
                lineHeight: 1.5,
                marginTop: 6,
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
              }}
            >
              {MPC_EXPLANATION}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
