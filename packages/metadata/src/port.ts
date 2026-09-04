export type ReleaseStatus = 'draft' | 'published' | 'archived';

export interface AppMeta {
  slug: string;
  name: string;
  activeVersion: number | null;
}

export interface ReleaseMeta {
  appSlug: string;
  version: number;
  status: ReleaseStatus;
  definition: AppDefinition;
  publishedAt?: string | null;
}

export class MetadataError extends Error {
  readonly code: 'already_exists' | 'not_found' | 'invalid_definition';
  /** Заповнюється для invalid_definition — агреговані проблеми DSL */
  readonly issues?: ReadonlyArray<AppDefinitionIssue>;

  constructor(
    code: MetadataError['code'],
    message: string,
    issues?: ReadonlyArray<AppDefinitionIssue>,
  ) {
    super(issues?.length ? `${message}: ${issues.map((i) => i.path).join(', ')}` : message);
    this.name = 'MetadataError';
    this.code = code;
    if (issues) this.issues = issues;
  }
}

/**
 * Контрольний центр метаданих: версії конфігурації, атомарна публікація.
 * Runtime читає ЛИШЕ published release (блюпринт §10).
 */
export interface MetadataPort {
  createApp(slug: string, name: string): Promise<AppMeta>;
  listApps(): Promise<AppMeta[]>;
  /** Видаляє застосунок і всі його релізи (кидає not_found).
   * Записи даних стають недосяжними (немає active release);
   * audit/outbox-історія свідомо зберігається. */
  deleteApp(slug: string): Promise<void>;
  /** Валідує визначення через @opora/dsl; кидає MetadataError('invalid_definition'). */
  createDraft(appSlug: string, definitionInput: unknown): Promise<ReleaseMeta>;
  publish(appSlug: string, version: number): Promise<ReleaseMeta>;
  /** Повертає активний реліз на раніший published (відкат без втрати історії).
   * Кидає not_found (нема застосунку/релізу), invalid_definition (реліз не published). */
  rollback(appSlug: string, version: number): Promise<ReleaseMeta>;
  getActive(
    appSlug: string,
  ): Promise<{ version: number; definition: AppDefinition } | null>;
  /** Повертає будь-який реліз за версією (draft включно) або null. */
  getRelease(appSlug: string, version: number): Promise<ReleaseMeta | null>;
  listReleases(appSlug: string): Promise<Array<{
    version: number;
    status: string;
    publishedAt: string | null;
  }>>;
  /** Оновлює чернетку релізу (тільки статус draft) */
  updateDraft(appSlug: string, version: number, definitionInput: unknown): Promise<void>;
}

export type { AppDefinitionIssue };

import type { AppDefinition, AppDefinitionIssue } from '@opora/dsl';
