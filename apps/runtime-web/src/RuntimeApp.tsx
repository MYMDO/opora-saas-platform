import { useEffect, useMemo, useState } from 'react';
import { client, type PublishedSchema } from './client';
import { EntityWorkspace } from './EntityWorkspace';

const SLUG_RE = /^[a-z][a-z0-9-]{0,62}$/;

interface Route {
  slug: string;
  entity: string | null;
}

function parseHash(): Route {
  const m = /^#\/([a-z0-9-]+)(?:\/([a-z0-9_]+))?/.exec(window.location.hash);
  if (!m || !m[1]) return { slug: 'service-desk', entity: null };
  return {
    slug: SLUG_RE.test(m[1]) ? m[1] : 'service-desk',
    entity: m[2] ?? null,
  };
}

export default function RuntimeApp() {
  const [route, setRoute] = useState<Route>(parseHash);
  const { slug, entity } = route;
  const [schema, setSchema] = useState<PublishedSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    client
      .getSchema(slug)
      .then((s) => !cancelled && setSchema(s))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const activeEntity = useMemo(() => {
    if (!schema) return null;
    return schema.definition.entities.find((e) => e.apiName === entity) ?? schema.definition.entities[0] ?? null;
  }, [schema, entity]);

  const entityPages = (entityName: string) =>
    schema?.definition.pages.filter((p) => p.entity === entityName) ?? [];

  function navigate(hash: string) {
    window.location.hash = hash;
  }

  return (
    <div className="opora-root" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div className="panel hidden-desktop" style={{ width: 220, borderRadius: 0, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px' }}>
          <div className="f-display" style={{ fontSize: 15, fontWeight: 700 }}>ОПОРА</div>
          <div className="f-mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>RUNTIME</div>
        </div>
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6, flex: 1 }}>
          {schema ? (
            schema.definition.entities.map((e) => (
              <button
                key={e.apiName}
                className={`nav-item ${activeEntity?.apiName === e.apiName ? 'active' : ''}`}
                onClick={() => navigate(`#/${slug}/${e.apiName}`)}
              >
                {e.label}
              </button>
            ))
          ) : (
            <span className="f-mono" style={{ fontSize: 11, color: 'var(--text-mute)', padding: '6px 12px' }}>
              Завантаження…
            </span>
          )}
        </div>
        <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
          <div className="f-mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
            tenant: <b>demo</b> · v{schema?.version ?? '—'}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, padding: '20px 22px' }}>
        <div style={{ marginBottom: 16 }}>
          <div className="f-display" style={{ fontSize: 20, fontWeight: 700 }}>
            {schema?.definition.app.name ?? 'Runtime'}
          </div>
          <div className="f-mono" style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>
            застосунок «{slug}»
          </div>
        </div>

        {error && (
          <div className="panel" role="alert" style={{ padding: 24 }}>
            <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 4 }}>
              Не вдалося завантажити схему
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 8 }}>{error}</div>
            <button className="btn btn-surface" onClick={() => window.location.reload()}>
              Спробувати знову
            </button>
          </div>
        )}
        {!error && !schema && (
          <div className="f-mono" style={{ color: 'var(--text-mute)' }}>
            Завантаження published-схеми…
          </div>
        )}
        {!error && schema && activeEntity && (
          <EntityWorkspace
            key={`${schema.version}:${activeEntity.apiName}`}
            schema={schema}
            entity={activeEntity}
            pages={entityPages(activeEntity.apiName)}
          />
        )}
        {!error && schema && schema.definition.entities.length === 0 && (
          <div className="panel" style={{ padding: 24 }}>
            У цьому застосунку ще немає сутностей — опублікуйте release із сутностями через Builder/API.
          </div>
        )}
      </div>
    </div>
  );
}
