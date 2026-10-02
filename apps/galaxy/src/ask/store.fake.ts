// A stubbed Supabase client for the ask API's tests: the two ask tables in memory, the Auth server's
// token check, and the row-level security of the migrations (PRD 144: every member of a session's
// workspace reads it and its rounds; only its owner changes or deletes it, asks and answers in it; a
// round is asked only in an open session, and a deleted session takes its rounds with it). A new
// session belongs to the caller's first workspace, and one in no workspace is refused with the
// database's reason: which one the database picks, and every refusal, is proved by
// supabase/checks/ask.sql, not here. It answers the query
// shapes src/ask/store.ts sends, and nothing else. The database's own rules (a round only moves
// forward, the grants) are proved by supabase/checks/ask.sql, not here. Like the database's trigger, it
// sets `answered_by` the moment a round is answered: the caller on the page, the session owner for
// the terminal. A round's category (PRD 144) is written only through the two functions the database
// has for it, as `rpc`: any member sets or clears it; the model's guess, recorded as the session's
// owner, never overrides a person's. A round is shared (PRD 144, step 4) only through
// `ask_round_share`, by the session's owner with another member of its workspace; the member it is
// shared with may then answer it on the page while it is open, and nothing else. `ask_members` lists
// a workspace's members to anyone in it.

import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { isCategory } from './classify';

type Row = Record<string, unknown>;

/** A value the fake's rows and calls hold as text, or undefined. */
const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };

/** An account, and the workspaces it belongs to: the one workspace FAKE_WORKSPACE when none is named. */
export type FakeAccount = { id: string; email: string; workspaces?: string[]; name?: string };

export const FAKE_WORKSPACE = '00000000-0000-4000-8000-00000000a0a0';
export type FakeTables = { ask_sessions: Row[]; ask_rounds: Row[]; ask_shares: Row[] };

/** A deep copy, as the database answers one: through JSON, so a key holding undefined is dropped. */
const clone = (value: unknown): unknown => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const isRow = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
/** A row's deep copy, as `clone` makes it. */
function cloneRow(row: Row): Row {
  const copy = clone(row);
  if (!isRow(copy)) throw new Error('a row did not copy as a row');
  return copy;
}

