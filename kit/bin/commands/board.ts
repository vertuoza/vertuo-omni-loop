// `omni board <prd> [--json] [--repo owner/name]` — the loop's view of a PRD's slices, rebuilt from
// GitHub on every run. Reads the plan's own slice table (`parsePlanSlices`, which carries each
// slice's own `blocked by` ids), fetches only this feature's own pull requests (`gh pr list`,
// narrowed by `board.matchBy` — never the whole repository), and hands the result to `boardFor`
// (`kit/lib/board.ts`) — the one place the state and the runnable frontier are decided. `commits`
// is never asked of `gh pr list`: on a repository with any real history that field alone can blow
// the GraphQL node-limit even at a small page size, so a head commit date is fetched with a second,
// per-pull-request `gh pr view --json commits` call, and only for the pull requests that could
// possibly be `claimed-stale` in the first place.
//
// In a plan repository (PRD 563), a plan whose slices name their `repo` is read one `gh pr list`
// per repository a slice names (its `plan.targets` entry, or `repo.slug` for the plan repository),
// and a repository `gh` cannot read makes its own slices `unreadable` instead of failing the board.
//
// `buildBoard` is that whole building part, exported so that the status line's background refresh
// (`omni statusline --refresh <n>`, PRD 324) builds the board exactly as `omni board` does; the
// command itself only prints what it returns.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardFor, fillBranch } from '../../lib/board.ts';
import type { BoardPr, BoardRepos, BoardRow } from '../../lib/board.ts';
import type { Context } from '../../lib/context.ts';
import type { Slice } from '../../lib/inbox/territory.ts';
import { parsePlanSlices } from '../../lib/inbox/territory.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { githubEnv } from '../github.ts';
import { errorCode, errorMessage, parseArgs, positiveInt, println, repoSlug, usageError } from '../args.ts';
import type { Command, CommandIo, Env, Exec } from '../io.ts';
import { GhPrCommitsSchema, GhPrListSchema } from '../schema.ts';
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';

const USAGE = 'usage: omni board <prd> [--json] [--repo <owner/name>]';

function readPlan(prd: number, { ctx }: { ctx: Context }): { planPath: string; markdown: string } {
  const planPath = ctx.layout.planPath(prd);
  if (planPath === null) throw usageError(`omni board: PRD ${prd} has no inbox or shipped folder.`);
  try {
    return { planPath, markdown: readFileSync(join(ctx.root, planPath), 'utf8') };
  } catch (error) {
    if (errorCode(error) === 'ENOENT') throw usageError(`omni board: no plan at ${planPath}.`);
    throw error;
  }
}

/** The PRD folder's own topic, which fills `{topic}` in `branches.feature` and `branches.slice`. */
function topicFor(prd: number, { ctx }: { ctx: Context }): string {
  const where = ctx.layout.whereIs(prd);
  if (!where) throw usageError(`omni board: PRD ${prd} has no inbox or shipped folder.`);
  const parsed = parseFolderName(where.name);
  if (!parsed) throw usageError(`omni board: cannot read a topic from folder "${where.name}".`);
  return parsed.topic;
}

// Deliberately no `commits`: asked for every pull request of any repository with real history, it
// can alone push a `gh pr list` call over the GraphQL API's per-query node limit — the failure this
// fix round exists to close. Fetched per pull request instead, and only where the staleness rule
// could possibly need it (see `fetchHeadCommitDates` below).
const PR_FIELDS = ['number', 'title', 'headRefName', 'baseRefName', 'state', 'isDraft', 'mergedAt', 'body', 'labels', 'updatedAt', 'createdAt'];

/** `--base <featureBranch>` for `board.matchBy: base`, `--label <subLabel>` for `board.matchBy:
 * label` — narrows `gh pr list` to this feature's own pull requests, server-side. Without this an
 * old sub-PR (say, already merged) can fall off a page of the whole repository's pull requests and
 * read as if it never existed — exactly what `--state all` was supposed to prevent. */
/** What narrows `gh pr list` to one feature's pull requests. */
type Narrowing = { matchBy: string; featureBranch: string; subLabel: string };

function narrowingArgs({ matchBy, featureBranch, subLabel }: Narrowing): string[] {
  return matchBy === 'label' ? ['--label', subLabel] : ['--base', featureBranch];
}

/** Every pull request of this feature — never the whole repository's. */
function fetchPrList({ repo, exec, env, matchBy, featureBranch, subLabel }: { repo: string; exec: Exec; env: Env | undefined } & Narrowing): BoardPr[] {
  const options: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', ...(env ? { env } : {}) };
  const raw = exec(
    'gh',
    [
      'pr',
      'list',
      '--repo',
      repo,
      '--json',
      PR_FIELDS.join(','),
      '--state',
      'all',
      '--limit',
      '200',
      ...narrowingArgs({ matchBy, featureBranch, subLabel }),
    ],
    options,
  );
  return GhPrListSchema.parse(JSON.parse(raw)).map((pr) => ({ ...pr, headCommitDate: null }));
}

