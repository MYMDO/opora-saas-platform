import { AlertTriangle, Clock, FileText, ShieldCheck } from 'lucide-react';
import { Area, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KpiCard, ProgressBar, Eyebrow, ChartTooltip } from '../../../design-system/components';
import { formatNumberUa } from '../../../lib/format';
import { getFinanceSnapshot } from '../index';
import { RISK_TREND } from '../data/fixtures';

export function FinancePage() {
  const snapshot = getFinanceSnapshot();
  const { contractors, totals, risk, deadlines } = snapshot;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard
          icon={ShieldCheck}
          label="Податковий ризик"
          value={`${risk.scorePercent}%`}
          sub={`Рівень: ${risk.label}`}
          color="var(--finance)"
          dim="var(--finance-dim)"
        />
        <KpiCard
          icon={FileText}
          label="Загальний обсяг постачання"
          value={`${formatNumberUa(totals.usedUah)} ₴`}
          sub={`з ${formatNumberUa(totals.limitUah)} ₴ безумовного ліміту`}
          color="#C9CDD2"
          dim="rgba(201,205,210,0.12)"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Контрагентів під ризиком"
          value={String(contractors.filter((c) => c.level !== 'safe').length)}
          sub={contractors.find((c) => c.level === 'danger')?.name ?? '—'}
          color="var(--danger)"
          dim="var(--danger-dim)"
        />
        <KpiCard
          icon={Clock}
          label="Найближчий дедлайн"
          value={`${deadlines[0]?.daysLeft ?? 0} дн.`}
          sub={deadlines[0]?.title}
          color="var(--ai)"
          dim="var(--ai-dim)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16 }} className="opora-grid-2">
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--finance)">Ліміти реєстрації ПН</Eyebrow>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Обсяг постачання на контрагента
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 14 }}>
            Поріг безумовної реєстрації — {formatNumberUa(totals.limitUah / 10)} ₴ на контрагента
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {contractors.map((c) => (
              <div key={c.name}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12.5,
                    marginBottom: 5,
                  }}
                >
                  <span>{c.name}</span>
                  <span className="f-mono" style={{ color: 'var(--text-dim)' }}>
                    {formatNumberUa(c.usedUah)} / {formatNumberUa(c.limitUah)} ₴
                  </span>
                </div>
                <ProgressBar used={c.usedUah} limit={c.limitUah} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12.5,
                marginBottom: 5,
              }}
            >
              <span>Загальний обсяг постачання (усі контрагенти)</span>
              <span className="f-mono" style={{ color: 'var(--text-dim)' }}>
                {formatNumberUa(totals.usedUah)} / {formatNumberUa(totals.limitUah)} ₴
              </span>
            </div>
            <ProgressBar used={totals.usedUah} limit={totals.limitUah} />
          </div>
        </div>

        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow>Динаміка ризик-скору</Eyebrow>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={RISK_TREND} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="m" tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
                <Tooltip content={<ChartTooltip unit="%" />} />
                <Area type="monotone" dataKey="score" name="Ризик" stroke="var(--finance)" fill="var(--finance-dim)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>
            Поточний скор: {risk.scorePercent}% · {risk.label}
          </div>
          <DeadlineList deadlines={deadlines} />
        </div>
      </div>
    </div>
  );
}

function DeadlineList({
  deadlines,
}: {
  deadlines: ReadonlyArray<{
    id: string;
    title: string;
    dueDateIso: string;
    daysLeft: number;
    tone: 'danger' | 'neutral';
  }>;
}) {
  return (
    <div style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <Eyebrow>Найближчі дедлайни</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        {deadlines.map((d) => (
          <div
            key={d.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <div style={{ fontSize: 12.5 }}>{d.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{d.dueDateIso}</div>
            </div>
            <span
              className="chip f-mono"
              style={{
                background: d.tone === 'danger' ? 'var(--danger-dim)' : 'var(--surface-2)',
                color: d.tone === 'danger' ? 'var(--danger)' : 'var(--text-dim)',
              }}
            >
              {d.daysLeft} дн.
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
