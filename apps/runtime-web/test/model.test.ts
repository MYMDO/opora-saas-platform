import { describe, expect, it } from 'vitest';
import {
  formatCellValue,
  resolveFormFields,
  resolveTableColumns,
  type EntityLike,
  type PageLike,
} from '../src/model';

const ticket: EntityLike = {
  apiName: 'ticket',
  label: 'Заявка',
  fields: [
    { name: 'title', label: 'Тема', type: 'text', required: true },
    { name: 'status', label: 'Статус', type: 'select', options: ['new', 'done'] },
    { name: 'due_at', label: 'Термін', type: 'datetime' },
    { name: 'internal_note', label: 'Внутрішня примітка', type: 'longtext' },
  ],
};

describe('resolveTableColumns', () => {
  it('без сторінки показує всі поля в порядку визначення', () => {
    expect(resolveTableColumns(ticket).map((c) => c.name)).toEqual([
      'title',
      'status',
      'due_at',
      'internal_note',
    ]);
  });

  it('явні колонки задають підмножину та порядок', () => {
    const page: PageLike = {
      path: '/tickets',
      label: 'Заявки',
      entity: 'ticket',
      view: { kind: 'table', columns: ['status', 'title'] },
    };
    expect(resolveTableColumns(ticket, page).map((c) => c.name)).toEqual(['status', 'title']);
  });

  it('невідомі колонки зі сторінки відфільтровуються (схема могла еволюціонувати)', () => {
    const page: PageLike = {
      path: '/tickets',
      label: 'Заявки',
      entity: 'ticket',
      view: { kind: 'table', columns: ['ghost_field', 'title'] },
    };
    expect(resolveTableColumns(ticket, page).map((c) => c.name)).toEqual(['title']);
  });
});

describe('resolveFormFields', () => {
  it('form-сторінка задає поля форми; інші види ігноруються', () => {
    const formPage: PageLike = {
      path: '/tickets/new',
      label: 'Нова заявка',
      entity: 'ticket',
      view: { kind: 'form', fields: ['title', 'status'] },
    };
    expect(resolveFormFields(ticket, formPage).map((f) => f.name)).toEqual(['title', 'status']);

    const tableView: PageLike = { ...formPage, view: { kind: 'table', columns: ['title'] } };
    expect(resolveFormFields(ticket, tableView)).toHaveLength(4);
  });
});

describe('formatCellValue', () => {
  it('бульові українською, порожнє — тире, решта рядком', () => {
    expect(formatCellValue(true, 'boolean')).toBe('так');
    expect(formatCellValue(false, 'boolean')).toBe('ні');
    expect(formatCellValue(undefined, 'datetime')).toBe('—');
    expect(formatCellValue(42, 'number')).toBe('42');
  });

  it('дати українською, биті — як є', () => {
    expect(formatCellValue('2026-09-03', 'date')).toBe('03.09.2026');
    expect(formatCellValue('2026-09-03T14:05:00', 'datetime')).toBe('03.09.2026, 14:05');
    expect(formatCellValue('не дата', 'date')).toBe('не дата');
  });
});
