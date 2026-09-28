// A stubbed Supabase client for the arcade's data tests: the workspace tables in memory, read and
// written as one signed-in person under the row-level security of
// supabase/migrations/20260926120000_workspaces.sql (a person reads their own memberships, a member
// reads their workspaces' rows and nothing of another's, a member with GitHub linked writes only
// their own player row), with link_github() and submit_score()
// (supabase/migrations/20260926180000_arcade_scores.sql), and, for the service role only,
// join_workspaces_by_github() (supabase/migrations/20261001090000_github_sign_up.sql, by the rule
// src/data/github-orgs.ts states). It answers the query shapes src/data sends, records every one,
// and nothing else. The database's own rules are proved by
// supabase/checks/access.sql, not here.

import { workspacesToJoin, type JoinableWorkspace } from './github-orgs';

type Row = Record<string, unknown>;
type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };

export type FakeUser = { id: string; email: string; github?: { id: number; login: string } };
export type FakeTable = 'workspaces' | 'workspace_members' | 'sectors' | 'teams' | 'players' | 'ledger_events' | 'player_xp' | 'arcade_scores';
export type FakeTables = Record<FakeTable, Row[]>;

/** One call the client received: a table's query with its `eq` filters, or an RPC with its arguments. */
export type FakeCall =
  | { kind: 'from'; table: FakeTable; op: 'select' | 'insert' | 'update'; eq: Record<string, unknown> }
  | { kind: 'rpc'; fn: string; args?: Record<string, unknown> };

