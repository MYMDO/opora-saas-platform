import type { AppDefinition, WorkflowDefinition } from '@opora/dsl';

export interface EventRef {
  entity: string;
  action: 'created' | 'updated' | 'deleted';
}

/**
 * Обирає workflow-и, тригер яких збігається з подією.
 * Події `updated` свідомо не обробляються рантаймом MVP (захист від циклів
 * assign→update→trigger); розширення — після впровадження guard-ів у DSL.
 */
export function matchWorkflows(def: AppDefinition, ev: EventRef): WorkflowDefinition[] {
  if (ev.action === 'updated') return [];
  return def.workflows.filter((wf) => wf.on === `${ev.entity}.${ev.action}`);
}
