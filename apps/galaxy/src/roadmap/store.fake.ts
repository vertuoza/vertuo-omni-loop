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
//   its fields, document, questions and PRD rows;
// - its human work (PRD 1217, supabase/migrations/20261113090000_roadmap_human_work.sql): a new key stored
//   with its rule kind, a stored key keeping its kind and reopened, a key missing from the push done at
//   the push's time; a push without `humanWork` touches none.
//
// And roadmap_prerequisites_push() of 20261114090000_roadmap_prerequisites.sql (PRD 1218): refused
// 42501 as above, 22023 for a roadmap not pushed yet; otherwise the roadmap's prerequisites replaced,
// each with the state and the waiting detail of the result row naming it, and the result's machine
// and time on the roadmap.
//
// And roadmap_product_push() of 20261210100000_product_roadmaps.sql (PRD 2011): refused 42501 signed out,
// P0002 for a product keyed so in none of the caller's workspaces or a roadmap number it has not; with no
// number it creates the product's next roadmap (a counter per product, no gap), with one it replaces the
// roadmap's fields and PRD rows; and it adds a version of the document, the PRD rows, the human work and
// the prerequisites only where what it carries differs from the latest. The products and their
// repository links are read as members read them (`products`, `product_repositories`).
//
// The body is trusted: the route validated it, and the database's own checks are proved by
// supabase/checks/roadmaps.sql, not here. Reading runs under the migration's policies: a member of the
// roadmap's workspace reads it, its PRDs and its human work.
import { parseIssue, parsePrd, type IssueNumber, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { fakeClient, fakeRecorder, listOf, objectOf, placeRepo, refused, tableQuery, textOf, type FakeAccount, type FakeResult as Result } from '../data/repo-tables.fake';
import {
  HumanWorkKind, HumanWorkSource, PrerequisiteCard, PrerequisiteCategory, PrerequisiteState, PrerequisiteWho, RoadmapPrdState, RoadmapQuestion,
  type RoadmapHumanWorkRow, type RoadmapPrerequisiteRow,
} from './store';

export type { FakeAccount } from '../data/repo-tables.fake';

type Row = Record<string, unknown>;

/** A workspace of the fake: the GitHub org it owns, and the names of its products. */
export type FakeWorkspace = { org: string; products: string[] };

type FakeRoadmap = {
  id: string; workspace_id: string; repo: string; number: IssueNumber; title: string; milestone: string; product_id: string | null;
  target_date: string | null; source: string | null; questions: RoadmapQuestion[]; document: string; pushed_by: string | null;
  created_at: string; pushed_at: string; prerequisites_machine: string | null; prerequisites_checked_at: string | null;
};
type FakePrd = {
  roadmap_id: string; position: number; row_id: string; prd: PrdNumber; title: string; repos: string[]; blockers: string[];
  wave: number; state: RoadmapPrdState; waits_on: string | null; waits_on_url: string | null; started_at: string | null; ended_at: string | null;
};

/** A sent value read as trimmed text; null when it is none or empty. */
const trimmedOf = (value: unknown) => textOf(value)?.trim() || null;

const productId = (workspace: string, name: string) => `product:${workspace}:${name}`;

/** The fields of an entry of human work a push refreshes on every push. */
function workFields(entry: Row) {
  const prd = entry.prd ?? null;
  return {
    prd: prd === null ? null : parsePrd(Number(prd)), repo: String(entry.repo).trim().toLowerCase(), source: HumanWorkSource.parse(entry.source),
    text: String(entry.text).trim(), act: textOf(entry.act)?.trim() || null, url: textOf(entry.url),
  };
}

/** A product of the fake, by its key: the workspace holding it, its name and its repository links. */
export type FakeProduct = {
  workspace: string; name: string; repositories: Array<{ repository: string; readOnly?: boolean; consumes?: string[] }>;
};

type FakeProductRoadmap = {
  id: string; dossier_id: string; workspace_id: string; key: string; seq: number; title: string; milestone: string; target_date: string | null;
  source: string | null; questions: unknown[]; document: string; prds: Row[]; pushed_by: string; pushed_at: string;
};
type FakeVersion = { dossier_id: string; kind: string; version: number; content: string };

/** `accounts`: token → account. `workspaces`: workspace id → its org and products. `now`: the clock, in ms. */
export function fakeRoadmaps(
  accounts: Record<string, FakeAccount>,
  workspaces: Record<string, FakeWorkspace>,
  now: () => number,
  products: Record<string, FakeProduct> = {},
) {
  const tables: { roadmaps: FakeRoadmap[]; roadmap_prds: FakePrd[]; roadmap_human_work: RoadmapHumanWorkRow[]; roadmap_prerequisites: RoadmapPrerequisiteRow[] } = {
    roadmaps: [], roadmap_prds: [], roadmap_human_work: [], roadmap_prerequisites: [],
  };
  const { calls, at, newId } = fakeRecorder(now);
  const productRoadmaps: FakeProductRoadmap[] = [];
  const versions: FakeVersion[] = [];
  const counters: Record<string, number> = {};

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

  /** The push's human work, as roadmap_push() keeps it: a new key with its rule kind, a stored one
   * refreshed and open, a missing one done now. Nothing when the push carries no list. */
  function keepHumanWork(roadmapId: string, sent: unknown) {
    if (!Array.isArray(sent)) return;
    const entries = listOf(sent).map(objectOf);
    for (const entry of entries) keepEntry(roadmapId, entry);
    const sentKeys = new Set(entries.map((e) => e.key));
    tables.roadmap_human_work
      .filter((h) => h.roadmap_id === roadmapId && h.state === 'open' && !sentKeys.has(h.key))
      .forEach((h) => Object.assign(h, { state: 'done', done_at: at() }));
  }

  /** One entry of a push: a stored key refreshed and open, keeping its kind; a new one stored. */
  function keepEntry(roadmapId: string, entry: Row) {
    const fields = workFields(entry);
    const found = tables.roadmap_human_work.find((h) => h.roadmap_id === roadmapId && h.key === entry.key);
    if (found !== undefined) {
      Object.assign(found, fields, { state: 'open', done_at: null });
      return;
    }
    tables.roadmap_human_work.push({
      roadmap_id: roadmapId, key: String(entry.key), ...fields, kind: HumanWorkKind.parse(entry.ruleKind), kind_by: 'rule', state: 'open',
      first_seen_at: at(), done_at: null,
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
    const roadmap: FakeRoadmap = {
      id: newId(), workspace_id: workspace, repo, number, created_at: at(), prerequisites_machine: null, prerequisites_checked_at: null, ...fields,
    };
    tables.roadmaps.push(roadmap);
    return { roadmap, created: true };
  }

  /** A call of `fn`, recorded: its body and where its repository is placed for the caller, or the refusal. */
  function placedCall(fn: string, me: FakeAccount | null, args: Row): { me: FakeAccount; body: Row; repo: string; workspace: string } | { refusal: Result } {
    calls.push({ fn, args });
    if (!me) return { refusal: refused('42501', 'Sign in first.') };
    const body = objectOf(args.p_body);
    const placed = placeRepo(me, body.repo, Object.keys(workspaces), (workspace) => workspaces[workspace]?.org);
    return 'refusal' in placed ? placed : { me, body, ...placed };
  }

  function roadmapPush(caller: FakeAccount | null, args: Row): Result {
    const placed = placedCall('roadmap_push', caller, args);
    if ('refusal' in placed) return placed.refusal;
    const { me, body, repo, workspace } = placed;
    const { named, product } = productOf(workspace, body);
    const fields = fieldsOf(me, workspace, body, product);
    const { roadmap, created } = upsert(workspace, repo, parseIssue(Number(body.number)), fields);
    const id = roadmap.id;
    tables.roadmap_prds = [...tables.roadmap_prds.filter((p) => p.roadmap_id !== id), ...prdRows(id, body.prds)];
    keepHumanWork(id, body.humanWork);
    return {
      data: { roadmapId: id, created, product: product ?? null, unknownProduct: named !== null && product === undefined ? named : null },
      error: null,
    };
  }

  /** The versions a product roadmap's push adds: each part it carries that differs from its latest. */
  function addVersions(dossierId: string, body: Row): { added: Array<{ kind: string; version: number }>; unchanged: string[] } {
    const parts: Array<[string, string | null]> = [
      ['roadmap', String(body.document)],
      ['roadmap-prds', JSON.stringify(body.prds)],
      ['roadmap-human-work', Array.isArray(body.humanWork) ? JSON.stringify(body.humanWork) : null],
      ['roadmap-prerequisites', Array.isArray(body.prerequisites) ? JSON.stringify(body.prerequisites) : null],
    ];
    const added: Array<{ kind: string; version: number }> = [];
    const unchanged: string[] = [];
    for (const [kind, content] of parts) {
      if (content === null) continue;
      const mine = versions.filter((v) => v.dossier_id === dossierId && v.kind === kind);
      const latest = mine.at(-1);
      if (latest?.content === content) {
        unchanged.push(kind);
        continue;
      }
      const version = mine.length + 1;
      versions.push({ dossier_id: dossierId, kind, version, content });
      added.push({ kind, version });
    }
    return { added, unchanged };
  }

  function productPush(me: FakeAccount | null, args: Row): Result {
    calls.push({ fn: 'roadmap_product_push', args });
    if (!me) return refused('42501', 'Sign in first.');
    const key = String(args.p_key);
    const product = products[key];
    if (product === undefined || !me.workspaces.includes(product.workspace)) return refused('P0002', `No product keyed ${key} in your workspaces.`);
    const body = objectOf(args.p_body);
    const fields = {
      title: String(body.title).trim(), milestone: String(body.milestone).trim(), target_date: textOf(body.target),
      source: textOf(body.source)?.trim() || null, questions: listOf(body.questions), document: String(body.document),
      prds: listOf(body.prds).map(objectOf), pushed_by: me.id, pushed_at: at(),
    };
    const number = typeof args.p_roadmap === 'number' ? args.p_roadmap : null;
    let created = false;
    let roadmap = productRoadmaps.find((r) => r.key === key && r.seq === number);
    if (number === null) {
      counters[key] = (counters[key] ?? 0) + 1;
      roadmap = { id: newId(), dossier_id: newId(), workspace_id: product.workspace, key, seq: counters[key], ...fields };
      productRoadmaps.push(roadmap);
      created = true;
    } else if (roadmap === undefined) {
      return refused('P0002', `No roadmap ${key}-R${number} on ${product.name}.`);
    } else {
      Object.assign(roadmap, fields);
    }
    const { added, unchanged } = addVersions(roadmap.dossier_id, body);
    return {
      data: {
        roadmapId: roadmap.id, dossierId: roadmap.dossier_id, roadmap: `${key}-R${roadmap.seq}`, created,
        product: { id: `product:${key}`, name: product.name }, added, unchanged,
      },
      error: null,
    };
  }

  /** A prerequisite as stored, with the state and the waiting detail of the result row naming it. */
  function prerequisiteRow(roadmapId: string, value: unknown, index: number, results: Row[]): RoadmapPrerequisiteRow {
    const row = objectOf(value);
    const found = results.find((r) => r.id === row.id);
    const state = PrerequisiteState.nullable().parse(found?.state ?? null);
    return {
      roadmap_id: roadmapId, position: index + 1, row_id: String(row.id), category: PrerequisiteCategory.parse(row.category),
      need: String(row.need).trim(), check_with: trimmedOf(row.check), fix_with: trimmedOf(row.fix),
      blocks_all: row.blocks === 'all', blocks: listOf(row.blocks).map(String), who: PrerequisiteWho.parse(row.who),
      repos: listOf(row.repos).map((r) => String(r).toLowerCase()), card: PrerequisiteCard.nullable().parse(row.card ?? null),
      state, detail: state === 'waits' ? trimmedOf(found?.detail)?.slice(0, 500) ?? null : null,
    };
  }

  function prerequisitesPush(caller: FakeAccount | null, args: Row): Result {
    const placed = placedCall('roadmap_prerequisites_push', caller, args);
    if ('refusal' in placed) return placed.refusal;
    const { body, repo, workspace } = placed;
    const roadmap = tables.roadmaps.find((r) => r.workspace_id === workspace && r.repo === repo && r.number === Number(body.number));
    if (roadmap === undefined) return refused('22023', 'Push the roadmap before its prerequisites.');
    const result = objectOf(body.result);
    const results = listOf(result.rows).map(objectOf);
    const rows = listOf(body.prerequisites).map((value, index) => prerequisiteRow(roadmap.id, value, index, results));
    tables.roadmap_prerequisites = [...tables.roadmap_prerequisites.filter((p) => p.roadmap_id !== roadmap.id), ...rows];
    roadmap.prerequisites_machine = trimmedOf(result.machine);
    roadmap.prerequisites_checked_at = textOf(result.checkedAt);
    return { data: { roadmapId: roadmap.id, prerequisites: rows.length }, error: null };
  }

  /** The reads of a caller, under the policies: a member of the roadmap's workspace reads it and its PRDs. */
  const reads = (mine: (workspace: string) => boolean) => {
    const roadmapIsMine = (roadmapId: string) => tables.roadmaps.some((r) => r.id === roadmapId && mine(r.workspace_id));
    return (table: string) => {
      if (table === 'roadmaps') return tableQuery(tables.roadmaps, (r) => mine(r.workspace_id));
      if (table === 'roadmap_prds') return tableQuery(tables.roadmap_prds, (p) => roadmapIsMine(p.roadmap_id));
      if (table === 'roadmap_human_work') return tableQuery(tables.roadmap_human_work, (h) => roadmapIsMine(h.roadmap_id));
      if (table === 'roadmap_prerequisites') return tableQuery(tables.roadmap_prerequisites, (p) => roadmapIsMine(p.roadmap_id));
      if (table === 'products') {
        const rows = Object.entries(products).map(([key, p], index) => ({ id: `product:${key}`, key, name: p.name, workspace_id: p.workspace, created_at: String(index).padStart(4, '0') }));
        return tableQuery(rows, (p) => mine(p.workspace_id));
      }
      if (table === 'product_repositories') {
        const rows = Object.entries(products).flatMap(([key, p]) =>
          p.repositories.map((r) => ({
            product_id: `product:${key}`, workspace_id: p.workspace, repository: r.repository, read_only: r.readOnly ?? false, consumes: r.consumes ?? [],
          })),
        );
        return tableQuery(rows, (r) => mine(r.workspace_id));
      }
      throw new Error(`the fake reads no ${table}`);
    };
  };
  /** A client acting as `token`: rpc() answers roadmap_push() and roadmap_prerequisites_push(). */
  const client = (token: string) => {
    const base = fakeClient(accounts, token, { fn: 'roadmap_push', call: roadmapPush, reads });
    const me = accounts[token] ?? null;
    return {
      ...base,
      rpc: (name: string, args: Row) => {
        if (name === 'roadmap_prerequisites_push') return Promise.resolve(prerequisitesPush(me, args));
        if (name === 'roadmap_product_push') return Promise.resolve(productPush(me, args));
        return base.rpc(name, args);
      },
    };
  };

  return { tables, calls, client, productId, productRoadmaps, versions };
}