/** The highest score submit_score() takes. */
const SCORE_CAP = 9_999_999;

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** `a, b:c, d:table(x, y)` → its items, split on the commas outside parentheses. */
function items(columns: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of columns) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function fakeGalaxyDb(seed: Partial<FakeTables> = {}, users: FakeUser[] = []) {
  const tables: FakeTables = {
    workspaces: [], workspace_members: [], sectors: [], teams: [], players: [], ledger_events: [], player_xp: [], arcade_scores: [],
    ...clone(seed),
  };
  const calls: FakeCall[] = [];
  /** `fail`: every call fails, as a database out of reach; `failOn`: only the reads of one table. */
  const state = { fail: null as Failure | null, failOn: null as FakeTable | null, clock: Date.parse('2026-09-26T09:00:00Z') };
  const stamp = () => new Date((state.clock += 1000)).toISOString();

  const isMember = (me: FakeUser | null, workspace: unknown) =>
    Boolean(me && tables.workspace_members.some((m) => m.workspace_id === workspace && m.user_id === me.id));
  const visible = (table: FakeTable, row: Row, me: FakeUser | null) =>
    table === 'workspaces' ? isMember(me, row.id)
      : table === 'workspace_members' ? Boolean(me && row.user_id === me.id)
        : isMember(me, row.workspace_id);

  /** The row `table` an embedding joins to `row`: a player on the row's workspace and person (the
   * composite key arcade_scores holds), any other table on `<table>_id`. */
  const joined = (table: FakeTable, row: Row) => (table === 'players'
    ? (r: Row) => r.workspace_id === row.workspace_id && r.user_id === row.user_id
    : (r: Row) => r.id === row[`${table.replace(/s$/, '')}_id`]);

  /** A row as `select(columns)` shapes it: aliases (`id:user_id`) and one level of embedding
   * (`workspace:workspaces(id, slug)`, `player:players(display_name)`, under the same security). */
  function project(row: Row, columns: string, me: FakeUser | null): Row {
    if (columns.trim() === '*') return clone(row);
    const out: Row = {};
    for (const item of items(columns)) {
      const m = /^(?:(\w+):)?(\w+)(?:\((.*)\))?$/s.exec(item);
      if (!m) throw new Error(`fake: cannot read the column list item "${item}"`);
      const [, alias, name, inner] = m;
      if (inner === undefined) { out[alias ?? name] = clone(row[name]); continue; }
      const table = name as FakeTable;
      const on = joined(table, row);
      const found = tables[table].find((r) => on(r) && visible(table, r, me));
      out[alias ?? name] = found ? project(found, inner, me) : null;
    }
    return out;
  }

  class Query implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'update' = 'select';
    private values: Row = {};
    private columns = '*';
    private eqs: Record<string, unknown> = {};
    private orders: Array<{ column: string; ascending: boolean }> = [];
    private window: [number, number] | null = null;
    private most: number | null = null;
    private shape: 'many' | 'single' | 'maybe' = 'many';

    constructor(private table: FakeTable, private me: FakeUser | null) {}

    select(columns = '*') { this.columns = columns; return this; }
    insert(values: Row) { this.op = 'insert'; this.values = values; return this; }
    update(values: Row) { this.op = 'update'; this.values = values; return this; }
    eq(column: string, value: unknown) { this.eqs[column] = value; return this; }
    order(column: string, options: { ascending?: boolean } = {}) { this.orders.push({ column, ascending: options.ascending ?? true }); return this; }
    range(from: number, to: number) { this.window = [from, to]; return this; }
    limit(count: number) { this.most = count; return this; }
    single() { this.shape = 'single'; return this; }
    maybeSingle() { this.shape = 'maybe'; return this; }

    then<A = Result, B = never>(done?: ((value: Result) => A | PromiseLike<A>) | null, failed?: ((reason: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve().then(() => this.run()).then(done, failed);
    }

    private run(): Result {
      calls.push({ kind: 'from', table: this.table, op: this.op, eq: { ...this.eqs } });
      if (state.fail) return { data: null, error: state.fail };
      if (state.failOn === this.table) return { data: null, error: { message: `fake: ${this.table} is out of reach` } };
      const rows = this.op === 'insert' ? this.insertRow() : this.op === 'update' ? this.updateRows() : this.matching();
      if ('error' in rows) return { data: null, error: rows.error };
      const shaped = rows.map((row) => project(row, this.columns, this.me));
      if (this.shape === 'many') return { data: shaped, error: null };
      if (shaped.length > 1 || (this.shape === 'single' && shaped.length === 0)) {
        return { data: null, error: { code: 'PGRST116', message: `JSON object requested, ${shaped.length} rows returned` } };
      }
      return { data: shaped[0] ?? null, error: null };
    }

    private matching(): Row[] {
      const rows = tables[this.table]
        .filter((row) => visible(this.table, row, this.me))
        .filter((row) => Object.entries(this.eqs).every(([column, value]) => row[column] === value));
      const sorted = [...rows].sort((a, b) => {
        for (const { column, ascending } of this.orders) {
          const numbers = typeof a[column] === 'number' && typeof b[column] === 'number';
          const x = numbers ? (a[column] as number) : String(a[column] ?? ''), y = numbers ? (b[column] as number) : String(b[column] ?? '');
          if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      });
      const shown = this.window ? sorted.slice(this.window[0], this.window[1] + 1) : sorted;
      return this.most === null ? shown : shown.slice(0, this.most);
    }

    /** A player joins: their own row, in a workspace they belong to, with GitHub linked; the guard
     * copies the login from the linked identity. Only the granted columns may be sent. */
    private insertRow(): Row[] | { error: Failure } {
      const refused = { error: { code: '42501', message: `new row violates row-level security policy for table "${this.table}"` } };
      const me = this.me;
      if (this.table !== 'players' || !me) return refused;
      const granted = ['workspace_id', 'user_id', 'display_name', 'team', 'hero'];
      const extra = Object.keys(this.values).find((k) => !granted.includes(k));
      if (extra) return { error: { code: '42501', message: `permission denied for table players (${extra})` } };
      if (this.values.user_id !== me.id || !isMember(me, this.values.workspace_id) || !me.github) return refused;
      if (tables.players.some((p) => p.workspace_id === this.values.workspace_id && p.user_id === me.id)) {
        return { error: { code: '23505', message: 'duplicate key value violates unique constraint "players_pkey"' } };
      }
      const at = stamp();
      const row = {
        team: null, ...clone(this.values),
        team_since: this.values.team ? at : null, github_id: me.github.id, github_login: me.github.login, created_at: at, updated_at: at,
      };
      tables.players.push(row);
      return [row];
    }

    private updateRows(): Row[] | { error: Failure } {
      const granted = ['display_name', 'team', 'hero'];
      const extra = Object.keys(this.values).find((k) => !granted.includes(k));
      if (extra) return { error: { code: '42501', message: `permission denied for table players (${extra})` } };
      const rows = this.matching().filter((row) => this.table === 'players' && row.user_id === this.me?.id);
      for (const row of rows) {
        if (this.values.team !== undefined && this.values.team !== row.team) row.team_since = stamp();
        Object.assign(row, clone(this.values));
      }
      return rows;
    }
  }

  /** The slugs of every workspace the person belongs to, the one joined first first. */
  const slugsOf = (userId: unknown) => tables.workspace_members.filter((m) => m.user_id === userId)
    .map((m) => ({ at: String(m.joined_at), slug: String(tables.workspaces.find((w) => w.id === m.workspace_id)?.slug) }))
    .sort((a, b) => (a.at === b.at ? (a.slug < b.slug ? -1 : 1) : a.at < b.at ? -1 : 1))
    .map((m) => m.slug);

  async function rpc(me: FakeUser | null, fn: string, args?: Record<string, unknown>, service = false): Promise<Result> {
    calls.push(args === undefined ? { kind: 'rpc', fn } : { kind: 'rpc', fn, args: clone(args) });
    if (state.fail) return { data: null, error: state.fail };
    if (fn === 'join_workspaces_by_github') {
      if (!service) return { data: null, error: { code: '42501', message: 'permission denied for function join_workspaces_by_github' } };
      const { p_user_id: userId, p_logins: logins } = args ?? {};
      if (typeof userId !== 'string') return { data: null, error: { code: '22023', message: 'Joining needs a person.' } };
      const at = stamp();
      const joins = workspacesToJoin((logins ?? []) as string[], tables.workspaces as unknown as (Row & JoinableWorkspace)[]);
      for (const w of joins) {
        if (!tables.workspace_members.some((m) => m.workspace_id === w.id && m.user_id === userId)) {
          tables.workspace_members.push({ workspace_id: w.id, user_id: userId, role: 'member', joined_at: at });
        }
      }
      return { data: slugsOf(userId), error: null };
    }
    if (fn === 'submit_score') {
      // A player of the workspace, with the game in their player_xp row's unlocked, a score from 0 to
      // the cap; the higher of the stored best and the score is kept, and returned.
      const { workspace, game, score } = args ?? {};
      const player = me && tables.players.find((p) => p.workspace_id === workspace && p.user_id === me.id);
      if (!me || !player) return { data: null, error: { code: '42501', message: 'Only a player of this workspace may post a score.' } };
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > SCORE_CAP) {
        return { data: null, error: { code: '22023', message: 'A score is a whole number from 0 to 9,999,999.' } };
      }
      const login = String(player.github_login ?? '').toLowerCase();
      const xp = tables.player_xp.find((x) => x.workspace_id === workspace && x.github_login === login);
      if (!xp || !(xp.unlocked as string[]).includes(String(game))) {
        return { data: null, error: { code: '42501', message: `The game ${game} is not unlocked for this player yet.` } };
      }
      const row = tables.arcade_scores.find((s) => s.workspace_id === workspace && s.user_id === me.id && s.game === game);
      if (!row) tables.arcade_scores.push({ workspace_id: workspace, user_id: me.id, game, best: score, at: stamp() });
      else if (score > (row.best as number)) Object.assign(row, { best: score, at: stamp() });
      return { data: row ? row.best : score, error: null };
    }
    if (!me) return { data: null, error: { code: '42501', message: 'Sign in first.' } };
    if (fn === 'link_github') {
      if (!tables.workspace_members.some((m) => m.user_id === me.id)) {
        return { data: null, error: { code: '42501', message: 'Sign in with an account of a workspace first.' } };
      }
      if (!me.github) return { data: null, error: { code: 'P0002', message: 'No GitHub account is linked to this sign-in yet.' } };
      for (const p of tables.players) if (p.user_id === me.id) Object.assign(p, { github_id: me.github.id, github_login: me.github.login });
      return { data: { github_id: me.github.id, github_login: me.github.login }, error: null };
    }
    return { data: null, error: { code: 'PGRST202', message: `fake: no function ${fn}` } };
  }

  /** The client for one person (null: nobody signed in), acting as them as the server's client does. */
  function client(user: FakeUser | null) {
    return {
      auth: {
        async getUser() {
          return { data: { user: user ? { id: user.id, email: user.email } : null }, error: null };
        },
      },
      from: (table: FakeTable) => new Query(table, user),
      rpc: (fn: string, args?: Record<string, unknown>) => rpc(user, fn, args),
    };
  }

  /** The service role's client, as galaxy's server holds it (SUPABASE_SERVICE_ROLE_KEY): RPCs only. */
  function service() {
    return { rpc: (fn: string, args?: Record<string, unknown>) => rpc(null, fn, args, true) };
  }

  return { tables, calls, state, client, service };
}

// ── Two workspaces, side by side ─────────────────────────────────────────────

export const VERTUOZA = '00000000-0000-4000-8000-00000000000a';
export const ACME = '00000000-0000-4000-8000-00000000000b';

const HERO = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 };
const fleet = (workspace_id: string, name: string, sort: number, retired_at: string | null = null) => ({
  workspace_id, name, label: name.toUpperCase(), color: '#2fc6a4', motto: '', mascot: null, home: null, sort, retired_at,
});
const charted = (workspace_id: string, title: string) => ({
  workspace_id, id: 'planet:12:charted', at: '2026-09-20T10:00:00Z', type: 'PLANET_CHARTED', planet: 12,
  region: null, contributor: null, team: null, data: { title, captain: 'ada-gh' },
});
const xpRow = (workspace_id: string, github_login: string, xp: number, level: number, unlocked: string[]) => ({
  workspace_id, github_login, xp, level, unlocked, computed_at: '2026-09-26T09:45:00Z',
});
export const score = (workspace_id: string, user_id: string, best: number, at: string, game = 'invaders') => ({
  workspace_id, user_id, game, best, at,
});
const player = (workspace_id: string, user_id: string, display_name: string, team: string, github_login: string) => ({
  workspace_id, user_id, display_name, team, team_since: '2026-09-21T10:00:00Z', hero: HERO, github_id: 1, github_login,
});