/** Whether `pr` could possibly read as `claimed-stale` at all: only an open draft whose claim
 * (`createdAt`) is already older than the limit is worth a second `gh` call for — a merged, closed
 * or non-draft pull request, or a draft claimed only moments ago, can never be `claimed-stale`
 * regardless of what its head commit date turns out to be (`kit/lib/board.ts`'s `isClaimedStale`). */
function couldBeStale(pr: BoardPr, now: number, staleMinutes: number): boolean {
  if (!pr.isDraft || pr.state !== 'OPEN' || !pr.createdAt) return false;
  return now - new Date(pr.createdAt).getTime() > staleMinutes * 60 * 1000;
}

/** The head commit's own date for one pull request, read with a second, narrow `gh pr view` call —
 * `null` when the payload carries no commit at all. */
function fetchHeadCommitDate({ repo, number, exec, env }: { repo: string; number: number | undefined; exec: Exec; env: Env | undefined }): string | null {
  const options: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', ...(env ? { env } : {}) };
  const raw = exec('gh', ['pr', 'view', String(number), '--repo', repo, '--json', 'commits'], options);
  const commits = GhPrCommitsSchema.parse(JSON.parse(raw)).commits ?? [];
  const last = commits.at(-1);
  return last?.committedDate ?? last?.authoredDate ?? null;
}

/** Widens every pull request that could possibly be `claimed-stale` with its own head commit date —
 * one extra `gh pr view` call each, never for a pull request the staleness rule could not apply to
 * anyway. */
function fetchHeadCommitDates(
  prs: BoardPr[],
  { repo, exec, env, now, staleMinutes }: { repo: string; exec: Exec; env: Env | undefined; now: number; staleMinutes: number },
): BoardPr[] {
  return prs.map((pr) =>
    couldBeStale(pr, now, staleMinutes)
      ? { ...pr, headCommitDate: fetchHeadCommitDate({ repo, number: pr.number, exec, env }) }
      : pr,
  );
}

const STATE_WIDTH = 'claimed-stale'.length;

/** A plan slice as the board reads it: `board.ts` types its wave as a number, the plan as a number or null. */
type PlanSlice = Slice & { wave: number };

/** A repository of a plan repository's slices that could not be read. */
type Unreadable = { repo: string | null | undefined; slug: string | null; reason: string };

function tableLine(row: BoardRow<PlanSlice>, repoWidth: number): string {
  const prCol = row.pr ? `#${row.pr.number}` : '—';
  const repoCol = row.repo === undefined ? '' : `${row.repo!.padEnd(repoWidth)}  `; // ts-allow: boardFor sets `repo` to a name or leaves it out
  return `  ${row.id.padEnd(6)} ${repoCol}w${row.wave}  ${row.state.padEnd(STATE_WIDTH)}  ${prCol.padEnd(6)} ${row.title}`;
}

/**
 * PRD `prd`'s board, built as `omni board` builds it: the plan's slices, this feature's own pull
 * requests from `gh pr list` (with a head commit date for each that could be `claimed-stale`), and
 * `boardFor`. Throws a `UsageError` for a PRD with no folder, no plan or a plan that cannot be read,
 * and whatever `gh` throws.
 * `repo` is `--repo`'s value, when given.
 *
 * In a plan repository whose plan has a `repo` column (PRD 563), it reads one pull-request list per
 * repository a slice names instead, and a repository `gh` cannot read makes only its own slices
 * `unreadable` rather than throwing.
 * It returns the plan's slices, the board, and each repository that could not be read (in a plan
 * repository).
 */
