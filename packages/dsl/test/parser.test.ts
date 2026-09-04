import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppDefinitionError, parseAppDefinition } from '../src';
import type { AppDefinition } from '../src';

const fixturePath = join(__dirname, '..', 'fixtures', 'service-desk.json');

type Raw = Record<string, unknown>;

function base(): Raw {
  return JSON.parse(readFileSync(fixturePath, 'utf-8')) as Raw;
}

function entities(d: Raw): Array<Raw> {
  return d.entities as Array<Raw>;
}

function pages(d: Raw): Array<Raw> {
  return d.pages as Array<Raw>;
}

function policies(d: Raw): Array<Raw> {
  return d.policies as Array<Raw>;
}

function workflows(d: Raw): Array<Raw> {
  return d.workflows as Array<Raw>;
}

function expectAppError(input: unknown): AppDefinitionError {
  try {
    parseAppDefinition(input);
  } catch (e) {
    if (e instanceof AppDefinitionError) return e;
    throw new Error(`очікували AppDefinitionError, отримали: ${String(e)}`);
  }
  throw new Error('очікували AppDefinitionError, але парсинг пройшов');
}

function expectIssue(input: unknown, fragment: string, code?: string): void {
  const err = expectAppError(input);
  const haystack = err.issues.map((i) => `${i.path} ${i.message} ${i.code}`);
  const match = haystack.find(
    (h) => h.includes(fragment) && (code === undefined || h.includes(code)),
  );
  expect(match, `серед ${JSON.stringify(err.issues)} немає "${fragment}"`).toBeTruthy();
}

function firstEntity(d: Raw): Raw {
  const e = entities(d)[0];
  if (!e) throw new Error('немає першої сутності');
  return e;
}

function withSingleField(d: Raw, index: number, field: Raw): Raw {
  const next = structuredClone(d);
  entities(next)[index] = { ...entities(next)[index], fields: [field] };
  return next;
}

describe('parseAppDefinition — fixture', () => {
  it('парсить service-desk.json у типізований обʼєкт', () => {
    const parsed = parseAppDefinition(base()) as AppDefinition;
    expect(parsed.app.slug).toBe('service-desk');
    expect(parsed.entities.map((e) => e.apiName)).toEqual(['contact', 'ticket']);
    const status = parsed.entities[1]?.fields.find((f) => f.name === 'status');
    expect(status?.type).toBe('select');
    expect(status?.type === 'select' && status.default).toBe('new');
    expect(parsed.pages).toHaveLength(3);
    expect(parsed.workflows[0]?.on).toBe('ticket.created');
  });

  it('заповнює дефолти (required=false, cardinality=one)', () => {
    const parsed = parseAppDefinition(base());
    const requester = parsed.entities[1]?.fields.find((f) => f.name === 'requester');
    expect(requester?.required).toBe(false);
    expect(requester?.type === 'relation' && requester.cardinality).toBe('one');
  });
});

describe('структура', () => {
  it('1. відхиляє не-обʼєкт на корені', () => {
    expect(() => parseAppDefinition([1, 2])).toThrow(AppDefinitionError);
    expect(() => parseAppDefinition('nope')).toThrow(AppDefinitionError);
  });

  it('2. відхиляє відсутній app.slug', () => {
    const d = base();
    delete (d.app as Raw).slug;
    expectIssue(d, 'app.slug');
  });

  it('3. відхиляє некоректний slug', () => {
    const d = base();
    (d.app as Raw).slug = 'Service Desk!';
    expectIssue(d, 'app.slug');
  });
});

