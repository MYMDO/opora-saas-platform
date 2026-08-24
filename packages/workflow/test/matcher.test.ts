import { describe, expect, it } from 'vitest';
import type { AppDefinition } from '@opora/dsl';
import { matchWorkflows } from '../src/matcher';

const def = {
  app: { slug: 'sd', name: 'SD' },
  entities: [{ apiName: 'ticket', label: 'Заявка', fields: [] }],
  pages: [],
  workflows: [
    { on: 'ticket.created', steps: [{ type: 'webhook', connection: 'slack', event: 'x' }] },
    {
      on: 'ticket.updated',
      if: "record.priority == 'high'",
      steps: [{ type: 'assign', field: 'flagged', value: true }],
    },
  ],
} as unknown as AppDefinition;

describe('matchWorkflows', () => {
  it('обирає за сутністю та дією', () => {
    const matched = matchWorkflows(def, { entity: 'ticket', action: 'created' });
    expect(matched).toHaveLength(1);
    expect(matched[0]?.on).toBe('ticket.created');
  });

  it('ігнорує updated-події у MVP рантаймі (захист від циклів)', () => {
    expect(matchWorkflows(def, { entity: 'ticket', action: 'updated' })).toHaveLength(0);
  });

  it('повертає порожньо для чужих подій', () => {
    expect(matchWorkflows(def, { entity: 'contact', action: 'created' })).toHaveLength(0);
  });
});
