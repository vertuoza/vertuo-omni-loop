// A stubbed Supabase client for the roadmaps' tests: the roadmaps and roadmap_prds tables in memory,
// the workspaces' products, the Auth server's token check, and roadmap_push() of
// supabase/migrations/20261109090000_roadmaps.sql written here as the migration writes it:
//
// - refused 42501 for a caller signed out or with no workspace for the repository (the fake's
//   repo_workspace(): the member workspace whose GitHub org owns the repository, else the one joined
//   first);
// - the product matched by name, case aside, among the workspace's own: a name matching none is
//   filed under none and answered as `unknownProduct`;
// - the first push of a repository's roadmap number creates it; a later one, by any member, replaces
//   its fields, document, questions and PRD rows.
//
// The body is trusted: the route validated it, and the database's own checks are proved by
// supabase/checks/roadmaps.sql, not here. Reading runs under the migration's policies: a member of the
// roadmap's workspace reads it and its PRDs.
import { parseIssue, parsePrd, type IssueNumber, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { RoadmapPrdState, RoadmapQuestion } from './store';

type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };
type Row = Record<string, unknown>;

/** An account, and the workspaces it belongs to in the order it joined them. */
export type FakeAccount = { id: string; email: string | null; workspaces: string[] };

/** A workspace of the fake: the GitHub org it owns, and the names of its products. */
export type FakeWorkspace = { org: string; products: string[] };

type FakeRoadmap = {
  id: string; workspace_id: string; repo: string; number: IssueNumber; title: string; milestone: string; product_id: string | null;
  target_date: string | null; source: string | null; questions: RoadmapQuestion[]; document: string; pushed_by: string | null;
  created_at: string; pushed_at: string;
};
type FakePrd = {
  roadmap_id: string; position: number; row_id: string; prd: PrdNumber; title: string; repos: string[]; blockers: string[];
  wave: number; state: RoadmapPrdState; waits_on: string | null; waits_on_url: string | null; started_at: string | null; ended_at: string | null;
};

const verdictOn = (account: FakeAccount | undefined) =>
  account === undefined ? { data: { user: null }, error: { status: 401 } } : { data: { user: { id: account.id, email: account.email } }, error: null };

const refused = (code: string, message: string): Result => ({ data: null, error: { code, message } });
const textOf = (value: unknown) => (typeof value === 'string' ? value : null);
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const rowOf = (value: unknown): Row => (typeof value === 'object' && value !== null ? { ...value } : {});
const productId = (workspace: string, name: string) => `product:${workspace}:${name}`;

