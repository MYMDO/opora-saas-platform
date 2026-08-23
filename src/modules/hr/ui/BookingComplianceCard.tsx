import { useState, type CSSProperties } from 'react';
import { AlertTriangle, CheckCircle2, UserCheck } from 'lucide-react';
import { Eyebrow, ProgressBar } from '../../../design-system/components';
import { formatNumberUa } from '../../../lib/format';
import { DEMO_EMPLOYEE_SALARY_UAH, DEMO_ENTERPRISE } from '../data/fixtures';
import {
  assessEmployeeBooking,
  quotaSlots,
  remainingBookingSlots,
  type BookingBlocker,
  type EnterpriseBookingContext,
} from '../domain/booking';
import type { TerritoryType } from '../domain/rules';

function blockerText(b: BookingBlocker): string {
  switch (b.kind) {
    case 'critical-status-missing':
      return 'Компанія не має статусу критично важливого підприємства.';
    case 'tax-debt':
      return 'Наявна заборгованість зі сплати податків та ЄСВ.';
    case 'salary-below-threshold':
      return `Зарплата ${formatNumberUa(b.actualUah)} ₴ нижча за поріг ${formatNumberUa(b.requiredUah)} ₴.`;
    case 'quota-exhausted':
      return `Ліміт бронювання вичерпано (${b.limitSlots} з ${b.limitSlots} місць).`;
  }
}

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 13,
};

export function BookingComplianceCard() {
  const [ctx, setCtx] = useState<EnterpriseBookingContext>(DEMO_ENTERPRISE);
  const [salaryUah, setSalaryUah] = useState(DEMO_EMPLOYEE_SALARY_UAH);

  const assessment = assessEmployeeBooking({ monthlySalaryUah: salaryUah }, ctx);
  const slots = quotaSlots(ctx);
  const remaining = remainingBookingSlots(ctx);

  function patch(partial: Partial<EnterpriseBookingContext>) {
    setCtx((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="panel" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <UserCheck size={14} color="var(--ai)" />
        <Eyebrow color="var(--ai)">Соломія · Бронювання від мобілізації</Eyebrow>
      </div>
      <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
        Калькулятор відповідності (КМУ №692)
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 14 }}>
        Поріг зарплати — {formatNumberUa(assessment.requiredSalaryThresholdUah)} ₴ · розгляд заявки до{' '}
        10 днів
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }} className="opora-grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 5 }}>
            Місячна зарплата працівника, ₴
            <input
              type="number"
              className="input-row"
              value={salaryUah}
              min={0}
              onChange={(e) => setSalaryUah(Math.max(0, Number(e.target.value) || 0))}
              style={inputStyle}
            />
          </label>

          <label style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 5 }}>
            Територія
            <select
              value={ctx.territoryType}
              onChange={(e) => patch({ territoryType: e.target.value as TerritoryType })}
              className="input-row"
              style={inputStyle}
            >
              <option value="regular">Звичайна територія</option>
              <option value="frontline">Прифронтова територія</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Checkbox
              label="Критично важливе підприємство"
              checked={ctx.hasCriticalEnterpriseStatus}
              onChange={(v) => patch({ hasCriticalEnterpriseStatus: v })}
            />
            <Checkbox
              label="Заборгованість з податків/ЄСВ"
              checked={ctx.hasTaxDebt}
              onChange={(v) => patch({ hasTaxDebt: v })}
            />
            <Checkbox
              label="Критична галузь (ліміт 100%)"
              checked={ctx.isCriticalIndustry}
              onChange={(v) => patch({ isCriticalIndustry: v })}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ fontSize: 12.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              Військовозобов'язаних
              <input
                type="number"
                className="input-row"
                value={ctx.militaryObligatedCount}
                min={0}
                onChange={(e) => patch({ militaryObligatedCount: Math.max(0, Number(e.target.value) || 0) })}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              Вже заброньовано
              <input
                type="number"
                className="input-row"
                value={ctx.alreadyBookedCount}
                min={0}
                onChange={(e) => patch({ alreadyBookedCount: Math.max(0, Number(e.target.value) || 0) })}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            className="chip f-mono"
            style={{
              alignSelf: 'flex-start',
              fontSize: 13,
              padding: '6px 12px',
              background: assessment.eligible ? 'var(--finance-dim)' : 'var(--danger-dim)',
              color: assessment.eligible ? 'var(--finance)' : 'var(--danger)',
            }}
          >
            {assessment.eligible ? 'Можна бронювати' : 'Є перешкоди'}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span>Ліміт бронювання</span>
              <span className="f-mono" style={{ color: 'var(--text-dim)' }}>
                {formatNumberUa(ctx.alreadyBookedCount)} / {formatNumberUa(slots)} місць
              </span>
            </div>
            <ProgressBar used={ctx.alreadyBookedCount} limit={Math.max(slots, 1)} />
            <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
              Вільних місць: {remaining}
            </div>
          </div>

          {assessment.blockers.length === 0 ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-dim)' }}>
              <CheckCircle2 size={15} color="var(--finance)" style={{ marginTop: 1, flexShrink: 0 }} />
              Усі умови КМУ №692 виконано — заявку можна подавати.
            </div>
          ) : (
            assessment.blockers.map((b) => (
              <div key={b.kind} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-dim)' }}>
                <AlertTriangle size={15} color="var(--danger)" style={{ marginTop: 1, flexShrink: 0 }} />
                {blockerText(b)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--ai)' }}
      />
      {label}
    </label>
  );
}
