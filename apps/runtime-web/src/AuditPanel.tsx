import { Fragment, useEffect, useState } from 'react';
import { client, type AuditEvent } from './client';

const ACTION_LABEL: Record<AuditEvent['action'], string> = {
  create: 'створено',
  update: 'змінено',
  delete: 'видалено',
};

const ACTION_COLOR: Record<AuditEvent['action'], string> = {
  create: 'var(--finance)',
  update: 'var(--energy)',
  delete: 'var(--danger)',
};

function changedKeys(e: AuditEvent): string[] {
  if (!e.before || !e.after) return [];
  const keys = new Set([...Object.keys(e.before), ...Object.keys(e.after)]);
  return [...keys].filter((k) => JSON.stringify(e.before?.[k]) !== JSON.stringify(e.after?.[k]));
}

export function AuditPanel() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [action, setAction] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setEvents(null);
    setForbidden(false);
    setError(null);
    client
      .getAudit({ limit: 100, action: action || undefined })
      .then(setEvents)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('403')) setForbidden(true);
        else setError(msg.slice(0, 160));
      });
  }, [action]);

  if (forbidden) {
    return (
      <div className="panel" role="alert" style={{ padding: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Журнал аудиту недоступний</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
          Потрібна роль адміністратора або власника.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="f-display" style={{ fontSize: 18, fontWeight: 700 }}>
              Журнал аудиту
            </div>
            <div className="f-mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
              хто · коли · що змінив {events ? `· ${events.length} подій` : ''}
            </div>
          </div>
          <select
            className="input-row"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">усі дії</option>
            <option value="create">створення</option>
            <option value="update">зміни</option>
            <option value="delete">видалення</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="panel" role="alert" style={{ padding: 18, color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Час', 'Дія', 'Сутність', 'Запис', 'Актор', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text-mute)',
                    fontWeight: 500,
                    fontSize: 11,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((e) => {
              const keys = changedKeys(e);
              const open = expanded === e.id;
              return (
                <Fragment key={e.id}>
                  <tr className="hoverable">
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {new Date(e.occurredAt).toLocaleString('uk-UA')}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: ACTION_COLOR[e.action], fontWeight: 600 }}>
                        {ACTION_LABEL[e.action]}
                      </span>
                    </td>
                    <td className="f-mono" style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                      {e.resourceType}
                    </td>
                    <td className="f-mono" style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                      {e.resourceId.slice(0, 8)}…
                    </td>
                    <td className="f-mono" style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                      {e.actorId ? `${e.actorId.slice(0, 8)}…` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      {(e.before || e.after) && (
                        <button
                          className="btn btn-ghost"
                          onClick={() => setExpanded(open ? null : e.id)}
                        >
                          {open ? 'Сховати' : keys.length > 0 ? `Зміни (${keys.length})` : 'Деталі'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={6} style={{ padding: '6px 12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <pre className="f-mono" style={{ fontSize: 11.5, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {keys.length > 0
                            ? keys.map((k) => `${k}: ${JSON.stringify(e.before?.[k] ?? null)} → ${JSON.stringify(e.after?.[k] ?? null)}`).join('\n')
                            : JSON.stringify(e.after ?? e.before ?? {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {events?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-mute)' }}>
                  Подій ще немає — створіть або змініть запис.
                </td>
              </tr>
            )}
            {events === null && !error && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-mute)' }}>
                  Завантаження…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
