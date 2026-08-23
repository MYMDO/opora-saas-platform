import React, { useState, useEffect, useRef } from 'react';
import {
  ComposedChart, Area, Line, Bar, BarChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  LayoutDashboard, Bot, Zap, ShieldCheck, BatteryCharging,
  TrendingDown, AlertTriangle, CheckCircle2, Send, Sun, Clock,
  Building2, Bell, Sparkles, ChevronDown, FileText, Wallet,
} from 'lucide-react';

/* ---------------------------------------------------------------
   ОПОРА — єдина модульна B2B SaaS-платформа операційної стійкості
   Модулі: ШІ-агенти · Енергоменеджмент (EMS) · Фінанси та податки
   ------------------------------------------------------------- */

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&display=swap');

  .opora-root {
    --bg: #14171A;
    --surface: #1B1F23;
    --surface-2: #22272C;
    --surface-hover: #282E34;
    --border: #2B3137;
    --border-light: #363D44;
    --text: #EDEEF0;
    --text-dim: #9AA1A9;
    --text-mute: #676D74;
    --energy: #F2A93B;
    --energy-dim: rgba(242,169,59,0.14);
    --ai: #3FC7B8;
    --ai-dim: rgba(63,199,184,0.14);
    --finance: #8CC97A;
    --finance-dim: rgba(140,201,122,0.14);
    --danger: #E5573F;
    --danger-dim: rgba(229,87,63,0.14);
    background: var(--bg);
    color: var(--text);
    font-family: 'IBM Plex Sans', sans-serif;
    min-height: 100%;
    width: 100%;
  }
  .opora-root * { box-sizing: border-box; }
  .f-display { font-family: 'IBM Plex Sans Condensed', sans-serif; }
  .f-mono { font-family: 'IBM Plex Mono', monospace; }

  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .panel-2 { background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; }

  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 5px; cursor: pointer;
    color: var(--text-dim); border-left: 2px solid transparent;
    transition: background .15s ease, color .15s ease;
    font-size: 13px; font-weight: 500;
  }
  .nav-item:hover { background: var(--surface-hover); color: var(--text); }
  .nav-item.active { background: var(--surface-2); color: var(--text); border-left: 2px solid var(--accent, #3FC7B8); }

  .tab-pill { transition: background .15s ease, color .15s ease, border-color .15s ease; }

  @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  .pulse { animation: pulse-dot 1.8s ease-in-out infinite; }

  @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fade-in .25s ease; }

  .opora-root ::-webkit-scrollbar { width: 7px; height: 7px; }
  .opora-root ::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 4px; }
  .opora-root ::-webkit-scrollbar-track { background: transparent; }

  .agent-card { border: 1px solid var(--border); background: var(--surface); border-radius: 6px; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
  .agent-card:hover { border-color: var(--border-light); background: var(--surface-2); }
  .agent-card.selected { border-color: var(--ai); background: var(--ai-dim); }

  .bar-track { background: var(--surface-2); border-radius: 3px; overflow: hidden; height: 6px; }
  .chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500; letter-spacing: .02em; }

  .input-row input { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); }
  .input-row input::placeholder { color: var(--text-mute); }
  .input-row input:focus { outline: none; border-color: var(--ai); }