/**
 * People: ADA, a Vertuoza player; WILE, an Acme player; BOTH, a player of each (Acme joined
 * first); BEA, a member of the vertuoza org on GitHub, in no workspace yet; UNA, a session from
 * before GitHub sign-in, no GitHub linked, in none; EVE, in no org any workspace joins.
 */
export const PEOPLE = {
  ada: { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com', github: { id: 11, login: 'ada-gh' } },
  wile: { id: '00000000-0000-4000-8000-0000000000b1', email: 'wile@acme.test', github: { id: 21, login: 'wile-gh' } },
  both: { id: '00000000-0000-4000-8000-0000000000c1', email: 'both@vertuoza.com', github: { id: 31, login: 'both-gh' } },
  bea: { id: '00000000-0000-4000-8000-0000000000d1', email: 'bea@vertuoza.com', github: { id: 41, login: 'bea-gh' } },
  una: { id: '00000000-0000-4000-8000-0000000000d2', email: 'una@vertuoza.com' },
  eve: { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@example.com' },
} satisfies Record<string, FakeUser>;

/** Vertuoza and Acme, each with its fleets, a sector, a planet #12 and its players. */
export function twoWorkspaces(): Partial<FakeTables> {
  const { ada, wile, both } = PEOPLE;
  return {
    workspaces: [
      { id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-plan', github_installation_id: 91001, github_account_type: 'Organization', theme: {} },
      { id: ACME, slug: 'acme', name: 'Acme', github_org: 'acme', plan_repo: 'acme-plan', github_installation_id: 91002, github_account_type: 'Organization', theme: { plasma: '#2fc6a4', 'plasma-dark': '#178a80' } },
    ],
    workspace_members: [
      { workspace_id: VERTUOZA, user_id: ada.id, role: 'member', joined_at: '2026-09-26T08:00:00Z' },
      { workspace_id: ACME, user_id: wile.id, role: 'member', joined_at: '2026-09-26T08:00:00Z' },
      { workspace_id: ACME, user_id: both.id, role: 'member', joined_at: '2026-09-26T07:00:00Z' },
      { workspace_id: VERTUOZA, user_id: both.id, role: 'member', joined_at: '2026-09-26T08:00:00Z' },
    ],
    sectors: [
      { workspace_id: VERTUOZA, name: 'core-belt', repos: ['vertuo-core'] },
      { workspace_id: ACME, name: 'mesa', repos: ['acme-api'] },
    ],
    teams: [
      fleet(VERTUOZA, 'beaver', 10), fleet(VERTUOZA, 'pirates', 50), fleet(VERTUOZA, 'invincible-team', 60, '2026-09-25T00:00:00Z'),
      fleet(ACME, 'roadrunners', 10),
    ],
    players: [
      player(VERTUOZA, ada.id, 'ADA', 'pirates', 'ada-gh'),
      player(ACME, wile.id, 'WILE', 'roadrunners', 'wile-gh'),
      player(ACME, both.id, 'BOTH', 'roadrunners', 'both-gh'),
      player(VERTUOZA, both.id, 'BOTH', 'beaver', 'both-gh'),
    ],
    ledger_events: [charted(VERTUOZA, 'Workspaces'), charted(ACME, 'Anvils')],
    // As the game workflow writes them (supabase/migrations/20260926170000_game_room.sql): a row per
    // lower-cased login the workspace's ledger names, player or not (BEA has no player row yet).
    player_xp: [
      xpRow(VERTUOZA, 'ada-gh', 180, 3, ['invaders']),
      xpRow(VERTUOZA, 'both-gh', 500, 5, ['invaders']),
      xpRow(VERTUOZA, 'bea-gh', 10, 1, ['invaders']),
      xpRow(ACME, 'both-gh', 60, 2, ['invaders']),
    ],
    // Each player's best at Entropy Invaders, as submit_score() keeps them.
    arcade_scores: [
      score(VERTUOZA, ada.id, 1240, '2026-09-26T08:30:00Z'),
      score(VERTUOZA, both.id, 385, '2026-09-26T08:40:00Z'),
      score(ACME, wile.id, 9210, '2026-09-26T08:50:00Z'),
    ],
  };
}

/** Supabase Auth's user for one of the people, as the page reads it: a first name, and the GitHub
 * identity they signed in with (none for a session from before GitHub sign-in). */
export function authUser(person: FakeUser) {
  const local = person.email.split('@')[0];
  return {
    id: person.id, email: person.email, aud: 'authenticated', app_metadata: {}, created_at: '2026-09-01T00:00:00Z',
    user_metadata: { given_name: local.charAt(0).toUpperCase() + local.slice(1), full_name: `${local} Doe` },
    identities: person.github ? [{ provider: 'github', identity_data: { user_name: person.github.login } }] : [],
  };
}
