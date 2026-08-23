export function ProgressBar({ used, limit, height = 6 }: { used: number; limit: number; height?: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--energy)' : 'var(--finance)';
  return (
    <div className="bar-track" style={{ height }}>
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: barColor,
          borderRadius: 3,
          transition: 'width .4s ease',
        }}
      />
    </div>
  );
}
