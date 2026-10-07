// A stubbed Supabase client for the roadmaps' tests: the roadmaps and roadmap_prds tables in memory,
// the workspaces' products, the Auth server's token check, and roadmap_push() of
// supabase/migrations/20261110090000_roadmaps.sql written here as the migration writes it:
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
import { fakeClient, fakeRecorder, listOf, objectOf, placeRepo, refused, tableQuery, textOf, type FakeAccount, type FakeResult as Result } from '../data/repo-tables.fake';
import { RoadmapPrdState, RoadmapQuestion } from './store';

export type { FakeAccount } from '../data/repo-tables.fake';

type Row = Record<string, unknown>;

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

const productId = (workspace: string, name: string) => `product:${workspace}:${name}`;

/** `accounts`: token → account. `workspaces`: workspace id → its org and products. `now`: the clock, in ms. */
export function fakeRoadmaps(accounts: Record<string, FakeAccount>, workspaces: Record<string, FakeWorkspace>, now: () => number) {
  const tables: { roadmaps: FakeRoadmap[]; roadmap_prds: FakePrd[] } = { roadmaps: [], roadmap_prds: [] };
  const { calls, at, newId } = fakeRecorder(now);

  function prdRows(roadmapId: string, sent: unknown): FakePrd[] {
    return listOf(sent).map((value, index) => {
      const row = objectOf(value);
      return {
        roadmap_id: roadmapId, position: index + 1, row_id: String(row.id), prd: parsePrd(Number(row.prd)), title: String(row.title).trim(),
        repos: listOf(row.repos).map((r) => String(r).toLowerCase()), blockers: listOf(row.blockers).map(String), wave: Number(row.wave),
        state: RoadmapPrdState.parse(row.state), waits_on: textOf(row.waitsOn)?.trim() || null, waits_on_url: textOf(row.waitsOnUrl),
        started_at: textOf(row.startedAt), ended_at: textOf(row.endedAt),
      };
    });
  }

  /** The product a push names, as sent, and the workspace's own product it matches, case aside. */
  function productOf(workspace: string, body: Row): { named: string | null; product: string | undefined } {
    const named = textOf(body.product)?.trim() || null;
    const product = named === null ? undefined : workspaces[workspace]?.products.find((p) => p.toLowerCase() === named.toLowerCase());
    return { named, product };
  }

  /** The roadmap's fields a push replaces. */
  function fieldsOf(me: FakeAccount, workspace: string, body: Row, product: string | undefined) {
    return {
      title: String(body.title).trim(), milestone: String(body.milestone).trim(),
      product_id: product === undefined ? null : productId(workspace, product), target_date: textOf(body.target),
      source: textOf(body.source)?.trim() || null, questions: listOf(body.questions).map((q) => RoadmapQuestion.parse(q)),
      document: String(body.document), pushed_by: me.id, pushed_at: at(),
    };
  }

  /** The repository's roadmap `number` in `workspace`: created on its first push, else its fields replaced. */
  function upsert(workspace: string, repo: string, number: IssueNumber, fields: ReturnType<typeof fieldsOf>): { roadmap: FakeRoadmap; created: boolean } {
    const found = tables.roadmaps.find((r) => r.workspace_id === workspace && r.repo === repo && r.number === number);
    if (found !== undefined) {
      Object.assign(found, fields);
      return { roadmap: found, created: false };
    }
    const roadmap: FakeRoadmap = { id: newId(), workspace_id: workspace, repo, number, created_at: at(), ...fields };
    tables.roadmaps.push(roadmap);
    return { roadmap, created: true };
  }

  function roadmapPush(me: FakeAccount | null, args: Row): Result {
    calls.push({ fn: 'roadmap_push', args });
    if (!me) return refused('42501', 'Sign in first.');
    const body = objectOf(args.p_body);
    const placed = placeRepo(me, body.repo, Object.keys(workspaces), (workspace) => workspaces[workspace]?.org);
    if ('refusal' in placed) return placed.refusal;
    const { repo, workspace } = placed;
    const { named, product } = productOf(workspace, body);
    const fields = fieldsOf(me, workspace, body, product);
    const { roadmap, created } = upsert(workspace, repo, parseIssue(Number(body.number)), fields);
    const id = roadmap.id;
    tables.roadmap_prds = [...tables.roadmap_prds.filter((p) => p.roadmap_id !== id), ...prdRows(id, body.prds)];
    return {
      data: { roadmapId: id, created, product: product ?? null, unknownProduct: named !== null && product === undefined ? named : null },
      error: null,
    };
  }

  /** The reads of a caller, under the policies: a member of the roadmap's workspace reads it and its PRDs. */
  const reads = (mine: (workspace: string) => boolean) => {
    const roadmapIsMine = (roadmapId: string) => tables.roadmaps.some((r) => r.id === roadmapId && mine(r.workspace_id));
    return (table: string) => {
      if (table === 'roadmaps') return tableQuery(tables.roadmaps, (r) => mine(r.workspace_id));
      if (table === 'roadmap_prds') return tableQuery(tables.roadmap_prds, (p) => roadmapIsMine(p.roadmap_id));
      throw new Error(`the fake reads no ${table}`);
    };
  };
  const client = (token: string) => fakeClient(accounts, token, { fn: 'roadmap_push', call: roadmapPush, reads });

  return { tables, calls, client, productId };
}
