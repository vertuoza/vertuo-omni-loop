// `omni board <prd> [--json] [--repo owner/name]` — the loop's view of a PRD's slices, rebuilt from
// the code host on every run. Reads the plan's own slice table (`parsePlanSlices`, which carries each
// slice's own `blocked by` ids), reads only this feature's own changes through the `LoopReads` port
// (PRD 1665: the Omni page, `kit/lib/loop-reads/`), narrowed by `board.matchBy` — never the whole
// repository — and hands the result to `boardFor` (`kit/lib/board.ts`) — the one place the state and
// the runnable frontier are decided. A change's head commit date is read with a second, per-change read,
// and only for the changes that could possibly be `claimed-stale` in the first place. It runs no `gh`.
//
// In a plan repository (PRD 563), a plan whose slices name their `repo` is read one list per
// repository a slice names (its `plan.targets` entry, or `repo.slug` for the plan repository), and a
// repository the page refuses (403, 424, 429) makes its own slices `unreadable` instead of failing the
// board. A read no repository can make (no sign-in, no answer, a page without the loop's routes) prints
// its one line on stderr and exits 1.
//
// A PRD whose plan has more than one landing (`landing` column) is read per landing: one list per
// landing branch (`branches.landing`) for its sub-PRs, and one by head for the landing's own change;
// the board then names the current landing and prints a line per landing.
//
// The command also says whether the branch the next wave builds on carries the default branch
// (issue 1179): `base` checks the feature branch, or the current landing's when its base is the
// default branch, with `git merge-base --is-ancestor <remote>/<default> <remote>/<branch>`. A plan cut
// while its phase-0 PR was open is otherwise built against the spec and plan before review.
//
// With `plan: { product }` (PRD 1548, s10), the targets the slices name are the product's, read from
// the Omni page (`withProductTargets`, `kit/lib/product/targets.ts`) before the board is built;
// `contextWithTargets` is that read for `omni board`, `omni next`, `omni care` and `omni flow`.
//
// `buildBoard` is that whole building part, exported so that `omni next`, `omni care` and the status
// line's background refresh (`omni statusline --refresh <n>`, PRD 324) build the board exactly as
// `omni board` does, from the reads they hand it; the command itself only prints what it returns.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardFor, fillBranch, inlineSlicesIn, inlineWave, landingBranches } from '../../lib/board.ts';
import type { BoardLanding, BoardPr, BoardRepos, BoardRow, LandingRow } from '../../lib/board.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context, ExecText } from '../../lib/context.ts';
import { gradedLandings } from '../../lib/inbox/plan-grade.ts';
import { landingPlan } from '../../lib/landings/landing-plan.ts';
import { withProductTargets } from '../../lib/product/targets.ts';
import type { ProductTargetsIo } from '../../lib/product/targets.ts';
import type { Slice } from '../../lib/inbox/territory.ts';
import { parsePlanLandings, parsePlanSlices } from '../../lib/inbox/territory.ts';
import { parseFolderName } from '../../lib/layout.ts';
import type { LoopChange } from '../../lib/loop-reads/contract.ts';
import { omniLoopReads } from '../../lib/loop-reads/omni.ts';
import { boardReads, holdsOneRepository, LoopReadError } from '../../lib/loop-reads/port.ts';
import type { BoardReads, LoopReads } from '../../lib/loop-reads/port.ts';
import { errorCode, errorMessage, parseArgs, prdArg, println, repoSlug, usageError } from '../args.ts';
import { defined, propertyOf } from '../../lib/narrow.ts';
import type { CommandIo, Exec, FreeCommand, FreeIo, Out } from '../io.ts';
import type { PrdNumber } from '../../lib/ids.ts';

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

/** What narrows a list to one feature's changes: its sub-PRs' base branch, or their label in `label` mode. */
type Narrowing = { matchBy: string; featureBranch: string; subLabel: string };

function narrowingOf({ matchBy, featureBranch, subLabel }: Narrowing): { base: string } | { label: string } {
  return matchBy === 'label' ? { label: subLabel } : { base: featureBranch };
}

/** A change as the board reads a pull request: `boardFor` keeps its own words (`OPEN`, `MERGED`). */
function boardPrOf(change: LoopChange): BoardPr {
  const state = change.state === 'merged' ? 'MERGED' : change.state === 'closed' ? 'CLOSED' : 'OPEN';
  return {
    number: change.number,
    title: change.title,
    headRefName: change.head,
    baseRefName: change.base,
    state,
    isDraft: change.state === 'draft',
    mergedAt: change.mergedAt,
    body: change.body,
    labels: change.labels,
    updatedAt: change.updatedAt,
    createdAt: change.createdAt,
    headCommitDate: null,
  };
}

