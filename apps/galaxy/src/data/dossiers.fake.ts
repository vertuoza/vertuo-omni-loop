// The dossiers beside the stubbed galaxy (galaxy.fake.ts), for the planet's DOSSIER tab: the dossiers
// table read as one signed-in person under the row-level security of
// supabase/migrations/20260928090000_dossiers.sql (a member reads their workspace's dossiers, nobody
// reads another's), and the two functions the tab reads, dossier_list(p_dossier, p_workspace) and
// dossier_rounds(p_dossier), which run as the caller: a dossier they may not read lists nothing and has
// no round. Every other table and function is the galaxy fake's. It answers the query shapes
// src/data/dossiers.ts sends, records every one, and nothing else; the functions' own rules are proved
// by supabase/checks/dossiers.sql, not here.
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { DossierListRow, DossierRoundRow } from '../dossier/store';
import { isFakeTable, type fakeGalaxyDb, type FakeUser } from './galaxy.fake';

type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };

/** A dossier as the database holds it, with what dossier_list() and dossier_rounds() give for it. */
export type FakeDossier = { row: DossierListRow; rounds: DossierRoundRow[] };

/** One call the dossier layer received: the dossiers table's query with its `eq` filters, or a function with its arguments. */
export type DossierCall =
  | { kind: 'from'; table: 'dossiers'; eq: Record<string, unknown> }
  | { kind: 'rpc'; fn: 'dossier_list' | 'dossier_rounds'; args: Record<string, unknown> };

/** A copy of a value as JSON carries it, read back as unknown. */
const copyOf = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** The arguments of a call, copied as JSON carries them. */
const copyArgs = (args: Record<string, unknown>): Record<string, unknown> => {
  const copy = copyOf(args);
  return isRecord(copy) ? copy : {};
};

export function withDossiers(world: ReturnType<typeof fakeGalaxyDb>, dossiers: FakeDossier[] = []) {
  const calls: DossierCall[] = [];
  /**
   * `failOn`: the dossiers table, one function, or every call about one dossier (its id), out of reach.
   * `gone`: dossiers deleted between the table's read and the functions', which then find nothing.
   */
  // failOn: 'dossiers', 'dossier_list', 'dossier_rounds', or a dossier's id.
  const state: { failOn: string | null; gone: Set<string> } = { failOn: null, gone: new Set<string>() };
  const refused = (what: string): Result => ({ data: null, error: { message: `fake: ${what} is out of reach` } });

  function client(me: FakeUser | null) {
    const base = world.client(me);
    const readable = (d: FakeDossier) =>
      Boolean(me && world.tables.workspace_members.some((m) => m.workspace_id === d.row.workspace_id && m.user_id === me.id));

    class DossierQuery implements PromiseLike<Result> {
      private columns = '*';
      private eqs: Record<string, unknown> = {};
      select(columns = '*') { this.columns = columns; return this; }
      eq(column: string, value: unknown) { this.eqs[column] = value; return this; }
      then: PromiseLike<Result>['then'] = (done, failed) => Promise.resolve(this.run()).then(done, failed);
      private run(): Result {
        calls.push({ kind: 'from', table: 'dossiers', eq: { ...this.eqs } });
        if (world.state.fail) return { data: null, error: world.state.fail };
        if (state.failOn === 'dossiers') return refused('dossiers');
        const names = this.columns.split(',').map((c) => c.trim());
        const rows = dossiers
          .filter(readable)
          .filter((d) => Object.entries(this.eqs).every(([column, value]) => propertyOf(d.row, column) === value))
          .map((d) => Object.fromEntries(names.map((n) => [n, copyOf(propertyOf(d.row, n))])));
        return { data: rows, error: null };
      }
    }

    async function rpc(fn: string, args?: Record<string, unknown>): Promise<Result> {
      if (fn !== 'dossier_list' && fn !== 'dossier_rounds') return base.rpc(fn, args);
      calls.push({ kind: 'rpc', fn, args: copyArgs(args ?? {}) });
      if (world.state.fail) return { data: null, error: world.state.fail };
      const id = args?.p_dossier;
      if (state.failOn === fn || (typeof id === 'string' && state.failOn === id)) return refused(fn);
      const mine = dossiers.filter(readable).filter((d) => !state.gone.has(d.row.id)).filter((d) => id === null || id === undefined || d.row.id === id)
        .filter((d) => typeof args?.p_workspace !== 'string' || d.row.workspace_id === args.p_workspace);
      return { data: copyOf(fn === 'dossier_list' ? mine.map((d) => d.row) : mine.flatMap((d) => d.rounds)), error: null };
    }

    return {
      ...base,
      from: (table: string) => {
        if (table === 'dossiers') return new DossierQuery();
        if (isFakeTable(table)) return base.from(table);
        throw new Error(`fake: no table ${table}`);
      },
      rpc,
    };
  }

  return { calls, state, client };
}
