import type { AppDefinition } from '@opora/dsl';
import { parseAppDefinition } from '@opora/dsl';
import {
  MetadataError,
  type AppDefinitionIssue,
  type AppMeta,
  type MetadataPort,
  type ReleaseMeta,
} from './port';

interface StoredRelease extends ReleaseMeta {
  publishedAt: string | null;
}

/** Повна реалізація в памʼяті: тести, локальна розробка. */
export class MemoryMetadataPort implements MetadataPort {
  readonly apps = new Map<string, AppMeta>();
  readonly releases = new Map<string, StoredRelease>(); // key `${slug}#${version}`

  async createApp(slug: string, name: string): Promise<AppMeta> {
    if (this.apps.has(slug)) {
      throw new MetadataError('already_exists', `Застосунок "${slug}" вже існує`);
    }
    const meta: AppMeta = { slug, name, activeVersion: null };
    this.apps.set(slug, meta);
    return { ...meta };
  }

  async listApps(): Promise<AppMeta[]> {
    return [...this.apps.values()].map((a) => ({ ...a }));
  }

  async createDraft(appSlug: string, definitionInput: unknown): Promise<ReleaseMeta> {
    this.mustApp(appSlug);
    let definition: AppDefinition;
    try {
      definition = parseAppDefinition(definitionInput);
    } catch (e) {
      const issues = (e as { issues?: AppDefinitionIssue[] }).issues ?? [];
      throw new MetadataError('invalid_definition', 'Визначення не пройшло валідацію', issues);
    }
    const version = this.nextVersion(appSlug);
    const release: StoredRelease = {
      appSlug,
      version,
      status: 'draft',
      definition,
      publishedAt: null,
    };
    this.releases.set(key(appSlug, version), release);
    return clone(release);
  }

  async publish(appSlug: string, version: number): Promise<ReleaseMeta> {
    this.mustApp(appSlug);
    const release = this.releases.get(key(appSlug, version));
    if (!release) throw new MetadataError('not_found', `Реліз v${version} не знайдено`);
    if (release.status === 'published') {
      throw new MetadataError('invalid_definition', `Реліз v${version} уже опубліковано`);
    }
    release.status = 'published';
    release.publishedAt = new Date().toISOString();
    const meta = this.apps.get(appSlug);
    if (meta) meta.activeVersion = version;
    return clone(release);
  }

  async listReleases(appSlug: string): Promise<Array<{ version: number; status: string; publishedAt: string | null }>> {
    return [...this.releases.values()]
      .filter((r) => r.appSlug === appSlug)
      .map((r) => ({ version: r.version, status: r.status, publishedAt: r.publishedAt ?? null }))
      .sort((a, b) => b.version - a.version);
  }

  async updateDraft(appSlug: string, version: number, definitionInput: unknown): Promise<void> {
    const key = `${appSlug}#${version}`;
    const release = this.releases.get(key);
    if (!release || release.status !== 'draft') {
      throw new MetadataError('not_found', `Чернетку v${version} не знайдено`);
    }
    const def = parseAppDefinition(definitionInput);
    release.definition = def;
  }

  async getActive(
    appSlug: string,
  ): Promise<{ version: number; definition: AppDefinition } | null> {
    const app = this.apps.get(appSlug);
    if (!app || app.activeVersion === null) return null;
    const release = this.releases.get(key(appSlug, app.activeVersion));
    if (!release || release.status !== 'published') return null;
    return { version: release.version, definition: structuredClone(release.definition) };
  }

  private mustApp(slug: string): AppMeta {
    const app = this.apps.get(slug);
    if (!app) throw new MetadataError('not_found', `Застосунок "${slug}" не знайдено`);
    return app;
  }

  async deleteApp(slug: string): Promise<void> {
    this.mustApp(slug);
    this.apps.delete(slug);
    for (const keyStr of [...this.releases.keys()]) {
      if (keyStr.startsWith(`${slug}#`)) this.releases.delete(keyStr);
    }
  }

  private nextVersion(slug: string): number {
    let max = 0;
    for (const keyStr of this.releases.keys()) {
      const [s, v] = keyStr.split('#');
      if (s === slug && Number(v) > max) max = Number(v);
    }
    return max + 1;
  }
}

function key(slug: string, version: number): string {
  return `${slug}#${version}`;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}
