import type { AppDefinition } from '@opora/dsl';

export interface FieldChange {
  name: string;
  changes: string[];
}

export interface EntityChange {
  apiName: string;
  addedFields: string[];
  removedFields: string[];
  changedFields: FieldChange[];
}

export interface DefinitionDiff {
  entities: { added: string[]; removed: string[]; changed: EntityChange[] };
  pages: { added: string[]; removed: string[] };
  policies: { added: string[]; removed: string[]; changed: string[] };
  workflows: { added: string[]; removed: string[]; changed: string[] };
  /** Коди ризиків `kind:detail`, напр. `field_removed:ticket.priority`. */
  risks: string[];
  /** true, коли публікація може зламати дані, доступи або клієнтів. */
  breaking: boolean;
}

const BREAKING_RISK = new Set([
  'entity_removed',
  'field_removed',
  'field_type_changed',
  'field_became_required',
  'policy_removed',
]);

function byKey<T>(items: T[], key: (v: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Порівнює мультимножини ключів: що зʼявилось, що зникло. */
function keyDiff(prevKeys: string[], nextKeys: string[]): { added: string[]; removed: string[] } {
  const prevCount = new Map<string, number>();
  for (const k of prevKeys) prevCount.set(k, (prevCount.get(k) ?? 0) + 1);
  const added: string[] = [];
  for (const k of nextKeys) {
    const left = prevCount.get(k) ?? 0;
    if (left > 0) prevCount.set(k, left - 1);
    else added.push(k);
  }
  const removed: string[] = [];
  for (const [k, left] of prevCount) {
    for (let i = 0; i < left; i++) removed.push(k);
  }
  return { added: added.sort(), removed: removed.sort() };
}

/**
 * Чисте порівняння двох визначень: що зміниться при публікації next
 * поверх prev. Вирази (allow/if) порівнюються як непрозорі рядки.
 */
export function diffAppDefinitions(prev: AppDefinition, next: AppDefinition): DefinitionDiff {
  const risks: string[] = [];

  const prevEntities = byKey(prev.entities, (e) => e.apiName);
  const nextEntities = byKey(next.entities, (e) => e.apiName);
  const entityKeys = keyDiff([...prevEntities.keys()], [...nextEntities.keys()]);
  const changedEntities: EntityChange[] = [];

  for (const apiName of [...prevEntities.keys()]) {
    if (!nextEntities.has(apiName)) {
      risks.push(`entity_removed:${apiName}`);
      continue;
    }
    const prevFields = byKey(prevEntities.get(apiName)![0]!.fields, (f) => f.name);
    const nextFields = byKey(nextEntities.get(apiName)![0]!.fields, (f) => f.name);
    const fieldKeys = keyDiff([...prevFields.keys()], [...nextFields.keys()]);
    const changedFields: FieldChange[] = [];

    for (const name of fieldKeys.removed) risks.push(`field_removed:${apiName}.${name}`);
    for (const name of [...prevFields.keys()]) {
      if (!nextFields.has(name)) continue;
      const from = prevFields.get(name)![0]!;
      const to = nextFields.get(name)![0]!;
      const changes: string[] = [];
      if (from.type !== to.type) {
        changes.push(`type: ${from.type} → ${to.type}`);
        risks.push(`field_type_changed:${apiName}.${name}`);
      }
      if (!from.required && to.required) {
        changes.push('стало обовʼязковим');
        risks.push(`field_became_required:${apiName}.${name}`);
      }
      if (from.label !== to.label) changes.push('змінено підпис');
      if (changes.length > 0) changedFields.push({ name, changes });
    }
    changedFields.sort((a, b) => (a.name < b.name ? -1 : 1));

    if (fieldKeys.added.length > 0 || fieldKeys.removed.length > 0 || changedFields.length > 0) {
      changedEntities.push({ apiName, addedFields: fieldKeys.added, removedFields: fieldKeys.removed, changedFields });
    }
  }
  changedEntities.sort((a, b) => (a.apiName < b.apiName ? -1 : 1));

  const pageKeys = keyDiff(
    prev.pages.map((p) => p.path),
    next.pages.map((p) => p.path),
  );
  for (const path of pageKeys.removed) risks.push(`page_removed:${path}`);

  const policyKey = (p: { resource: string; action: string }): string => `${p.resource}:${p.action}`;
  const prevPolicies = byKey(prev.policies, policyKey);
  const nextPolicies = byKey(next.policies, policyKey);
  const policyKeys = keyDiff([...prevPolicies.keys()], [...nextPolicies.keys()]);
  const changedPolicies: string[] = [];
  for (const k of policyKeys.removed) risks.push(`policy_removed:${k}`);
  for (const k of [...prevPolicies.keys()]) {
    if (!nextPolicies.has(k)) continue;
    const fromAllow = prevPolicies.get(k)!.map((p) => p.allow).sort().join('\n');
    const toAllow = nextPolicies.get(k)!.map((p) => p.allow).sort().join('\n');
    if (fromAllow !== toAllow) {
      changedPolicies.push(k);
      risks.push(`policy_changed:${k}`);
    }
  }
  changedPolicies.sort();

  const prevFlows = byKey(prev.workflows, (w) => w.on);
  const nextFlows = byKey(next.workflows, (w) => w.on);
  const flowKeys = keyDiff([...prevFlows.keys()], [...nextFlows.keys()]);
  const changedFlows: string[] = [];
  for (const k of flowKeys.removed) risks.push(`workflow_removed:${k}`);
  for (const k of [...prevFlows.keys()]) {
    if (!nextFlows.has(k)) continue;
    if (JSON.stringify(prevFlows.get(k)) !== JSON.stringify(nextFlows.get(k))) {
      changedFlows.push(k);
      risks.push(`workflow_changed:${k}`);
    }
  }
  changedFlows.sort();

  risks.sort();
  return {
    entities: { added: entityKeys.added, removed: entityKeys.removed, changed: changedEntities },
    pages: { added: pageKeys.added, removed: pageKeys.removed },
    policies: { added: policyKeys.added, removed: policyKeys.removed, changed: changedPolicies },
    workflows: { added: flowKeys.added, removed: flowKeys.removed, changed: changedFlows },
    risks,
    breaking: risks.some((r) => BREAKING_RISK.has(r.split(':')[0]!)),
  };
}
