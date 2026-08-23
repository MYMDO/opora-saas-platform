import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export type AlertLevel = 'danger' | 'warning' | 'ok';

const LEVEL_META = {
  danger: { color: 'var(--danger)', Icon: AlertTriangle },
  warning: { color: 'var(--energy)', Icon: AlertTriangle },
  ok: { color: 'var(--finance)', Icon: CheckCircle2 },
} as const;

export function AlertRow({ level, text }: { level: AlertLevel; text: string }) {
  const meta = LEVEL_META[level];
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <meta.Icon size={15} color={meta.color} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}
