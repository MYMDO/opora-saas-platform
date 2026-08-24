import { describe, expect, it, vi } from 'vitest';
import type { WorkflowDefinition } from '@opora/dsl';
import { executeWorkflow } from '../src/executor';

const wf: WorkflowDefinition = {
  on: 'ticket.created',
  steps: [
    { type: 'assign', field: 'owner_id', value: 'agent-1' },
    { type: 'webhook', connection: 'slack', event: 'ticket.created' },
  ],
};

function deps(overrides?: Partial<{
  webhookPost: ReturnType<typeof vi.fn>;
  resolveConnection: ReturnType<typeof vi.fn>;
  applyRecordPatch: ReturnType<typeof vi.fn>;
}>) {
  return {
    webhookPost: overrides?.webhookPost ?? vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    resolveConnection: overrides?.resolveConnection ?? vi.fn().mockReturnValue('https://hooks.test/x'),
    applyRecordPatch: overrides?.applyRecordPatch ?? vi.fn().mockResolvedValue(undefined),
  };
}

describe('executeWorkflow', () => {
  it('виконує assign та webhook у порядку кроків', async () => {
    const d = deps();
    const r = await executeWorkflow(wf, { title: 'T' }, d);

    expect(r.ok).toBe(true);
    expect(r.steps.map((s) => `${s.type}:${s.status}`)).toEqual([
      'assign:ok',
      'webhook:ok',
      'applyPatch:ok',
    ]);
    expect(d.applyRecordPatch).toHaveBeenCalledWith({ owner_id: 'agent-1' });
    expect(d.webhookPost).toHaveBeenCalledWith(
      'https://hooks.test/x',
      { event: 'ticket.created', record: { title: 'T' } },
    );
  });

  it('робить 2 спроби webhook і фіксує помилку', async () => {
    const post = vi.fn().mockResolvedValue({ ok: false, error: 'ECONNREFUSED' });
    const r = await executeWorkflow(wf, { title: 'T' }, deps({ webhookPost: post }));

    expect(post).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(false);
    expect(r.steps.find((s) => s.type === 'webhook')?.status).toBe('error');
  });

  it('не конфігурований connection — skipped, без мережевих викликів', async () => {
    const post = vi.fn();
    const r = await executeWorkflow(
      wf,
      { title: 'T' },
      deps({ resolveConnection: vi.fn().mockReturnValue(null), webhookPost: post }),
    );
    expect(r.steps.find((s) => s.type === 'webhook')?.status).toBe('skipped');
    expect(post).not.toHaveBeenCalled();
    void post;
  });

  it('assign із функціональним значенням пропускається (безпечна граматика)', async () => {
    const wfFn: WorkflowDefinition = {
      on: 'ticket.created',
      steps: [{ type: 'assign', field: 'owner_id', value: "firstAvailable('agent')" }],
    };
    const apply = vi.fn().mockResolvedValue(undefined);
    const r = await executeWorkflow(wfFn, null, deps({ applyRecordPatch: apply }));

    expect(r.steps.find((s) => s.type === 'assign')?.status).toBe('skipped');
    expect(apply).not.toHaveBeenCalled();
  });
});
