import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { isFakeTable, type FakeUser, type fakeGalaxyDb } from '../../data/galaxy.fake';

// A stubbed Supabase client for the counts' loader tests (PRD 328): the galaxy's fake database
// (src/data/galaxy.fake.ts) answers the game's tables, and beside it the three ask tables live in
// memory, read as one signed-in person under their row-level security (a member of a session's
// workspace reads the session and its rounds; a share is read by the member it names, and by every
// member of its round's workspace: supabase/checks/ask.sql proves the database's own rules). Membership
// is the galaxy fake's own workspace_members. It answers the reads the counts send, through their own
// count and the ask pages' readers (readTabs, readForMe): select, with or without a count, then eq,
// in, gte and lt, and nothing else. src/ask/store.fake.ts reads no range and counts nothing, so the
// count of the questions you answered cannot run on it.

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null; count?: number | null };

export type AskTable = 'ask_sessions' | 'ask_rounds' | 'ask_shares';
export type AskTables = Record<AskTable, Row[]>;

type Op = 'eq' | 'in' | 'gte' | 'lt';
/** One read of an ask table, as the fake received it. */
export type AskRead = { table: AskTable; filters: Array<{ column: string; op: Op; value: unknown }>; counting: boolean };

const ASK_TABLES: readonly AskTable[] = ['ask_sessions', 'ask_rounds', 'ask_shares'];
const clone = <T>(value: T): T => structuredClone(value);

/** Instants as instants; a range never holds a null. */
const time = (value: unknown) => (typeof value === 'string' ? Date.parse(value) : Number.NaN);
const passes = (cell: unknown, op: Op, value: unknown) =>
  op === 'eq' ? cell === value
    : op === 'in' ? Array.isArray(value) && value.includes(cell)
      : op === 'gte' ? time(cell) >= time(value)
        : time(cell) < time(value);

export function fakeCountsDb(world: ReturnType<typeof fakeGalaxyDb>, seed: Partial<AskTables> = {}) {
  const tables: AskTables = { ask_sessions: [], ask_rounds: [], ask_shares: [], ...clone(seed) };
  const reads: AskRead[] = [];
  /** `failWhen`: the reads that fail, as a database out of reach for them. */
  const state: { failWhen: ((read: AskRead) => boolean) | null } = { failWhen: null };

  const member = (me: FakeUser, workspace: unknown) =>
    world.tables.workspace_members.some((m) => m.workspace_id === workspace && m.user_id === me.id);
  const sessionOf = (table: AskTable, row: Row): Row | undefined => {
    if (table === 'ask_sessions') return row;
    const round = table === 'ask_rounds' ? row : tables.ask_rounds.find((r) => r.id === row.round_id);
    return round && tables.ask_sessions.find((s) => s.id === round.session_id);
  };
  const visible = (table: AskTable, row: Row, me: FakeUser) => {
    if (table === 'ask_shares' && row.shared_with === me.id) return true;
    const session = sessionOf(table, row);
    return Boolean(session && member(me, session.workspace_id));
  };

  class Query implements PromiseLike<Result> {
    private table: AskTable;
    private me: FakeUser | null;
    private filters: AskRead['filters'] = [];
    private counting = false;
    private head = false;

    constructor(table: AskTable, me: FakeUser | null) {
      this.table = table;
      this.me = me;
    }

    select(_columns?: string, options: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean } = {}) {
      this.counting = options.count !== undefined;
      this.head = options.head ?? false;
      return this;
    }
    private where(column: string, op: Op, value: unknown) { this.filters.push({ column, op, value }); return this; }
    eq(column: string, value: unknown) { return this.where(column, 'eq', value); }
    in(column: string, values: readonly unknown[]) { return this.where(column, 'in', [...values]); }
    gte(column: string, value: unknown) { return this.where(column, 'gte', value); }
    lt(column: string, value: unknown) { return this.where(column, 'lt', value); }

    then<A = Result, B = never>(done?: ((value: Result) => A | PromiseLike<A>) | null, failed?: ((reason: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve().then(() => this.run()).then(done, failed);
    }

    private run(): Result {
      const read: AskRead = { table: this.table, filters: clone(this.filters), counting: this.counting };
      reads.push(read);
      if (state.failWhen?.(read)) return { data: null, error: { message: `fake: ${this.table} is out of reach` } };
      const me = this.me;
      const rows = me
        ? tables[this.table].filter((row) => visible(this.table, row, me) && this.filters.every((f) => passes(row[f.column], f.op, f.value)))
        : [];
      if (this.counting) return { data: this.head ? null : clone(rows), error: null, count: rows.length };
      return { data: clone(rows), error: null };
    }
  }

  /** The client for one person (null: nobody signed in): the ask tables here, the rest the galaxy's. */
  function client(user: FakeUser | null) {
    const game = world.client(user);
    return {
      ...game,
      from: (table: string) => {
        if (isOneOf(ASK_TABLES, table)) return new Query(table, user);
        if (isFakeTable(table)) return game.from(table);
        throw new Error(`fake: no table ${table}`);
      },
    };
  }

  return { tables, reads, state, client };
}
