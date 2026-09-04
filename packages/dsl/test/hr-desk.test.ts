import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAppDefinition } from '../src';

const hrDesk = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'hr-desk.json'), 'utf-8'),
) as unknown;

describe('parseAppDefinition — hr-desk fixture', () => {
  it('парситься без помилок: воронка найму з трьох сутностей', () => {
    const parsed = parseAppDefinition(hrDesk);
    expect(parsed.app.slug).toBe('hr-desk');
    expect(parsed.entities.map((e) => e.apiName)).toEqual(['vacancy', 'candidate', 'onboarding']);
    expect(parsed.pages).toHaveLength(6);
    expect(parsed.policies).toHaveLength(4);
    expect(parsed.workflows.map((w) => w.on)).toEqual(['candidate.created', 'candidate.updated']);
  });

  it('звʼязки ведуть на існуючі сутності, дефолти етапів у межах options', () => {
    const parsed = parseAppDefinition(hrDesk);
    const candidate = parsed.entities.find((e) => e.apiName === 'candidate')!;
    const vacancyRef = candidate.fields.find((f) => f.name === 'vacancy')!;
    expect(vacancyRef.type === 'relation' && vacancyRef.target).toBe('vacancy');
    const stage = candidate.fields.find((f) => f.name === 'stage')!;
    expect(stage.type === 'select' && stage.default).toBe('new');
    const funnel = parsed.pages.find((p) => p.path === '/candidates/stages')!;
    expect(funnel.view.kind === 'stats' && funnel.view.groupBy).toBe('stage');
  });
});
