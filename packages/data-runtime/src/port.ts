import type { EntityDefinition } from '@opora/dsl';
import type { Json, Page, QuerySpec, RecordEntity } from './validate';

export interface DataPortContext {
  tenantId: string;
  appSlug: string;
  actorId: string | null;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorId: string | null;
  action: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId: string;
  before: Record<string, Json> | null;
  after: Record<string, Json> | null;
  occurredAt: string;
}

export interface OutboxEvent {
  id: string;
  tenantId: string;
  appSlug: string;
  eventType: string;
  payload: Record<string, Json>;
  createdAt: string;
}

/**
 * Єдиний спосіб доступу до даних застосунків (ADR 0001.2).
 * Реалізації зобовʼязані: ізолювати тенант, писати audit+outbox разом зі змінами.
 */
export interface AggregateGroup {
  value: string | number | boolean | null;
  count: number;
  /** Сума числового поля (null — без sumBy або нема сумовних значень). */
  sum: number | null;
}

export interface DataPort {
  list(ctx: DataPortContext, entity: EntityDefinition, q?: QuerySpec): Promise<Page<RecordEntity>>;
  aggregate(
    ctx: DataPortContext,
    entity: EntityDefinition,
    opts: { groupBy: string; filters?: Record<string, Json>; sumBy?: string },
  ): Promise<AggregateGroup[]>;
  get(ctx: DataPortContext, entity: EntityDefinition, id: string): Promise<RecordEntity | null>;
  create(
    ctx: DataPortContext,
    entity: EntityDefinition,
    data: unknown,
  ): Promise<RecordEntity>;
  update(
    ctx: DataPortContext,
    entity: EntityDefinition,
    id: string,
    patch: unknown,
  ): Promise<RecordEntity>;
  softDelete(ctx: DataPortContext, entity: EntityDefinition, id: string): Promise<void>;
  /** Стрічка аудиту для тенанта (admin only на рівні API) */
  audit(ctx: DataPortContext, opts?: { limit?: number; action?: string }): Promise<AuditEvent[]>;
}
