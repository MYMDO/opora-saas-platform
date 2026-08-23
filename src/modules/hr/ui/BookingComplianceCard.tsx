import { useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { Eyebrow, ProgressBar } from '../../../design-system/components';
import { formatNumberUa } from '../../../lib/format';
import {
  assessBookingRoster,
  quotaSlots,
  remainingBookingSlots,
  salaryThreshold,
  type BookingBlocker,
  type EnterpriseBookingContext,
} from '../index';
import { useScenario } from '../../../app/scenario';

const inputStyle: CSSProperties = {
  fontSize: 12.5,
};

function blockerText(b: BookingBlocker): string {
  switch (b.kind) {
    case 'not-military-obliged':
      return 'Не є військовозобов’язаним — бронювання не застосовується';
    case 'critical-status-missing':
      return 'Немає статусу критично важливого підприємства';
    case 'tax-debt':
      return 'Заборгованість з податків та ЄСВ';
    case 'salary-below-threshold':
      return `Зарплата нижча за поріг ${formatNumberUa(b.requiredUah)} ₴`;
    case 'quota-exhausted':
      return 'Ліміт бронювання вичерпано';
  }
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

export function BookingComplianceCard() {
  const { scenario, updateEnterprise, addEmployee, updateEmployee, removeEmployee, resetScenario } =
    useScenario();
  const { enterprise, employees } = scenario.hr;
  const [newName, setNewName] = useState('');
  const [newSalaryUah, setNewSalaryUah] = useState(26_000);

  const roster = assessBookingRoster(employees, enterprise);
  const slots = quotaSlots(enterprise);
  const remaining = remainingBookingSlots(enterprise);
  const threshold = salaryThreshold(enterprise);

  function submitEmployee() {
    if (!newName.trim()) return;
    addEmployee(newName, newSalaryUah);
    setNewName('');
  }

  return (
    <div className="panel" style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={14} color="var(--ai)" />
          <Eyebrow color="var(--ai)">Соломія · Бронювання від мобілізації</Eyebrow>
        </div>
        <button
          onClick={resetScenario}
          title="Повернути демо-дані"
          aria-label="Скинути сценарій"
          className="btn btn-ghost"
        >
          <RotateCcw size={11} /> Скинути
        </button>
      </div>
      <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
        Реєстр працівників і відповідність (КМУ №692)
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 14 }}>
        Поріг зарплати — {formatNumberUa(threshold)} ₴ · розгляд до 10 днів · стосується
        військовозобов'язаних (чоловіки 18–60; жінки за переліком МОУ №313 — медицина/фармація)
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 16 }}
        className="opora-grid-2"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 5 }}>
            Територія
            <select
              value={enterprise.territoryType}
              onChange={(e) =>
                updateEnterprise({
                  territoryType: e.target.value as EnterpriseBookingContext['territoryType'],
                })
              }
              className="input-row"
              style={inputStyle}
            >
              <option value="regular">Звичайна територія</option>
              <option value="frontline">Прифронтова територія</option>
            </select>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Checkbox
              label="Критично важливе підприємство"
              checked={enterprise.hasCriticalEnterpriseStatus}
              onChange={(v) => updateEnterprise({ hasCriticalEnterpriseStatus: v })}
            />
            <Checkbox
              label="Заборгованість з податків/ЄСВ"
              checked={enterprise.hasTaxDebt}
              onChange={(v) => updateEnterprise({ hasTaxDebt: v })}
            />
            <Checkbox
              label="Критична галузь (ліміт 100%)"
              checked={enterprise.isCriticalIndustry}
              onChange={(v) => updateEnterprise({ isCriticalIndustry: v })}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ fontSize: 12.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              Військовозобов'язаних
              <input
                type="number"
                className="input-row"
                value={enterprise.militaryObligatedCount}
                min={0}
                onChange={(e) =>
                  updateEnterprise({ militaryObligatedCount: Math.max(0, Number(e.target.value) || 0) })
                }
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              Вже заброньовано
              <input
                type="number"
                className="input-row"
                value={enterprise.alreadyBookedCount}
                min={0}
                onChange={(e) =>
                  updateEnterprise({ alreadyBookedCount: Math.max(0, Number(e.target.value) || 0) })
                }
                style={inputStyle}
              />
            </label>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12.5,
                marginBottom: 5,
              }}
            >
              <span>Ліміт бронювання</span>
              <span className="f-mono" style={{ color: 'var(--text-dim)' }}>
                {formatNumberUa(enterprise.alreadyBookedCount)} / {formatNumberUa(slots)} місць
              </span>
            </div>
            <ProgressBar used={enterprise.alreadyBookedCount} limit={Math.max(slots, 1)} />
            <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
              Вільних місць: {remaining}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <span
            className="chip f-mono"
            style={{
              alignSelf: 'flex-start',
              fontSize: 13,
              padding: '6px 12px',
              background: roster.eligibleCount > 0 ? 'var(--finance-dim)' : 'var(--danger-dim)',
              color: roster.eligibleCount > 0 ? 'var(--finance)' : 'var(--danger)',
            }}
          >
            Можна бронювати: {roster.eligibleCount} з {employees.length}
          </span>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 260,
              overflowY: 'auto',
              paddingRight: 2,
            }}
          >
            {roster.rows.map((row) => (
              <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input-row"
                  value={
                    employees.find((e) => e.id === row.id)?.name ?? row.name
                  }
                  onChange={(e) => updateEmployee(row.id, { name: e.target.value })}
                  aria-label={`Імʼя працівника ${row.name}`}
                  style={{ ...inputStyle, flex: '1 1 130px', minWidth: 0 }}
                />
                <input
                  type="number"
                  className="input-row"
                  value={row.monthlySalaryUah}
                  min={0}
                  step={500}
                  onChange={(e) =>
                    updateEmployee(row.id, {
                      monthlySalaryUah: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  aria-label={`Зарплата, ${row.name}`}
                  title="Місячна зарплата, ₴"
                  style={{ ...inputStyle, width: 104, flexShrink: 0 }}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Військовозобов'язаний/-а (чоловіки 18–60; жінки за переліком МОУ №313)"
                >
                  <input
                    type="checkbox"
                    checked={row.isMilitaryObliged}
                    onChange={(e) => updateEmployee(row.id, { isMilitaryObliged: e.target.checked })}
                    style={{ accentColor: 'var(--ai)' }}
                  />
                  В/з
                </label>
                <span
                  className="chip f-mono"
                  title={row.eligible ? undefined : blockerText(row.blockers[0])}
                  style={{
                    flexShrink: 0,
                    background:
                      row.blockers[0]?.kind === 'not-military-obliged'
                        ? 'var(--surface-2)'
                        : row.eligible
                          ? 'var(--finance-dim)'
                          : 'var(--danger-dim)',
                    color:
                      row.blockers[0]?.kind === 'not-military-obliged'
                        ? 'var(--text-mute)'
                        : row.eligible
                          ? 'var(--finance)'
                          : 'var(--danger)',
                    cursor: row.eligible ? 'default' : 'help',
                  }}
                >
                  {row.eligible
                    ? <CheckCircle2 size={12} />
                    : row.blockers[0]?.kind === 'not-military-obliged'
                      ? '—'
                      : <AlertTriangle size={12} />}
                </span>
                <button
                  onClick={() => removeEmployee(row.id)}
                  aria-label={`Видалити ${row.name}`}
                  title="Видалити працівника"
                  className="btn btn-icon"
                  style={{ flexShrink: 0 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input-row"
              placeholder="Новий працівник…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitEmployee();
              }}
              aria-label="Імʼя нового працівника"
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            <input
              type="number"
              className="input-row"
              value={newSalaryUah}
              min={0}
              step={500}
              onChange={(e) => setNewSalaryUah(Math.max(0, Number(e.target.value) || 0))}
              aria-label="Зарплата нового працівника"
              title="Місячна зарплата, ₴"
              style={{ ...inputStyle, width: 104, flexShrink: 0 }}
            />
            <button
              onClick={submitEmployee}
              disabled={!newName.trim()}
              aria-label="Додати працівника"
              className={`btn ${newName.trim() ? 'btn-solid' : 'btn-surface'}`}
              style={{ padding: '0 12px', flexShrink: 0 }}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
