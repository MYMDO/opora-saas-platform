import { AppDefinitionError, type AppDefinitionIssue } from './errors';
import { AppDefinitionSchema, type AppDefinition } from './schema';

/** Zod-проблеми → уніфіковані issues зі шляхами на кшталт "entities[0].label". */
function zodIssues(error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> }): AppDefinitionIssue[] {
  return error.issues.map((i) => ({
    path: i.path.map(String).join('.') || 'root',
    message: i.message,
    code: 'invalid_structure' as const,
  }));
}

function collectDuplicates<T>(items: readonly T[], key: (item: T) => string): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) dupes.push(k);
    else seen.add(k);
  }
  return dupes;
}

/**
 * Єдиний вхід у пакет. Валідує структуру за Zod та референційну цілісність
 * (сторінки→сутності, поля view→поля сутності, relation→сутність,
 * policy/workflow→сутність). Вирази НЕ виконуються і НЕ парсяться.
 *
 * @throws AppDefinitionError — агреговано по всіх знайдених проблемах.
 */
export function parseAppDefinition(input: unknown): AppDefinition {
  const parsed = AppDefinitionSchema.safeParse(input);
  if (!parsed.success) throw new AppDefinitionError(zodIssues(parsed.error));
  const def = parsed.data;

  const issues: AppDefinitionIssue[] = [];

  for (const entity of def.entities) {
    for (const dupe of collectDuplicates(entity.fields, (f) => f.name)) {
      issues.push({
        path: `entities[${entity.apiName}].fields`,
        message: `дублікат поля "${dupe}"`,
        code: 'duplicate_name',
      });
    }
  }

  for (const dupe of collectDuplicates(def.entities, (e) => e.apiName)) {
    issues.push({ path: 'entities', message: `дублікат apiName "${dupe}"`, code: 'duplicate_name' });
  }

  const entityNames = new Set(def.entities.map((e) => e.apiName));

  for (const entity of def.entities) {
    for (const field of entity.fields) {
      if (field.type === 'relation' && !entityNames.has(field.target)) {
        issues.push({
          path: `entities.${entity.apiName}.fields.${field.name}.target`,
          message: `relation веде на неіснуючу сутність "${field.target}"`,
          code: 'unknown_reference',
        });
      }
      if (field.type === 'select' && field.default !== undefined && !field.options.includes(field.default)) {
        issues.push({
          path: `entities.${entity.apiName}.fields.${field.name}.default`,
          message: `default "${field.default}" відсутній у options`,
          code: 'invalid_default',
        });
      }
    }
  }

  for (const dupe of collectDuplicates(def.pages, (p) => p.path)) {
    issues.push({ path: 'pages', message: `дублікат шляху "${dupe}"`, code: 'duplicate_name' });
  }

  for (const page of def.pages) {
    const entity = def.entities.find((e) => e.apiName === page.entity);
    if (!entity) {
      issues.push({
        path: `pages[${page.path}].entity`,
        message: `сторінка посилається на неіснуючу сутність "${page.entity}"`,
        code: 'unknown_reference',
      });
      continue;
    }
    const fieldNames = new Set(entity.fields.map((f) => f.name));
    const listed =
      page.view.kind === 'form' ? page.view.fields : page.view.columns;
    for (const name of listed) {
      if (!fieldNames.has(name)) {
        issues.push({
          path: `pages[${page.path}].view`,
          message: `${page.view.kind} містить невідоме поле "${name}" сутності ${page.entity}`,
          code: 'unknown_reference',
        });
      }
    }
  }

  for (const policy of def.policies) {
    if (!entityNames.has(policy.resource)) {
      issues.push({
        path: `policies[${policy.resource}.${policy.action}]`,
        message: `policy для неіснуючої сутності "${policy.resource}"`,
        code: 'unknown_reference',
      });
    }
  }

  for (const [index, wf] of def.workflows.entries()) {
    const entity = wf.on.split('.')[0] ?? '';
    if (!entityNames.has(entity)) {
      issues.push({
        path: `workflows[${index}].on`,
        message: `тригер для неіснуючої сутності "${entity}"`,
        code: 'unknown_reference',
      });
    }
  }

  if (issues.length > 0) throw new AppDefinitionError(issues);
  return def;
}
