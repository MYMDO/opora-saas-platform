import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { API_BASE, client } from './client';
import { DefinitionEditor, buildFullDefinition, type DefinitionDraft } from './DefinitionEditor';
import { AutomationPanel } from './AutomationPanel';

interface ReleaseInfo {
  version: number;
  status: string;
  publishedAt: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  published: { bg: 'var(--finance-dim)', fg: 'var(--finance)' },
  draft:     { bg: 'var(--ai-dim)',      fg: 'var(--ai)' },
  archived:  { bg: 'var(--surface-2)',   fg: 'var(--text-mute)' },
};

export function ReleaseManager({ appSlug }: { appSlug: string }) {
  const [releases, setReleases] = useState<ReleaseInfo[] | null>(null);
  const [draftJson, setDraftJson] = useState('');
  const [visualDraft, setVisualDraft] = useState<DefinitionDraft | null>(null);

  // Завантажити published schema при mount для ініціалізації редактора
  useEffect(() => {
    client
      .getSchema(appSlug)
      .then((s) => {
        const def = s.definition as unknown as DefinitionDraft;
        setVisualDraft(structuredClone(def));
        setDraftJson((prev) => prev || JSON.stringify(def, null, 2));
      })
      .catch(() => {});
  }, [appSlug]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/apps/${appSlug}/releases`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { releases: ReleaseInfo[] };
      setReleases(body.releases);
    } catch (e) {
      setError(String(e).slice(0, 120));
    }
  }, [appSlug]);

  useEffect(() => { void load(); }, [load, appSlug]);

  async function createDraftFromJson() {
    setError(null); setOkMsg(null);
    try {
      const def = JSON.parse(draftJson);
      const res = await fetch(`${API_BASE}/v1/apps/${appSlug}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(def),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string; issues?: Array<{ message: string }> };
        setError(b.error ?? `HTTP ${res.status}` + (b.issues ? `: ${b.issues.map(i => i.message).join('; ')}` : ''));
        return;
      }
      setOkMsg('Чернетку створено');
      setDraftJson('');
      await load();
    } catch (e) {
      setError(String(e).slice(0, 160));
    }
  }

  async function publish(version: number) {
    setError(null); setOkMsg(null);
    const res = await fetch(`${API_BASE}/v1/apps/${appSlug}/releases/${version}/publish`, { method: 'POST' });
    if (!res.ok) { setError(`Publish failed: HTTP ${res.status}`); return; }
    setOkMsg(`Реліз v${version} опубліковано`);
    await load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Релізи */}
      <div className="panel" style={{ padding: 18 }}>
        <Eyebrow>Релізи застосунку «{appSlug}»</Eyebrow>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 6 }}>{error}</div>}
        {okMsg && <div style={{ color: 'var(--finance)', fontSize: 12.5, marginTop: 4 }}>{okMsg}</div>}
        {!releases && <div style={{ padding: 12, color: 'var(--text-mute)' }}>Завантаження…</div>}
        {releases && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 10 }}>
            <thead><tr><Th>Версія</Th><Th>Статус</Th><Th>Опубліковано</Th><th /></tr></thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.version} className="hoverable">
                  <Td>v{r.version}</Td>
                  <Td><StatusChip status={r.status} /></Td>
                  <Td>{r.publishedAt ? new Date(r.publishedAt).toLocaleString('uk-UA') : '—'}</Td>
                  <Td>{r.status === 'draft' && (
                    <button className="btn btn-solid" style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={() => void publish(r.version)}>Publish</button>
                  )}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Візуальний редактор */}
      <div className="panel" style={{ padding: 18 }}>
        <Eyebrow>Візуальний редактор сутностей</Eyebrow>
        <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 10 }}>
          Додайте сутності та поля — JSON згенерується автоматично
        </div>
        <DefinitionEditor
          draft={visualDraft ?? emptyDraft()}
          appSlug={appSlug}
          appName="Service Desk"
          onChange={(next) => {
            setVisualDraft(next);
            const full = buildFullDefinition(next, appSlug, "Service Desk");
            setDraftJson(JSON.stringify(full, null, 2));
          }}
        />
      </div>

      {/* JSON редактор */}
      <div className="panel" style={{ padding: 18 }}>
        <Eyebrow>DSL визначення (JSON)</Eyebrow>
        <textarea
          className="input-row f-mono"
          rows={14}
          value={draftJson}
          onChange={(e) => setDraftJson(e.target.value)}
          placeholder='{ "app": { "slug": "...", "name": "..." }, ... }'
          style={{ fontSize: 12.5, fontFamily: 'IBM Plex Mono, monospace', width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-solid" onClick={() => void createDraftFromJson()}
            disabled={!draftJson.trim()}>
            Створити чернетку
          </button>
        </div>
      </div>

      {/* Автоматизації */}
      <AutomationPanel appSlug={appSlug} />
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function emptyDraft(): DefinitionDraft {
  return { app: { slug: '', name: '' }, entities: [], pages: [], workflows: [], policies: [] };
}

function Th({ children }: { children?: ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)',
      color: 'var(--text-mute)', fontWeight: 500, fontSize: 11,
      letterSpacing: '.08em', textTransform: 'uppercase',
    }}>{children}</th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{children}</td>;
}

function StatusChip({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: 'var(--surface-2)', fg: 'var(--text-dim)' };
  return <span className="chip" style={{ background: s.bg, color: s.fg }}>{status}</span>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="f-mono" style={{
      fontSize: 10.5, letterSpacing: '.12em',
      textTransform: 'uppercase', color: 'var(--text-mute)',
      fontWeight: 600,
    }}>{children}</div>
  );
}
