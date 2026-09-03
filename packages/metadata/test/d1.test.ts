import { describe, expect, it } from 'vitest';
import { D1MetadataPort } from '../src/d1';

class FakeD1 {
  private log: Array<{ sql: string; params: unknown[] }> = [];
  constructor(private handlers: Array<{ test(sql: string): boolean; handle(params: unknown[]): unknown }>) {}
  prepare(sql: string) {
    const h = this.handlers.find((x) => x.test(sql));
    if (!h) throw new Error(`немає обробника: ${sql.slice(0, 40)}`);
    const exec = (params: unknown[]) => {
      this.log.push({ sql, params });
      return h.handle(params);
    };
    const stmt = (params: unknown[]) => ({
      bind: (...p: unknown[]) => stmt(p.length ? p : params),
      all: <T>() => Promise.resolve({ results: exec(params) as T[] }),
      first: <T>() => Promise.resolve((exec(params) ?? null) as T),
      run: () => {
        exec(params);
        return Promise.resolve({ success: true });
      },
    });
    return stmt([]);
  }
  batch(stmts: Array<{ run(): Promise<unknown> }>) {
    return Promise.all(stmts.map((s) => s.run()));
  }
  calls(frag: string) {
    return this.log.filter((c) => c.sql.includes(frag));
  }
}

const appRow = { slug: 'sd', name: 'Service Desk', active_version: null };

describe('D1MetadataPort', () => {
  it('createApp вставляє і повертає мету', async () => {
    const db = new FakeD1([
      { test: (s) => s.includes('FROM apps WHERE slug'), handle: () => null },
      { test: (s) => s.includes('INSERT INTO apps'), handle: () => null },
    ]);
    const port = new D1MetadataPort(db as never);
    const meta = await port.createApp('sd', 'Service Desk');
    expect(meta).toEqual({ slug: 'sd', name: 'Service Desk', activeVersion: null });
  });

  it('createDraft рахує наступну версію через MAX', async () => {
    let maxV: number | null = 3;
    const db = new FakeD1([
      { test: (s) => s.includes('FROM apps WHERE slug'), handle: () => appRow },
      { test: (s) => s.includes('MAX(version)'), handle: () => ({ v: maxV }) },
      { test: (s) => s.includes("INSERT INTO app_releases"), handle: () => null },
    ]);
    const port = new D1MetadataPort(db as never);
    const release = await port.createDraft('sd', minimalDef());
    expect(release.version).toBe(4);

    maxV = null;
    const first = await port.createDraft('sd', minimalDef());
    expect(first.version).toBe(1);
  });

  it('publish оновлює статус і активну версію одним batch', async () => {
    const db = new FakeD1([
      {
        test: (s) => s.includes('FROM app_releases WHERE'),
        handle: () => ({ app_slug: 'sd', version: 2, status: 'draft', definition: JSON.stringify(minimalDef()), published_at: null }),
      },
      { test: (s) => s.includes("UPDATE app_releases SET status"), handle: () => null },
      { test: (s) => s.includes('UPDATE apps SET active_version'), handle: () => null },
    ]);
    const port = new D1MetadataPort(db as never);
    const published = await port.publish('sd', 2);
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBeTruthy();
    expect(db.calls("UPDATE app_releases SET status = 'published'")).toHaveLength(1);
    expect(db.calls('UPDATE apps SET active_version')).toHaveLength(1);
  });

  it('getActive читає JOIN-ом лише published', async () => {
    const db = new FakeD1([
      {
        test: (s) => s.includes('JOIN app_releases'),
        handle: () => ({ version: 2, definition: JSON.stringify(minimalDef()) }),
      },
    ]);
    const active = await new D1MetadataPort(db as never).getActive('sd');
    expect(active?.version).toBe(2);
    expect(active?.definition.app.slug).toBe('service-desk');
  });

  it('deleteApp перевіряє наявність і чистить релізи одним batch', async () => {
    const db = new FakeD1([
      { test: (s) => s.includes('FROM apps WHERE slug'), handle: () => ({ slug: 'sd' }) },
      { test: (s) => s.startsWith('DELETE FROM app_releases'), handle: () => null },
      { test: (s) => s.startsWith('DELETE FROM apps'), handle: () => null },
    ]);
    await new D1MetadataPort(db as never).deleteApp('sd');
    expect(db.calls('DELETE FROM app_releases')).toHaveLength(1);
    expect(db.calls('DELETE FROM apps')).toHaveLength(1);
  });

  it('deleteApp невідомого застосунку → not_found', async () => {
    const db = new FakeD1([
      { test: (s) => s.includes('FROM apps WHERE slug'), handle: () => null },
    ]);
    await expect(new D1MetadataPort(db as never).deleteApp('ghost')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

function minimalDef() {
  return {
    app: { slug: 'service-desk', name: 'Service Desk' },
    entities: [
      {
        apiName: 'ticket',
        label: 'Заявка',
        fields: [{ name: 'title', label: 'Тема', type: 'text', required: true, maxLength: 100 }],
      },
    ],
    pages: [
      { path: '/tickets', label: 'Заявки', entity: 'ticket', view: { kind: 'table', columns: ['title'] } },
    ],
  };
}
