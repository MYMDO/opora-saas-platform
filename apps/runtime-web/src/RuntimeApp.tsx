import { useEffect, useMemo, useState } from 'react';
import { client } from './client';
import { EntityWorkspace } from './EntityWorkspace';
import { BuilderList } from './BuilderList';
import { ReleaseManager } from './ReleaseManager';

type Route =
  | { view: 'runtime'; slug: string; entity: string | null }
  | { view: 'builder'; appSlug: string | null };

function parseHash(): Route {
  const h = window.location.hash;
  if (h.startsWith('#/builder')) {
    const appMatch = /app=([a-z0-9-]+)/.exec(h);
    return { view: 'builder', appSlug: appMatch?.[1] ?? null };
  }
  const m = /^#\/([a-z0-9-]+)(?:\/([a-z0-9_]+))?/.exec(h);
  if (m && m[1] && m[1] !== 'builder') {
    return { view: 'runtime', slug: m[1], entity: m[2] ?? null };
  }
  return { view: 'runtime', slug: 'service-desk', entity: null };
}

export default function RuntimeApp() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (hash: string) => {
    window.location.hash = hash;
  };

  const [schema, setSchema] = useState<Awaited<ReturnType<typeof client.getSchema>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeSlug = route.view === 'runtime' ? route.slug : null;

  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    setError(null); setSchema(null);
    client.getSchema(activeSlug)
      .then((s) => !cancelled && setSchema(s))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, [activeSlug]);

  const activeEntity = useMemo(() => {
    if (!schema || route.view !== 'runtime' || !route.entity) return schema?.definition.entities[0] ?? null;
    return schema.definition.entities.find((e) => e.apiName === route.entity) ?? null;
  }, [schema, route]);

  return (
    <div className="opora-root" style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="panel hidden-desktop" style={{ width: 220, borderRadius: 0, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px' }}>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 700 }}>ОПОРА</div>
          <div className="f-mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>PLATFORM</div>
        </div>
        <nav style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <button className={`nav-item ${route.view === 'builder' ? 'active' : ''}`}
            onClick={() => navigate('#/builder')}>Builder</button>
          {schema && (
            <>
              <div className="f-mono" style={{ fontSize: 10, color: 'var(--text-mute)', padding: '6px 12px 2px' }}>
                {schema.definition.app.name}
              </div>
              {schema.definition.entities.map((e) => (
                <button key={e.apiName}
                  className={`nav-item ${route.view === 'runtime' && activeEntity?.apiName === e.apiName ? 'active' : ''}`}
                  onClick={() => navigate(`#/${activeSlug}/${e.apiName}`)}>
                  {e.label}
                </button>
              ))}
            </>
          )}
          {!schema && activeSlug && (
            <span className="f-mono" style={{ fontSize: 11, color: 'var(--text-mute)', padding: '6px 12px' }}>
              Завантаження…
            </span>
          )}
        </nav>
        <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
          <div className="f-mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
            tenant: demo · v{schema?.version ?? '—'}
          </div>
        </div>
      </div>

      <main style={{ flex: 1, minWidth: 0, padding: '20px 22px' }}>
        {route.view === 'builder' && (
          <BuilderList onOpenApp={(slug: string) => navigate(`#/builder?app=${slug}`)} />
        )}
        {route.view === 'builder' && route.appSlug && (
          <ReleaseManager appSlug={route.appSlug} />
        )}

        {route.view === 'runtime' && error && (
          <div className="panel" role="alert" style={{ padding: 24 }}>
            <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 4 }}>
              Не вдалося завантажити схему
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 8 }}>{error}</div>
            <button className="btn btn-surface" onClick={() => window.location.reload()}>Спробувати знову</button>
          </div>
        )}
        {route.view === 'runtime' && !error && !schema && (
          <div className="f-mono" style={{ color: 'var(--text-mute)', padding: 20 }}>Завантаження published-схеми…</div>
        )}
        {route.view === 'runtime' && schema && activeEntity && (
          <EntityWorkspace
            key={`${schema.version}:${activeEntity.apiName}`}
            schema={schema}
            entity={activeEntity}
            pages={schema.definition.pages.filter((p) => p.entity === activeEntity.apiName)}
          />
        )}
        {route.view === 'runtime' && schema && schema.definition.entities.length === 0 && (
          <div className="panel" style={{ padding: 24 }}>
            У застосунку ще немає сутностей.
          </div>
        )}
      </main>
    </div>
  );
}
