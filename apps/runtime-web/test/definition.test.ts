import { describe, expect, it } from 'vitest';
import { buildFullDefinition, type DefinitionDraft } from '../src/DefinitionEditor';

const draft: DefinitionDraft = {
  app: { slug: '', name: '' },
  entities: [],
  pages: [],
  workflows: [{ on: 'ticket.created', steps: [] }],
  policies: [{ effect: 'allow' }],
};

describe('buildFullDefinition', () => {
  it('зберігає workflows та policies візуальних правок', () => {
    const full = buildFullDefinition(draft, 'service-desk', 'Service Desk');
    expect(full.app).toEqual({ slug: 'service-desk', name: 'Service Desk' });
    expect(full.workflows).toHaveLength(1);
    expect(full.policies).toHaveLength(1);
  });
});
