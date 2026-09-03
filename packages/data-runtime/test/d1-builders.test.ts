import { describe, expect, it } from 'vitest';
import {
  buildAggregateQuery,
  buildAudit,
  buildInsertRecord,
  buildListQuery,
  buildOutbox,
  buildSoftDelete,
  buildUpdateRecord,
} from '../src/d1';

const sampleRecord = {
  id: 'r-1',
  tenantId: 't1',
  appSlug: 'service-desk',
  entity: 'ticket',
  data: { title: 'T', status: 'new' },
  ownerId: null,
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
};

describe('SQL builders', () => {
  it('insert бʼє по всіх колонках', () => {
    const s = buildInsertRecord(sampleRecord);
    expect(s.sql).toContain('INSERT INTO records');
    expect(s.params).toEqual([
      'r-1',
      't1',
      'service-desk',
      'ticket',
      '{"title":"T","status":"new"}',
      null,
      sampleRecord.createdAt,
      sampleRecord.updatedAt,
    ]);
  });

  it('update фільтрує soft-deleted і серіалізує data', () => {
    const s = buildUpdateRecord('r-1', { title: 'T2' });
    expect(s.sql).toContain('deleted_at IS NULL');
    expect(s.params[0]).toBe('{"title":"T2"}');
    expect(s.params[2]).toBe('r-1');
  });

  it('list додає equality-фільтри через json_extract', () => {
    const s = buildListQuery(
      { tenantId: 't1', appSlug: 'sd', actorId: null },
      'ticket',
      { filters: { status: 'new', priority: 'high' }, limit: 10 },
    );
    expect(s.sql).toContain("json_extract(data, '$.status') = ?4");
    expect(s.sql).toContain("json_extract(data, '$.priority') = ?5");
    expect(s.sql).toContain('LIMIT ?6');
    expect(s.sql).toContain('OFFSET ?7');
    // params: tenant, slug, entity, status, priority, limit=10, offset=0
    expect(s.params.slice(0, 5)).toEqual(['t1', 'sd', 'ticket', 'new', 'high']);
    expect(s.params[5]).toBe(10);
    expect(s.params[6]).toBe(0);
  });

  it('сортування за полем JSON', () => {
    const s = buildListQuery(
      { tenantId: 't1', appSlug: 'sd', actorId: null },
      'ticket',
      { sortBy: 'title', sortDir: 'asc', limit: 50 },
    );
    expect(s.sql).toContain("json_extract(data, '$.title')");
    expect(s.sql).not.toContain('DESC');
  });

  it('owner_id фільтрується через колонку, а не json', () => {
    const s = buildListQuery(
      { tenantId: 't1', appSlug: 'sd', actorId: null },
      'ticket',
      { filters: { owner_id: 'u1' } },
    );
    expect(s.sql).toContain('owner_id = ?4');
    expect(s.sql).not.toContain("$.owner_id");
    expect(s.params).toContain('u1');
  });

  it('ігнорує фільтри з небезпечними ключами', () => {
    const s = buildListQuery(
      { tenantId: 't1', appSlug: 'sd', actorId: null },
      'ticket',
      { filters: { "x'); DROP TABLE records; --": 1 } as unknown as Record<string, never> },
    );
    expect(s.sql).not.toContain('DROP');
  });

  it('soft delete ставить deleted_at лише для живих рядків', () => {
    const s = buildSoftDelete('r-9');
    expect(s.sql).toContain('deleted_at = ?1');
    expect(s.sql).toContain('deleted_at IS NULL');
    expect(s.params[1]).toBe('r-9');
  });

  it('audit серіалізує before/after як JSON', () => {
    const s = buildAudit({
      id: 'a-1',
      tenantId: 't1',
      actorId: null,
      action: 'create',
      resourceType: 'ticket',
      resourceId: 'r-1',
      before: null,
      after: { title: 'T' },
      occurredAt: '2026-08-23T00:00:00.000Z',
    });
    expect(s.params[0]).toBe('a-1');
    expect(s.params[6]).toBeNull();
    expect(s.params[7]).toBe('{"title":"T"}');
    expect(s.params[7]).toBe('{"title":"T"}');
  });

  it('outbox пише тип події та app_slug', () => {
    const s = buildOutbox({
      id: 'o-1',
      appSlug: 'service-desk',
      tenantId: 't1',
      eventType: 'ticket.created',
      payload: { recordId: 'r-1' },
      createdAt: '2026-08-23T00:00:00.000Z',
    });
    expect(s.sql).toContain('app_slug');
    expect(s.params[2]).toBe('service-desk');
    expect(s.params[3]).toBe('ticket.created');
    expect(s.params[4]).toBe('{"recordId":"r-1"}');
  });

  it('aggregate групує через GROUP BY з фільтрами', () => {
    const s = buildAggregateQuery(
      { tenantId: 't1', appSlug: 'sd', actorId: null },
      'ticket',
      'status',
      { priority: 'high' },
    );
    expect(s.sql).toContain("json_extract(data, '$.status')");
    expect(s.sql).toContain('GROUP BY');
    expect(s.sql).toContain('COUNT(*)');
    expect(s.sql).toContain("json_extract(data, '$.priority') = ?4");
  });

  it('aggregate відхиляє небезпечне поле', () => {
    expect(() =>
      buildAggregateQuery({ tenantId: 't1', appSlug: 'sd', actorId: null }, 'ticket', "x'); DROP--", undefined),
    ).toThrow();
  });
});
