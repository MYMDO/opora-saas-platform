import { BatteryCharging, Clock, Sun, TrendingDown } from 'lucide-react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, Eyebrow, KpiCard } from '../../../design-system/components';
import {
  DEFAULT_ARBITRAGE,
  DEMO_BESS,
  ENERGY_24H,
  getEnergySnapshot,
  MARKET_TARIFFS,
  MPC_EXPLANATION,
  WEEK_SAVINGS,
} from '../index';
import { formatDecimalUa, formatNumberUa } from '../../../lib/format';

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

export function EnergyPage() {
  const snap = getEnergySnapshot();
  const params = { ...DEFAULT_ARBITRAGE, batteryCapacityKwh: DEMO_BESS.capacityKwh };
  const arbitrageRows = [
    {
      label: 'Нічний тариф (заряджання)',
      value: `${formatDecimalUa(MARKET_TARIFFS.nightUahPerKwh)} ₴/кВт·год`,
      color: 'var(--ai)',
    },
    {
      label: 'Ринковий тариф вдень',
      value: `${formatDecimalUa(MARKET_TARIFFS.dayUahPerKwh)} ₴/кВт·год`,
      color: '#C9CDD2',
    },
    {
      label: 'Піковий тариф (розряджання)',
      value: `до ${formatDecimalUa(MARKET_TARIFFS.peakUahPerKwh)} ₴/кВт·год`,
      color: 'var(--energy)',
    },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard
          icon={BatteryCharging}
          label="Заряд BESS"
          value={`${snap.socPercent}%`}
          sub={snap.capacityLabel}
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
          sub={`Арбітраж: ${params.cyclesPerDay} цикли × ${formatDecimalUa(params.maxDodPercent, 0)}% DoD · еф. ${formatDecimalUa(params.roundTripEfficiencyPercent, 0)}%`}
          color="var(--finance)"
          dim="var(--finance-dim)"
        />
        <KpiCard
          icon={Clock}
          label="Окупність інвестиції"
          value={`${formatDecimalUa(snap.paybackYears ?? 0)} року`}
          sub="Розраховано з щоденної економії арбітражу"
          color="#C9CDD2"
          dim="rgba(201,205,210,0.12)"
        />
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16 }} className="opora-grid-2">
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
