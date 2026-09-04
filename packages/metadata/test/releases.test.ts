import { describe, expect, it } from 'vitest';
import { MemoryMetadataPort } from '../src/memory';

const VALID_DEF = {
  app: { slug: 'test-app', name: 'Test App' },
  entities: [
    {
      apiName: 'task',
      label: 'Завдання',
      fields: [{ name: 'title', label: 'Назва', type: 'text', required: true }],
    },
  ],
  pages: [
    { path: '/tasks', label: 'Завдання', entity: 'task', view: { kind: 'table', columns: ['title'] } },
  ],
};

describe('MetadataPort — releases lifecycle', () => {
  it('createDraft → publish → listReleases показує обидва статуси', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('test-app', 'Test App');
    await port.createDraft('test-app', VALID_DEF);
    await port.publish('test-app', 1);
    await port.createDraft('test-app', VALID_DEF);

    const releases = await port.listReleases('test-app');
    expect(releases).toHaveLength(2);
    expect(releases[0]?.version).toBe(2);
    expect(releases[0]?.status).toBe('draft');
    expect(releases[1]?.version).toBe(1);
    expect(releases[1]?.status).toBe('published');
  });

  it('updateDraft змінює тільки draft реліз', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('test-app', 'Test App');
    await port.createDraft('test-app', VALID_DEF);

    const modified = structuredClone(VALID_DEF);
    (modified.app as { name: string }).name = 'Modified Name';
    await port.updateDraft('test-app', 1, modified);

    const releases = await port.listReleases('test-app');
    expect(releases[0]?.version).toBe(1);
    expect(releases[0]?.status).toBe('draft');
  });

  it('updateDraft на published релізі → not_found', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('test-app', 'Test App');
    await port.createDraft('test-app', VALID_DEF);
    await port.publish('test-app', 1);

    await expect(port.updateDraft('test-app', 1, VALID_DEF)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('listReleases для невідомого застосунку повертає порожній масив', async () => {
    const port = new MemoryMetadataPort();
    expect(await port.listReleases('nonexistent')).toEqual([]);
  });

  it('rollback повертає активний реліз на раніший published без втрати історії', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('test-app', 'Test App');
    await port.createDraft('test-app', VALID_DEF);
    await port.publish('test-app', 1);
    await port.createDraft('test-app', VALID_DEF);
    await port.publish('test-app', 2);

    const rolled = await port.rollback('test-app', 1);
    expect(rolled.version).toBe(1);
    expect(rolled.status).toBe('published');
    expect(await port.getActive('test-app')).toMatchObject({ version: 1 });

    const releases = await port.listReleases('test-app');
    expect(releases).toHaveLength(2);
    expect(releases.every((r) => r.status === 'published')).toBe(true);
  });

  it('getRelease повертає будь-який реліз або null', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('test-app', 'Test App');
    await port.createDraft('test-app', VALID_DEF);

    const draft = await port.getRelease('test-app', 1);
    expect(draft?.status).toBe('draft');
    expect(await port.getRelease('test-app', 99)).toBeNull();
    expect(await port.getRelease('ghost', 1)).toBeNull();
  });

  it('rollback на draft або невідомий реліз відхиляється', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('test-app', 'Test App');
    await port.createDraft('test-app', VALID_DEF);
    await port.publish('test-app', 1);
    await port.createDraft('test-app', VALID_DEF);

    await expect(port.rollback('test-app', 2)).rejects.toMatchObject({ code: 'invalid_definition' });
    await expect(port.rollback('test-app', 99)).rejects.toMatchObject({ code: 'not_found' });
    expect(await port.getActive('test-app')).toMatchObject({ version: 1 });
  });
});