describe('сутності й поля', () => {
  it('4. вимагає щонайменше одну сутність', () => {
    const d = base();
    d.entities = [];
    expectIssue(d, 'entities');
  });

  it('5. виявляє дублікат apiName сутностей', () => {
    const d = base();
    entities(d).push(structuredClone(entities(d)[0] as Raw));
    expectIssue(d, 'duplicate_name');
  });

  it('6. відхиляє невалідний apiName', () => {
    const d = base();
    firstEntity(d).apiName = 'service-Ticket';
    expectIssue(d, 'apiName');
  });

  it('7. відхиляє порожній label сутності', () => {
    const d = base();
    firstEntity(d).label = '   ';
    expectIssue(d, 'label');
  });

  it('8. виявляє дублікат імені поля всередині сутності', () => {
    const d = base();
    const fields = firstEntity(d).fields as Array<Raw>;
    fields.push({ name: 'email', label: 'Email', type: 'text' });
    expectIssue(d, 'duplicate_name');
  });

  it('9. відхиляє невідомий тип поля', () => {
    const input = withSingleField(base(), 1, { name: 'magic', label: 'Магія', type: 'wizard' });
    expectIssue(input, 'type');
  });

  it('10. вимагає ≥2 опцій у select', () => {
    const input = withSingleField(base(), 1, {
      name: 'status',
      label: 'Статус',
      type: 'select',
      options: ['only-one'],
    });
    expectIssue(input, 'options');
  });

  it('11. відхиляє default поза options у select', () => {
    const input = withSingleField(base(), 1, {
      name: 'status',
      label: 'Статус',
      type: 'select',
      options: ['a', 'b'],
      default: 'c',
    });
    expectIssue(input, 'default', 'invalid_default');
  });

  it('12. відхиляє relation на неіснуючу сутність', () => {
    const input = withSingleField(base(), 1, {
      name: 'owner_ref',
      label: 'Виконавець',
      type: 'relation',
      target: 'unicorn',
    });
    expectIssue(input, 'target', 'unknown_reference');
  });

  it('13. відхиляє невалідну cardinality', () => {
    const input = withSingleField(base(), 1, {
      name: 'requester',
      label: 'Заявник',
      type: 'relation',
      target: 'contact',
      cardinality: 'many-many',
    });
    expectIssue(input, 'cardinality');
  });
});

describe('сторінки', () => {
  it('14. відхиляє сторінку на неіснуючу сутність', () => {
    const d = base();
    pages(d).push({
      path: '/ghosts',
      label: 'Примари',
      entity: 'ghost',
      view: { kind: 'table', columns: ['title'] },
    });
    expectIssue(d, 'unknown_reference');
  });

  it('15. відхиляє невідоме поле у table view', () => {
    const d = base();
    const firstPage = pages(d)[0];
    if (!firstPage) throw new Error('немає сторінки');
    const view = firstPage.view as Raw;
    view.columns = ['title', 'nonexistent_field'];
    expectIssue(d, 'view', 'unknown_reference');
  });

  it('16. відхиляє дублікат шляху сторінок', () => {
    const d = base();
    pages(d).push(structuredClone(pages(d)[0] as Raw));
    expectIssue(d, 'duplicate_name');
  });

  it('17. відхиляє шлях без початкового «/»', () => {
    const d = base();
    const pageToRename = pages(d)[0];
    if (!pageToRename) throw new Error('немає сторінки');
    pageToRename.path = 'tickets';
    expectIssue(d, 'path');
  });
});