/** `accounts`: token → account. `workspaces`: workspace id → its org and products. `now`: the clock, in ms. */
export function fakeRoadmaps(accounts: Record<string, FakeAccount>, workspaces: Record<string, FakeWorkspace>, now: () => number) {
  const tables: { roadmaps: FakeRoadmap[]; roadmap_prds: FakePrd[] } = { roadmaps: [], roadmap_prds: [] };
  const calls: Array<{ fn: string; args: Row }> = [];
  let ids = 0;
  const at = () => new Date(now()).toISOString();
  const newId = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;

  function place(me: FakeAccount, repo: string): { workspace: string } | { refusal: string } {
    const org = repo.split('/')[0];
    const owners = Object.keys(workspaces).filter((workspace) => workspaces[workspace]?.org.toLowerCase() === org);
    if (owners.length === 0) {
      const first = me.workspaces[0];
      return first ? { workspace: first } : { refusal: `no workspace owns ${repo} yet — install the Omni App` };
    }
    const member = me.workspaces.find((workspace) => owners.includes(workspace));
    return member ? { workspace: member } : { refusal: `you are not a member of the workspace which owns ${repo}` };
  }

  function prdRows(roadmapId: string, sent: unknown): FakePrd[] {
    return listOf(sent).map((value, index) => {
      const row = rowOf(value);
      return {
        roadmap_id: roadmapId, position: index + 1, row_id: String(row.id), prd: parsePrd(Number(row.prd)), title: String(row.title).trim(),
        repos: listOf(row.repos).map((r) => String(r).toLowerCase()), blockers: listOf(row.blockers).map(String), wave: Number(row.wave),
        state: RoadmapPrdState.parse(row.state), waits_on: textOf(row.waitsOn)?.trim() || null, waits_on_url: textOf(row.waitsOnUrl),
        started_at: textOf(row.startedAt), ended_at: textOf(row.endedAt),
      };
    });
  }

  function roadmapPush(me: FakeAccount | null, args: Row): Result {
    calls.push({ fn: 'roadmap_push', args });
    if (!me) return refused('42501', 'Sign in first.');
    const body = rowOf(args.p_body);
    const repo = (textOf(body.repo) ?? '').trim().toLowerCase();
    const placed = place(me, repo);
    if ('refusal' in placed) return refused('42501', placed.refusal);
    const { workspace } = placed;

    const named = textOf(body.product)?.trim() || null;
    const product = named === null ? undefined : workspaces[workspace]?.products.find((p) => p.toLowerCase() === named.toLowerCase());
    const number = parseIssue(Number(body.number));
    const fields = {
      title: String(body.title).trim(), milestone: String(body.milestone).trim(),
      product_id: product === undefined ? null : productId(workspace, product), target_date: textOf(body.target),
      source: textOf(body.source)?.trim() || null, questions: listOf(body.questions).map((q) => RoadmapQuestion.parse(q)),
      document: String(body.document), pushed_by: me.id, pushed_at: at(),
    };

    let roadmap = tables.roadmaps.find((r) => r.workspace_id === workspace && r.repo === repo && r.number === number);
    const created = roadmap === undefined;
    if (roadmap === undefined) {
      roadmap = { id: newId(), workspace_id: workspace, repo, number, created_at: at(), ...fields };
      tables.roadmaps.push(roadmap);
    } else {
      Object.assign(roadmap, fields);
    }
    const id = roadmap.id;
    tables.roadmap_prds = [...tables.roadmap_prds.filter((p) => p.roadmap_id !== id), ...prdRows(id, body.prds)];
    return {
      data: { roadmapId: id, created, product: product ?? null, unknownProduct: named !== null && product === undefined ? named : null },
      error: null,
    };
  }

  /** A read of one table as `me`, under the policies. */
  function query<T extends Row>(source: T[], visible: (row: T) => boolean) {
    let rows = source.filter(visible);
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => { rows = rows.filter((r) => r[column] === value); return builder; },
      order: (column: string, { ascending }: { ascending: boolean }) => {
        rows = [...rows].sort((a, b) => {
          const [x, y] = [a[column], b[column]];
          const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
          return ascending ? order : -order;
        });
        return builder;
      },
      maybeSingle: (): Promise<Result> => Promise.resolve({ data: rows[0] ? structuredClone(rows[0]) : null, error: null }),
      then: (resolve: (r: Result) => unknown) => resolve({ data: rows.map((r) => structuredClone(r)), error: null }),
    };
    return builder;
  }

  function client(token: string) {
    const me = accounts[token] ?? null;
    const mine = (workspace: string) => me !== null && me.workspaces.includes(workspace);
    const roadmapIsMine = (roadmapId: string) => tables.roadmaps.some((r) => r.id === roadmapId && mine(r.workspace_id));
    return {
      auth: { getUser: (jwt: string) => Promise.resolve(verdictOn(accounts[jwt])) },
      rpc(fn: string, args: Row): Promise<Result> {
        return Promise.resolve(fn === 'roadmap_push' ? roadmapPush(me, args) : refused('42883', `no function ${fn}`));
      },
      from(table: string) {
        if (table === 'roadmaps') return query(tables.roadmaps, (r) => mine(r.workspace_id));
        if (table === 'roadmap_prds') return query(tables.roadmap_prds, (p) => roadmapIsMine(p.roadmap_id));
        throw new Error(`the fake reads no ${table}`);
      },
    };
  }

  return { tables, calls, client, productId };
}
