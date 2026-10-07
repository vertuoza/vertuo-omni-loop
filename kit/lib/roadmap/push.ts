/**
 * **A roadmap is pushed** (PRD 1162, slice s6): what `omni roadmap push <n>` sends to the app's
 * `POST /api/roadmaps` (`apps/galaxy/src/roadmap/api.ts`): `roadmap.md`'s front matter and its text,
 * its open questions with the latest answer to each, and one row per PRD with where it stands.
 *
 * Where a PRD stands is read from its pull requests: its feature PR, found by the feature branch its
 * folder's topic names, and in a plan repository the feature PR of each target its row names, by the
 * same branch, as `/omni:ultra-yolo` opens them. {@link prdState} turns them into one of the app's
 * states; a PRD not started whose blockers have not all merged names the first of them it waits on
 * ({@link waitsOn}). The reading goes through two functions a caller hands in, `gh` and `git`, so
 * every rule here is tested without GitHub.
 */
import { z } from 'zod';
import { fillBranch } from '../board.ts';
import type { Context } from '../context.ts';
import { PrNumberSchema } from '../ids.ts';
import type { PrNumber } from '../ids.ts';
import { parseFolderName } from '../layout.ts';
import { parseOutboxItem } from '../outbox/outbox.ts';
import type { Roadmap, RoadmapRow } from './parse.ts';

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
export type PushedPrd = {
  id: string;
  prd: number;
  title: string;
  repos: string[];
  blockers: string[];
  wave: number;
  state: RoadmapPrdState;
  waitsOn: string | null;
  waitsOnUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

/** One open question of the push, with the latest answer given, or null. */
export type PushedQuestion = { id: string; question: string; recommendation: string | null; blocks: string[]; kind: 'default' | 'person'; answer: string | null };

/** The body of `POST /api/roadmaps`: exactly the fields the contract takes. */
export type RoadmapPushBody = {
  repo: string;
  roadmap: number;
  title: string;
  milestone: string;
  product: string | null;
  target: string | null;
  source: string | null;
  questions: PushedQuestion[];
  document: string;
  prds: PushedPrd[];
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
export function prdTimes(standing: PrdStanding, state: RoadmapPrdState): { startedAt: string | null; endedAt: string | null } {
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
 * (<id> <title>): <state>` and that PR's link, or `waits on <id> <title>: not started` with no link. */
export function waitsOn(
  row: RoadmapRow,
  rows: ReadonlyMap<string, { row: RoadmapRow; standing: PrdStanding; state: RoadmapPrdState }>,
): { waitsOn: string | null; waitsOnUrl: string | null } {
  for (const id of row.blockedBy) {
    const blocker = rows.get(id);
    if (!blocker || blocker.state === 'merged') continue;
    const pr = namedPr(blocker.standing);
    const who = `${blocker.row.id} ${blocker.row.title}`;
    const words = stateWords(blocker.state, pr);
    if (pr === null) return { waitsOn: cut(`waits on ${who}: ${words}`, WAITS_ON_MAX), waitsOnUrl: null };
    return { waitsOn: cut(`waits on ${pr.repo}#${pr.number} (${who}): ${words}`, WAITS_ON_MAX), waitsOnUrl: pr.url };
  }
  return { waitsOn: null, waitsOnUrl: null };
}

/** The body `omni roadmap push` sends: the roadmap, its document, its answers and each PRD's standing
 * (a row with none read stands as waiting). */
export function roadmapPushBody({ repo, roadmap, document, standings, answers }: {
  repo: string;
  roadmap: Roadmap;
  document: string;
  standings: ReadonlyMap<string, PrdStanding>;
  answers: ReadonlyMap<string, string>;
}): RoadmapPushBody {
  const none: PrdStanding = { shipped: false, prs: [], expected: 1 };
  const rows = new Map(roadmap.prds.map((row) => {
    const standing = standings.get(row.id) ?? none;
    return [row.id, { row, standing, state: prdState(standing) }] as const;
  }));
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
  const questions = roadmap.questions.map((q) => ({
    id: q.id,
    question: q.question,
    recommendation: NO_RECOMMENDATION.test(q.recommendation.trim()) ? null : q.recommendation.trim(),
    blocks: [...q.blocks],
    kind: q.kind,
    answer: answers.get(q.id) ?? null,
  }));
  const { title, milestone, product, target, source } = roadmap;
  return { repo, roadmap: roadmap.roadmap, title, milestone, product, target, source, questions, document, prds };
}

// ── Reading where each PRD stands ────────────────────────────────────────────────────────────────

/** How the reading runs `gh` and `git` (in the repository's root); each returns stdout or throws. */
export type Readers = { gh: (args: string[]) => string; git: (args: string[]) => string };

const GhPrSchema = z.looseObject({
  number: PrNumberSchema,
  url: z.string(),
  state: z.enum(['OPEN', 'MERGED', 'CLOSED']),
  isDraft: z.boolean().nullish(),
  createdAt: z.string().nullish(),
  mergedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});
type GhPr = z.infer<typeof GhPrSchema>;

/** The part of an `owner/name` slug after the `/`: the name a roadmap's `repos` column uses. */
export const shortName = (slug: string): string => slug.slice(slug.indexOf('/') + 1);

/** The pull request from `branch` on `slug`: the open one, else the one updated last; null with none. */
function featurePr(slug: string, branch: string, { gh }: Readers): GhPr | null {
  const raw = gh(['pr', 'list', '--repo', slug, '--head', branch, '--state', 'all', '--json', 'number,url,state,isDraft,createdAt,mergedAt,closedAt,updatedAt', '--limit', '20']);
  const prs = z.array(GhPrSchema).parse(JSON.parse(raw));
  return prs.find((pr) => pr.state === 'OPEN') ?? [...prs].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] ?? null;
}

