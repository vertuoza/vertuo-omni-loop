// A stubbed database for the history's read (PRD omni-loop-23): ask_history_page and ask_history_facets
// answered over rows in memory, the way the demo reads them (historyPageOf, historyFacetsOf), and the
// sessions they belong to. What the two functions read in the database (row-level security, the
// search's words, the cursor) is proved by supabase/checks/ask_history_page.sql, not here: this proves
// what the app asks of them and what it makes of their answers. Every call is recorded.
import { historyFacetsOf, historyPageOf, type HistoryFilters, type HistoryRow } from './workspace-history';

type Args = { filters?: HistoryFilters; before?: string | null; page_size?: number };
type Answer = { data: unknown; error: { code: string; message: string } | null };

type HistoryCall ={ name: string; args: Args; columns: string | null };

export function historyDatabase(rows: HistoryRow[]) {
  const calls: HistoryCall[] = [];
  const state: { fail: { code: string; message: string } | null } = { fail: null };
  const answer = (data: unknown): Answer => (state.fail ? { data: null, error: state.fail } : { data, error: null });
  const run = (name: string, args: Args): Answer => {
    const filters = args.filters ?? {};
    if (name === 'ask_history_page') {
      const page = historyPageOf(rows, args.before ? { ...filters, before: args.before } : filters, args.page_size);
      return answer(page.rows.map(({ round, session }) => ({ ...round, session_id: session.id, search: "'words'" })));
    }
    // A count is a bigint: the database may send it as text.
    return answer(historyFacetsOf(rows, filters).map(({ id, matched, total }) => ({ category: id, matched: String(matched), total: String(total) })));
  };
  const db = {
    rpc(name: string, args: Args) {
      const call: HistoryCall = { name, args, columns: null };
      calls.push(call);
      return Object.assign(Promise.resolve().then(() => run(name, args)), {
        /** Only the columns named, as PostgREST answers a select on a function's rows. */
        select(columns: string) {
          call.columns = columns;
          const names = columns.split(',').map((c) => c.trim());
          const answered = Promise.resolve().then(() => {
            const { data, error } = run(name, args);
            const picked = Array.isArray(data) ? data.map((row: Record<string, unknown>) => Object.fromEntries(names.filter((n) => n in row).map((n) => [n, row[n]]))) : data;
            return { data: picked, error };
          });
          // overrideTypes() only retypes the answer: the same answer comes back.
          return Object.assign(answered, { overrideTypes: () => answered });
        },
      });
    },
    from: () => ({
      select: () => ({
        in: (_column: string, ids: string[]) => Promise.resolve(answer(rows.map((r) => r.session).filter((s, i, all) => ids.includes(s.id) && all.indexOf(s) === i))),
      }),
    }),
  };
  // The stub answers only the calls the history's read sends, so it is not a whole Supabase client: a
  // test casts it to the one it stands in for.
  return { db, calls, state };
}
