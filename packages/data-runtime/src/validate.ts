import type { EntityDefinition, FieldDefinition } from '@opora/dsl';
import { ValidationError } from './errors';

export type Json = string | number | boolean | null;

export interface RecordEntity {
  id: string;
  tenantId: string;
  appSlug: string;
  entity: string;
  data: Record<string, Json>;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Soft delete (блюпринт §4): рядок лишається, фільтрується на читанні */
  deletedAt?: string | null;
}

export interface QuerySpec {
  /** Фільтри рівності по полях data (пізніше — оператори) */
  filters?: Record<string, Json>;
  /** Пошук підрядка (case-insensitive) по вказаних текстових полях */
  search?: { fields: string[]; query: string };
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface Page<R = RecordEntity> {
  rows: R[];
}

const MAX_STR = 100_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)?$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function typeCheck(field: FieldDefinition, value: unknown): string | null {
  switch (field.type) {
    case 'text':
    case 'longtext': {
      if (typeof value !== 'string') return 'очікується рядок';
      if (value.length > MAX_STR) return `довжина > ${MAX_STR}`;
      if (field.type === 'text' && field.maxLength && value.length > field.maxLength) {
        return `довжина > ${field.maxLength}`;
      }
      return null;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'очікується число';
      if (field.min !== undefined && value < field.min) return `менше за ${field.min}`;
      if (field.max !== undefined && value > field.max) return `більше за ${field.max}`;
      return null;
    }
    case 'boolean':
      return typeof value === 'boolean' ? null : 'очікується boolean';
    case 'date':
    case 'datetime':
      if (typeof value !== 'string' || !ISO_RE.test(value)) {
        return field.type === 'date' ? 'очікується YYYY-MM-DD' : 'очікується ISO datetime';
      }
      return null;
    case 'select':
      return field.options.includes(String(value)) ? null : 'значення поза options';
    case 'relation':
      return typeof value === 'string' && value.length <= 64
        ? null
        : 'очікується id цільового запису';
    default:
      return 'непідтримуваний тип поля';
  }
}

/** Валідує payload проти EntityDefinition; create застосовує defaults та required. */
export function validateRecord(
  def: EntityDefinition,
  input: unknown,
  mode: 'create' | 'patch',
): Record<string, Json> {
  if (!isObject(input)) {
    throw new ValidationError([{ path: 'body', message: 'очікується обʼєкт' }]);
  }

  const issues: Array<{ path: string; message: string }> = [];
  const out: Record<string, Json> = {};

  for (const [key, value] of Object.entries(input)) {
    const field: FieldDefinition | undefined = def.fields.find(
      (f): f is FieldDefinition => f.name === key,
    );
    if (!field) {
      issues.push({ path: key, message: 'невідоме поле для цієї сутності' });
      continue;
    }
    if (value === undefined) continue;
    const err = typeCheck(field, value);
    if (err) issues.push({ path: key, message: err });
    else out[key] = value as Json;
  }

  if (mode === 'create') {
    for (const field of def.fields) {
      if (out[field.name] !== undefined) continue;
      if ('default' in field && field.default !== undefined) {
        out[field.name] = field.default as Json;
      } else if (field.required) {
        issues.push({ path: field.name, message: "обовʼязкове поле" });
      }
    }
  }

  if (issues.length > 0) throw new ValidationError(issues);
  return out;
}
