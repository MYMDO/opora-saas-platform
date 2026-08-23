import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Dot, Eyebrow } from '../../../design-system/components';
import { formatNumberUa } from '../../../lib/format';
import { AGENTS, buildAssistantReply, CANNED, getAgent } from '../index';
import { getFinanceSnapshot } from '../../finance/index';
import { getEnergySnapshot } from '../../energy/index';
import { assessBookingRoster, remainingBookingSlots } from '../../hr/index';
import { useScenario } from '../../../app/scenario';
import { BookingComplianceCard } from '../../hr';

interface ChatMessage {
  from: 'bot' | 'user';
  text: string;
}

export function AiAgentsPage() {
  const { scenario } = useScenario();
  const [selected, setSelected] = useState('hanna');
  const [messages, setMessages] = useState<ChatMessage[]>([{ from: 'bot', text: CANNED.hanna[0] }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const turnRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ from: 'bot', text: CANNED[selected][0] }]);
    turnRef.current = 1;
  }, [selected]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  function buildContext() {
    const roster = assessBookingRoster(scenario.hr.employees, scenario.hr.enterprise);
    return {
      finance: getFinanceSnapshot(scenario.finance),
      energy: getEnergySnapshot(),
      roster: { eligibleCount: roster.eligibleCount, total: roster.rows.length },
      bookingRemainingSlots: remainingBookingSlots(scenario.hr.enterprise),
    };
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: 'user', text }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const bank = CANNED[selected];
      const fallback = bank[turnRef.current % bank.length];
      turnRef.current += 1;
      const reply = buildAssistantReply(
        { id: selected, name: getAgent(selected).name },
        text,
        buildContext(),
        fallback,
      );
      setMessages((m) => [...m, { from: 'bot', text: reply }]);
      setTyping(false);
    }, 850);
  }

  const agent = getAgent(selected);

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
              <div className="f-display" style={{ fontSize: 15, fontWeight: 600 }}>
                {a.name}
              </div>
              <Dot color="var(--ai)" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{a.role}</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div>
                <div className="f-mono" style={{ fontSize: 17, fontWeight: 600 }}>
                  {a.resolvedToday}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>сьогодні</div>
              </div>
              <div>
                <div className="f-mono" style={{ fontSize: 17, fontWeight: 600 }}>
                  {a.avgTime}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>сер. час</div>
              </div>
              <div>
                <div className="f-mono" style={{ fontSize: 17, fontWeight: 600 }}>
                  {a.csat}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>CSAT</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)',
          gap: 16,
        }}
        className="opora-grid-2"
      >
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow color="var(--ai)">
            {agent.name} · опис ролі
          </Eyebrow>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>{agent.desc}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StatRow label="Всього вирішено" value={formatNumberUa(agent.resolvedTotal)} />
            <StatRow label="Ескалація на людину" value="7%" />
            <StatRow label="Доступність" value="24/7" />
          </div>
        </div>

        <div className="panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', height: 360 }}>
          <Eyebrow>Тестова розмова з агентом «{agent.name}»</Eyebrow>
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '8px 2px',
            }}
          >
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  className="fade-in"
                  style={{
                    maxWidth: '80%',
                    fontSize: 13,
                    lineHeight: 1.45,
                    padding: '8px 12px',
                    borderRadius: 10,
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
                <div className="f-mono" style={{ fontSize: 12, color: 'var(--text-mute)', padding: '6px 12px' }}>
                  {agent.name} набирає…
                </div>
              </div>
            )}
          </div>
          <div className="input-row" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="Напишіть повідомлення агенту…"
              style={{ flex: 1, padding: '9px 12px', borderRadius: 6, fontSize: 13 }}
            />
            <button
              onClick={send}
              aria-label="Надіслати"
              style={{
                background: 'var(--ai)',
                border: 'none',
                borderRadius: 6,
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <Send size={15} color="#0E1213" />
            </button>
          </div>
        </div>
      </div>

      <BookingComplianceCard />
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-mute)' }}>{label}</span>
      <span className="f-mono">{value}</span>
    </div>
  );
}
