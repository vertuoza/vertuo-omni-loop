/**
 * **A roadmap is pushed** (PRD 1162, slice s6): what `omni roadmap push <n>` sends to the app's
 * `POST /api/roadmaps` (the app's roadmaps contract): `roadmap.md`'s front matter and its text,
 * its open questions with the latest answer to each, and one row per PRD with where it stands.
 *
 * Where a PRD stands is read from its pull requests: its feature PR, found by the feature branch its
 * folder's topic names, and in a plan repository the feature PR of each target its row names, by the
 * same branch, as `/omni:ultra-yolo` opens them. {@link prdState} turns them into one of the app's
 * states; a PRD not started whose blockers have not all merged names the first of them it waits on
 * ({@link waitsOn}). The reading goes through what a caller hands in: the loop's reads (`LoopReads`,
 * PRD 1665: the Omni page) for the pull requests and the comments, and `git` for the branches, so
 * every rule here is tested without a code host.
 */
import { fillBranch } from '../board.ts';
import type { Context } from '../context.ts';
import type { IssueNumber, PrNumber } from '../ids.ts';
import type { LoopChange } from '../loop-reads/contract.ts';
import type { LoopReads } from '../loop-reads/port.ts';
import { parsePlanSlices } from '../inbox/territory.ts';
import { parseFolderName } from '../layout.ts';
import { makeMarkers } from '../markers.ts';
import { parseOutboxItem } from '../outbox/outbox.ts';
import type { OutboxItem } from '../types.ts';
import { clarificationWork, outboxWork, parkWork, questionWork } from './human-work.ts';
import type { DatedComment, HumanWorkEntry } from './human-work.ts';
import type { ProductRoadmap, ProductRoadmapRow, Roadmap, RoadmapPrerequisite, RoadmapRow } from './parse.ts';
import type { LastResult } from './prereqs/last.ts';

/** Where a roadmap's PRD stands, as the app stores it: its bar's colour on the Gantt. */
export type RoadmapPrdState = 'waiting' | 'building' | 'outbox' | 'ready' | 'merged' | 'closed';

/** One feature PR of a PRD, in one repository (its short name), as the push reads it. `questions` is
 * the outbox questions open on its branch: read for the PRD's own repository's open draft only. */
export type PrStanding = {
  repo: string;
  number: PrNumber;
  url: string;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  isDraft: boolean;
  createdAt: string | null;
  mergedAt: string | null;
  closedAt: string | null;
  questions: number;
};

/** A PRD's pull requests, whether its folder has shipped, and how many feature PRs it ends with: one,
 * or in a plan repository the plan PR and one per target its row names. */
export type PrdStanding = { shipped: boolean; prs: PrStanding[]; expected: number };

/** One PRD's row of the push, as the app's contract takes it. */
export type PushedPrd = Pick<RoadmapRow, 'id' | 'prd' | 'title' | 'wave'> & PrdTimes & {
  repos: string[];
  blockers: string[];
  state: RoadmapPrdState;
  waitsOn: string | null;
  waitsOnUrl: string | null;
};

/** When a PRD started (its first feature PR opened) and ended; null while it has not. */
type PrdTimes = { startedAt: string | null; endedAt: string | null };

/** One open question of the push, with the latest answer given, or null. */
export type PushedQuestion = { id: string; question: string; recommendation: string | null; blocks: string[]; kind: 'default' | 'person'; answer: string | null };

/** One prerequisite of the push (PRD 1218): its row and its card, `repos` empty outside a plan
 * repository. */
export type PushedPrerequisite = Omit<RoadmapPrerequisite, 'repos'> & { repos: string[] };

/** This machine's last prerequisites result, as the push carries it: the machine, the time, and each
 * row's state and why it waits. */
export type PushedPrerequisiteResult = Omit<LastResult, 'roadmap'>;

/** The body of `POST /api/roadmaps`: exactly the fields the contract takes. `humanWork` (PRD 1217)
 * is left out when the PRDs' human work could not be read whole: a push without it closes nothing.
 * `prerequisites` and `prerequisiteResult` (PRD 1218) are there only when the roadmap has a
 * `## Prerequisites` table, so a roadmap without one pushes as before PRD 1218. */
