// What a store's database call answers, and the error a store throws when the database refused or
// failed: `code` is Postgres's, `reason` the database's own words. Each store names its own subclass.

export type Outcome<T> = { data: T | null; error: { code?: string; message: string } | null };

export class StoreError extends Error {
  readonly code: string | undefined;
  readonly reason: string;

  constructor(what: string, code: string | undefined, reason: string) {
    super(`${what}: ${reason}`);
    this.code = code;
    this.reason = reason;
  }
}
