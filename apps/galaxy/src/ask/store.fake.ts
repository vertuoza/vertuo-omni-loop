// A stubbed Supabase client for the ask API's tests: the two ask tables in memory, the Auth server's
// token check, and the row-level security of the migrations (PRD 144: every member of a session's
// workspace reads it and its rounds; only its owner changes or deletes it, asks and answers in it; a
// round is asked only in an open session, and a deleted session takes its rounds with it). A new
// session belongs to the caller's first workspace: which one the database picks is proved by
// supabase/checks/ask.sql, not here. It answers the query
// shapes src/ask/store.ts sends, and nothing else. The database's own rules (a round only moves
// forward, the grants) are proved by supabase/checks/ask.sql, not here. Like the database's trigger, it
// sets `answered_by` the moment a round is answered: the caller on the page, the session owner for
// the terminal. A round's category (PRD 144) is written only through the two functions the database
// has for it, as `rpc`: any member sets or clears it; the model's guess, recorded as the session's
// owner, never overrides a person's.

import { isCategory } from './classify';

type Row = Record<string, unknown>;
type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };

/** An account, and the workspaces it belongs to: the one workspace FAKE_WORKSPACE when none is named. */
export type FakeAccount = { id: string; email: string; workspaces?: string[] };

export const FAKE_WORKSPACE = '00000000-0000-4000-8000-00000000a0a0';
export type FakeTables = { ask_sessions: Row[]; ask_rounds: Row[] };

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