export type RoadmapPushBody = {
  repo: string;
  roadmap: IssueNumber;
  title: string;
  milestone: string;
  product: string | null;
  target: string | null;
  source: string | null;
  questions: PushedQuestion[];
  document: string;
  prds: PushedPrd[];
  prerequisites?: PushedPrerequisite[];
  prerequisiteResult?: PushedPrerequisiteResult | null;
  humanWork?: HumanWorkEntry[];
};

/** The longest waits-on line the app stores. */
export const WAITS_ON_MAX = 300;

/** A recommendation cell that gives none: empty, a dash of any width, or the word, as the parser
 * reads a "none" cell. */
const NO_RECOMMENDATION = /^(?:|-|–|—|none)$/i;

/** Outbox ranks a person must answer: a medium decision is adopted, never asked. */
const ASKED_RANKS = new Set(['human-action', 'high']);

/** PRD standing's state: closed unmerged, merged everywhere it lands, ready when every feature PR is
 * ready, outbox when its draft holds open questions, building once a feature PR exists, else waiting. */
export function prdState({ shipped, prs, expected }: PrdStanding): RoadmapPrdState {
  if (prs.length === 0) return shipped ? 'merged' : 'waiting';
  if (prs.some((pr) => pr.state === 'CLOSED')) return 'closed';
  const open = prs.filter((pr) => pr.state === 'OPEN');
  if (open.length === 0) return shipped || prs.length >= expected ? 'merged' : 'building';
  if (open.some((pr) => pr.isDraft && pr.questions > 0)) return 'outbox';
  return open.every((pr) => !pr.isDraft) && prs.length >= expected ? 'ready' : 'building';
}

/** The earliest of `times`, or the latest, or null with none. */
function bound(times: readonly (string | null)[], pick: 'first' | 'last'): string | null {
  const known = times.filter((time): time is string => time !== null).sort();
  return (pick === 'first' ? known[0] : known.at(-1)) ?? null;
}

/** When the PRD started (its first feature PR opened) and ended (its last merge, or its close). */
export function prdTimes(standing: PrdStanding, state: RoadmapPrdState): PrdTimes {
  const startedAt = bound(standing.prs.map((pr) => pr.createdAt), 'first');
  if (state === 'merged') return { startedAt, endedAt: bound(standing.prs.map((pr) => pr.mergedAt), 'last') };
  if (state === 'closed') return { startedAt, endedAt: bound(standing.prs.filter((pr) => pr.state === 'CLOSED').map((pr) => pr.closedAt), 'last') };
  return { startedAt, endedAt: null };
}

/** `1 question`, `2 questions`. */
const questionsWord = (n: number): string => `${n} question${n === 1 ? '' : 's'}`;

/** A blocker's state, in the words a waits-on line ends with. */
function stateWords(state: RoadmapPrdState, pr: PrStanding | null): string {
  if (state === 'closed') return 'closed unmerged: fix the roadmap';
  if (state === 'ready') return 'ready, waiting for your merge';
  if (state === 'outbox') return `outbox: ${questionsWord(pr?.questions ?? 0)}`;
  return state === 'waiting' ? 'not started' : state;
}

