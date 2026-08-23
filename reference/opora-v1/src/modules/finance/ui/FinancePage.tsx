import { useState, type CSSProperties } from 'react';
import { AlertTriangle, Clock, FileText, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip, Eyebrow, KpiCard, ProgressBar } from '../../../design-system/components';
import { formatDecimalUa, formatDateUa, formatNumberUa } from '../../../lib/format';
import { getFinanceSnapshot, VAT_RULES } from '../index';
import { useScenario } from '../../../app/scenario';
import { RotateCcw } from 'lucide-react';
import { RISK_TREND } from '../data/fixtures';

const inputStyle: CSSProperties = {
  fontSize: 12.5,
};

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
              <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{formatDateUa(d.dueDateIso)}</div>
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

export function FinancePage() {
  const {
    scenario,
    updateContractor,
    addContractor,
    removeContractor,
    resetScenario,
  } = useScenario();
  const fin = scenario.finance;
  const [newName, setNewName] = useState('');
  const snapshot = getFinanceSnapshot(fin);
  const { contractors, totals, risk, deadlines } = snapshot;

  function submitNew() {
    if (!newName.trim()) return;
    addContractor(newName);
    setNewName('');
  }

  function clampUah(value: string): number {
    return Math.max(0, Number(value) || 0);
  }

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)',
          gap: 16,
        }}
        className="opora-grid-2"
      >
        <div className="panel" style={{ padding: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Eyebrow color="var(--finance)">Ліміти реєстрації ПН · інтерактивно</Eyebrow>
            <button
              onClick={resetScenario}
              title="Повернути демо-дані"
              aria-label="Скинути сценарій"
              className="btn btn-ghost"
            >
              <RotateCcw size={11} /> Скинути
            </button>
          </div>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Обсяг постачання на контрагента
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 14 }}>
            Поріг безумовної реєстрації — {formatNumberUa(VAT_RULES.perContractorLimitUah)} ₴ на
            контрагента. Змініть суми — ризик-скор перерахується миттєво.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {fin.contractors.map((c, i) => (
              <div key={c.id}>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    className="input-row"
                    value={c.name}
                    onChange={(e) => updateContractor(i, { name: e.target.value })}
                    aria-label={`Назва контрагента ${i + 1}`}
                    style={{ ...inputStyle, flex: '1 1 150px' }}
                  />
                  <input
                    type="number"
                    className="input-row"
                    value={c.usedUah}
                    min={0}
                    step={1000}
                    onChange={(e) => updateContractor(i, { usedUah: clampUah(e.target.value) })}
                    aria-label={`Обсяг постачання, ${c.name}`}
                    title="Обсяг постачання, ₴"
                    style={{ ...inputStyle, width: 110 }}
                  />
                  <input
                    type="number"
                    className="input-row"
                    value={c.limitUah}
                    min={0}
                    step={5000}
                    onChange={(e) => updateContractor(i, { limitUah: clampUah(e.target.value) })}
                    aria-label={`Ліміт, ${c.name}`}
                    title="Ліміт, ₴"
                    style={{ ...inputStyle, width: 104 }}
                  />
                  <button
                    onClick={() => removeContractor(i)}
                    aria-label={`Видалити ${c.name}`}
                    title="Видалити контрагента"
                    className="btn btn-icon"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ marginTop: 5 }}>
                  <ProgressBar used={c.usedUah} limit={Math.max(1, c.limitUah)} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              className="input-row"
              placeholder="Новий контрагент…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNew();
              }}
              aria-label="Назва нового контрагента"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={submitNew}
              disabled={!newName.trim()}
              aria-label="Додати контрагента"
              className="btn btn-finance"
              style={{ padding: '0 12px' }}
            >
              <Plus size={15} />
            </button>
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
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
                <YAxis tick={{ fill: 'var(--text-mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={26} domain={[0, 100]} />
                <Tooltip content={<ChartTooltip unit="%" />} />
                <Area type="monotone" dataKey="score" name="Ризик" stroke="var(--finance)" fill="var(--finance-dim)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>
            Поточний скор: {risk.scorePercent}% · {risk.label} · вікно коригування{' '}
            {formatDecimalUa(fin.adjustmentWindowDays, 0)} дн.
          </div>
          <DeadlineList deadlines={deadlines} />
        </div>
      </div>
    </div>
  );
}
