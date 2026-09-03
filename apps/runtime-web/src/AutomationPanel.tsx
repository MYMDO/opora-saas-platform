import { useEffect, useState } from 'react';
import { client, type WorkflowRun } from './client';

interface WorkflowStep {
  type: string;
  field?: string;
  value?: string;
  connection?: string;
  event?: string;
}

interface WorkflowDef {
  on: string;
  if?: string;
  steps: WorkflowStep[];
}

const RUN_LABEL: Record<WorkflowRun['status'], string> = {
  running: 'виконується',
  ok: 'успішно',
  error: 'помилка',
  skipped: 'пропущено',
};

const RUN_COLOR: Record<WorkflowRun['status'], string> = {
  running: 'var(--energy)',
  ok: 'var(--finance)',
  error: 'var(--danger)',
  skipped: 'var(--text-mute)',
};

function stepText(s: WorkflowStep): string {
  if (s.type === 'assign') return `призначити ${s.field ?? '?'} ← ${s.value ?? '?'}`;
  if (s.type === 'webhook') return `webhook → ${s.connection ?? '?'} (${s.event ?? ''})`;
  return s.type;
}

export function AutomationPanel({ appSlug }: { appSlug: string }) {
  const [workflows, setWorkflows] = useState<WorkflowDef[] | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setWorkflows(null);
    setRuns(null);
    setForbidden(false);
    client
      .getSchema(appSlug)
      .then((s) => setWorkflows(((s.definition as { workflows?: WorkflowDef[] }).workflows ?? [])))
      .catch(() => setWorkflows([]));
    client
      .getWorkflowRuns(50)
      .then(setRuns)
      .catch((e: unknown) => {
        if (e instanceof Error && e.message.includes('403')) setForbidden(true);
        else setRuns([]);
      });
    client
      .getConnections()
      .then((list) => setConnections(Object.fromEntries(list.map((c) => [c.slug, c.configured]))))
      .catch(() => setConnections({}));
  }, [appSlug]);

  return (
    <div className="panel" style={{ padding: 18 }}>
      <div className="f-mono" style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-mute)', fontWeight: 600 }}>
        Автоматизації
      </div>

      {workflows?.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginTop: 8 }}>
          У published-релізі немає workflow.
        </div>
      )}
      {(workflows ?? []).map((w, i) => (
        <div key={i} style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="f-mono" style={{ fontSize: 12.5, fontWeight: 700 }}>на {w.on}</span>
            {w.if && (
              <span className="f-mono" style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>якщо {w.if}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {w.steps.map((s, j) => (
              <span key={j} className="f-mono" style={{ fontSize: 11.5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 10px' }}>
                {j + 1}. {stepText(s)}
                {s.type === 'webhook' && s.connection && connections[s.connection] === false && (
                  <span style={{ color: 'var(--danger)', fontWeight: 700 }}> · не підключено</span>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}

      <div className="f-mono" style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-mute)', fontWeight: 600, marginTop: 16, marginBottom: 6 }}>
        Останні виконання
      </div>
      {forbidden ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Потрібна роль адміністратора або власника.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <tbody>
            {(runs ?? []).map((r) => (
              <tr key={r.idempotencyKey} className="hoverable">
                <td style={{ padding: '7px 10px 7px 0', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {new Date(r.createdAt).toLocaleString('uk-UA')}
                </td>
                <td className="f-mono" style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>
                  {r.workflowOn}
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: RUN_COLOR[r.status], fontWeight: 600 }}>{RUN_LABEL[r.status]}</span>
                  {r.error && (
                    <span className="f-mono" style={{ marginLeft: 8, color: 'var(--danger)', fontSize: 11.5 }}>
                      {r.error.slice(0, 120)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {runs?.length === 0 && (
              <tr>
                <td style={{ padding: 12, color: 'var(--text-mute)' }}>
                  Виконань ще немає — події обробляються автоматично cron-дреном.
                </td>
              </tr>
            )}
            {runs === null && (
              <tr><td style={{ padding: 12, color: 'var(--text-mute)' }}>Завантаження…</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
