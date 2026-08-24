import type { WorkflowDefinition } from '@opora/dsl';
import { conditionMatches } from './condition';

export type StepStatus = 'ok' | 'skipped' | 'error';

export interface StepLog {
  readonly type: string;
  readonly status: StepStatus;
  readonly detail?: string;
}

export interface RunResult {
  readonly ok: boolean;
  readonly steps: ReadonlyArray<StepLog>;
}

export interface WebhookAttempt {
  ok: boolean;
  status?: number;
  error?: string;
}

export interface ExecutorDeps {
  /** Резолв connection-слага з DSL у URL (секрети — окремо, у env/vault) */
  resolveConnection(connection: string): string | null;
  webhookPost(url: string, body: unknown): Promise<WebhookAttempt>;
  applyRecordPatch(patch: Record<string, unknown>): Promise<void>;
  /** Опційний колбек спостережуваності кроків */
  log?(s: StepLog): void;
}

const WEBHOOK_ATTEMPTS = 2;

export async function executeWorkflow(
  wf: WorkflowDefinition,
  recordData: Record<string, unknown> | null,
  deps: ExecutorDeps,
): Promise<RunResult> {
  const steps: Array<StepLog & { status: StepStatus; detail?: string }> = [];
  const push = (s: StepLog) => {
    steps.push(s);
    deps.log?.(s);
    return s;
  };

  if (wf.if !== undefined) {
    const verdict = conditionMatches(wf.if, recordData);
    if (verdict === null) {
      const s = push({ type: 'if', status: 'skipped', detail: 'unsupported_condition' });
      return { ok: true, steps: [s] };
    }
    if (verdict === false) {
      const s = push({ type: 'if', status: 'skipped', detail: 'condition_false' });
      return { ok: true, steps: [s] };
    }
  }

  let pendingPatch: Record<string, unknown> = {};

  for (const step of wf.steps) {
    switch (step.type) {
      case 'assign': {
        const value = step.value;
        if (typeof value === 'string' && /\w+\s*\(/.test(value)) {
          steps.push({ type: 'assign', status: 'skipped', detail: 'function_values_unsupported' });
          break;
        }
        pendingPatch = { ...pendingPatch, [step.field]: value };
        steps.push({ type: 'assign', status: 'ok' });
        break;
      }
      case 'webhook': {
        const url = deps.resolveConnection(step.connection);
        if (!url) {
          steps.push({ type: 'webhook', status: 'skipped', detail: 'connection_not_configured' });
          break;
        }
        const payload = { event: wf.on, record: recordData };
        let last: { ok: boolean; status?: number; error?: string } = { ok: false, error: 'not_attempted' };
        for (let attempt = 1; attempt <= WEBHOOK_ATTEMPTS; attempt++) {
          last = await deps.webhookPost(url, payload);
          if (last.ok) break;
        }
        steps.push(
          last.ok
            ? { type: 'webhook', status: 'ok', detail: `HTTP ${last.status ?? ''}`.trimEnd() }
            : {
                type: 'webhook',
                status: 'error',
                detail: `вичерпано ${WEBHOOK_ATTEMPTS} спроб: ${last.error ?? `HTTP ${last.status ?? '?'}`}`,
              },
        );
        break;
      }
      default:
        steps.push({ type: 'unknown', status: 'skipped', detail: 'unsupported_step_type' });
    }
  }

  if (Object.keys(pendingPatch).length > 0) {
    try {
      await deps.applyRecordPatch(pendingPatch);
      steps.push({ type: 'applyPatch', status: 'ok' });
    } catch (e) {
      steps.push({ type: 'applyPatch', status: 'error', detail: String(e).slice(0, 120) });
    }
  }

  const ok = !steps.some((s) => s.status === 'error');
  return { ok, steps };
}