/** The outbox questions a person must answer, open under `dir` on `ref`; none when it cannot be read. */
function questionsOn(ref: string, dir: string, { git }: Readers): number {
  let listed: string;
  try {
    listed = git(['ls-tree', '-r', '--name-only', ref, '--', dir]);
  } catch {
    return 0;
  }
  const files = listed.split('\n').map((line) => line.trim())
    .filter((file) => file.endsWith('.md') && !file.endsWith('/settled.md') && !file.slice(dir.length).includes('/accounts/'));
  return files.filter((file) => {
    const parsed = parseOutboxItem(git(['show', `${ref}:${file}`]), { file });
    return parsed.ok && ASKED_RANKS.has(parsed.item.rank);
  }).length;
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

/** Where one PRD of the roadmap stands. Throws what `gh` throws when GitHub cannot be read. */
export function readStanding(ctx: Pick<Context, 'config' | 'layout'>, row: RoadmapRow, readers: Readers): PrdStanding {
  const slug = ctx.config.repo.slug ?? '';
  const slugs = slugsOf(ctx, row, slug);
  const where = ctx.layout.whereIs(row.prd);
  const folder = where === null ? null : parseFolderName(where.name);
  if (where === null || folder === null) return { shipped: false, prs: [], expected: slugs.length };
  const branch = fillBranch(ctx.config.branches.feature, { topic: folder.topic });
  const prs = slugs.flatMap((repo) => {
    const pr = featurePr(repo, branch, readers);
    if (pr === null) return [];
    const isDraft = Boolean(pr.isDraft);
    const questions = repo === slug && pr.state === 'OPEN' && isDraft ? draftQuestions(ctx, row, branch, readers) : 0;
    return [{
      repo: shortName(repo), number: pr.number, url: pr.url, state: pr.state, isDraft,
      createdAt: pr.createdAt ?? null, mergedAt: pr.mergedAt ?? null, closedAt: pr.closedAt ?? null, questions,
    }];
  });
  return { shipped: where.state === 'shipped', prs, expected: slugs.length };
}

/** Where every PRD of the roadmap stands, by row id. Throws what `gh` throws. */
export function readStandings(ctx: Pick<Context, 'config' | 'layout'>, roadmap: Roadmap, readers: Readers): Map<string, PrdStanding> {
  return new Map(roadmap.prds.map((row) => [row.id, readStanding(ctx, row, readers)]));
}
