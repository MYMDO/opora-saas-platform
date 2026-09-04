// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { ReleaseManager } from '../src/ReleaseManager';

afterEach(() => cleanup());

const diffPayload = {
  version: 2,
  against: 1,
  diff: {
    entities: { added: ['invoice'], removed: [], changed: [] },
    pages: { added: [], removed: [] },
    policies: { added: [], removed: [], changed: [] },
    workflows: { added: [], removed: [], changed: [] },
    risks: ['field_removed:ticket.priority'],
    breaking: true,
  },
};

vi.stubGlobal(
  'fetch',
  vi.fn(async (url: unknown) => {
    const path = String(url);
    if (path.endsWith('/releases/2/diff')) {
      return { ok: true, json: async () => diffPayload };
    }
    if (path.endsWith('/releases')) {
      return {
        ok: true,
        json: async () => ({
          releases: [
            { version: 1, status: 'published', publishedAt: '2026-09-01T00:00:00.000Z' },
            { version: 2, status: 'draft', publishedAt: null },
          ],
        }),
      };
    }
    if (path.endsWith('/schema')) {
      return {
        ok: true,
        json: async () => ({
          version: 1,
          definition: {
            app: { slug: 'inv', name: 'Inv' },
            entities: [],
            pages: [],
            workflows: [],
          },
        }),
      };
    }
    if (path.endsWith('/workflow-runs?limit=50')) {
      return { ok: true, json: async () => ({ runs: [] }) };
    }
    throw new Error(`неочікуваний запит: ${path}`);
  }),
);

describe('ReleaseManager — diff/rollback', () => {
  it('кнопка Diff показує ризики і breaking-бейдж', async () => {
    render(<ReleaseManager appSlug="inv" />);
    const diffButtons = await screen.findAllByText('Diff');
    expect(diffButtons).toHaveLength(2);
    const draftDiff = diffButtons[1];
    if (!draftDiff) throw new Error('немає кнопки Diff чернетки');
    fireEvent.click(draftDiff);
    expect(await screen.findByText('breaking-ризики')).toBeTruthy();
    expect(screen.getByText('field_removed:ticket.priority')).toBeTruthy();
  });

  it('опублікований реліз має кнопку Відкат', async () => {
    render(<ReleaseManager appSlug="inv" />);
    const diffButtons = await screen.findAllByText('Diff');
    const table = diffButtons[0]?.closest('table');
    if (!table) throw new Error('немає таблиці релізів');
    expect(within(table).getByText('Відкат')).toBeTruthy();
    expect(within(table).getByText('Publish')).toBeTruthy();
  });
});
