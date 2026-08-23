interface Stmt {
  bind(...params: unknown[]): Stmt;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

export type Handler = (params: unknown[]) => unknown;

/** Мінімальний D1-стаб: матчить за підрядком SQL, повертає підготовлений результат */
export class FakeD1 {
  private log: Array<{ sql: string; params: unknown[] }> = [];

  constructor(private handlers: Array<{ test(sql: string): boolean; handle: Handler }>) {}

  prepare(sql: string): Stmt {
    const handler = this.handlers.find((h) => h.test(sql));
    if (!handler) throw new Error(`FakeD1: немає обробника для "${sql}"`);
    const exec = (params: unknown[]) => {
      this.log.push({ sql, params });
      return handler.handle(params) as never;
    };
    const stmt = (params: unknown[]): Stmt => ({
      bind: (...next: unknown[]) => stmt(next.length > 0 ? next : params),
      all: <T>() => Promise.resolve({ results: exec(params) as T[] }),
      first: <T>() => Promise.resolve((exec(params) ?? null) as T),
      run: () => {
        exec(params);
        return Promise.resolve({ success: true });
      },
    });
    return stmt([]);
  }

  calls(sqlFragment: string): Array<{ sql: string; params: unknown[] }> {
    return this.log.filter((c) => c.sql.includes(sqlFragment));
  }
}