export function fakeSupabase(accounts: Record<string, FakeAccount>, now: () => number = Date.now) {
  const tables: FakeTables = { ask_sessions: [], ask_rounds: [], ask_shares: [] };
  let next = 0;
  const state: { fail: Failure | null; queries: number } = { fail: null, queries: 0 };
  const newId = () => `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`;
  const stamp = () => new Date(now()).toISOString();

  const workspacesOf = (me: FakeAccount) => me.workspaces ?? [FAKE_WORKSPACE];
  const sessionOf = (row: Row, table: keyof FakeTables): Row | undefined => {
    if (table === 'ask_sessions') return row;
    if (table === 'ask_rounds') return tables.ask_sessions.find((s) => s.id === row.session_id);
    const round = tables.ask_rounds.find((r) => r.id === row.round_id);
    return round && sessionOf(round, 'ask_rounds');
  };
  /** Reading: a member of the session's workspace; a share, also the member it names. */
  const visible = (table: keyof FakeTables, row: Row, me: FakeAccount | null) => {
    const session = sessionOf(row, table);
    if (table === 'ask_shares' && me && row.shared_with === me.id) return true;
    return Boolean(me && session && isOneOf(workspacesOf(me), session.workspace_id));
  };
  /** A round shared with the caller, who still belongs to its session's workspace. */
  const sharedWithMe = (round: Row, me: FakeAccount | null) =>
    Boolean(me && visible('ask_rounds', round, me) && tables.ask_shares.some((s) => s.round_id === round.id && s.shared_with === me.id));
  /** Changing or deleting: the session's owner, who is a member too. */
  const owned = (table: keyof FakeTables, row: Row, me: FakeAccount | null) =>
    visible(table, row, me) && sessionOf(row, table)?.owner === me?.id;

  class Query implements PromiseLike<Result> {
    private table: keyof FakeTables;
    private me: FakeAccount | null;
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private values: Row = {};
    private filters: Array<(row: Row) => boolean> = [];
    private shape: 'many' | 'single' | 'maybe' = 'many';
    private sorting: { column: string; ascending: boolean } | null = null;
    private cap: number | null = null;

    constructor(table: keyof FakeTables, me: FakeAccount | null) {
      this.table = table;
      this.me = me;
    }

    // Every column, whichever are named: the type keeps the callers' argument, the fake reads none.
    select: (columns?: string) => Query = () => this;
    insert(values: Row) { this.op = 'insert'; this.values = values; return this; }
    update(values: Row) { this.op = 'update'; this.values = values; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
    in(column: string, values: unknown[]) { this.filters.push((row) => values.includes(row[column])); return this; }
    order(column: string, { ascending = true }: { ascending?: boolean } = {}) { this.sorting = { column, ascending }; return this; }
    limit(count: number) { this.cap = count; return this; }
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
        : this.ordered(this.matching());
      if ('error' in rows) return { data: null, error: rows.error };
      if (this.shape === 'many') return { data: clone(rows), error: null };
      if (rows.length > 1 || (this.shape === 'single' && rows.length === 0)) {
        return { data: null, error: { code: 'PGRST116', message: `JSON object requested, ${rows.length} rows returned` } };
      }
      return { data: clone(rows[0] ?? null), error: null };
    }

    /** `order()` then `limit()`, as PostgREST applies them to a read. */
    private ordered(rows: Row[]): Row[] {
      const { sorting, cap } = this;
      const sorted = sorting
        ? [...rows].sort((a, b) => String(a[sorting.column]).localeCompare(String(b[sorting.column])) * (sorting.ascending ? 1 : -1))
        : rows;
      return cap === null ? sorted : sorted.slice(0, cap);
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
      const rounds = new Set(tables.ask_rounds.filter((r) => gone.has(r.session_id)).map((r) => r.id));
      tables.ask_rounds = tables.ask_rounds.filter((r) => !rounds.has(r.id));
      tables.ask_shares = tables.ask_shares.filter((s) => !rounds.has(s.round_id));
      return rows;
    }

    private insertRow(): Row[] | { error: Failure } {
      const refused = { error: { code: '42501', message: `new row violates row-level security policy for table "${this.table}"` } };
      // No grant writes a share: ask_round_share() does.
      if (!this.me || this.table === 'ask_shares') return refused;
      if (this.table === 'ask_sessions') {
        const at = stamp();
        const row = {
          id: newId(), owner: this.me.id, status: 'open', created_at: at, last_seen_at: at, repo: null, branch: null, claude_session_id: null,
          ...cloneRow(this.values),
          workspace_id: workspacesOf(this.me)[0] ?? null,
        };
        // Like the trigger (repo_workspace(), PRD 459): a session with nowhere to go is refused with the reason.
        if (!row.workspace_id) {
          return { error: { code: '42501', message: `no workspace owns ${typeof row.repo === 'string' ? row.repo : 'this repository'} yet — install the Omni App` } };
        }
        tables.ask_sessions.push(row);
        return [row];
      }
      const session = tables.ask_sessions.find((s) => s.id === this.values.session_id);
      if (!session || session.owner !== this.me.id || session.status !== 'open') return refused;
      const row = {
        id: newId(), answers: null, answered_via: null, status: 'open', created_at: stamp(), answered_at: null,
        prd: null, skill: null, model: null, tokens: null, cost_usd: null,
        ...cloneRow(this.values),
        answered_by: null, category: null, category_by: null,
      };
      tables.ask_rounds.push(row);
      return [row];
    }

    private updateRows(): Row[] | { error: Failure } {
      if (this.table !== 'ask_rounds') return this.applyUpdate(this.matching(owned));
      // The owner's rule, or a shared member's: an open round, answered on the page and nothing else.
      const theirs = this.matching(owned);
      const shared = this.matching((_t, row, me) => row.status === 'open' && !theirs.includes(row) && sharedWithMe(row, me));
      if (shared.length > 0 && !(this.values.status === 'answered' && this.values.answered_via === 'page')) {
        return { error: { code: '42501', message: 'new row violates row-level security policy for table "ask_rounds"' } };
      }
      return this.applyUpdate([...theirs, ...shared]);
    }

    private applyUpdate(rows: Row[]): Row[] {
      for (const row of rows) {
        const answering = this.table === 'ask_rounds' && this.values.status === 'answered' && row.status !== 'answered';
        // No grant reaches these columns: the database refuses them, the functions below write them.
        const values = cloneRow(this.values);
        delete values.answered_by;
        delete values.category;
        delete values.category_by;
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
  function call(me: FakeAccount | null, name: string, args: Record<string, unknown> & { round_id?: string; new_category?: unknown }): Result {
    state.queries += 1;
    if (state.fail) return { data: null, error: state.fail };
    if (name === 'ask_round_share') return share(me, { p_round_id: textOf(args.p_round_id), p_member: textOf(args.p_member) });
    if (name === 'ask_members') return members(me, textOf(args.workspace));
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
      if (sorted && round) Object.assign(round, { category, category_by: 'model' });
      return { data: sorted, error: null };
    }
    return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
  }

  /** `ask_round_share`: the session's owner shares a round with another member of its workspace. */
  function share(me: FakeAccount | null, { p_round_id: id, p_member: member }: { p_round_id?: string; p_member?: string }): Result {
    const round = tables.ask_rounds.find((r) => r.id === id);
    const session = round && sessionOf(round, 'ask_rounds');
    const place = textOf(session?.workspace_id);
    const target = Object.values(accounts).find((a) => a.id === member);
    const ok = Boolean(me && round && place && owned('ask_rounds', round, me) && target && target.id !== me.id && workspacesOf(target).includes(place));
    if (ok && me && !tables.ask_shares.some((s) => s.round_id === id && s.shared_with === member)) {
      tables.ask_shares.push({ round_id: id, shared_with: member, shared_by: me.id, created_at: stamp() });
    }
    return { data: ok, error: null };
  }

  /** `ask_members`: a workspace's members, for someone in it; nobody's for anyone else. */
  function members(me: FakeAccount | null, workspace: string | undefined): Result {
    if (!me || !workspace || !workspacesOf(me).includes(workspace)) return { data: [], error: null };
    const rows = Object.values(accounts)
      .filter((a) => workspacesOf(a).includes(workspace))
      .map((a) => ({ user_id: a.id, email: a.email, name: a.name ?? null }));
    return { data: rows, error: null };
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
      rpc: (name: string, args: Record<string, unknown>) => rpcResult(() => call(me, name, args)),
      auth: {
        getUser(jwt: string) {
          state.queries += 1;
          const account = accounts[jwt];
          return Promise.resolve(account
            ? { data: { user: { id: account.id, email: account.email } }, error: null }
            : { data: { user: null }, error: { name: 'AuthApiError', status: 401, message: 'invalid JWT' } });
        },
      },
      from: (table: keyof FakeTables) => new Query(table, me),
    };
  }

  return { tables, client, state };
}
