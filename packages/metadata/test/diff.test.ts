import { describe, expect, it } from 'vitest';
import { diffAppDefinitions } from '../src/diff';

const BASE = {
  app: { slug: 'test-app', name: 'Test App' },
  entities: [
    {
      apiName: 'ticket',
      label: 'Заявка',
      fields: [
        { name: 'title', label: 'Тема', type: 'text', required: true },
        { name: 'priority', label: 'Пріоритет', type: 'select', options: ['low', 'high'] },
      ],
    },
  ],
  pages: [{ path: '/tickets', label: 'Заявки', entity: 'ticket', view: { kind: 'table', columns: ['title'] } }],
  policies: [{ resource: 'ticket', action: 'read', allow: "role('agent')" }],
  workflows: [{ on: 'ticket.created', steps: [{ type: 'webhook', connection: 'slack', event: 'ticket.created' }] }],
} as const;

function clone<T>(v: T): T {
  return structuredClone(v);
}

describe('diffAppDefinitions', () => {
  it('тотожні визначення → порожній diff без ризиків', async () => {
    const { parseAppDefinition } = await import('@opora/dsl');
    const def = parseAppDefinition(clone(BASE));
    const diff = diffAppDefinitions(def, parseAppDefinition(clone(BASE)));
    expect(diff.risks).toEqual([]);
    expect(diff.breaking).toBe(false);
    expect(diff.entities.changed).toEqual([]);
  });

  it('видалене поле і нова сутність: ризики + breaking', async () => {
    const { parseAppDefinition } = await import('@opora/dsl');
    const prev = parseAppDefinition(clone(BASE));
    const raw = clone(BASE) as unknown as { entities: Array<{ apiName: string; fields: unknown[] }> };
    raw.entities[0]!.fields = raw.entities[0]!.fields.filter((f) => (f as { name: string }).name !== 'priority');
    raw.entities.push({
      apiName: 'contact',
      label: 'Контакт',
      fields: [{ name: 'full_name', label: 'Імʼя', type: 'text', required: true }],
    } as never);
    const next = parseAppDefinition(raw);

    const diff = diffAppDefinitions(prev, next);
    expect(diff.entities.added).toEqual(['contact']);
    expect(diff.entities.changed).toHaveLength(1);
    expect(diff.entities.changed[0]).toMatchObject({
      apiName: 'ticket',
      removedFields: ['priority'],
    });
    expect(diff.risks).toContain('field_removed:ticket.priority');
    expect(diff.breaking).toBe(true);
  });

  it('зміна типу поля і нове required → breaking-ризики', async () => {
    const { parseAppDefinition } = await import('@opora/dsl');
    const prev = parseAppDefinition(clone(BASE));
    const raw = clone(BASE) as unknown as { entities: Array<{ fields: Array<{ name: string; type: string; required?: boolean }> }> };
    for (const f of raw.entities[0]!.fields) {
      if (f.name === 'title') f.type = 'longtext';
      if (f.name === 'priority') f.required = true;
    }
    const diff = diffAppDefinitions(prev, parseAppDefinition(raw));
    expect(diff.risks).toContain('field_type_changed:ticket.title');
    expect(diff.risks).toContain('field_became_required:ticket.priority');
    expect(diff.breaking).toBe(true);
  });

  it('знята політика — breaking через зміну доступів; змінений workflow — ризик', async () => {
    const { parseAppDefinition } = await import('@opora/dsl');
    const prev = parseAppDefinition(clone(BASE));
    const raw = clone(BASE) as unknown as {
      policies: unknown[];
      workflows: Array<{ on: string; steps: unknown[] }>;
    };
    raw.policies = [];
    raw.workflows[0]!.steps.push({ type: 'assign', field: 'owner_id', value: 'auto' });
    const diff = diffAppDefinitions(prev, parseAppDefinition(raw));
    expect(diff.policies.removed).toEqual(['ticket:read']);
    expect(diff.risks).toContain('policy_removed:ticket:read');
    expect(diff.workflows.changed).toEqual(['ticket.created']);
    expect(diff.risks).toContain('workflow_changed:ticket.created');
    expect(diff.breaking).toBe(true);
  });

  it('додана сторінка і поле — не breaking', async () => {
    const { parseAppDefinition } = await import('@opora/dsl');
    const prev = parseAppDefinition(clone(BASE));
    const raw = clone(BASE) as unknown as {
      entities: Array<{ fields: unknown[] }>;
      pages: unknown[];
    };
    raw.entities[0]!.fields.push({ name: 'due_at', label: 'Дедлайн', type: 'datetime' });
    raw.pages.push({ path: '/calendar', label: 'Календар', entity: 'ticket', view: { kind: 'table', columns: ['title'] } });
    const diff = diffAppDefinitions(prev, parseAppDefinition(raw));
    expect(diff.risks).toEqual([]);
    expect(diff.breaking).toBe(false);
    expect(diff.pages.added).toEqual(['/calendar']);
  });
});
