import { useEffect, useMemo, useState } from 'react';
import { client, type RecordRow } from './client';
import {
  formatCellValue,
  resolveFormFields,
  resolveTableColumns,
  type ColumnVM,
  type FieldLike,
} from './model';

type SchemaVM = NonNullable<Awaited<ReturnType<typeof client.getSchema>>>;
type EntityVM = SchemaVM['definition']['entities'][number];
type PageVM = SchemaVM['definition']['pages'][number];

interface Props {
  schema: SchemaVM;
  entity: EntityVM;
  pages: PageVM[];
}

type Draft = Record<string, unknown>;

function toInputValue(type: string, raw: unknown): string | boolean {
  if (type === 'boolean') return raw === true;
  return raw === undefined || raw === null ? '' : String(raw);
}


export function EntityWorkspace({ schema, entity, pages }: Props) {
  const [rows, setRows] = useState<RecordRow[] | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const tablePage = pages.find((p) => p.entity === entity.apiName && p.view.kind === 'table');
  const formPage = pages.find((p) => p.entity === entity.apiName && p.view.kind === 'form');

  const columns = useMemo(() => resolveTableColumns(entity, tablePage), [entity, tablePage]);
  const formFields = useMemo(
    () => resolveFormFields(entity, formPage ?? tablePage),
    [entity, formPage, tablePage],
  );

  async function reload() {
    setRows(await client.listRecords(schema.definition.app.slug, entity.apiName));
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.version, entity.apiName]);

  function startCreate() {
    setDraftId(null);
    setIssues([]);
    const fresh: Draft = {};
    for (const f of formFields) {
      if ('default' in f && f.default !== undefined) fresh[f.name] = f.default;
      else if (f.type === 'boolean') fresh[f.name] = false;
    }
    setDraft(fresh);
  }

  function startEdit(row: RecordRow) {
    setDraftId(row.id);
    setIssues([]);
    setDraft({ ...row.data });
  }

  async function save() {
    setBusy(true);
    setIssues([]);
    try {
      if (draftId) await client.updateRecord(schema.definition.app.slug, entity.apiName, draftId, draft);
      else await client.createRecord(schema.definition.app.slug, entity.apiName, draft);
      setDraftId(null);
      setDraft({});
      await reload();
    } catch (e) {
      setIssues([String(e).slice(0, 160)]);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Видалити запис?')) return;
    await client.deleteRecord(schema.definition.app.slug, entity.apiName, id);
    await reload();
  }

  function setValue(f: FieldLike, raw: string | boolean) {
    setDraft((prev) => {
      const next = { ...prev };
      if (f.type === 'number') {
        const n = Number(raw);
        next[f.name] = raw === '' ? undefined : Number.isFinite(n) ? n : undefined;
      } else if (f.type === 'boolean') {
        next[f.name] = Boolean(raw);
      } else {
        next[f.name] = raw === '' ? undefined : raw;
      }
      return next;
    });
  }

  const editing = draftId !== null || Object.keys(draft).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="f-display" style={{ fontSize: 18, fontWeight: 700 }}>
              {entity.label}
            </div>
            <div className="f-mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
              release v{schema.version} · {rows?.length ?? '…'} записів
            </div>
          </div>
          {!editing && (
            <button className="btn btn-solid" onClick={startCreate} disabled={busy}>
              + Новий запис
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="panel" style={{ padding: 18 }}>
          <div
            className="f-mono"
            style={{
              fontSize: 10.5,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--text-mute)',
              fontWeight: 600,
            }}
          >
            {draftId ? `Редагування ${draftId.slice(0, 8)}…` : 'Новий запис'}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
              marginTop: 12,
            }}
          >
            {formFields.map((f) => (
              <FieldInput
                key={f.name}
                field={f}
                value={toInputValue(f.type, draft[f.name])}
                onChange={(v) =>
                  setValue({ ...f, type: f.type }, v)
                }
              />
            ))}
          </div>
          {issues.length > 0 && (
            <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{issues.join('; ')}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-solid" onClick={() => void save()} disabled={busy}>
              Зберегти
            </button>
            <button
              className="btn btn-surface"
              onClick={() => {
                setDraftId(null);
                setDraft({});
                setIssues([]);
              }}
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((col: ColumnVM) => (
                <th
                  key={col.name}
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
                  {col.label}
                </th>
              ))}
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row: RecordRow) => (
              <tr key={row.id} className="hoverable">
                {columns.map((col: ColumnVM) => (
                  <td key={col.name} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                    {formatCellValue(row.data[col.name], col.type)}
                  </td>
                ))}
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost" onClick={() => startEdit(row)}>
                    Редагувати
                  </button>{' '}
                  <button className="btn btn-icon" onClick={() => void remove(row.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={{ padding: 24, textAlign: 'center', color: 'var(--text-mute)' }}>
                  Записів немає — створіть перший.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldLike;
  value: string | boolean;
  onChange(v: string | boolean): void;
}) {
  const labelStyle: React.CSSProperties = {
    fontSize: 12.5,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  };
  if (field.type === 'boolean') {
    return (
      <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          style={{ accentColor: 'var(--ai)' }}
        />
        {field.label}
      </label>
    );
  }
  return (
    <label style={labelStyle}>
      {field.label}
      {field.required ? <span style={{ color: 'var(--danger)' }}> *</span> : null}
      {field.type === 'select' ? (
        <select
          className="input-row"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.type === 'longtext' ? (
        <textarea
          className="input-row"
          rows={3}
          value={String(value ?? '')}
          maxLength={'maxLength' in field && typeof field.maxLength === 'number' ? field.maxLength : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input-row"
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'date'
                ? 'date'
                : field.type === 'datetime'
                  ? 'datetime-local'
                  : 'text'
          }
          value={String(value ?? '')}
          maxLength={'maxLength' in field && typeof field.maxLength === 'number' ? field.maxLength : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
