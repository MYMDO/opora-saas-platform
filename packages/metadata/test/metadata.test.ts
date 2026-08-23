import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryMetadataPort, MetadataError } from '../src';

let fixture: unknown;

beforeAll(() => {
  fixture = JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', 'packages', 'dsl', 'fixtures', 'service-desk.json'),
      'utf-8',
    ),
  );
});

describe('MemoryMetadataPort', () => {
  it('createApp → 409-подібний already_exists на дублікат', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('service-desk', 'Service Desk');
    await expect(port.createApp('service-desk', 'Інша')).rejects.toMatchObject({
      code: 'already_exists',
    });
  });

  it('draft → publish → getActive повертає published definition', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('service-desk', 'Service Desk');

    const draft = await port.createDraft('service-desk', fixture);
    expect(draft.version).toBe(1);
    expect(draft.status).toBe('draft');
    expect((await port.getActive('service-desk')) === null).toBe(true);

    const published = await port.publish('service-desk', 1);
    expect(published.status).toBe('published');

    const active = await port.getActive('service-desk');
    expect(active?.version).toBe(1);
    expect(active?.definition.entities.map((e) => e.apiName)).toEqual(['contact', 'ticket']);
  });

  it('новий draft не змінює активний release (runtime стабільний)', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('sd', 'SD');
    await port.createDraft('sd', fixture);
    await port.publish('sd', 1);
    await port.createDraft('sd', structuredClone(fixture));

    const active = await port.getActive('sd');
    expect(active?.version).toBe(1);

    await expect(port.publish('sd', 1)).rejects.toBeInstanceOf(MetadataError);
    const v2 = await port.publish('sd', 2);
    expect(v2.version).toBe(2);
  });

  it('невалідне визначення → invalid_definition з issues', async () => {
    const port = new MemoryMetadataPort();
    await port.createApp('bad', 'Bad');
    const invalid = { app: { slug: 'bad-app', name: 'Bad' }, entities: [], pages: [] };
    await expect(port.createDraft('bad', invalid)).rejects.toMatchObject({
      code: 'invalid_definition',
    });
  });

  it('not_found для невідомого застосунку/версії', async () => {
    const port = new MemoryMetadataPort();
    await expect(port.createDraft('ghost', fixture)).rejects.toMatchObject({ code: 'not_found' });
    await expect(port.publish('ghost', 9)).rejects.toMatchObject({ code: 'not_found' });
  });
});
