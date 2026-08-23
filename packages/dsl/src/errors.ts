export interface AppDefinitionIssue {
  /** Шлях усередині визначення, наприклад "entities[0].fields[2].target" */
  readonly path: string;
  readonly message: string;
  readonly code:
    | 'invalid_structure'
    | 'duplicate_name'
    | 'unknown_reference'
    | 'invalid_default';
}

/** Єдина типізована помилка парсера. Агрегує всі проблеми, а не першу. */
export class AppDefinitionError extends Error {
  readonly issues: ReadonlyArray<AppDefinitionIssue>;

  constructor(issues: ReadonlyArray<AppDefinitionIssue>) {
    const summary =
      issues.length === 1
        ? `${issues[0]?.path}: ${issues[0]?.message}`
        : `${issues.length} проблем(и) — ${issues
            .map((i) => `${i.path}: ${i.message}`)
            .join('; ')}`;
    super(`AppDefinition: ${summary}`);
    this.name = 'AppDefinitionError';
    this.issues = issues;
  }
}
