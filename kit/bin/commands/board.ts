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
// A PRD whose plan has more than one landing (`landing` column) is read per landing: one `gh pr list`
// per landing branch (`branches.landing`) for its sub-PRs, and one by head for the landing's own
// pull request; the board then names the current landing and prints a line per landing.
//
// The command also says whether the branch the next wave builds on carries the default branch
// (issue 1179): `base` checks the feature branch, or the current landing's when its base is the
// default branch, with `git merge-base --is-ancestor <remote>/<default> <remote>/<branch>`. A plan cut
// while its phase-0 PR was open is otherwise built against the spec and plan before review.
//
// `buildBoard` is that whole building part, exported so that the status line's background refresh
// (`omni statusline --refresh <n>`, PRD 324) builds the board exactly as `omni board` does; the
// command itself only prints what it returns.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardFor, fillBranch, landingBranches } from '../../lib/board.ts';
import type { BoardLanding, BoardPr, BoardRepos, BoardRow, LandingRow } from '../../lib/board.ts';
import { gradedLandings } from '../../lib/inbox/plan-grade.ts';
import { landingPlan } from '../../lib/landings/landing-plan.ts';
import type { Context } from '../../lib/context.ts';
import type { Slice } from '../../lib/inbox/territory.ts';
import { parsePlanLandings, parsePlanSlices } from '../../lib/inbox/territory.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { githubEnv } from '../github.ts';
import { errorCode, errorMessage, parseArgs, prdArg, println, repoSlug, usageError } from '../args.ts';
import { defined, propertyOf } from '../../lib/narrow.ts';
import type { Command, CommandIo, Env, Exec } from '../io.ts';
import { GhPrCommitsSchema, GhPrListSchema } from '../schema.ts';
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { synchronous } from '../synchronous.ts';
import type { PrNumber, PrdNumber } from '../../lib/ids.ts';

const USAGE = 'usage: omni board <prd> [--json] [--repo <owner/name>]';

