import type { LucideIcon } from 'lucide-react';
import { Eyebrow } from './Eyebrow';

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  dim,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  color: string;
  dim: string;
}) {
  return (
    <div className="panel fade-in" style={{ padding: 16, flex: 1, minWidth: 200 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <Eyebrow color="var(--text-mute)">{label}</Eyebrow>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: dim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={14} color={color} />
        </div>
      </div>
      <div className="f-mono" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