export function fakeSupabase(accounts: Record<string, FakeAccount>, now: () => number = Date.now) {
  const tables: FakeTables = { ask_sessions: [], ask_rounds: [] };
  let next = 0;
  const state = { fail: null as Failure | null, queries: 0 };
  const newId = () => `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`;
  const stamp = () => new Date(now()).toISOString();

  const workspacesOf = (me: FakeAccount) => me.workspaces ?? [FAKE_WORKSPACE];
  const sessionOf = (row: Row, table: keyof FakeTables) =>
    table === 'ask_sessions' ? row : tables.ask_sessions.find((s) => s.id === row.session_id);
  /** Reading: a member of the session's workspace. */
  const visible = (table: keyof FakeTables, row: Row, me: FakeAccount | null) => {
    const session = sessionOf(row, table);
    return Boolean(me && session && workspacesOf(me).includes(session.workspace_id as string));
  };
  /** Changing or deleting: the session's owner, who is a member too. */
  const owned = (table: keyof FakeTables, row: Row, me: FakeAccount | null) =>
    Boolean(visible(table, row, me) && sessionOf(row, table)?.owner === me?.id);

  class Query implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private values: Row = {};
    private filters: Array<(row: Row) => boolean> = [];
    private shape: 'many' | 'single' | 'maybe' = 'many';

    constructor(private table: keyof FakeTables, private me: FakeAccount | null) {}

    select(_columns?: string) { return this; }
    insert(values: Row) { this.op = 'insert'; this.values = values; return this; }
    update(values: Row) { this.op = 'update'; this.values = values; return this; }
    delete() { this.op = 'delete'; return this; }
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
      const rows = this.op === 'insert' ? this.insertRow()
        : this.op === 'update' ? this.updateRows()
        : this.op === 'delete' ? this.deleteRows()
        : this.matching();
      if ('error' in rows) return { data: null, error: rows.error };
      if (this.shape === 'many') return { data: clone(rows), error: null };
      if (rows.length > 1 || (this.shape === 'single' && rows.length === 0)) {
        return { data: null, error: { code: 'PGRST116', message: `JSON object requested, ${rows.length} rows returned` } };
      }
      return { data: clone(rows[0] ?? null), error: null };
    }

    private matching(rule = visible) {
      return tables[this.table].filter((row) => rule(this.table, row, this.me) && this.filters.every((f) => f(row)));
    }

    /** Only the owner's sessions go, and their rounds with them (on delete cascade). */
    private deleteRows(): Row[] {
      if (this.table !== 'ask_sessions') return [];
      const rows = this.matching(owned);
      const gone = new Set(rows.map((r) => r.id));
      tables.ask_sessions = tables.ask_sessions.filter((s) => !gone.has(s.id));
      tables.ask_rounds = tables.ask_rounds.filter((r) => !gone.has(r.session_id));
      return rows;
    }

    private insertRow(): Row[] | { error: Failure } {
      const refused = { error: { code: '42501', message: `new row violates row-level security policy for table "${this.table}"` } };
      if (!this.me) return refused;
      if (this.table === 'ask_sessions') {
        const at = stamp();
        const row = {
          id: newId(), owner: this.me.id, status: 'open', created_at: at, last_seen_at: at, repo: null, branch: null, claude_session_id: null,
          ...clone(this.values),
          workspace_id: workspacesOf(this.me)[0] ?? null,
        };
        if (!row.workspace_id) return refused;
        tables.ask_sessions.push(row);
        return [row];
      }
      const session = tables.ask_sessions.find((s) => s.id === this.values.session_id);
      if (!session || session.owner !== this.me.id || session.status !== 'open') return refused;
      const row = {
        id: newId(), answers: null, answered_via: null, status: 'open', created_at: stamp(), answered_at: null,
        prd: null, skill: null, model: null, tokens: null, cost_usd: null,
        ...clone(this.values),
        answered_by: null, category: null, category_by: null,
      };
      tables.ask_rounds.push(row);
      return [row];
    }

    private updateRows(): Row[] {
      const rows = this.matching(owned);
      for (const row of rows) {
        const answering = this.table === 'ask_rounds' && this.values.status === 'answered' && row.status !== 'answered';
        // No grant reaches these columns: the database refuses them, the functions below write them.
        const { answered_by: _answeredBy, category: _category, category_by: _categoryBy, ...values } = clone(this.values);
        Object.assign(row, values);
        if (answering) {
          row.answered_at = stamp();
          const owner = tables.ask_sessions.find((s) => s.id === row.session_id)?.owner ?? null;
          row.answered_by = row.answered_via === 'terminal' ? owner : this.me?.id ?? null;
        }
      }
      return rows;
    }
  }

  /** `ask_round_categorize` and `ask_round_classified`, as the migration writes them. */
  function call(me: FakeAccount | null, name: string, args: { round_id?: string; new_category?: unknown }): Result {
    state.queries += 1;
    if (state.fail) return { data: null, error: state.fail };
    const { round_id: id, new_category: category } = args;
    if (category !== null && !isCategory(category)) {
      return { data: null, error: { code: '23514', message: 'new row for relation "ask_rounds" violates check constraint "ask_rounds_category_check"' } };
    }
    const round = tables.ask_rounds.find((r) => r.id === id);
    if (name === 'ask_round_categorize') {
      if (!me || !round || !visible('ask_rounds', round, me)) return { data: [], error: null };
      Object.assign(round, { category, category_by: me.id });
      return { data: [{ category: round.category, category_by: round.category_by }], error: null };
    }
    if (name === 'ask_round_classified') {
      const sorted = Boolean(me && round && category !== null && round.category_by === null && owned('ask_rounds', round, me));
      if (sorted) Object.assign(round!, { category, category_by: 'model' });
      return { data: sorted, error: null };
    }
    return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
  }

  /** An rpc's answer, as a list or, through maybeSingle(), one row or null. */
  function rpcResult(run: () => Result) {
    return {
      maybeSingle: () => Promise.resolve().then(() => {
        const result = run();
        if (result.error || !Array.isArray(result.data)) return result;
        if (result.data.length > 1) return { data: null, error: { code: 'PGRST116', message: `JSON object requested, ${result.data.length} rows returned` } };
        return { data: clone(result.data[0] ?? null), error: null };
      }),
      then<A = Result, B = never>(done?: ((value: Result) => A | PromiseLike<A>) | null, failed?: ((reason: unknown) => B | PromiseLike<B>) | null) {
        return Promise.resolve().then(run).then(done, failed);
      },
    };
  }

  /** The client for one bearer token: acting as its account, as the API's real client does. */
  function client(token: string) {
    const me = accounts[token] ?? null;
    return {
      rpc: (name: string, args: { round_id?: string; new_category?: unknown }) => rpcResult(() => call(me, name, args)),
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
