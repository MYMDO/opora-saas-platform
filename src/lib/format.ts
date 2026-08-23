export function formatNumberUa(value: number): string {
  return value.toLocaleString('uk-UA');
}

export function formatUah(value: number): string {
  return `${formatNumberUa(value)} ₴`;
}

export function formatTimeUa(date: Date): string {
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export function formatDecimalUa(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}
