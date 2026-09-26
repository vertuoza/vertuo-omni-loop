// A stubbed Supabase client for the ask API's tests: the two ask tables in memory, the Auth server's
// token check, and the row-level security of the migration (an account sees and changes only its
// own sessions and their rounds; a round is asked only in an open session). It answers the query
// shapes src/ask/store.ts sends, and nothing else. The database's own rules (a round only moves
// forward, the grants) are proved by supabase/checks/ask.sql, not here.

type Row = Record<string, unknown>;
type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };

export type FakeAccount = { id: string; email: string };
export type FakeTables = { ask_sessions: Row[]; ask_rounds: Row[] };

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

export function fakeSupabase(accounts: Record<string, FakeAccount>, now: () => number = Date.now) {
  const tables: FakeTables = { ask_sessions: [], ask_rounds: [] };
  let next = 0;
  const state = { fail: null as Failure | null, queries: 0 };
  const newId = () => `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`;
  const stamp = () => new Date(now()).toISOString();

  const ownsSession = (me: FakeAccount | null, sessionId: unknown) =>
    Boolean(me && tables.ask_sessions.some((s) => s.id === sessionId && s.owner === me.id));
  const visible = (table: keyof FakeTables, row: Row, me: FakeAccount | null) =>
    table === 'ask_sessions' ? Boolean(me && row.owner === me.id) : ownsSession(me, row.session_id);

  class Query implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'update' = 'select';
    private values: Row = {};
    private filters: Array<(row: Row) => boolean> = [];
    private shape: 'many' | 'single' | 'maybe' = 'many';

    constructor(private table: keyof FakeTables, private me: FakeAccount | null) {}

    select(_columns?: string) { return this; }
    insert(values: Row) { this.op = 'insert'; this.values = values; return this; }
    update(values: Row) { this.op = 'update'; this.values = values; return this; }
    eq(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
    in(column: string, values: unknown[]) { this.filters.push((row) => values.includes(row[column])); return this; }
    single() { this.shape = 'single'; return this; }
    maybeSingle() { this.shape = 'maybe'; return this; }

    then<A = Result, B = never>(done?: ((value: Result) => A | PromiseLike<A>) | null, failed?: ((reason: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve().then(() => this.run()).then(done, failed);
    }

    private run(): Result {
      state.queries += 1;
      if (state.fail) return { data: null, error: state.fail };
      const rows = this.op === 'insert' ? this.insertRow() : this.op === 'update' ? this.updateRows() : this.matching();
      if ('error' in rows) return { data: null, error: rows.error };
      if (this.shape === 'many') return { data: clone(rows), error: null };
      if (rows.length > 1 || (this.shape === 'single' && rows.length === 0)) {
        return { data: null, error: { code: 'PGRST116', message: `JSON object requested, ${rows.length} rows returned` } };
      }
      return { data: clone(rows[0] ?? null), error: null };
    }

    private matching() {
      return tables[this.table].filter((row) => visible(this.table, row, this.me) && this.filters.every((f) => f(row)));
    }

    private insertRow(): Row[] | { error: Failure } {
      const refused = { error: { code: '42501', message: `new row violates row-level security policy for table "${this.table}"` } };
      if (!this.me) return refused;
      if (this.table === 'ask_sessions') {
        const at = stamp();
        const row = { id: newId(), owner: this.me.id, status: 'open', created_at: at, last_seen_at: at, ...clone(this.values) };
        tables.ask_sessions.push(row);
        return [row];
      }
      const session = tables.ask_sessions.find((s) => s.id === this.values.session_id);
      if (!session || session.owner !== this.me.id || session.status !== 'open') return refused;
      const row = {
        id: newId(), answers: null, answered_via: null, status: 'open', created_at: stamp(), answered_at: null,
        ...clone(this.values),
      };
      tables.ask_rounds.push(row);
      return [row];
    }

    private updateRows(): Row[] {
      const rows = this.matching();
      for (const row of rows) {
        Object.assign(row, clone(this.values));
        if (this.table === 'ask_rounds' && this.values.status === 'answered') row.answered_at = stamp();
      }
      return rows;
    }
  }

  /** The client for one bearer token: acting as its account, as the API's real client does. */
  function client(token: string) {
    const me = accounts[token] ?? null;
    return {
      auth: {
        async getUser(jwt: string) {
          state.queries += 1;
          const account = accounts[jwt];
          return account
            ? { data: { user: { id: account.id, email: account.email } }, error: null }
            : { data: { user: null }, error: { name: 'AuthApiError', status: 401, message: 'invalid JWT' } };
        },
      },
      from: (table: keyof FakeTables) => new Query(table, me),
    };
  }

  return { tables, client, state };
}
