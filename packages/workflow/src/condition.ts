/**
 * Умови workflow `if`: порівняння поля запису з літералом.
 * Формат: "record.<field> <op> <'рядок' | число | true | false>"
 * Оператори: == != < <= > >=
 *
 * Порядкові оператори працюють лише для чисел з обох боків;
 * інакше (відсутнє поле, невідповідність типів) — false.
 * Все інше (&&/||, функції) — повертає null = «не підтримується»,
 * і executor пропускає workflow зі статусом skipped (ніколи не кидає виняток).
 */

export type ComparisonOp = '==' | '!=' | '<' | '<=' | '>' | '>=';

export interface Condition {
  field: string;
  op: ComparisonOp;
  value: string | number | boolean;
}

export interface SimpleEquality {
  field: string;
  value: string | number | boolean;
}

const COND_RE =
  /^record\.([a-z][a-z0-9_]*)\s*(==|!=|<=|>=|<|>)\s*('(?:[^']*)'|"[^"]*"|-?\d+(?:\.\d+)?|true|false)$/;

function parseLiteral(raw: string): string | number | boolean {
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1);
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return Number(raw);
}

export function parseCondition(expr: string): Condition | null {
  const m = COND_RE.exec(expr.trim());
  if (!m || !m[1] || !m[2]) return null;
  return { field: m[1], op: m[2] as ComparisonOp, value: parseLiteral(m[3] ?? '') };
}

export function parseSimpleEquality(expr: string): SimpleEquality | null {
  const cond = parseCondition(expr);
  if (!cond || cond.op !== '==') return null;
  return { field: cond.field, value: cond.value };
}

/** true/false — результат; null — вираз не підтримується граматикою. */
export function conditionMatches(
  expr: string,
  data: Record<string, unknown> | null,
): boolean | null {
  const cond = parseCondition(expr);
  if (!cond) return null;
  const actual = data?.[cond.field];
  switch (cond.op) {
    case '==':
      return actual === cond.value;
    case '!=':
      return actual !== cond.value;
    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (typeof actual !== 'number' || typeof cond.value !== 'number') return false;
      if (cond.op === '<') return actual < cond.value;
      if (cond.op === '<=') return actual <= cond.value;
      if (cond.op === '>') return actual > cond.value;
      return actual >= cond.value;
    }
  }
}
