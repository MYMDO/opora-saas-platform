import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from './client';

interface AppMeta {
  slug: string;
  name: string;
  activeVersion: number | null;
}

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 13,
};

export function BuilderList({ onOpenApp }: { onOpenApp(slug: string): void }) {
  const [apps, setApps] = useState<AppMeta[] | null>(null);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/apps`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { apps: AppMeta[] };
      setApps(body.apps);
    } catch (e) {
      setError(String(e).slice(0, 120));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    setError(null);
    const res = await fetch(`${API_BASE}/v1/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, name }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setSlug('');
    setName('');
    await load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <div className="f-display" style={{ fontSize: 18, fontWeight: 700 }}>Застосунки</div>
        <div style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 2 }}>
          Створіть застосунок, опублікуйте реліз і відкрийте в Runtime
        </div>
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Slug
            <input className="input-row" value={slug} onChange={(e) => setSlug(e.target.value)}
              placeholder="my-app" maxLength={63}
              style={{ ...inputStyle, width: 180 }} />
          </label>
          <label style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Назва
            <input className="input-row" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Мій застосунок" maxLength={80}
              style={{ ...inputStyle, width: 220 }} />
          </label>
          <button className="btn btn-solid" onClick={() => void create()}
            disabled={!slug.trim() || !name.trim()}>
            Створити
          </button>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      </div>

      {apps && (
        <div className="panel" style={{ padding: 18 }}>
          <Eyebrow>Ваші застосунки</Eyebrow>
          {apps.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-mute)', fontSize: 13 }}>
              Ще немає застосунків.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <Th>Slug</Th><Th>Назва</Th><Th>Активна версія</Th><th />
              </tr></thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.slug} className="hoverable">
                    <Td>{a.slug}</Td>
                    <Td>{a.name}</Td>
                    <Td>{a.activeVersion != null ? `v${a.activeVersion}` : '—'}</Td>
                    <Td>
                      <button className="btn btn-surface" style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => onOpenApp(a.slug)}>
                        Відкрити в Runtime
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)',
    color: 'var(--text-mute)', fontWeight: 500, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{children}</td>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="f-mono" style={{ fontSize: 10.5, letterSpacing: '.12em',
    textTransform: 'uppercase', color: 'var(--text-mute)', fontWeight: 600 }}>{children}</div>;
}
