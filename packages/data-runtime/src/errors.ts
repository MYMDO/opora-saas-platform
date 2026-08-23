export class RecordNotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity}/${id}: запис не знайдено`);
    this.name = 'RecordNotFoundError';
  }
}

export class ValidationError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>;

  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join('; '));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
