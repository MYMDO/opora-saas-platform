import type { ReactNode } from 'react';

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div
      className="f-mono"
      style={{
        fontSize: 10.5,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: color || 'var(--text-mute)',
        marginBottom: 6,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
