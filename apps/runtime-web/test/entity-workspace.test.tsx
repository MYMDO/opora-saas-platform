// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntityWorkspace } from '../src/EntityWorkspace';
import type { PublishedSchema } from '../src/client';

afterEach(() => cleanup());

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ records: [] }) }),
);

// Сутність без жодного default/boolean: свіжий draft порожній.
// Регресія: форма мусить відкриватись і тоді (раніше кнопка мовчала).
const schema = {
  version: 1,
  definition: {
    app: { slug: 'service-desk', name: 'Service Desk' },
    entities: [
      {
        apiName: 'ticket',
        label: 'Заявка',
        fields: [
          { name: 'title', label: 'Тема', type: 'text' },
          { name: 'description', label: 'Опис', type: 'longtext' },
        ],
      },
    ],
    pages: [],
  },
} as unknown as PublishedSchema;

function ticketEntity() {
  const e = schema.definition.entities[0];
  if (!e) throw new Error('test fixture broken');
  return e;
}

describe('EntityWorkspace — створення запису', () => {
  it('кнопка "+ Новий запис" відкриває форму навіть з порожнім draft', () => {
    render(
      <EntityWorkspace
        schema={schema}
        entity={ticketEntity()}
        pages={[]}
      />,
    );
    expect(screen.queryByText('Новий запис')).toBeNull();
    fireEvent.click(screen.getByText('+ Новий запис'));
    expect(screen.getByText('Новий запис')).toBeTruthy();
    expect(screen.getByText('Зберегти')).toBeTruthy();
  });

  it('Скасувати закриває форму', () => {
    render(
      <EntityWorkspace
        schema={schema}
        entity={ticketEntity()}
        pages={[]}
      />,
    );
    fireEvent.click(screen.getByText('+ Новий запис'));
    expect(screen.getByText('Новий запис')).toBeTruthy();
    fireEvent.click(screen.getByText('Скасувати'));
    expect(screen.queryByText('Новий запис')).toBeNull();
    expect(screen.getByText('+ Новий запис')).toBeTruthy();
  });
});
