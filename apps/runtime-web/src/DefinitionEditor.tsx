import { useState } from 'react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/* Типи                                                               */
/* ------------------------------------------------------------------ */

export interface FieldDraft {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  maxLength?: number;
}

export interface EntityDraft {
  apiName: string;
  label: string;
  fields: FieldDraft[];
}

export interface DefinitionDraft {
  app: { slug: string; name: string };
  entities: EntityDraft[];
  pages: Array<{
    path: string;
    label: string;
    entity: string;
    view: { kind: string; columns?: string[] };
  }>;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'longtext', label: 'Довгий текст' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Так / Ні' },
  { value: 'date', label: 'Дата' },
  { value: 'datetime', label: 'Дата і час' },
  { value: 'select', label: 'Список' },
] as const;

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 13,
};

/* ------------------------------------------------------------------ */
/* Допоміжні                                                          */
/* ------------------------------------------------------------------ */

function Label({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>{children}</span>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="f-mono" style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-mute)', fontWeight: 600 }}>
      {children}
    </div>
  );
}

function autoPagePath(entityApiName: string): string {
  return `/${entityApiName.replace(/_/g, '-')}`;
}

/* ------------------------------------------------------------------ */
/* Головний компонент                                                  */
/* ------------------------------------------------------------------ */

export function DefinitionEditor({
  draft,
  onChange,
  appSlug,
  appName,
}: {
  draft: DefinitionDraft;
  onChange(next: DefinitionDraft): void;
  readonly appSlug: string;
  readonly appName: string;
}) {
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityLabel, setNewEntityLabel] = useState('');
  const [activeEntityIdx, setActiveEntityIdx] = useState(0);

  function addEntity(): void {
    void appSlug; void appName;
    const raw = newEntityName.trim();
    // Автосанітизація: нижній регістр, пробіли → _, видалити недопустимі символи
    let apiName = raw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    // Гарантувати що починається з літери
    if (apiName && /^[0-9]/.test(apiName)) apiName = 'e_' + apiName;
    if (!apiName || draft.entities.some((e) => e.apiName === apiName)) return;
    const next = structuredClone(draft);
    next.entities.push({
      apiName,
      label: newEntityLabel.trim() || apiName,
      fields: [{ name: 'title', label: 'Назва', type: 'text', required: true }],
    });
    next.pages.push({
      path: autoPagePath(apiName),
      label: newEntityLabel.trim() || apiName,
      entity: apiName,
      view: { kind: 'table', columns: ['title'] },
    });
    // Оновити app метадані якщо порожні
    if (!next.app.slug) next.app.slug = appSlug;
    if (!next.app.name) next.app.name = appName;
    onChange(next);
    setNewEntityName('');
    setNewEntityLabel('');
    setActiveEntityIdx(next.entities.length - 1);
  }

  function removeEntity(index: number) {
    if (draft.entities.length <= 1) return;
    const next = structuredClone(draft);
    next.entities.splice(index, 1);
    onChange(next);
    setActiveEntityIdx(Math.min(activeEntityIdx, next.entities.length - 1));
  }

  function addField(entityIdx: number) {
    const next = structuredClone(draft);
    const entity = next.entities[entityIdx];
    if (!entity) return;
    const fieldName = `field_${entity.fields.length + 1}`;
    entity.fields.push({ name: fieldName, label: `Поле ${entity.fields.length + 1}`, type: 'text', required: false });
    onChange(next);
  }

  function removeField(entityIdx: number, fieldIdx: number) {
    const next = structuredClone(draft);
    const entity = next.entities[entityIdx];
    if (!entity || entity.fields.length <= 1) return;
    entity.fields.splice(fieldIdx, 1);
    onChange(next);
  }

  function updateField(entityIdx: number, fieldIdx: number, patch: Partial<FieldDraft>) {
    const next = structuredClone(draft);
    const entity = next.entities[entityIdx];
    if (!entity?.fields[fieldIdx]) return;
    Object.assign(entity.fields[fieldIdx], patch);
    onChange(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Сутності */}
      <div className="panel" style={{ padding: 18 }}>
        <SectionTitle>Сутності</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {draft.entities.map((entity, ei) => (
            <div key={entity.apiName} className="panel" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="f-display" style={{ fontSize: 15, fontWeight: 600 }}>{entity.label}</div>
                  <Label>{entity.apiName} · {entity.fields.length} полів</Label>
                </div>
                {draft.entities.length > 1 && (
                  <button className="btn btn-icon" onClick={() => removeEntity(ei)} title="Видалити сутність">✕</button>
                )}
              </div>

              {/* Поля */}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entity.fields.map((field, fi) => (
                  <div key={fi} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px auto auto', gap: 6, alignItems: 'center' }}>
                    <input className="input-row" value={field.name} placeholder="назва_поля"
                      onChange={(e) => updateField(ei, fi, { name: e.target.value })}
                      style={{ ...inputStyle, fontSize: 12 }} />
                    <input className="input-row" value={field.label} placeholder="Підпис"
                      onChange={(e) => updateField(ei, fi, { label: e.target.value })}
                      style={{ ...inputStyle, fontSize: 12 }} />
                    <select className="input-row" value={field.type}
                      onChange={(e) => updateField(ei, fi, { type: e.target.value })}
                      style={{ ...inputStyle, fontSize: 12 }}>
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input type="checkbox" checked={field.required ?? false}
                        onChange={(e) => updateField(ei, fi, { required: e.target.checked })}
                        style={{ accentColor: 'var(--ai)' }} />
                      Обовʼязк.
                    </label>
                    <button className="btn btn-icon" onClick={() => removeField(ei, fi)}
                      disabled={entity.fields.length <= 1}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 8 }}>
                <button className="btn btn-surface" style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => addField(ei)}>
                  + Поле
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Додати сутність */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <Label>Новa сутність (slug)</Label>
            <input className="input-row" value={newEntityName} onChange={(e) => setNewEntityName(e.target.value)}
              placeholder="напр. invoice" style={{ ...inputStyle, fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <Label>Назва</Label>
            <input className="input-row" value={newEntityLabel} onChange={(e) => setNewEntityLabel(e.target.value)}
              placeholder="Напр. Рахунок" style={{ ...inputStyle, fontSize: 12 }} />
          </label>
          <button className="btn btn-solid" style={{ padding: '8px 14px', fontSize: 12 }}
            onClick={addEntity} disabled={!newEntityName.trim()}>
            + Сутність
          </button>
        </div>
      </div>
    </div>
  );
}

/** Повертає повне AppDefinition з автоматично підставленими app метаданими */
export function buildFullDefinition(
  draft: DefinitionDraft,
  appSlug: string,
  appName: string,
): DefinitionDraft {
  return {
    ...draft,
    app: { slug: appSlug, name: appName },
  };
}

export { FIELD_TYPES };
