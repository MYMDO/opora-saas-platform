/**
 * Чисті функції перетворення EntityDefinition (+опційної сторінки DSL)
 * у view-моделі для генерації таблиць і форм. Без React, без мережі.
 */

export interface FieldLike {
  name: string;
  label: string;
  /** Тип із DSL-схеми; рендерер трактує його як рядок */
  type: string;
  required?: boolean;
  options?: string[];
  maxLength?: number;
}

export interface EntityLike {
  apiName: string;
  label: string;
  fields: ReadonlyArray<FieldLike>;
}

export interface TableViewLike {
  kind: 'table';
  columns: ReadonlyArray<string>;
}

export interface FormViewLike {
  kind: 'form';
  fields: ReadonlyArray<string>;
}

export interface PageLike {
  path: string;
  label: string;
  entity: string;
  view: { kind: string; columns?: ReadonlyArray<string>; fields?: ReadonlyArray<string> };
}

export interface ColumnVM {
  name: string;
  label: string;
  type: FieldLike['type'];
}

/** Колонки таблиці: явний список зі сторінки, або всі поля сутності. */
export function resolveTableColumns(
  entity: EntityLike,
  page?: Pick<PageLike, 'view'>,
): ColumnVM[] {
  const view = page?.view;
  if (view && view.kind === 'table' && Array.isArray(view.columns)) {
    return view.columns
      .map((name) => entity.fields.find((f) => f.name === name))
      .filter((f): f is FieldLike => Boolean(f))
      .map(toColumn);
  }
  return entity.fields.map(toColumn);
}

/** Поля форми: явний список зі сторінки form, або всі поля крім системних defaults. */
export function resolveFormFields(
  entity: EntityLike,
  page?: Pick<PageLike, 'view'>,
): FieldLike[] {
  const view = page?.view;
  if (view && view.kind === 'form' && Array.isArray(view.fields)) {
    return view.fields
      .map((name) => entity.fields.find((f) => f.name === name))
      .filter((f): f is FieldLike => Boolean(f));
  }
  return [...entity.fields];
}

function toColumn(f: FieldLike): ColumnVM {
  return { name: f.name, label: f.label, type: f.type };
}

export function formatCellValue(value: unknown, type: string): string {
  if (value === undefined || value === null || value === '') return '—';
  if (type === 'boolean') return value === true ? 'так' : 'ні';
  return String(value);
}
