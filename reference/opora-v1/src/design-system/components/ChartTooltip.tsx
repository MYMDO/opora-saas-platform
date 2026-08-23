interface TooltipPayloadItem {
  readonly name?: string | number;
  readonly value?: string | number;
  readonly color?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="panel-2 f-mono"
      style={{ padding: '8px 10px', fontSize: 11, border: '1px solid var(--border-light)' }}
    >
      <div style={{ color: 'var(--text-mute)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <span>
            {p.value}
            {unit || ''}
          </span>
        </div>
      ))}
    </div>
  );
}
