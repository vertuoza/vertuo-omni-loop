// `omni board <prd> [--json] [--repo owner/name]` — the loop's view of a PRD's slices, rebuilt from
// GitHub on every run. Reads the plan's own slice table (`parsePlanSlices`, which carries each
// slice's own `blocked by` ids), fetches only this feature's own pull requests (`gh pr list`,
// narrowed by `board.matchBy` — never the whole repository), and hands the result to `boardFor`
// (`kit/lib/board.mjs`) — the one place the state and the runnable frontier are decided. `commits`
// is never asked of `gh pr list`: on a repository with any real history that field alone can blow
// the GraphQL node-limit even at a small page size, so a head commit date is fetched with a second,
// per-pull-request `gh pr view --json commits` call, and only for the pull requests that could
// possibly be `claimed-stale` in the first place.
//
// `buildBoard` is that whole building part, exported so that the status line's background refresh
// (`omni statusline --refresh <n>`, PRD 324) builds the board exactly as `omni board` does; the
// command itself only prints what it returns.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardFor, fillBranch } from '../../lib/board.mjs';
import { parsePlanSlices } from '../../lib/inbox/territory.mjs';
import { parseFolderName } from '../../lib/layout.mjs';
import { githubEnv } from '../github.mjs';
import { parseArgs, positiveInt, println, repoSlug, usageError } from '../args.mjs';

const USAGE = 'usage: omni board <prd> [--json] [--repo <owner/name>]';

function readPlan(prd, { ctx }) {
  const planPath = ctx.layout.planPath(prd);
  if (planPath === null) throw usageError(`omni board: PRD ${prd} has no inbox or shipped folder.`);
  try {
    return { planPath, markdown: readFileSync(join(ctx.root, planPath), 'utf8') };
  } catch (error) {
    if (error?.code === 'ENOENT') throw usageError(`omni board: no plan at ${planPath}.`);
    throw error;
  }
}

/** The PRD folder's own topic, which fills `{topic}` in `branches.feature` and `branches.slice`. */
function topicFor(prd, { ctx }) {
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
function narrowingArgs({ matchBy, featureBranch, subLabel }) {
  return matchBy === 'label' ? ['--label', subLabel] : ['--base', featureBranch];
}

/** Every pull request of this feature — never the whole repository's. */
function fetchPrList({ repo, exec, env, matchBy, featureBranch, subLabel }) {
  const options = { encoding: 'utf8', ...(env ? { env } : {}) };
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
  return JSON.parse(raw).map((pr) => ({ ...pr, headCommitDate: null }));
}

/** Whether `pr` could possibly read as `claimed-stale` at all: only an open draft whose claim
 * (`createdAt`) is already older than the limit is worth a second `gh` call for — a merged, closed
 * or non-draft pull request, or a draft claimed only moments ago, can never be `claimed-stale`
 * regardless of what its head commit date turns out to be (`kit/lib/board.mjs`'s `isClaimedStale`). */
function couldBeStale(pr, now, staleMinutes) {
  if (!pr.isDraft || pr.state !== 'OPEN' || !pr.createdAt) return false;
  return now - new Date(pr.createdAt).getTime() > staleMinutes * 60 * 1000;
}

/** The head commit's own date for one pull request, read with a second, narrow `gh pr view` call —
 * `null` when the payload carries no commit at all. */
function fetchHeadCommitDate({ repo, number, exec, env }) {
  const options = { encoding: 'utf8', ...(env ? { env } : {}) };
  const raw = exec('gh', ['pr', 'view', String(number), '--repo', repo, '--json', 'commits'], options);
  const commits = JSON.parse(raw).commits ?? [];
  const last = commits.at(-1);
  return last?.committedDate ?? last?.authoredDate ?? null;
}

/** Widens every pull request that could possibly be `claimed-stale` with its own head commit date —
 * one extra `gh pr view` call each, never for a pull request the staleness rule could not apply to
 * anyway. */
function fetchHeadCommitDates(prs, { repo, exec, env, now, staleMinutes }) {
  return prs.map((pr) =>
    couldBeStale(pr, now, staleMinutes)
      ? { ...pr, headCommitDate: fetchHeadCommitDate({ repo, number: pr.number, exec, env }) }
      : pr,
  );
}

const STATE_WIDTH = 'claimed-stale'.length;

function tableLine(row) {
  const prCol = row.pr ? `#${row.pr.number}` : '—';
  return `  ${row.id.padEnd(6)} w${row.wave}  ${row.state.padEnd(STATE_WIDTH)}  ${prCol.padEnd(6)} ${row.title}`;
}

/**
 * PRD `prd`'s board, built as `omni board` builds it: the plan's slices, this feature's own pull
 * requests from `gh pr list` (with a head commit date for each that could be `claimed-stale`), and
 * `boardFor`. Throws a `UsageError` for a PRD with no folder, no plan or a plan that cannot be read,
 * and whatever `gh` throws.
 *
 * @param {number} prd
 * @param {{ ctx: object, exec: Function, env?: object, repo?: string, now?: number }} options `repo`
 *   is `--repo`'s value, when given
 * @returns {{ slices: object[], result: ReturnType<typeof boardFor> }} the plan's slices, and the board
 */
export function buildBoard(prd, { ctx, exec, env, repo: repoFlag, now = Date.now() }) {
  const { markdown } = readPlan(prd, { ctx });
  let slices;
  try {
    slices = parsePlanSlices(markdown);
  } catch (error) {
    throw usageError(`omni board: ${error.message}`);
  }
  const topic = topicFor(prd, { ctx });
  const featureBranch = fillBranch(ctx.config.branches.feature, { topic });
  const repo = repoSlug('board', ctx, repoFlag);
  const ghEnv = githubEnv(ctx, { exec, env });
  const matchBy = ctx.config.board.matchBy;
  const subLabel = ctx.config.labels.sub;
  const staleMinutes = ctx.config.limits.claimStaleMinutes;

  const listed = fetchPrList({ repo, exec, env: ghEnv, matchBy, featureBranch, subLabel });
  const prs = fetchHeadCommitDates(listed, { repo, exec, env: ghEnv, now, staleMinutes });

  const result = boardFor({ slices, prs, now, limits: ctx.config.limits, config: ctx.config, prd: { topic } });
  return { slices, result };
}

export const board = {
  async run(args, { ctx, stdout, exec, env }) {
    const { positional, flags } = parseArgs('board', args, { values: ['repo'], booleans: ['json'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = positiveInt('board', '<prd>', positional[0]);

    const { slices, result } = buildBoard(prd, { ctx, exec, env, repo: flags.repo });

    if (flags.json) {
      println(stdout, JSON.stringify(result, null, 2));
      return 0;
    }

    println(stdout, `omni board — PRD ${prd}: ${slices.length} slice(s).`);
    for (const row of result.slices) println(stdout, tableLine(row));

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