/** Whether `pr` could possibly read as `claimed-stale` at all: only an open draft whose claim
 * (`createdAt`) is already older than the limit is worth a second read — a merged, closed or non-draft
 * pull request, or a draft claimed only moments ago, can never be `claimed-stale` regardless of what
 * its head commit date turns out to be (`kit/lib/board.ts`'s `isClaimedStale`). */
function couldBeStale(pr: BoardPr, now: number, staleMinutes: number): boolean {
  if (!pr.isDraft || pr.state !== 'OPEN' || !pr.createdAt) return false;
  return now - new Date(pr.createdAt).getTime() > staleMinutes * 60 * 1000;
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
 * The ids of the slices built inline (issue 1722): those a commit on one of `branches` (as the remote
 * has them) names in an `Omni-Slice:` trailer. Read only when `wave.inlineBelow` is set and an `exec`
 * is handed in, so a repository that never builds inline makes no git call here; a branch not yet
 * pushed or fetched names no slice.
 */
function inlineSlicesBuilt(ctx: Context, exec: ExecText | undefined, branches: readonly string[]): Set<string> {
  const built = new Set<string>();
  if (exec === undefined || ctx.config.wave.inlineBelow <= 0) return built;
  const { remote, defaultBranch } = ctx.config.repo;
  for (const branch of branches) {
    try {
      const messages = exec('git', ['log', `${remote}/${defaultBranch}..${remote}/${branch}`, '--format=%B'], {
        cwd: ctx.root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      for (const id of inlineSlicesIn(messages)) built.add(id);
    } catch {
      // The branch is not on the remote (yet): nothing was built on it.
    }
  }
  return built;
}

/** What a board is built from beyond its plan. */
type Built = { slices: Slice[]; result: ReturnType<typeof boardFor<Slice>>; unreadable: Unreadable[]; landings: BoardLanding[] };

/**
 * PRD `prd`'s board, built as `omni board` builds it: the plan's slices, this feature's own changes read
 * through `reads` (with a head commit date for each that could be `claimed-stale`), and `boardFor`.
 * Rejects with a `UsageError` for a PRD with no folder, no plan or a plan that cannot be read, and with
 * the `LoopReadError` of a read that cannot be made. `repo` is `--repo`'s value, when given. With an
 * `exec`, and `wave.inlineBelow` set, a slice built inline on the feature branch reads as merged
 * (`inlineSlicesBuilt`).
 *
 * In a plan repository whose plan has a `repo` column (PRD 563), it reads one list per repository a
 * slice names instead, and a repository refused alone (`holdsOneRepository`) makes only its own slices
 * `unreadable` rather than rejecting. It returns the plan's slices, the board, and each repository that
 * could not be read (in a plan repository).
 */
export async function buildBoard(
  prd: PrdNumber,
  { ctx, reads, repo: repoFlag, now = Date.now(), exec }: { ctx: Context; reads: BoardReads; repo?: string | undefined; now?: number; exec?: ExecText | undefined },
): Promise<Built> {
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
    reads,
    now,
    matchBy: ctx.config.board.matchBy,
    featureBranch: fillBranch(ctx.config.branches.feature, { topic }),
    subLabel: ctx.config.labels.sub,
    staleMinutes: ctx.config.limits.claimStaleMinutes,
  };
  const board = (prs: BoardPr[], more: { repos?: BoardRepos; landings: BoardLanding[] | null; inlineDone?: ReadonlySet<string> }) =>
    boardFor({ slices, prs, now, limits: ctx.config.limits, config: ctx.config, prd: { topic }, ...more });

  if (slices.every((slice) => slice.repo === null)) {
    const inlineDone = inlineSlicesBuilt(ctx, exec, landings.map(({ branch }) => branch));
    return { slices, result: board(await readPrs(repo, landed, reader), { landings: landed, inlineDone }), unreadable: [], landings };
  }

  // In a plan repository, each repository's own chain: only its landings, numbered within it.
  const chainOf = (name: string | null): BoardLanding[] | null =>
    landed === null
      ? null
      : landingPlan({ landings: planLandings, slices, branches: ctx.config.branches, defaultBranch: ctx.config.repo.defaultBranch, topic, repo: name }).map(
          (step) => ({ landing: step.planLanding, name: step.name, branch: step.branch, repo: name }),
        );
  const across = await readAcrossRepos(slices, { known: knownRepositories(ctx, repo), chainOf, reader });
  const chains = landed === null ? null : across.chains;
  return { slices, result: board(across.prs, { repos: across.repos, landings: chains }), unreadable: across.unreadable, landings: chains ?? landings };
}

/** What reading a feature's changes needs: the reads, and the config it narrows by. */
type Reader = { reads: BoardReads; now: number; staleMinutes: number } & Narrowing;

/** One repository's pull requests of this feature, each that could be `claimed-stale` with its head
 * commit date. With a landing chain: the sub-PRs into each landing branch (once, by label, in
 * `label` mode), then each landing's own pull request by head. */
async function readPrs(slug: string, chain: readonly BoardLanding[] | null, reader: Reader): Promise<BoardPr[]> {
  const { reads, now, staleMinutes, ...narrowing } = reader;
  const list = async (query: { base: string } | { label: string } | { head: string }) =>
    (await reads.changes({ repo: slug, state: 'all', ...query })).map(boardPrOf);
  let prs: BoardPr[];
  if (chain === null) prs = await list(narrowingOf(narrowing));
  else {
    const subs =
      narrowing.matchBy === 'label'
        ? await list(narrowingOf(narrowing))
        : (await Promise.all(chain.map(({ branch }) => list(narrowingOf({ ...narrowing, featureBranch: branch }))))).flat();
    const heads = (await Promise.all(chain.map(({ branch }) => list({ head: branch })))).flat();
    const byNumber = new Map<number | undefined, BoardPr>();
    for (const pr of [...subs, ...heads]) if (!byNumber.has(pr.number)) byNumber.set(pr.number, pr);
    prs = [...byNumber.values()];
  }
  return Promise.all(
    prs.map(async (pr) =>
      pr.number !== undefined && couldBeStale(pr, now, staleMinutes) ? { ...pr, headCommitDate: await reads.lastCommitAt(slug, pr.number) } : pr,
    ),
  );
}

/**
 * A plan repository's pull requests (PRD 563): one list per repository a slice names, each pull
 * request tagged with the slug it was read from; a repository refused alone holds only its slices.
 * With landings, each repository is read along its own chain, and `chains` gathers them.
 */
async function readAcrossRepos(
  slices: readonly Slice[],
  { known, chainOf, reader }: { known: Map<string, string>; chainOf: (name: string | null) => BoardLanding[] | null; reader: Reader },
): Promise<{ prs: BoardPr[]; repos: BoardRepos; unreadable: Unreadable[]; chains: BoardLanding[] }> {
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
      out.prs.push(...(await readPrs(slug, chain, reader)).map((pr) => ({ ...pr, slug })));
      out.repos[key] = { slug, readable: true };
    } catch (error) {
      if (!holdsOneRepository(error)) throw error;
      out.repos[key] = { slug, readable: false };
      out.unreadable.push({ repo: name, slug, reason: error.line });
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

/** Whether the branch the next wave builds on carries `onto`, the default branch on the remote:
 * `behind` true when it does not, false when it does, null when git cannot say (a branch not
 * pushed yet, a ref not fetched). */
type BoardBase = { branch: string; onto: string; behind: boolean | null };

/** The branch the next wave builds on, when its base is the default branch: the feature branch, or
 * the current landing's — landing 1, or a later one whose pull request is based on the default
 * branch (retargeted once the landing before it merged). Null in a plan repository's board, with
 * every landing merged, or while the current landing is stacked on the one before. */
function branchOnDefault(ctx: Context, built: Built): string | null {
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
function baseOf(ctx: Context, exec: Exec, built: Built): BoardBase | null {
  const branch = branchOnDefault(ctx, built);
  if (branch === null) return null;
  const { remote, defaultBranch } = ctx.config.repo;
  const onto = `${remote}/${defaultBranch}`;
  return { branch, onto, behind: ancestry(ctx, exec, onto, `${remote}/${branch}`) };
}

/** The board's rows, under a line per landing when it has more than one. */
function printRows(stdout: Out, result: Built['result']): void {
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
function printFrontier(stdout: Out, result: Built['result']): void {
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

/** What the board says last: that a wave builds it inline (`inlineBelow` is then the threshold), and that
 * its branch is behind the default branch. */
function printNotices(stdout: Out, { inlineBelow, base }: { inlineBelow: number | null; base: BoardBase | null }): void {
  if (inlineBelow !== null) {
    println(stdout, `omni board — inline: fewer than ${inlineBelow} slices (wave.inlineBelow) — a wave builds them on the feature branch, with no sub-PR.`);
  }
  if (base?.behind === true) {
    println(stdout, `omni board — ${base.branch} is behind ${base.onto}: merge ${base.onto} into it before reading the plan or running a wave.`);
  }
}

/** What a command that reads a product's targets is handed: a free command's, what a test hands in for
 * the read (the sign-in, the app, the clock), and a test's own `LoopReads` for the loop's reads. */
export type TargetsIo = FreeIo & Omit<ProductTargetsIo, 'cwd' | 'exec'> & { reads?: LoopReads | undefined };

/** The loop's reads for `ctx`: a test's own `LoopReads`, or the Omni page's with the io's sign-in. */
export function loopReadsFor(ctx: Context, { reads, tokens, home, fetch, callMs }: TargetsIo): LoopReads {
  return reads ?? omniLoopReads({ askUrl: ctx.config.ask.url, tokens, home, fetch, callMs });
}

/**
 * The context `omni <verb>` runs in, loaded from `io.cwd`: with `plan: { product }`, its
 * `plan.targets` are the product's, read from the server, the last read's line on stderr when the
 * copy answered. A usage error, with the line saying why, when they cannot be read.
 */
export async function contextWithTargets(verb: string, io: TargetsIo): Promise<Context> {
  const read = await withProductTargets(loadContext(io.cwd, { exec: io.exec }), io, io.stderr);
  if (typeof read === 'string') throw usageError(`omni ${verb}: ${read}`);
  return read;
}

/** A subcommand of `omni care` or `omni flow`: its run, handed the command's io and the free io it was
 * run with (for the loop's reads), and whether the arguments it is given need a plan repository's targets. */
export type TargetsSubcommand = {
  run: (args: string[], io: CommandIo, free: TargetsIo) => number | Promise<number>;
  targets: (args: readonly string[]) => boolean;
};

/**
 * Runs the subcommand `args` names among `subcommands`, in the context `contextWithTargets` reads when
 * its arguments need the targets, and in the plain context otherwise, so that it calls no server.
 */
export async function runWithTargets(verb: string, usage: string, subcommands: Record<string, TargetsSubcommand>, args: string[], io: TargetsIo): Promise<number> {
  const [sub = '', ...rest] = args;
  const command = Object.hasOwn(subcommands, sub) ? subcommands[sub] : undefined;
  if (command === undefined) throw usageError(usage);
  const ctx = command.targets(rest) ? await contextWithTargets(verb, io) : loadContext(io.cwd, { exec: io.exec });
  return command.run(rest, { ctx, stdout: io.stdout, stderr: io.stderr, exec: io.exec, env: io.env, vars: io.vars }, io);
}

export const board = {
  withoutContext: true,
  async run(args: string[], io: TargetsIo): Promise<number> {
    const { stdout, stderr } = io;
    const { positional, flags } = parseArgs('board', args, { values: ['repo'], booleans: ['json'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = prdArg('board', '<prd>', positional[0]);
    const ctx = await contextWithTargets('board', io);
    const loop = loopReadsFor(ctx, io);

    let built: Built;
    try {
      built = await buildBoard(prd, { ctx, reads: boardReads(loop), repo: flags.repo, exec: io.exec });
    } catch (error) {
      if (!(error instanceof LoopReadError)) throw error;
      println(stderr, error.line);
      return 1;
    }
    const { slices, result, unreadable } = built;
    const base = baseOf(ctx, io.exec, built);

    const inline = inlineWave(result, ctx.config.wave.inlineBelow);
    if (flags.json) {
      println(stdout, JSON.stringify({ ...result, base, inline }, null, 2));
      return 0;
    }

    println(stdout, `omni board — PRD ${prd}: ${slices.length} slice(s).`);
    printRows(stdout, result);
    for (const { repo, slug, reason } of unreadable) {
      println(stdout, `omni board — cannot read ${slug ?? repo}: ${reason} — its slices are unreadable.`);
    }
    printFrontier(stdout, result);
    printNotices(stdout, { inlineBelow: inline ? ctx.config.wave.inlineBelow : null, base });
    return 0;
  },
} satisfies FreeCommand;
