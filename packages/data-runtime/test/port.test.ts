import { describe, expect, it } from 'vitest';
import type { EntityDefinition } from '@opora/dsl';
import { MemoryDataPort } from '../src/memory';
import { validateRecord } from '../src/validate';

const ticketEntity: EntityDefinition = {
  apiName: 'ticket',
  label: 'Заявка',
  fields: [
    { name: 'title', label: 'Тема', type: 'text', required: true, maxLength: 200 },
    {
      name: 'status',
      label: 'Статус',
      type: 'select',
      required: false,
      options: ['new', 'in_progress', 'done'],
      default: 'new',
    },
    { name: 'priority', label: 'Пріоритет', type: 'select', required: false, options: ['low', 'normal', 'high'] },
    { name: 'requester_id', label: 'Заявник', type: 'relation', target: 'contact', required: false, cardinality: 'one' },
    { name: 'due_at', label: 'Термін', type: 'datetime', required: false },
    { name: 'estimate_hours', label: 'Години', type: 'number', required: false, min: 0, max: 1000 },
    { name: 'is_escalated', label: 'Ескаловано', type: 'boolean', required: false },
  ],
};

const ctx = { tenantId: 't1', appSlug: 'service-desk', actorId: null };

describe('validateRecord', () => {
  it('застосовує default і відхиляє невідомі поля', () => {
    expect(() => validateRecord(ticketEntity, { title: 'X', bogus: 1 }, 'create')).toThrow(/bogus/);
    const clean = validateRecord(ticketEntity, { title: 'X' }, 'create');
    expect(clean).toEqual({ title: 'X', status: 'new' });
  });

  it('вимагає required на create, але не на patch', () => {
    expect(() => validateRecord(ticketEntity, {}, 'create')).toThrow(/title/);
    const patched = validateRecord(ticketEntity, { status: 'done', priority: 'high' }, 'patch');
    expect(patched).toEqual({ status: 'done', priority: 'high' });
  });

  it('перевіряє select/number/datetime типи', () => {
    expect(() =>
      validateRecord(ticketEntity, { title: 'T', status: 'nope' }, 'create'),
    ).toThrow(/options/);
    expect(() =>
      validateRecord(ticketEntity, { title: 'T', estimate_hours: -5 }, 'create'),
    ).toThrow(/менше/);
    expect(() => validateRecord(ticketEntity, { title: 'T', due_at: 'oops' }, 'create')).toThrow(
      /ISO/,
    );
  });
});

describe('MemoryDataPort — tenant boundary та audit/outbox', () => {
  it('ізолює записи між тенантами', async () => {
    const port = new MemoryDataPort();
    await port.create({ ...ctx, tenantId: 'a' }, ticketEntity, { title: 'A-квиток' });
    const pageB = await port.list({ ...ctx, tenantId: 'b' }, ticketEntity);
    expect(pageB.rows).toHaveLength(0);
  });

  it('create повертає запис з defaults; get/list фільтрують soft delete', async () => {
    const port = new MemoryDataPort();
    const created = await port.create(ctx, ticketEntity, {
      title: 'Принтер не друкує',
      priority: 'high',
      requester_id: 'contact-1',
    });
    expect(created.data.status).toBe('new');
    expect(created.id).toBeTruthy();

    await port.softDelete(ctx, ticketEntity, created.id);
    expect(await port.get(ctx, ticketEntity, created.id)).toBeNull();
    expect((await port.list(ctx, ticketEntity)).rows).toHaveLength(0);
  });

  it('пише audit event і outbox на create/update/delete', async () => {
    const port = new MemoryDataPort();
    const rec = await port.create(ctx, ticketEntity, { title: 'T1' });
    await port.update(ctx, ticketEntity, rec.id, { priority: 'low' });
    await port.softDelete(ctx, ticketEntity, rec.id);

    const actions = port.state.audit.map((a) => a.action);
    expect(actions).toEqual(['create', 'update', 'delete']);
    expect(port.state.audit[0]?.after).toMatchObject({ title: 'T1', status: 'new' });
    expect(port.state.audit[2]?.before).toMatchObject({ title: 'T1' });

    expect(port.state.outbox.map((o) => o.eventType)).toEqual([
      'ticket.created',
      'ticket.deleted',
    ]);
    expect(port.state.outbox[0]?.tenantId).toBe('t1');
  });

  it('кидає RecordNotFoundError для чужого тенанта при update', async () => {
    const port = new MemoryDataPort();
    const rec = await port.create(ctx, ticketEntity, { title: 'T' });
    await expect(
      port.update({ ...ctx, tenantId: 'other' }, ticketEntity, rec.id, { priority: 'low' }),
    ).rejects.toThrow(/не знайдено/);
  });

  it('aggregate рахує групи з урахуванням фільтрів і тенанта', async () => {
    const port = new MemoryDataPort();
    await port.create(ctx, ticketEntity, { title: 'A', status: 'new' });
    await port.create(ctx, ticketEntity, { title: 'B', status: 'done' });
    await port.create(ctx, ticketEntity, { title: 'C', status: 'done' });
    await port.create({ ...ctx, tenantId: 'other' }, ticketEntity, { title: 'D', status: 'done' });
    const groups = await port.aggregate(ctx, ticketEntity, { groupBy: 'status' });
    expect(groups).toEqual([
      { value: 'done', count: 2 },
      { value: 'new', count: 1 },
    ]);
    const filtered = await port.aggregate(ctx, ticketEntity, { groupBy: 'status', filters: { title: 'A' } });
    expect(filtered).toEqual([{ value: 'new', count: 1 }]);
  });

  it('search шукає підрядок без урахування регістру', async () => {
    const port = new MemoryDataPort();
    await port.create(ctx, ticketEntity, { title: 'Принтер не друкує' });
    await port.create(ctx, ticketEntity, { title: 'Заміна картриджа' });
    const found = await port.list(ctx, ticketEntity, { search: { fields: ['title'], query: 'принтер' } });
    expect(found.rows.map((r) => r.data.title)).toEqual(['Принтер не друкує']);
    const none = await port.list(ctx, ticketEntity, { search: { fields: ['title'], query: 'zzz' } });
    expect(none.rows).toHaveLength(0);
    const all = await port.list(ctx, ticketEntity, { search: { fields: ['title'], query: '   ' } });
    expect(all.rows).toHaveLength(2);
  });
});
