/**
 * Мінімальна підмножина умов для workflow `if`: рівність поля запису.
 * Формат: "record.<field> == <'рядок' | число | true | false>"
 *
 * Все інше (&&/||, функції, порівняння) — повертає null = «не підтримується»,
 * і executor пропускає workflow зі статусом skipped (ніколи не кидає виняток).
 */

export interface SimpleEquality {
  field: string;
  value: string | number | boolean;
}

const COND_RE =
  /^record\.([a-z][a-z0-9_]*)\s*==\s*('(?:[^']*)'|"[^"]*"|-?\d+(?:\.\d+)?|true|false)$/;

export function parseSimpleEquality(expr: string): SimpleEquality | null {
  const m = COND_RE.exec(expr.trim());
  if (!m || !m[1]) return null;
  const raw = m[2] ?? '';
  let value: string | number | boolean;
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    value = raw.slice(1, -1);
  } else if (raw === 'true') value = true;
  else if (raw === 'false') value = false;
  else value = Number(raw);

  return { field: m[1], value };
}

/** true/false — результат; null — вираз не підтримується граматикою v1. */
export function conditionMatches(
  expr: string,
  data: Record<string, unknown> | null,
): boolean | null {
  const cond = parseSimpleEquality(expr);
  if (!cond) return null;
  const actual = data?.[cond.field];
  return actual === cond.value;
}
