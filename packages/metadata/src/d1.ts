import { parseAppDefinition, type AppDefinition, type AppDefinitionIssue } from '@opora/dsl';
import { MetadataError, type AppMeta, type MetadataPort, type ReleaseMeta, type ReleaseStatus } from './port';

export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  all<T>(): Promise<{ results?: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Executor {
  prepare(sql: string): D1Prepared;
  batch(statements: D1Prepared[]): Promise<Array<{ success: boolean }>>;
}

interface AppRow {
  slug: string;
  name: string;
  active_version: number | null;
}

interface ReleaseRow {
  app_slug: string;
  version: number;
  status: ReleaseStatus;
  definition: string;
  published_at: string | null;
}

function appFrom(row: AppRow): AppMeta {
  return { slug: row.slug, name: row.name, activeVersion: row.active_version };
}

function releaseFrom(row: ReleaseRow): ReleaseMeta {
  return {
    appSlug: row.app_slug,
    version: row.version,
    status: row.status,
    definition: JSON.parse(row.definition) as AppDefinition,
    publishedAt: row.published_at,
  };
}

export class D1MetadataPort implements MetadataPort {
  constructor(private readonly db: D1Executor) {}

  async createApp(slug: string, name: string): Promise<AppMeta> {
    const existing = await this.db
      .prepare('SELECT slug, name, active_version FROM apps WHERE slug = ?1')
      .bind(slug)
      .first<AppRow>();
    if (existing) throw new MetadataError('already_exists', `Застосунок "${slug}" вже існує`);
    await this.db
      .prepare('INSERT INTO apps (slug, name) VALUES (?1, ?2)')
      .bind(slug, name)
      .run();
    return { slug, name, activeVersion: null };
  }

  async listApps(): Promise<AppMeta[]> {
    const { results } = await this.db
      .prepare('SELECT slug, name, active_version FROM apps ORDER BY created_at')
      .all<AppRow>();
    return (results ?? []).map(appFrom);
  }

  async createDraft(appSlug: string, definitionInput: unknown): Promise<ReleaseMeta> {
    await this.mustApp(appSlug);
    let definition: AppDefinition;
    try {
      definition = parseAppDefinition(definitionInput);
    } catch (e) {
      const issues = (e as { issues?: AppDefinitionIssue[] }).issues ?? [];
      throw new MetadataError('invalid_definition', 'Визначення не пройшло валідацію', issues);
    }

    const maxRow = await this.db
      .prepare('SELECT MAX(version) AS v FROM app_releases WHERE app_slug = ?1')
      .bind(appSlug)
      .first<{ v: number | null }>();
    const version = (maxRow?.v ?? 0) + 1;

    await this.db
      .prepare(
        `INSERT INTO app_releases (app_slug, version, status, definition) VALUES (?1, ?2, 'draft', ?3)`,
      )
      .bind(appSlug, version, JSON.stringify(definition))
      .run();

    return { appSlug, version, status: 'draft', definition };
  }

  async publish(appSlug: string, version: number): Promise<ReleaseMeta> {
    const releaseRow = await this.db
      .prepare('SELECT * FROM app_releases WHERE app_slug = ?1 AND version = ?2')
      .bind(appSlug, version)
      .first<ReleaseRow>();
    if (!releaseRow) throw new MetadataError('not_found', `Реліз v${version} не знайдено`);
    if (releaseRow.status === 'published') {
      throw new MetadataError('invalid_definition', `Реліз v${version} уже опубліковано`);
    }
    if (releaseRow.status !== 'draft') {
      throw new MetadataError('invalid_definition', 'Архівний реліз не можна публікувати');
    }

    const ts = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE app_releases SET status = 'published', published_at = ?3 WHERE app_slug = ?1 AND version = ?2",
        )
        .bind(appSlug, version, ts),
      this.db.prepare('UPDATE apps SET active_version = ?2 WHERE slug = ?1').bind(appSlug, version),
    ]);

    return releaseFrom({ ...releaseRow, status: 'published', published_at: ts });
  }

  async rollback(appSlug: string, version: number): Promise<ReleaseMeta> {
    await this.mustApp(appSlug);
    const releaseRow = await this.db
      .prepare('SELECT * FROM app_releases WHERE app_slug = ?1 AND version = ?2')
      .bind(appSlug, version)
      .first<ReleaseRow>();
    if (!releaseRow) throw new MetadataError('not_found', `Реліз v${version} не знайдено`);
    if (releaseRow.status !== 'published') {
      throw new MetadataError('invalid_definition', `Відкотити можна лише на published реліз (v${version} — ${releaseRow.status})`);
    }
    await this.db.prepare('UPDATE apps SET active_version = ?2 WHERE slug = ?1').bind(appSlug, version).run();
    return releaseFrom(releaseRow);
  }

  async listReleases(appSlug: string): Promise<Array<{ version: number; status: string; publishedAt: string | null }>> {
    const { results } = await this.db
      .prepare('SELECT version, status, published_at FROM app_releases WHERE app_slug = ?1 ORDER BY version DESC')
      .bind(appSlug)
      .all<Record<string, unknown>>();
    return (results ?? []).map((r) => ({
      version: Number(r.version),
      status: String(r.status),
      publishedAt: r.published_at == null ? null : String(r.published_at),
    }));
  }

  async updateDraft(appSlug: string, version: number, definitionInput: unknown): Promise<void> {
    await this.mustApp(appSlug);
    const existing = await this.db
      .prepare('SELECT status FROM app_releases WHERE app_slug = ?1 AND version = ?2')
      .bind(appSlug, version)
      .first<{ status: ReleaseStatus }>();
    if (!existing || existing.status !== 'draft') {
      throw new MetadataError('not_found', `Чернетку v${version} не знайдено`);
    }
    const parsedDef = parseAppDefinition(definitionInput);
    await this.db
      .prepare("UPDATE app_releases SET definition = ?3 WHERE app_slug = ?1 AND version = ?2 AND status = 'draft'")
      .bind(appSlug, version, JSON.stringify(parsedDef))
      .run();
  }

  async getActive(
    appSlug: string,
  ): Promise<{ version: number; definition: AppDefinition } | null> {
    const row = await this.db
      .prepare(
        `SELECT r.version AS version, r.definition AS definition
         FROM apps a JOIN app_releases r
           ON r.app_slug = a.slug AND r.version = a.active_version
         WHERE a.slug = ?1 AND r.status = 'published'`,
      )
      .bind(appSlug)
      .first<{ version: number; definition: string }>();
    if (!row) return null;
    return { version: row.version, definition: JSON.parse(row.definition) as AppDefinition };
  }

  async getRelease(appSlug: string, version: number): Promise<ReleaseMeta | null> {
    const row = await this.db
      .prepare('SELECT * FROM app_releases WHERE app_slug = ?1 AND version = ?2')
      .bind(appSlug, version)
      .first<ReleaseRow>();
    return row ? releaseFrom(row) : null;
  }

  private async mustApp(slug: string): Promise<AppRow> {
    const row = await this.db
      .prepare('SELECT slug, name, active_version FROM apps WHERE slug = ?1')
      .bind(slug)
      .first<AppRow>();
    if (!row) throw new MetadataError('not_found', `Застосунок "${slug}" не знайдено`);
    return row;
  }

  async deleteApp(slug: string): Promise<void> {
    await this.mustApp(slug);
    await this.db.batch([
      this.db.prepare('DELETE FROM app_releases WHERE app_slug = ?1').bind(slug),
      this.db.prepare('DELETE FROM apps WHERE slug = ?1').bind(slug),
    ]);
  }
}

