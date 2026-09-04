import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAppDefinition } from '../src';

const pnStorozh = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'pn-storozh.json'), 'utf-8'),
) as unknown;

describe('parseAppDefinition — pn-storozh fixture', () => {
  it('парситься без помилок: контрагенти → накладні → суми', () => {
    const parsed = parseAppDefinition(pnStorozh);
    expect(parsed.app.slug).toBe('pn-storozh');
    expect(parsed.entities.map((e) => e.apiName)).toEqual(['counterparty', 'invoice']);
    expect(parsed.pages).toHaveLength(5);
    expect(parsed.workflows.map((w) => w.on)).toEqual(['invoice.created', 'invoice.created']);
  });

  it('звʼязок, числовий поріг алерту і stats-сторінка з сумою', () => {
    const parsed = parseAppDefinition(pnStorozh);
    const invoice = parsed.entities.find((e) => e.apiName === 'invoice')!;
    const cp = invoice.fields.find((f) => f.name === 'counterparty')!;
    expect(cp.type === 'relation' && cp.target).toBe('counterparty');
    const big = parsed.workflows.find((w) => w.if === 'record.amount >= 100000')!;
    expect(big.steps).toHaveLength(1);
    const stats = parsed.pages.find((p) => p.path === '/invoices/by-status')!;
    expect(stats.view.kind === 'stats' && stats.view.groupBy).toBe('status');
    expect(stats.view.kind === 'stats' && stats.view.sum).toBe('amount');
  });
});