function readPlan(prd: PrdNumber, { ctx }: { ctx: Context }): { planPath: string; markdown: string } {
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
function topicFor(prd: PrdNumber, { ctx }: { ctx: Context }): string {
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

/** Every pull request of this feature — never the whole repository's. With `head`, the pull
 * requests whose head is that branch instead: a landing's own. */
function fetchPrList({ repo, exec, env, matchBy, featureBranch, subLabel, head = null }: { repo: string; exec: Exec; env: Env | undefined; head?: string | null } & Narrowing): BoardPr[] {
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
      ...(head === null ? narrowingArgs({ matchBy, featureBranch, subLabel }) : ['--head', head]),
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
function fetchHeadCommitDate({ repo, number, exec, env }: { repo: string; number: PrNumber | undefined; exec: Exec; env: Env | undefined }): string | null {
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

/** A repository of a plan repository's slices that could not be read. */
type Unreadable = { repo: string | null | undefined; slug: string | null; reason: string };

function tableLine(row: BoardRow<Slice>, repoWidth: number): string {
  const prCol = row.pr ? `#${row.pr.number}` : '—';
  const repoCol = row.repo === undefined ? '' : `${defined(row.repo, `the repository of ${row.id}`).padEnd(repoWidth)}  `;
  return `  ${row.id.padEnd(6)} ${repoCol}w${row.wave}  ${row.state.padEnd(STATE_WIDTH)}  ${prCol.padEnd(6)} ${row.title}`;
}

/** A landing's header line: its number, name and branch, its counts, its pull request's state, and
 * whether it is the landing a wave takes from now. */
function landingLine(landing: LandingRow): string {
  const pr = landing.pr.number === null ? 'no PR' : `#${landing.pr.number} ${landing.pr.state}`;
  const counts = `${landing.merged}/${landing.slices.length} merged, ${landing.open} open, ${landing.notStarted} not started`;
  const where = landing.repo === undefined || landing.repo === null ? '' : `${landing.repo} `;
  return ` ${where}landing ${landing.landing} (${landing.name}) ${landing.branch} — ${counts} — ${pr}${landing.current ? ' — current' : ''}`;
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
  prd: PrdNumber,
  { ctx, exec, env, repo: repoFlag, now = Date.now() }: { ctx: Context; exec: Exec; env?: Env | undefined; repo?: string | undefined; now?: number },
): { slices: Slice[]; result: ReturnType<typeof boardFor<Slice>>; unreadable: Unreadable[]; landings: BoardLanding[] } {
  const { markdown } = readPlan(prd, { ctx });
  let slices: Slice[];
  try {
    slices = parsePlanSlices(markdown);
  } catch (error) {
    throw usageError(`omni board: ${errorMessage(error)}`);
  }
  const topic = topicFor(prd, { ctx });
  const planLandings = gradedLandings(slices, parsePlanLandings(markdown));
  const landings = landingBranches(ctx.config.branches, { topic, landings: planLandings });
  const landed = landings.length > 1 ? landings : null;
  const repo = repoSlug('board', ctx, repoFlag);
  const reader: Reader = {
    exec,
    env: githubEnv(ctx, { exec, env }),
    now,
    matchBy: ctx.config.board.matchBy,
    featureBranch: fillBranch(ctx.config.branches.feature, { topic }),
    subLabel: ctx.config.labels.sub,
    staleMinutes: ctx.config.limits.claimStaleMinutes,
  };
  const board = (prs: BoardPr[], more: { repos?: BoardRepos; landings: BoardLanding[] | null }) =>
    boardFor({ slices, prs, now, limits: ctx.config.limits, config: ctx.config, prd: { topic }, ...more });

  if (slices.every((slice) => slice.repo === null)) {
    return { slices, result: board(readPrs(repo, landed, reader), { landings: landed }), unreadable: [], landings };
  }

  // In a plan repository, each repository's own chain: only its landings, numbered within it.
  const chainOf = (name: string | null): BoardLanding[] | null =>
    landed === null
      ? null
      : landingPlan({ landings: planLandings, slices, branches: ctx.config.branches, defaultBranch: ctx.config.repo.defaultBranch, topic, repo: name }).map(
          (step) => ({ landing: step.planLanding, name: step.name, branch: step.branch, repo: name }),
        );
  const across = readAcrossRepos(slices, { known: knownRepositories(ctx, repo), chainOf, reader });
  const chains = landed === null ? null : across.chains;
  return { slices, result: board(across.prs, { repos: across.repos, landings: chains }), unreadable: across.unreadable, landings: chains ?? landings };
}

/** What reading a feature's pull requests needs: the `gh` call's means and the config it narrows by. */
type Reader = { exec: Exec; env: Env | undefined; now: number; staleMinutes: number } & Narrowing;

/** One repository's pull requests of this feature, each that could be `claimed-stale` with its head
 * commit date. With a landing chain: the sub-PRs into each landing branch (once, by label, in
 * `label` mode), then each landing's own pull request by head. */
function readPrs(slug: string, chain: readonly BoardLanding[] | null, reader: Reader): BoardPr[] {
  const { exec, env, now, staleMinutes, ...narrowing } = reader;
  const list = (more: Partial<Narrowing> & { head?: string }) => fetchPrList({ repo: slug, exec, env, ...narrowing, ...more });
  let prs: BoardPr[];
  if (chain === null) prs = list({});
  else {
    const subs = narrowing.matchBy === 'label' ? list({}) : chain.flatMap(({ branch }) => list({ featureBranch: branch }));
    const byNumber = new Map<number | undefined, BoardPr>();
    for (const pr of [...subs, ...chain.flatMap(({ branch }) => list({ head: branch }))]) if (!byNumber.has(pr.number)) byNumber.set(pr.number, pr);
    prs = [...byNumber.values()];
  }
  return fetchHeadCommitDates(prs, { repo: slug, exec, env, now, staleMinutes });
}

/**
 * A plan repository's pull requests (PRD 563): one list per repository a slice names, each pull
 * request tagged with the slug it was read from; a repository gh cannot read holds only its slices.
 * With landings, each repository is read along its own chain, and `chains` gathers them.
 */
function readAcrossRepos(
  slices: readonly Slice[],
  { known, chainOf, reader }: { known: Map<string, string>; chainOf: (name: string | null) => BoardLanding[] | null; reader: Reader },
): { prs: BoardPr[]; repos: BoardRepos; unreadable: Unreadable[]; chains: BoardLanding[] } {
  const out: { prs: BoardPr[]; repos: BoardRepos; unreadable: Unreadable[]; chains: BoardLanding[] } = { prs: [], repos: {}, unreadable: [], chains: [] };
  for (const name of new Set(slices.map((slice) => slice.repo))) {
    const chain = chainOf(name);
    out.chains.push(...(chain ?? []));
    // `String(name)` is the key JavaScript itself would use for a slice with no repo name.
    const key = String(name);
    const slug = (typeof name === 'string' ? known.get(name) : undefined) ?? null;
    if (slug === null) {
      out.repos[key] = { slug: null, readable: false };
      out.unreadable.push({ repo: name, slug: null, reason: 'neither a target nor this plan repository' });
      continue;
    }
    try {
      out.prs.push(...readPrs(slug, chain, reader).map((pr) => ({ ...pr, slug })));
      out.repos[key] = { slug, readable: true };
    } catch (error) {
      out.repos[key] = { slug, readable: false };
      out.unreadable.push({ repo: name, slug, reason: ghReason(error) });
    }
  }
  return out;
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

/** What a process wrote, as text: a string as it is, a buffer decoded, nothing for anything else. */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  return Buffer.isBuffer(value) ? value.toString() : '';
}

/** What gh said when it could not read a repository, as one line. */
function ghReason(error: unknown): string {
  const lines = `${textOf(propertyOf(error, 'stderr'))}\n${textOf(propertyOf(error, 'message'))}`.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines[0] ?? 'gh could not read it';
}

/** Whether the branch the next wave builds on carries `onto`, the default branch on the remote:
 * `behind` true when it does not, false when it does, null when git cannot say (a branch not
 * pushed yet, a ref not fetched). */
type BoardBase = { branch: string; onto: string; behind: boolean | null };

/** The branch the next wave builds on, when its base is the default branch: the feature branch, or
 * the current landing's — landing 1, or a later one whose pull request is based on the default
 * branch (retargeted once the landing before it merged). Null in a plan repository's board, with
 * every landing merged, or while the current landing is stacked on the one before. */
function branchOnDefault(ctx: Context, built: ReturnType<typeof buildBoard>): string | null {
  const { slices, result } = built;
  if (slices.some((slice) => slice.repo !== null)) return null;
  if (result.landings === undefined) return fillBranch(ctx.config.branches.feature, { topic: result.prd.topic });
  const index = result.landings.findIndex((landing) => landing.current);
  const current = result.landings[index];
  if (current === undefined) return null;
  return index === 0 || current.pr.base === ctx.config.repo.defaultBranch ? current.branch : null;
}

/** Status 1 is git's own "not an ancestor"; anything else is a question git could not answer. */
function ancestry(ctx: Context, exec: Exec, onto: string, head: string): boolean | null {
  try {
    exec('git', ['merge-base', '--is-ancestor', onto, head], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return false;
  } catch (error) {
    return propertyOf(error, 'status') === 1 ? true : null;
  }
}

/** The board's `base`: see `BoardBase`. */
function baseOf(ctx: Context, exec: Exec, built: ReturnType<typeof buildBoard>): BoardBase | null {
  const branch = branchOnDefault(ctx, built);
  if (branch === null) return null;
  const { remote, defaultBranch } = ctx.config.repo;
  const onto = `${remote}/${defaultBranch}`;
  return { branch, onto, behind: ancestry(ctx, exec, onto, `${remote}/${branch}`) };
}

/** The board's rows, under a line per landing when it has more than one. */
function printRows(stdout: CommandIo['stdout'], result: ReturnType<typeof buildBoard>['result']): void {
  const repoWidth = Math.max(0, ...result.slices.map((row) => (row.repo ?? '').length));
  if (result.landings === undefined) {
    for (const row of result.slices) println(stdout, tableLine(row, repoWidth));
    return;
  }
  for (const landing of result.landings) {
    println(stdout, landingLine(landing));
    for (const row of result.slices.filter((candidate) => landing.slices.includes(candidate.id))) println(stdout, tableLine(row, repoWidth));
  }
}

/** The runnable frontier, in words. */
function printFrontier(stdout: CommandIo['stdout'], result: ReturnType<typeof buildBoard>['result']): void {
  const { frontier } = result;
  if (frontier.wave === null) {
    println(stdout, 'omni board — runnable frontier: none — nothing is takeable right now.');
    if (result.landings !== undefined && result.currentLanding === null) println(stdout, 'omni board — every landing has all its slices merged.');
    return;
  }
  const takeable = frontier.takeable.join(', ') || '(none — every candidate collides with another)';
  const where = result.currentLanding === undefined ? '' : ` of landing ${result.currentLanding}`;
  println(stdout, `omni board — runnable frontier: wave ${frontier.wave}${where} — takeable: ${takeable}`);
  println(stdout, `omni board — of which runnable (unclaimed): ${frontier.runnable.join(', ') || '(none)'}`);
  if (frontier.excluded.length > 0) {
    println(stdout, `omni board — deferred by a same-wave territory collision (kept the earlier slice in plan order): ${frontier.excluded.join(', ')}`);
  }
}

export const board: Command = {
  run: synchronous((args: string[], { ctx, stdout, exec, env }: CommandIo): number => {
    const { positional, flags } = parseArgs('board', args, { values: ['repo'], booleans: ['json'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = prdArg('board', '<prd>', positional[0]);

    const built = buildBoard(prd, { ctx, exec, env, repo: flags.repo });
    const { slices, result, unreadable } = built;
    const base = baseOf(ctx, exec, built);

    if (flags.json) {
      println(stdout, JSON.stringify({ ...result, base }, null, 2));
      return 0;
    }

    println(stdout, `omni board — PRD ${prd}: ${slices.length} slice(s).`);
    printRows(stdout, result);
    for (const { repo, slug, reason } of unreadable) {
      println(stdout, `omni board — cannot read ${slug ?? repo}: ${reason} — its slices are unreadable.`);
    }
    printFrontier(stdout, result);
    if (base?.behind === true) {
      println(stdout, `omni board — ${base.branch} is behind ${base.onto}: merge ${base.onto} into it before reading the plan or running a wave.`);
    }
    return 0;
  }),
};
