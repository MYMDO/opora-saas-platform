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
});