describe('policies та workflows', () => {
  it('18. відхиляє policy для неіснуючої сутності', () => {
    const d = base();
    policies(d).push({ resource: 'dragon', action: 'read', allow: "role('admin')" });
    expectIssue(d, 'dragon', 'unknown_reference');
  });

  it('19. відхиляє недопустиму дію policy', () => {
    const d = base();
    const policy0 = policies(d)[0];
    if (!policy0) throw new Error('немає політики');
    policy0.action = 'export_all';
    expectIssue(d, 'action');
  });

  it('20. відхиляє тригер workflow неіснуючої сутності', () => {
    const d = base();
    const wf0 = workflows(d)[0];
    if (!wf0) throw new Error('немає workflow');
    wf0.on = 'unicorn.created';
    expectIssue(d, 'workflows[0]', 'unknown_reference');
  });

  it('21. вимагає непорожній масив steps', () => {
    const d = base();
    const wfSteps = workflows(d)[0];
    if (!wfSteps) throw new Error('немає workflow');
    wfSteps.steps = [];
    expectIssue(d, 'steps');
  });

  it('22. відхиляє невідомий тип step', () => {
    const d = base();
    const wf = workflows(d)[0];
    if (!wf) throw new Error('немає workflow');
    const steps = wf.steps as Array<Raw>;
    const firstStep = steps[0];
    if (!firstStep) throw new Error('немає першого step');
    firstStep.type = 'deployToProd';
    expectIssue(d, 'type');
  });

  it('23. агрегує кілька проблем одночасно', () => {
    const d = base();
    policies(d).push({ resource: 'dragon', action: 'read', allow: "role('admin')" });
    pages(d).push({
      path: '/ghosts',
      label: 'Примари',
      entity: 'ghost',
      view: { kind: 'table', columns: ['x'] },
    });
    const err = expectAppError(d);
    expect(err.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('24. stats-view з groupBy проходить валідацію', () => {
    const d = base();
    pages(d).push({
      path: '/stats',
      label: 'Статистика',
      entity: 'ticket',
      view: { kind: 'stats', groupBy: 'status' },
    });
    expect(() => parseAppDefinition(d)).not.toThrow();
  });

  it('25. stats-view без groupBy відхиляється', () => {
    const d = base();
    pages(d).push({
      path: '/stats',
      label: 'Статистика',
      entity: 'ticket',
      view: { kind: 'stats' },
    });
    expectAppError(d);
  });

  it('26. stats-view з sum валідує обидва поля', () => {
    const ok = base();
    const ticket = entities(ok).find((e) => (e as { apiName?: string }).apiName === 'ticket') as
      | { fields: Array<Record<string, unknown>> }
      | undefined;
    if (!ticket) throw new Error('fixture без ticket');
    ticket.fields.push({ name: 'estimate_hours', label: 'Години', type: 'number' });
    pages(ok).push({
      path: '/stats',
      label: 'Статистика',
      entity: 'ticket',
      view: { kind: 'stats', groupBy: 'status', sum: 'estimate_hours' },
    });
    expect(() => parseAppDefinition(ok)).not.toThrow();
    const bad = base();
    pages(bad).push({
      path: '/stats',
      label: 'Статистика',
      entity: 'ticket',
      view: { kind: 'stats', groupBy: 'status', sum: 'nope' },
    });
    expectAppError(bad);
  });

  it('27. schedule-workflow: тригер без сутності, aggregate валідується', () => {
    const ok = base();
    const ticket = entities(ok).find((e) => (e as { apiName?: string }).apiName === 'ticket') as
      | { fields: Array<Record<string, unknown>> }
      | undefined;
    if (!ticket) throw new Error('fixture без ticket');
    ticket.fields.push({ name: 'estimate_hours', label: 'Години', type: 'number' });
    workflows(ok).push({
      on: 'schedule',
      if: 'record.sum >= 1000000',
      aggregate: { entity: 'ticket', groupBy: 'status', sum: 'estimate_hours' },
      steps: [{ type: 'webhook', connection: 'ops-hook', event: 'ticket.limit' }],
    });
    expect(() => parseAppDefinition(ok)).not.toThrow();

    const noAgg = base();
    workflows(noAgg).push({
      on: 'schedule',
      steps: [{ type: 'webhook', connection: 'ops-hook', event: 'x' }],
    });
    expectIssue(noAgg, 'workflows[1].aggregate', 'invalid_structure');

    const badRef = base();
    workflows(badRef).push({
      on: 'schedule',
      aggregate: { entity: 'ticket', groupBy: 'status', sum: 'nope' },
      steps: [{ type: 'webhook', connection: 'ops-hook', event: 'x' }],
    });
    expectIssue(badRef, 'unknown_reference');
  });
});