export function buildBoard(
  prd: number,
  { ctx, exec, env, repo: repoFlag, now = Date.now() }: { ctx: Context; exec: Exec; env?: Env | undefined; repo?: string | undefined; now?: number },
): { slices: PlanSlice[]; result: ReturnType<typeof boardFor<PlanSlice>>; unreadable: Unreadable[] } {
  const { markdown } = readPlan(prd, { ctx });
  let slices: PlanSlice[];
  try {
    slices = parsePlanSlices(markdown) as PlanSlice[]; // ts-allow: a slice with no wave reaches boardFor as it always has
  } catch (error) {
    throw usageError(`omni board: ${errorMessage(error)}`);
  }
  const topic = topicFor(prd, { ctx });
  const featureBranch = fillBranch(ctx.config.branches.feature, { topic });
  const repo = repoSlug('board', ctx, repoFlag);
  const ghEnv = githubEnv(ctx, { exec, env });
  const matchBy = ctx.config.board.matchBy;
  const subLabel = ctx.config.labels.sub;
  const staleMinutes = ctx.config.limits.claimStaleMinutes;
  const read = (slug: string) => {
    const listed = fetchPrList({ repo: slug, exec, env: ghEnv, matchBy, featureBranch, subLabel });
    return fetchHeadCommitDates(listed, { repo: slug, exec, env: ghEnv, now, staleMinutes });
  };

  if (slices.every((slice) => slice.repo === null)) {
    const prs = read(repo);
    const result = boardFor({ slices, prs, now, limits: ctx.config.limits, config: ctx.config, prd: { topic } });
    return { slices, result, unreadable: [] };
  }

  // A plan repository (PRD 563): one pull-request list per repository a slice names, each pull
  // request tagged with the slug it was read from; a repository gh cannot read holds only its slices.
  const known = knownRepositories(ctx, repo);
  const repos: BoardRepos = {};
  const prs: BoardPr[] = [];
  const unreadable: Unreadable[] = [];
  for (const name of new Set(slices.map((slice) => slice.repo))) {
    // `String(name)` is the key JavaScript itself would use for a slice with no repo name.
    const key = String(name);
    const slug = (typeof name === 'string' ? known.get(name) : undefined) ?? null;
    if (slug === null) {
      repos[key] = { slug: null, readable: false };
      unreadable.push({ repo: name, slug: null, reason: 'neither a target nor this plan repository' });
      continue;
    }
    try {
      prs.push(...read(slug).map((pr) => ({ ...pr, slug })));
      repos[key] = { slug, readable: true };
    } catch (error) {
      repos[key] = { slug, readable: false };
      unreadable.push({ repo: name, slug, reason: ghReason(error) });
    }
  }
  const result = boardFor({ slices, prs, now, limits: ctx.config.limits, config: ctx.config, prd: { topic }, repos });
  return { slices, result, unreadable };
}

/** The part of an `owner/name` slug after the `/`: the name a plan's `repo` column uses. */
function shortName(slug: string): string {
  return slug.slice(slug.indexOf('/') + 1);
}

/** Every repository a plan repository's slices may name, short name to slug: its `plan.targets`,
 * then the plan repository itself (`repo.slug`, or `--repo`). */
function knownRepositories(ctx: Context, planSlug: string): Map<string, string> {
  const known = new Map<string, string>();
  for (const target of ctx.config.plan?.targets ?? []) known.set(shortName(target.repo), target.repo);
  known.set(shortName(planSlug), planSlug);
  return known;
}

/** What gh said when it could not read a repository, as one line. */
function ghReason(error: unknown): string {
  const failure = error as { stderr?: unknown; message?: unknown } | null | undefined; // ts-allow: whatever was thrown, read as `error?.stderr` and `error?.message` read it
  const lines = `${failure?.stderr ?? ''}\n${failure?.message ?? ''}`.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines[0] ?? 'gh could not read it';
}

export const board: Command = {
  async run(args: string[], { ctx, stdout, exec, env }: CommandIo) {
    const { positional, flags } = parseArgs('board', args, { values: ['repo'], booleans: ['json'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = positiveInt('board', '<prd>', positional[0]);

    const { slices, result, unreadable } = buildBoard(prd, { ctx, exec, env, repo: flags.repo });

    if (flags.json) {
      println(stdout, JSON.stringify(result, null, 2));
      return 0;
    }

    println(stdout, `omni board — PRD ${prd}: ${slices.length} slice(s).`);
    const repoWidth = Math.max(0, ...result.slices.map((row) => (row.repo ?? '').length));
    for (const row of result.slices) println(stdout, tableLine(row, repoWidth));
    for (const { repo, slug, reason } of unreadable) {
      println(stdout, `omni board — cannot read ${slug ?? repo}: ${reason} — its slices are unreadable.`);
    }

    if (result.frontier.wave === null) {
      println(stdout, 'omni board — runnable frontier: none — nothing is takeable right now.');
    } else {
      const takeable = result.frontier.takeable.join(', ') || '(none — every candidate collides with another)';
      println(stdout, `omni board — runnable frontier: wave ${result.frontier.wave} — takeable: ${takeable}`);
      println(stdout, `omni board — of which runnable (unclaimed): ${result.frontier.runnable.join(', ') || '(none)'}`);
      if (result.frontier.excluded.length > 0) {
        println(
          stdout,
          `omni board — deferred by a same-wave territory collision (kept the earlier slice in plan order): ${result.frontier.excluded.join(', ')}`,
        );
      }
    }
    return 0;
  },
};
