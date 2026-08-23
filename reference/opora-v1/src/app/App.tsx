import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Building2,
  ChevronDown,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Dot, ErrorBoundary } from '../design-system/components';
import { formatNumberUa, formatTimeUa } from '../lib/format';
import { TODAY_AI_RESOLVED } from '../modules/ai-agents/index';
import { getEnergySnapshot } from '../modules/energy/index';
import { getFinanceSnapshot } from '../modules/finance/index';
import { useScenario } from './scenario';
import { parseTabFromHash, tabToHash, type TabId } from './routing';

const OverviewPage = lazy(() =>
  import('../modules/overview/ui/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const AiAgentsPage = lazy(() =>
  import('../modules/ai-agents/ui/AiAgentsPage').then((m) => ({ default: m.AiAgentsPage })),
);
const EnergyPage = lazy(() =>
  import('../modules/energy/ui/EnergyPage').then((m) => ({ default: m.EnergyPage })),
);
const FinancePage = lazy(() =>
  import('../modules/finance/ui/FinancePage').then((m) => ({ default: m.FinancePage })),
);

type NavItem = {
  id: TabId;
  label: string;
  Icon: LucideIcon;
};

const NAV: ReadonlyArray<NavItem> = [
  { id: 'overview', label: 'Огляд', Icon: LayoutDashboard },
  { id: 'ai', label: 'ШІ-агенти', Icon: Bot },
  { id: 'energy', label: 'Енергія', Icon: Zap },
  { id: 'finance', label: 'Фінанси', Icon: ShieldCheck },
];

const MODULE_META: Partial<Record<TabId, { color: string }>> = {
  ai: { color: 'var(--ai)' },
  energy: { color: 'var(--energy)' },
  finance: { color: 'var(--finance)' },
};

const TAB_SUBTITLE: Record<TabId, string> = {
  overview: 'Єдина картина операційної стійкості бізнесу — люди, енергія, комплаєнс.',
  ai: 'Команда ШІ-агентів, що бере на себе рутину замість дефіцитного персоналу.',
  energy: 'Керування генерацією, накопиченням та тарифним арбітражем у реальному часі.',
  finance: 'Моніторинг лімітів ПДВ, ризик-скору та комплаєнс-дедлайнів без ручного обліку.',
};

function StatusMetric({ Icon, color, text }: { Icon: LucideIcon; color: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Dot color={color} />
      <Icon size={13} color={color} />
      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{text}</span>
    </div>
  );
}

export default function App() {
  const [tab, setTabState] = useState<TabId>(() => parseTabFromHash(window.location.hash));
  const [now, setNow] = useState(() => new Date());

  const setTab = (next: TabId) => {
    setTabState(next);
    history.replaceState(null, '', tabToHash(next));
  };

  useEffect(() => {
    const onHashChange = () => setTabState(parseTabFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.title = `${NAV.find((n) => n.id === tab)?.label ?? 'Огляд'} · ОПОРА`;
  }, [tab]);

  const { scenario, apiOnline, syncError } = useScenario();
  const finance = useMemo(() => getFinanceSnapshot(scenario.finance), [scenario.finance]);
  const energy = useMemo(() => getEnergySnapshot(), []);

  return (
    <div className="opora-root" style={{ display: 'flex', minHeight: 640 }}>
      {/* Sidebar */}
      <div
        className="panel"
        style={{
          width: 216,
          borderRadius: 0,
          borderTop: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div className="hidden-mobile" style={{ padding: '18px 16px 14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'var(--energy-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={14} color="var(--energy)" />
          </div>
          <div>
            <div className="f-display" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.02em' }}>
              ОПОРА
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-mute)', letterSpacing: '.03em' }}>
              ПЛАТФОРМА СТІЙКОСТІ
            </div>
          </div>
        </div>

        <div className="hidden-mobile" style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
          {NAV.map((n) => (
            <div
              key={n.id}
              className={`nav-item ${tab === n.id ? 'active' : ''}`}
              style={
                tab === n.id ? { borderLeftColor: MODULE_META[n.id]?.color || 'var(--ai)' } : {}
              }
              onClick={() => setTab(n.id)}
            >
              <n.Icon size={15} />
              {n.label}
            </div>
          ))}
        </div>

        <div className="hidden-mobile" style={{ marginTop: 'auto', padding: 14 }}>
          <div className="panel-2" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Building2 size={13} color="var(--text-dim)" />
              <span style={{ fontSize: 11.5, fontWeight: 500 }}>ТОВ «Мануфактура»</span>
              <ChevronDown size={12} color="var(--text-mute)" style={{ marginLeft: 'auto' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-mute)' }}>Тариф: Growth · 3 модулі активні</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            padding: '11px 22px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <StatusMetric Icon={Bot} color="var(--ai)" text={`${TODAY_AI_RESOLVED} звернень оброблено сьогодні`} />
          <StatusMetric
            Icon={Zap}
            color="var(--energy)"
            text={`Заряд ${energy.socPercent}% · економія ${formatNumberUa(energy.savedTodayUah)} ₴`}
          />
          <StatusMetric
            Icon={ShieldCheck}
            color="var(--finance)"
            text={`Ризик ${finance.risk.scorePercent}% · ${finance.risk.label}`}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              title={
                apiOnline === false && syncError ? `Причина: ${syncError}` : undefined
              }
              style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: apiOnline === false ? 'help' : 'default' }}
            >
              <Dot
                color={
                  apiOnline == null
                    ? 'var(--text-mute)'
                    : apiOnline
                      ? 'var(--finance)'
                      : 'var(--danger)'
                }
              />
              <span className="f-mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {apiOnline == null
                  ? 'Хмара: перевірка…'
                  : apiOnline
                    ? 'Хмара: онлайн'
                    : 'Хмара: офлайн · локальний режим'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={14} color="var(--text-mute)" />
              <span className="f-mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Київ, {formatTimeUa(now)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: '18px 22px 4px 22px' }}>
          <div className="f-display" style={{ fontSize: 20, fontWeight: 700 }}>
            {NAV.find((n) => n.id === tab)?.label}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginTop: 2, marginBottom: 16 }}>
            {TAB_SUBTITLE[tab]}
          </div>
        </div>

        <div style={{ padding: '0 22px 24px 22px', overflowY: 'auto' }}>
          <ErrorBoundary key={tab} label={NAV.find((n) => n.id === tab)?.label}>
            <Suspense
              fallback={
                <div className="f-mono" style={{ fontSize: 12, color: 'var(--text-mute)', padding: 24 }}>
                  Завантаження…
                </div>
              }
            >
              {tab === 'overview' && <OverviewPage />}
              {tab === 'ai' && <AiAgentsPage />}
              {tab === 'energy' && <EnergyPage />}
              {tab === 'finance' && <FinancePage />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div
        className="mobile-nav"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          justifyContent: 'space-around',
          padding: '8px 4px',
          zIndex: 20,
        }}
      >
        {NAV.map((n) => (
          <div
            key={n.id}
            onClick={() => setTab(n.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              color:
                tab === n.id
                  ? MODULE_META[n.id]?.color || 'var(--ai)'
                  : 'var(--text-mute)',
            }}
          >
            <n.Icon size={17} />
            <span style={{ fontSize: 9 }}>{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