/** A line on one line, cut to `max`. */
const cut = (line: string, max: number): string => {
  const flat = line.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

/** The PR of a blocker a waits-on line names: its first open one, else its first closed one. */
const namedPr = (standing: PrdStanding): PrStanding | null =>
  standing.prs.find((pr) => pr.state === 'OPEN') ?? standing.prs.find((pr) => pr.state === 'CLOSED') ?? null;

/** What a PRD not started waits on: the first of its blockers not merged, as `waits on <repo>#<pr>
 * (<id> <title>): <state>` and that PR's link, or `waits on <id> <title>: not started` with no link.
 * `live` (PRD 1162, slice s7: `omni next` reads the board and the CI) gives a blocker's state in finer
 * words, by row id — `building wave <k>/<m>`, `CI red` — in place of the state's own. */
export function waitsOn(
  row: RoadmapRow,
  rows: ReadonlyMap<string, { row: RoadmapRow; standing: PrdStanding; state: RoadmapPrdState }>,
  live: ReadonlyMap<string, string> = new Map(),
): { waitsOn: string | null; waitsOnUrl: string | null } {
  for (const id of row.blockedBy) {
    const blocker = rows.get(id);
    if (!blocker || blocker.state === 'merged') continue;
    const pr = namedPr(blocker.standing);
    const who = `${blocker.row.id} ${blocker.row.title}`;
    const words = live.get(id) ?? stateWords(blocker.state, pr);
    if (pr === null) return { waitsOn: cut(`waits on ${who}: ${words}`, WAITS_ON_MAX), waitsOnUrl: null };
    return { waitsOn: cut(`waits on ${pr.repo}#${pr.number} (${who}): ${words}`, WAITS_ON_MAX), waitsOnUrl: pr.url };
  }
  return { waitsOn: null, waitsOnUrl: null };
}

/** Each row of `roadmap` by id, with its standing and its state (a row with none read stands as
 * waiting): what {@link waitsOn} reads. */
export function rowStates(roadmap: Pick<Roadmap, 'prds'>, standings: ReadonlyMap<string, PrdStanding>): Map<string, { row: RoadmapRow; standing: PrdStanding; state: RoadmapPrdState }> {
  const none: PrdStanding = { shipped: false, prs: [], expected: 1 };
  return new Map(roadmap.prds.map((row) => {
    const standing = standings.get(row.id) ?? none;
    return [row.id, { row, standing, state: prdState(standing) }] as const;
  }));
}

/** The push's prerequisites and `result`, or nothing for a roadmap without any. */
function prerequisitesOf(roadmap: Pick<Roadmap, 'prerequisites'>, result: PushedPrerequisiteResult | null): Pick<RoadmapPushBody, 'prerequisites' | 'prerequisiteResult'> {
  const rows = roadmap.prerequisites ?? [];
  if (rows.length === 0) return {};
  return {
    prerequisites: rows.map(({ repos, blocks, ...row }) => ({ ...row, blocks: blocks === 'all' ? 'all' : [...blocks], repos: repos ?? [] })),
    prerequisiteResult: result,
  };
}

/** The roadmap's open questions as the push carries them, each with the latest answer given, or null. */
function pushedQuestions(roadmap: Pick<Roadmap, 'questions'>, answers: ReadonlyMap<string, string>): PushedQuestion[] {
  return roadmap.questions.map((q) => ({
    id: q.id,
    question: q.question,
    recommendation: NO_RECOMMENDATION.test(q.recommendation.trim()) ? null : q.recommendation.trim(),
    blocks: [...q.blocks],
    kind: q.kind,
    answer: answers.get(q.id) ?? null,
  }));
}

/** The body `omni roadmap push` sends: the roadmap, its document, its answers, each PRD's standing
 * (a row with none read stands as waiting), its human work: the roadmap's unanswered person
 * questions, then `prdWork`; no `humanWork` at all when `prdWork` is null (it could not be read),
 * and its prerequisites with this machine's last `result`. */
export function roadmapPushBody({ repo, roadmap, document, standings, answers, prdWork, result = null }: {
  repo: string;
  roadmap: Roadmap;
  document: string;
  standings: ReadonlyMap<string, PrdStanding>;
  answers: ReadonlyMap<string, string>;
  prdWork: readonly HumanWorkEntry[] | null;
  result?: PushedPrerequisiteResult | null;
}): RoadmapPushBody {
  const rows = rowStates(roadmap, standings);
  const prds = [...rows.values()].map(({ row, standing, state }) => ({
    id: row.id,
    prd: row.prd,
    title: row.title,
    repos: row.repos ?? [],
    blockers: [...row.blockedBy],
    wave: row.wave,
    state,
    ...(state === 'waiting' ? waitsOn(row, rows) : { waitsOn: null, waitsOnUrl: null }),
    ...prdTimes(standing, state),
  }));
  const questions = pushedQuestions(roadmap, answers);
  const { title, milestone, product, target, source } = roadmap;
  const body: RoadmapPushBody = { repo, roadmap: roadmap.roadmap, title, milestone, product, target, source, questions, document, prds, ...prerequisitesOf(roadmap, result) };
  if (prdWork === null) return body;
  const issueUrl = `https://github.com/${repo}/issues/${roadmap.roadmap}`;
  return { ...body, humanWork: [...questionWork(roadmap, answers, { repo: shortName(repo), issueUrl }), ...prdWork] };
}

// ── A roadmap born on the server (PRD 2011) ──────────────────────────────────────────────────────

/** One row of a product roadmap's push: its PRD is a repository's number (`912`) or a product's id (`mobile-12`). */
export type ProductPushedPrd = Omit<PushedPrd, 'prd'> & Pick<ProductRoadmapRow, 'prd'>;

/**
 * The body of a product roadmap's `POST /api/roadmaps`: the key of the product, `new: true` to create
 * the product's next roadmap or `roadmap: <n>` to push to `<key>-R<n>`, the repository the kit runs from
 * (only to choose between two workspaces holding the key), and the roadmap. `check: true` asks the
 * server to check the rows against the product's repositories and write nothing.
 */
export type ProductRoadmapPushBody = {
  productKey: string;
  new?: true;
  roadmap?: number;
  repo?: string;
  check?: true;
  title: string;
  milestone: string;
  target: string | null;
  source: string | null;
  questions: PushedQuestion[];
  document: string;
  prds: ProductPushedPrd[];
  prerequisites?: PushedPrerequisite[];
  prerequisiteResult?: PushedPrerequisiteResult | null;
};

/**
 * The body `omni roadmap push --product` sends. A product roadmap has no issue and no feature PR to
 * read, so every row stands as `waiting` until the PRD it names starts; its questions carry no answer
 * yet (the page answers them); and no human work is sent, so a push closes none.
 */
export function productRoadmapPushBody({ key, seq, repo, roadmap, document, check = false, result = null }: {
  key: string;
  seq: number | null;
  repo: string | null;
  roadmap: ProductRoadmap;
  document: string;
  check?: boolean;
  result?: PushedPrerequisiteResult | null;
}): ProductRoadmapPushBody {
  const prds = roadmap.prds.map((row) => ({
    id: row.id, prd: row.prd, title: row.title, repos: row.repos ?? [], blockers: [...row.blockedBy], wave: row.wave,
    state: 'waiting' as const, waitsOn: null, waitsOnUrl: null, startedAt: null, endedAt: null,
  }));
  const questions = pushedQuestions(roadmap, new Map());
  return {
    productKey: key,
    ...(seq === null ? { new: true as const } : { roadmap: seq }),
    ...(repo === null ? {} : { repo }),
    ...(check ? { check: true as const } : {}),
    title: roadmap.title, milestone: roadmap.milestone, target: roadmap.target, source: roadmap.source,
    questions, document, prds, ...prerequisitesOf(roadmap, result),
  };
}

// ── Reading where each PRD stands ────────────────────────────────────────────────────────────────

/** What the reading goes through: the loop's reads, which throw a `LoopReadError` when they cannot be
 * made, and `git` (in the repository's root), which returns stdout or throws. */
export type Readers = { reads: LoopReads; git: (args: string[]) => string };

/** A feature PR, as the push reads it. */
type FeaturePr = Omit<PrStanding, 'repo' | 'questions'> & { updatedAt: string };

/** A change in the push's words: merged and closed as the app takes them, a draft open. A change's
 * close is its last update, as the contract carries no close date of its own. */
function featurePrOf(change: LoopChange): FeaturePr {
  const state = change.state === 'merged' ? 'MERGED' : change.state === 'closed' ? 'CLOSED' : 'OPEN';
  const closedAt = state === 'MERGED' ? change.mergedAt : state === 'CLOSED' ? change.updatedAt || null : null;
  return {
    number: change.number, url: change.url, state, isDraft: change.state === 'draft',
    createdAt: change.createdAt || null, mergedAt: change.mergedAt, closedAt, updatedAt: change.updatedAt,
  };
}

/** The part of an `owner/name` slug after the `/`: the name a roadmap's `repos` column uses. */
const shortName = (slug: string): string => slug.slice(slug.indexOf('/') + 1);

/** The pull request from `branch` on `slug`: the open one, else the one updated last; null with none. */
async function featurePr(slug: string, branch: string, { reads }: Readers): Promise<FeaturePr | null> {
  const prs = (await reads.changes({ repo: slug, head: branch, state: 'all' })).map(featurePrOf);
  return prs.find((pr) => pr.state === 'OPEN') ?? [...prs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/** The open outbox items under `dir` as they stand on `ref`, read through `git`; `null` when the ref
 * cannot be read. An item that does not parse is left out. */
export function openItemsOn(ref: string, dir: string, git: (args: string[]) => string): OutboxItem[] | null {
  let listed: string;
  try {
    listed = git(['ls-tree', '-r', '--name-only', ref, '--', dir]);
  } catch {
    return null;
  }
  const files = listed.split('\n').map((line) => line.trim())
    .filter((file) => file.endsWith('.md') && !file.endsWith('/settled.md') && !file.slice(dir.length).includes('/accounts/'));
  return files.flatMap((file) => {
    const parsed = parseOutboxItem(git(['show', `${ref}:${file}`]), { file });
    return parsed.ok ? [parsed.item] : [];
  });
}

/** The outbox questions a person must answer, open under `dir` on `ref`; none when it cannot be read. */
function questionsOn(ref: string, dir: string, { git }: Readers): number {
  return (openItemsOn(ref, dir, git) ?? []).filter((item) => ASKED_RANKS.has(item.rank)).length;
}

/** The open questions on the feature branch of a PRD whose own feature PR is an open draft. */
function draftQuestions(ctx: Pick<Context, 'config' | 'layout'>, row: RoadmapRow, branch: string, readers: Readers): number {
  const dir = ctx.layout.outboxDir(row.prd);
  if (dir === null) return 0;
  const remote = ctx.config.repo.remote;
  try {
    readers.git(['fetch', '--quiet', remote, branch]);
  } catch {
    // The ref as last fetched is read below, or none.
  }
  return questionsOn(`${remote}/${branch}`, dir, readers);
}

/** The slugs a PRD's feature PRs live in: this repository's, then each target its row names. */
function slugsOf(ctx: Pick<Context, 'config'>, row: RoadmapRow, slug: string): string[] {
  const targets = ctx.config.plan?.targets ?? [];
  const named = new Set(row.repos ?? []);
  const own = shortName(slug);
  return [slug, ...targets.filter((t) => named.has(shortName(t.repo)) && shortName(t.repo) !== own).map((t) => t.repo)];
}

/** A PRD's feature branch, filled from its folder's topic; null when it has no folder. */
function featureBranchOf(ctx: Pick<Context, 'config' | 'layout'>, row: RoadmapRow): string | null {
  const where = ctx.layout.whereIs(row.prd);
  const folder = where === null ? null : parseFolderName(where.name);
  return folder === null ? null : fillBranch(ctx.config.branches.feature, { topic: folder.topic });
}

/** Where one PRD of the roadmap stands, and its own repository's feature PR as read. Rejects with what
 * the loop's reads throw when they cannot be made. */
async function readStanding(ctx: Pick<Context, 'config' | 'layout'>, row: RoadmapRow, readers: Readers): Promise<{ standing: PrdStanding; own: FeaturePr | null }> {
  const slug = ctx.config.repo.slug ?? '';
  const slugs = slugsOf(ctx, row, slug);
  const where = ctx.layout.whereIs(row.prd);
  const branch = featureBranchOf(ctx, row);
  if (where === null || branch === null) return { standing: { shipped: false, prs: [], expected: slugs.length }, own: null };
  let own: FeaturePr | null = null;
  const prs: PrStanding[] = [];
  for (const repo of slugs) {
    const pr = await featurePr(repo, branch, readers);
    if (repo === slug) own = pr;
    if (pr !== null) prs.push(prStandingOf(ctx, row, branch, { repo, own: repo === slug, pr }, readers));
  }
  return { standing: { shipped: where.state === 'shipped', prs, expected: slugs.length }, own };
}

/** Feature PR `pr` in `repo` as a standing: its outbox questions are read for the PRD's own
 * repository's open draft only. */
function prStandingOf(
  ctx: Pick<Context, 'config' | 'layout'>,
  row: RoadmapRow,
  branch: string,
  { repo, own, pr }: { repo: string; own: boolean; pr: FeaturePr },
  readers: Readers,
): PrStanding {
  const questions = own && pr.state === 'OPEN' && pr.isDraft ? draftQuestions(ctx, row, branch, readers) : 0;
  const { number, url, state, isDraft, createdAt, mergedAt, closedAt } = pr;
  return { repo: shortName(repo), number, url, state, isDraft, createdAt, mergedAt, closedAt, questions };
}

// ── Reading each PRD's human work (PRD 1217) ─────────────────────────────────────────────────────

/** Every comment of issue or pull request `n` on `slug`, oldest first, each linked on the issue's page.
 * Rejects with what the loop's reads throw. */
async function issueComments(slug: string, n: IssueNumber | PrNumber, { reads }: Readers): Promise<DatedComment[]> {
  return (await reads.comments(slug, n)).map((comment) => ({
    body: comment.body,
    url: `https://github.com/${slug}/issues/${n}#issuecomment-${comment.id}`,
    createdAt: comment.createdAt,
  }));
}

/** When PRD `row`'s plan was last committed, on its feature branch or on this checkout's HEAD; null
 * with no plan yet. */
function planCommittedAt(ctx: Pick<Context, 'config' | 'layout'>, row: RoadmapRow, branch: string, { git }: Readers): string | null {
  const plan = ctx.layout.planPath(row.prd);
  if (plan === null) return null;
  const times = [`${ctx.config.repo.remote}/${branch}`, 'HEAD'].flatMap((ref) => {
    try {
      const at = git(['log', '-1', '--format=%cI', ref, '--', plan]).trim();
      return at ? [new Date(at).toISOString()] : [];
    } catch {
      return [];
    }
  });
  return bound(times, 'last');
}

/** The repository each slice of the plan on `ref` lands in, by slice id; empty when it cannot be read. */
function sliceRepos(ctx: Pick<Context, 'layout'>, row: RoadmapRow, ref: string, { git }: Readers): Map<string, string> {
  const plan = ctx.layout.planPath(row.prd);
  if (plan === null) return new Map();
  try {
    return new Map(parsePlanSlices(git(['show', `${ref}:${plan}`])).flatMap((slice) => (slice.repo ? [[String(slice.id), slice.repo] as const] : [])));
  } catch {
    return new Map();
  }
}

/** The work an open feature PR holds: its outbox items a person must act on, each in its slice's
 * repository, and its park. Rejects when its branch's outbox or its comments cannot be read. */
async function openPrWork(ctx: Pick<Context, 'config' | 'layout'>, row: RoadmapRow, branch: string, pr: FeaturePr, readers: Readers): Promise<HumanWorkEntry[]> {
  const slug = ctx.config.repo.slug ?? '';
  const repo = shortName(slug);
  const ref = `${ctx.config.repo.remote}/${branch}`;
  const dir = ctx.layout.outboxDir(row.prd);
  const items = dir === null ? [] : openItemsOn(ref, dir, readers.git);
  if (items === null) throw new Error(`${ref} cannot be read`);
  const repos = sliceRepos(ctx, row, ref, readers);
  const marker = makeMarkers(ctx.config.markers.prefix).status;
  const status = (await issueComments(slug, pr.number, readers)).find((comment) => comment.body.includes(marker))?.body ?? null;
  return [
    ...outboxWork(row.prd, items, { repoOf: (item) => repos.get(String(item.slice)) ?? repo, url: pr.url }),
    ...parkWork(row.prd, status, { repo, prUrl: pr.url }),
  ];
}

/** PRD `row`'s human work: none once it merged or closed; else its open feature PR's work and its
 * needs-clarification question. Rejects with what the loop's reads throw. */
async function readPrdWork(ctx: Pick<Context, 'config' | 'layout'>, row: RoadmapRow, standing: PrdStanding, own: FeaturePr | null, readers: Readers): Promise<HumanWorkEntry[]> {
  const state = prdState(standing);
  const branch = featureBranchOf(ctx, row);
  if (branch === null || state === 'merged' || state === 'closed') return [];
  const slug = ctx.config.repo.slug ?? '';
  const prWork = own !== null && own.state === 'OPEN' ? await openPrWork(ctx, row, branch, own, readers) : [];
  const planAt = planCommittedAt(ctx, row, branch, readers);
  return [...prWork, ...clarificationWork(row.prd, await issueComments(slug, row.prd, readers), { repo: shortName(slug), planAt })];
}

/** What the code host says of every PRD of the roadmap: each one's standing, by row id, and the human
 * work of them all, or null when that work could not be read whole. Rejects with what the loop's reads
 * throw for a standing. */
export async function readRoadmapPrds(
  ctx: Pick<Context, 'config' | 'layout'>,
  roadmap: Roadmap,
  readers: Readers,
): Promise<{ standings: Map<string, PrdStanding>; prdWork: HumanWorkEntry[] | null }> {
  const read: { row: RoadmapRow; standing: PrdStanding; own: FeaturePr | null }[] = [];
  for (const row of roadmap.prds) read.push({ row, ...(await readStanding(ctx, row, readers)) });
  const standings = new Map(read.map(({ row, standing }) => [row.id, standing] as const));
  try {
    const work: HumanWorkEntry[] = [];
    for (const { row, standing, own } of read) work.push(...(await readPrdWork(ctx, row, standing, own, readers)));
    return { standings, prdWork: work };
  } catch {
    return { standings, prdWork: null };
  }
}
