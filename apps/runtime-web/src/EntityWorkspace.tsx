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
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ by: string; dir: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');

  const PAGE_SIZE = 20;

  const tablePage = pages.find((p) => p.entity === entity.apiName && p.view.kind === 'table');
  const formPage = pages.find((p) => p.entity === entity.apiName && p.view.kind === 'form');

  const columns = useMemo(() => resolveTableColumns(entity, tablePage), [entity, tablePage]);
  const formFields = useMemo(
    () => resolveFormFields(entity, formPage ?? tablePage),
    [entity, formPage, tablePage],
  );

  async function reload(nextPage = page, nextSort = sort, nextFilters = filters) {
    setRows(null);
    setRows(
      await client.listRecords(schema.definition.app.slug, entity.apiName, {
        filters: Object.keys(nextFilters).length > 0 ? nextFilters : undefined,
        offset: nextPage * PAGE_SIZE,
        limit: PAGE_SIZE,
        sortBy: nextSort?.by,
        sortDir: nextSort?.dir,
      }),
    );
  }

  useEffect(() => {
    setPage(0);
    setFilters({});
    setFilterField('');
    setFilterValue('');
    void reload(0, sort, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.version, entity.apiName]);

  const pickedField = entity.fields.find((f) => f.name === filterField) ?? null;

  function applyFilter() {
    if (!pickedField || filterValue === '') return;
    const next = { ...filters, [pickedField.name]: filterValue };
    setFilters(next);
    setFilterValue('');
    setPage(0);
    void reload(0, sort, next);
  }

  function removeFilter(name: string) {
    const next = { ...filters };
    delete next[name];
    setFilters(next);
    setPage(0);
    void reload(0, sort, next);
  }

  function toggleSort(col: ColumnVM) {
    const next =
      sort?.by === col.name
        ? { by: col.name, dir: sort.dir === 'asc' ? ('desc' as const) : ('asc' as const) }
        : { by: col.name, dir: 'asc' as const };
    setSort(next);
    setPage(0);
    void reload(0, next);
  }

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
              release v{schema.version} · стор. {page + 1} · {rows?.length ?? '…'} на сторінці
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

      <div className="panel" style={{ padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="f-mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>Фільтр:</span>
        <select
          className="input-row"
          value={filterField}
          onChange={(e) => { setFilterField(e.target.value); setFilterValue(''); }}
          style={{ width: 170 }}
        >
          <option value="">— поле —</option>
          {entity.fields.map((f) => (
            <option key={f.name} value={f.name}>{f.label}</option>
          ))}
        </select>
        {pickedField?.type === 'select' ? (
          <select className="input-row" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} style={{ width: 170 }}>
            <option value="">— значення —</option>
            {(pickedField.options ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : pickedField?.type === 'boolean' ? (
          <select className="input-row" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} style={{ width: 130 }}>
            <option value="">—</option>
            <option value="true">так</option>
            <option value="false">ні</option>
          </select>
        ) : (
          <input
            className="input-row"
            type={pickedField?.type === 'number' ? 'number' : 'text'}
            placeholder="значення"
            value={filterValue}
            disabled={!pickedField}
            onChange={(e) => setFilterValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilter(); }}
            style={{ width: 170 }}
          />
        )}
        <button className="btn btn-surface" onClick={applyFilter} disabled={!pickedField || filterValue === ''}>
          Застосувати
        </button>
        {Object.entries(filters).map(([k, v]) => (
          <span
            key={k}
            className="f-mono"
            style={{
              fontSize: 11.5,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '3px 6px 3px 10px',
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            {entity.fields.find((f) => f.name === k)?.label ?? k}: {v}
            <button className="btn btn-icon" onClick={() => removeFilter(k)} title="Прибрати">✕</button>
          </span>
        ))}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((col: ColumnVM) => (
                <th
                  key={col.name}
                  onClick={() => toggleSort(col)}
                  role="button"
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                    color: sort?.by === col.name ? 'var(--text)' : 'var(--text-mute)',
                    fontWeight: 500,
                    fontSize: 11,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                  {sort?.by === col.name && (
                    <span style={{ marginLeft: 4, color: 'var(--ai)' }}>
                      {sort.dir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 6,
            padding: '10px 12px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            className="btn btn-ghost"
            disabled={page === 0 || busy}
            onClick={() => {
              const p = page - 1;
              setPage(p);
              void reload(p);
            }}
          >
            ← Назад
          </button>
          <button
            className="btn btn-ghost"
            disabled={!rows || rows.length < PAGE_SIZE || busy}
            onClick={() => {
              const p = page + 1;
              setPage(p);
              void reload(p);
            }}
          >
            Далі →
          </button>
        </div>
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
