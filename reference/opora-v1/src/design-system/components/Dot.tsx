export function Dot({ color = 'var(--finance)' }: { color?: string }) {
  return (
    <span
      className="pulse"
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: color,
        display: 'inline-block',
        boxShadow: `0 0 6px ${color}`,
      }}
    />
  );
}