`;

/* ---------------------------- Дані ---------------------------- */

const AGENTS = [
  {
    id: 'solomiya',
    name: 'Соломія',
    role: 'HR-онбординг',
    color: 'var(--ai)',
    resolvedToday: 34,
    resolvedTotal: 1284,
    avgTime: '2х 40с',
    csat: 4.8,
    desc: 'Веде первинний онбординг нових співробітників — документи, бронювання, адаптаційний чек-лист.',
  },
  {
    id: 'taras',
    name: 'Тарас',
    role: 'Кваліфікація лідів',
    color: 'var(--ai)',
    resolvedToday: 58,
    resolvedTotal: 2931,
    avgTime: '1х 15с',
    csat: 4.6,
    desc: 'Обробляє вхідні заявки, кваліфікує ліди за бюджетом і термінами, передає гарячі угоди менеджеру.',
  },
  {
    id: 'hanna',
    name: 'Ганна',
    role: 'Підтримка клієнтів',
    color: 'var(--ai)',
    resolvedToday: 155,
    resolvedTotal: 18420,
    avgTime: '0х 52с',
    csat: 4.9,
    desc: 'Закриває типові звернення підтримки без ескалації на людину, працює 24/7.',
  },
];

const CANNED = {
  solomiya: [
    'Вітаю! Я Соломія, допоможу з онбордингом. На яку дату виходить новий співробітник?',
    'Прийнято. Документи для оформлення вже підготовлені у розділі «Кадри» — залишилось підписання.',
    'Бронювання від мобілізації підтверджено, зарплата відповідає порогу 25 941 ₴. Заявку передано юристу платформи.',
    'Чек-лист адаптації надіслано співробітнику. Перше нагадування — за 2 дні до старту.',
  ],
  taras: [
    'Вітаю! Я Тарас, опрацьовую вхідні заявки. Уточніть, будь ласка, приблизний бюджет проєкту.',
    'Дякую. Лід кваліфіковано як «гарячий» — передаю менеджеру з продажів, він звʼяжеться протягом години.',
    'Комерційну пропозицію сформовано та надіслано на пошту. Нагадаю про неї через 3 дні, якщо не буде відповіді.',
    'Заявку додано до CRM. Ймовірність закриття за нашою моделлю — 62%.',
  ],
  hanna: [
    'Вітаю! Я Ганна, служба підтримки. Опишіть, будь ласка, суть звернення.',
    'Знайшла ваше замовлення в системі. Статус — «в обробці», очікуваний термін — 2 робочих дні.',
    'Питання вирішено без ескалації. Якщо повторится — одразу підключу спеціаліста-людину.',
    'Дякую за звернення! Оцініть, будь ласка, якість відповіді від 1 до 5.',
  ],
};

const AI_WEEK = [
  { day: 'Пн', resolved: 198, escalated: 14 },
  { day: 'Вт', resolved: 224, escalated: 11 },
  { day: 'Ср', resolved: 211, escalated: 18 },
  { day: 'Чт', resolved: 247, escalated: 9 },
  { day: 'Пт', resolved: 260, escalated: 12 },
  { day: 'Сб', resolved: 132, escalated: 5 },
  { day: 'Нд', resolved: 98, escalated: 3 },
];

const ENERGY_24H = [
  { h: '00', gen: 0, cons: 14, batt: 61 },
  { h: '02', gen: 0, cons: 11, batt: 54 },
  { h: '04', gen: 0, cons: 10, batt: 47 },
  { h: '06', gen: 2, cons: 18, batt: 41 },
  { h: '08', gen: 21, cons: 34, batt: 38 },
  { h: '10', gen: 48, cons: 39, batt: 52 },
  { h: '12', gen: 63, cons: 41, batt: 71 },
  { h: '14', gen: 58, cons: 40, batt: 86 },
  { h: '16', gen: 39, cons: 42, batt: 92 },
  { h: '18', gen: 12, cons: 55, batt: 80 },
  { h: '20', gen: 0, cons: 51, batt: 64 },
  { h: '22', gen: 0, cons: 27, batt: 62 },
];

const WEEK_SAVINGS = [
  { day: 'Пн', without: 41200, with: 29600 },
  { day: 'Вт', without: 39800, with: 27100 },
  { day: 'Ср', without: 43500, with: 30800 },
  { day: 'Чт', without: 45100, with: 30380 },
  { day: 'Пт', without: 47600, with: 33200 },
  { day: 'Сб', without: 28300, with: 21900 },
  { day: 'Нд', without: 22100, with: 17400 },
];

const CONTRACTORS = [
  { name: 'ТОВ «Технобуд»', used: 97500, limit: 100000 },
  { name: 'ТОВ «Логістик Плюс»', used: 82000, limit: 100000 },
  { name: 'ФОП Коваленко І. В.', used: 45300, limit: 100000 },
  { name: 'ТОВ «Агро-Сервіс»', used: 21000, limit: 100000 },
];

const RISK_TREND = [
  { m: 'Лют', score: 22 },
  { m: 'Бер', score: 19 },
  { m: 'Кві', score: 24 },
  { m: 'Тра', score: 16 },
  { m: 'Чер', score: 14 },
  { m: 'Лип', score: 12 },
];

const DEADLINES = [
  { title: 'Декларація з ПДВ за червень', date: '20.07.2026', days: 3 },
  { title: 'Звіт ЄСВ по заброньованих працівниках', date: '28.07.2026', days: 11 },
  { title: 'Підтвердження статусу критичного підприємства', date: '04.08.2026', days: 18 },
];

const ALERTS = [
  { level: 'danger', text: 'ТОВ «Технобуд» — 97 500 ₴ з ліміту 100 000 ₴ на контрагента. Ризик блокування ПН.' },
  { level: 'warning', text: 'Батарея BESS зарядилась до 92% о 16:00 — доступний резерв для вечірнього піку.' },
  { level: 'ok', text: 'Агент «Ганна» закрила 155 звернень сьогодні без жодної ескалації.' },
];

const MODULE_META = {
  ai: { label: 'ШІ-агенти', color: 'var(--ai)', dim: 'var(--ai-dim)', Icon: Bot },
  energy: { label: 'Енергія', color: 'var(--energy)', dim: 'var(--energy-dim)', Icon: Zap },
  finance: { label: 'Фінанси', color: 'var(--finance)', dim: 'var(--finance-dim)', Icon: ShieldCheck },
};

/* ------------------------- Дрібні компоненти ------------------------- */

function Dot({ color = 'var(--finance)' }) {
  return (
    <span
      className="pulse"
      style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block', boxShadow: `0 0 6px ${color}` }}
    />
  );
}

function Eyebrow({ children, color }) {
  return (
    <div
      className="f-mono"
      style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: color || 'var(--text-mute)', marginBottom: 6, fontWeight: 600 }}
    >
      {children}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, dim }) {
  return (
    <div className="panel fade-in" style={{ padding: 16, flex: 1, minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Eyebrow color="var(--text-mute)">{label}</Eyebrow>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div className="f-mono" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ used, limit, color = 'var(--finance)', height = 6 }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--energy)' : color;
  return (
    <div className="bar-track" style={{ height }}>
      <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width .4s ease' }} />
    </div>
  );
}

function AlertRow({ level, text }) {
  const meta = {
    danger: { color: 'var(--danger)', Icon: AlertTriangle },
    warning: { color: 'var(--energy)', Icon: AlertTriangle },
    ok: { color: 'var(--finance)', Icon: CheckCircle2 },
  }[level];
  const Icon = meta.Icon;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <Icon size={15} color={meta.color} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="panel-2 f-mono" style={{ padding: '8px 10px', fontSize: 11, border: '1px solid var(--border-light)' }}>
      <div style={{ color: 'var(--text-mute)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <span>{p.value}{unit || ''}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Сторінки ------------------------------ */

function OverviewPage() {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard icon={Bot} label="Звернень оброблено ШІ сьогодні" value="247" sub="93% без ескалації на людину" color="var(--ai)" dim="var(--ai-dim)" />
        <KpiCard icon={BatteryCharging} label="Заряд BESS зараз" value="82%" sub="Економія сьогодні — 14 720 ₴" color="var(--energy)" dim="var(--energy-dim)" />
        <KpiCard icon={ShieldCheck} label="Податковий ризик" value="12%" sub="Низький · 1 контрагент потребує уваги" color="var(--finance)" dim="var(--finance-dim)" />
        <KpiCard icon={Wallet} label="Витрати платформи цього місяця" value="47 380 ₴" sub="База + оплата за результат + за використання" color="#C9CDD2" dim="rgba(201,205,210,0.12)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16 }} className="opora-grid-2">
        <div className="panel" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <Eyebrow color="var(--energy)">Енергія · останні 24 години</Eyebrow>
              <div className="f-display" style={{ fontSize: 15, fontWeight: 600 }}>Генерація, споживання, заряд батареї</div>
            </div>
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
            {ALERTS.map((a, i) => <AlertRow key={i} {...a} />)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }} className="opora-grid-2">
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--ai)">ШІ-агенти · тиждень</Eyebrow>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Оброблені звернення</div>
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
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Розбивка витрат цього місяця</div>
          <BillingRow label="Базова підписка платформи" value="9 900 ₴" note="Фіксована плата за інфраструктуру та ISO 27001" color="#C9CDD2" />
          <BillingRow label="ШІ-модуль — оплата за результат" value="23 780 ₴" note="≈ 38 ₴ за вирішене звернення · 626 звернень" color="var(--ai)" />
          <BillingRow label="Енергомодуль — оплата за використання" value="13 700 ₴" note="15% від суми заощадженого на арбітражі" color="var(--energy)" />
        </div>
      </div>
    </div>
  );
}

function BillingRow({ label, value, note, color }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block' }} />
          <span style={{ fontSize: 13 }}>{label}</span>
        </div>
        <span className="f-mono" style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 3, marginLeft: 14 }}>{note}</div>
    </div>
  );
}

function AIPage() {
  const [selected, setSelected] = useState('hanna');
  const [messages, setMessages] = useState([
    { from: 'bot', text: CANNED.hanna[0] },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const turnRef = useRef(1);
  const scrollRef = useRef(null);

  useEffect(() => {
    const first = CANNED[selected][0];
    setMessages([{ from: 'bot', text: first }]);
    turnRef.current = 1;
  }, [selected]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  function send() {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: 'user', text }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const bank = CANNED[selected];
      const reply = bank[turnRef.current % bank.length];
      turnRef.current += 1;
      setMessages((m) => [...m, { from: 'bot', text: reply }]);
      setTyping(false);
    }, 850);
  }

  const agent = AGENTS.find((a) => a.id === selected);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {AGENTS.map((a) => (
          <div
            key={a.id}
            className={`agent-card ${selected === a.id ? 'selected' : ''}`}
            style={{ padding: 14, flex: 1, minWidth: 220 }}
            onClick={() => setSelected(a.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="f-display" style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
              <Dot color="var(--ai)" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{a.role}</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div>
                <div className="f-mono" style={{ fontSize: 17, fontWeight: 600 }}>{a.resolvedToday}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>сьогодні</div>
              </div>
              <div>
                <div className="f-mono" style={{ fontSize: 17, fontWeight: 600 }}>{a.avgTime}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>сер. час</div>
              </div>
              <div>
                <div className="f-mono" style={{ fontSize: 17, fontWeight: 600 }}>{a.csat}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>CSAT</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 16 }} className="opora-grid-2">
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--ai)">{agent.name} · опис ролі</Eyebrow>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>{agent.desc}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-mute)' }}>Всього вирішено</span>
              <span className="f-mono">{agent.resolvedTotal.toLocaleString('uk-UA')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-mute)' }}>Ескалація на людину</span>
              <span className="f-mono">7%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-mute)' }}>Доступність</span>
              <span className="f-mono">24/7</span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', height: 360 }}>
          <Eyebrow>Тестова розмова з агентом «{agent.name}»</Eyebrow>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 2px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  className="fade-in"
                  style={{
                    maxWidth: '80%', fontSize: 13, lineHeight: 1.45, padding: '8px 12px', borderRadius: 10,
                    background: m.from === 'user' ? 'var(--ai-dim)' : 'var(--surface-2)',
                    color: m.from === 'user' ? 'var(--text)' : 'var(--text-dim)',
                    border: m.from === 'user' ? '1px solid var(--ai)' : '1px solid var(--border)',
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div className="f-mono" style={{ fontSize: 12, color: 'var(--text-mute)', padding: '6px 12px' }}>{agent.name} набирає…</div>
              </div>
            )}
          </div>
          <div className="input-row" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Напишіть повідомлення агенту…"
              style={{ flex: 1, padding: '9px 12px', borderRadius: 6, fontSize: 13 }}
            />
            <button
              onClick={send}
              style={{ background: 'var(--ai)', border: 'none', borderRadius: 6, padding: '0 14px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <Send size={15} color="#0E1213" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnergyPage() {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard icon={BatteryCharging} label="Заряд BESS" value="82%" sub="800 кВт / 1600 кВт·год" color="var(--energy)" dim="var(--energy-dim)" />
        <KpiCard icon={Sun} label="Генерація сьогодні" value="312 кВт·год" sub="СЕС 30 кВт, пікове сонце 12:00–15:00" color="var(--energy)" dim="var(--energy-dim)" />
        <KpiCard icon={TrendingDown} label="Економія сьогодні" value="14 720 ₴" sub="Peak shaving + арбітраж тарифів" color="var(--finance)" dim="var(--finance-dim)" />
        <KpiCard icon={Clock} label="Окупність інвестиції" value="3,4 роки" sub="При тарифі 17 ₴/кВт·год у пік" color="#C9CDD2" dim="rgba(201,205,210,0.12)" />
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <Eyebrow color="var(--energy)">Профіль доби</Eyebrow>
        <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Генерація, споживання та заряд батареї</div>
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
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Вартість електроенергії: без EMS проти з EMS</div>
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
            <ArbitrageRow label="Нічний тариф (заряджання)" value="2,5 ₴/кВт·год" color="var(--ai)" />
            <ArbitrageRow label="Ринковий тариф вдень" value="4,1 ₴/кВт·год" color="#C9CDD2" />
            <ArbitrageRow label="Піковий тариф (розряджання)" value="до 9,0 ₴/кВт·год" color="var(--energy)" />
            <div style={{ fontSize: 12, color: 'var(--text-mute)', lineHeight: 1.5, marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              MPC-алгоритм враховує прогноз погоди й графік споживання, лінеаризує криву деградації акумулятора (DOD) та обирає момент заряду/розряду так, щоб продовжити ресурс батареї й мінімізувати рахунок.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArbitrageRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block' }} />
        <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{label}</span>
      </div>
      <span className="f-mono" style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function FinancePage() {
  const totalUsed = 612000;
  const totalLimit = 1000000;
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard icon={ShieldCheck} label="Податковий ризик" value="12%" sub="Низький рівень" color="var(--finance)" dim="var(--finance-dim)" />
        <KpiCard icon={FileText} label="Загальний обсяг постачання" value="612 000 ₴" sub="з 1 000 000 ₴ безумовного ліміту" color="#C9CDD2" dim="rgba(201,205,210,0.12)" />
        <KpiCard icon={AlertTriangle} label="Контрагентів під ризиком" value="1" sub="ТОВ «Технобуд» — 97,5% ліміту" color="var(--danger)" dim="var(--danger-dim)" />
        <KpiCard icon={Clock} label="Людино-днів зекономлено" value="~340 / рік" sub="Автоматичний моніторинг лімітів" color="var(--ai)" dim="var(--ai-dim)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16 }} className="opora-grid-2">
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--finance)">Ліміти реєстрації ПН</Eyebrow>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Обсяг постачання на контрагента</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 14 }}>Поріг безумовної реєстрації — 100 000 ₴ на контрагента</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {CONTRACTORS.map((c) => (
              <div key={c.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span>{c.name}</span>
                  <span className="f-mono" style={{ color: 'var(--text-dim)' }}>{c.used.toLocaleString('uk-UA')} / {c.limit.toLocaleString('uk-UA')} ₴</span>
                </div>
                <ProgressBar used={c.used} limit={c.limit} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span>Загальний обсяг постачання (усі контрагенти)</span>
              <span className="f-mono" style={{ color: 'var(--text-dim)' }}>{totalUsed.toLocaleString('uk-UA')} / {totalLimit.toLocaleString('uk-UA')} ₴</span>
            </div>
            <ProgressBar used={totalUsed} limit={totalLimit} />
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
          <div style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <Eyebrow>Найближчі дедлайни</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
              {DEADLINES.map((d) => (
                <div key={d.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12.5 }}>{d.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{d.date}</div>
                  </div>
                  <span
                    className="chip f-mono"
                    style={{
                      background: d.days <= 5 ? 'var(--danger-dim)' : 'var(--surface-2)',
                      color: d.days <= 5 ? 'var(--danger)' : 'var(--text-dim)',
                    }}
                  >
                    {d.days} дн.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- App -------------------------------- */

const NAV = [
  { id: 'overview', label: 'Огляд', Icon: LayoutDashboard },
  { id: 'ai', label: 'ШІ-агенти', Icon: Bot },
  { id: 'energy', label: 'Енергія', Icon: Zap },
  { id: 'finance', label: 'Фінанси', Icon: ShieldCheck },
];

export default function OporaPlatform() {
  const [tab, setTab] = useState('overview');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const activeColor = MODULE_META[tab]?.color || 'var(--ai)';

  return (
    <div className="opora-root" style={{ display: 'flex', minHeight: 640 }}>
      <style>{CSS}</style>

      {/* Sidebar */}
      <div className="panel" style={{ width: 216, borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none', display: 'flex', flexDirection: 'column', flexShrink: 0 }} >
        <div className="hidden-mobile" style={{ padding: '18px 16px 14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--energy-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color="var(--energy)" />
          </div>
          <div>
            <div className="f-display" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.02em' }}>ОПОРА</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-mute)', letterSpacing: '.03em' }}>ПЛАТФОРМА СТІЙКОСТІ</div>
          </div>
        </div>

        <div className="hidden-mobile" style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
          {NAV.map((n) => (
            <div
              key={n.id}
              className={`nav-item ${tab === n.id ? 'active' : ''}`}
              style={tab === n.id ? { borderLeftColor: MODULE_META[n.id]?.color || 'var(--ai)' } : {}}
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
        {/* Status strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '11px 22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <StatusMetric Icon={Bot} color="var(--ai)" text="247 звернень оброблено сьогодні" />
          <StatusMetric Icon={BatteryCharging} color="var(--energy)" text="Заряд 82% · економія 14 720 ₴" />
          <StatusMetric Icon={ShieldCheck} color="var(--finance)" text="Ризик 12% · низький" />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={14} color="var(--text-mute)" />
            <span className="f-mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>Київ, {timeStr}</span>
          </div>
        </div>

        {/* Tab header */}
        <div style={{ padding: '18px 22px 4px 22px' }}>
          <div className="f-display" style={{ fontSize: 20, fontWeight: 700 }}>
            {NAV.find((n) => n.id === tab)?.label}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginTop: 2, marginBottom: 16 }}>
            {tab === 'overview' && 'Єдина картина операційної стійкості бізнесу — люди, енергія, комплаєнс.'}
            {tab === 'ai' && 'Команда ШІ-агентів, що бере на себе рутину замість дефіцитного персоналу.'}
            {tab === 'energy' && 'Керування генерацією, накопиченням та тарифним арбітражем у реальному часі.'}
            {tab === 'finance' && 'Моніторинг лімітів ПДВ, ризик-скору та комплаєнс-дедлайнів без ручного обліку.'}
          </div>
        </div>

        <div style={{ padding: '0 22px 24px 22px', overflowY: 'auto' }}>
          {tab === 'overview' && <OverviewPage />}
          {tab === 'ai' && <AIPage />}
          {tab === 'energy' && <EnergyPage />}
          {tab === 'finance' && <FinancePage />}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div
        className="mobile-nav"
        style={{
          display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)',
          borderTop: '1px solid var(--border)', justifyContent: 'space-around', padding: '8px 4px', zIndex: 20,
        }}
      >
        {NAV.map((n) => (
          <div key={n.id} onClick={() => setTab(n.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: tab === n.id ? MODULE_META[n.id]?.color : 'var(--text-mute)' }}>
            <n.Icon size={17} />
            <span style={{ fontSize: 9 }}>{n.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .hidden-mobile { display: none !important; }
          .mobile-nav { display: flex !important; }
          .opora-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function StatusMetric({ Icon, color, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Dot color={color} />
      <Icon size={13} color={color} />
      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{text}</span>
    </div>
  );
}
