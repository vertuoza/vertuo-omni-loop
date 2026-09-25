// `omni board <prd> [--json] [--repo owner/name]` — the loop's view of a PRD's slices, rebuilt from
// GitHub on every run. Reads the plan's own slice table (`parsePlanSlices`, plus the `blocked by`
// column read the same narrow way `omni plan check` already does), fetches only this feature's own
// pull requests (`gh pr list`, narrowed by `board.matchBy` — never the whole repository), and hands
// the result to `boardFor` (`kit/lib/board.mjs`) — the one place the state and the runnable
// frontier are decided. `commits` is never asked of `gh pr list`: on a repository with any real
// history that field alone can blow the GraphQL node-limit even at a small page size, so a head
// commit date is fetched with a second, per-pull-request `gh pr view --json commits` call, and only
// for the pull requests that could possibly be `claimed-stale` in the first place.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardFor, fillBranch } from '../../lib/board.mjs';
import { parsePlanSlices } from '../../lib/inbox/territory.mjs';
import { parseFolderName } from '../../lib/layout.mjs';
import { githubEnv } from '../github.mjs';
import { parseArgs, positiveInt, println, repoSlug, usageError } from '../args.mjs';

const USAGE = 'usage: omni board <prd> [--json] [--repo <owner/name>]';

function isTableRow(line) {
  return line.trim().startsWith('|');
}

function isSeparatorRow(line) {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const NOTHING = /^[—–-]?$/;

/** The ids one `blocked by` cell names — comma-separated, backticks stripped. `[]` for a cell that
 * declares nothing. Mirrors `omni plan check`'s own reading of this column: `parsePlanSlices`
 * (`kit/lib/inbox/territory.mjs`) deliberately stops at `id`, `slice`, `territory` and `wave`, so
 * every command that also needs `blocked by` reads the same table a second, narrower way rather
 * than widen that module's job. */
function blockedByCell(cell) {
  const text = (cell ?? '').trim();
  if (NOTHING.test(text)) return [];
  return text
    .split(',')
    .map((token) => token.replace(/`/g, '').trim())
    .filter(Boolean);
}

/** The plan's own slice table's `blocked by` column, by id — a `Map<id, string[]>`. */
function blockedByColumn(markdown) {
  const lines = markdown.split('\n');
  const headerIndex = lines.findIndex((line) => isTableRow(line) && /^\|\s*id\s*\|/i.test(line.trim()));
  const map = new Map();
  if (headerIndex === -1) return map;

  const header = cells(lines[headerIndex]).map((name) => name.toLowerCase());
  const idCol = header.indexOf('id');
  const blockedCol = header.indexOf('blocked by');
  if (blockedCol === -1) return map;

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isTableRow(line)) break;
    if (isSeparatorRow(line)) continue;
    const row = cells(line);
    const id = row[idCol];
    if (!id) continue;
    map.set(id, blockedByCell(row[blockedCol]));
  }
  return map;
}

/** The plan's slices, each widened with its own `blocked by` ids. */
function slicesWithBlockers(markdown) {
  const slices = parsePlanSlices(markdown);
  const blockedBy = blockedByColumn(markdown);
  return slices.map((slice) => ({ ...slice, blockedBy: blockedBy.get(slice.id) ?? [] }));
}

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

export const board = {
  async run(args, { ctx, stdout, exec, env }) {
    const { positional, flags } = parseArgs('board', args, { values: ['repo'], booleans: ['json'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = positiveInt('board', '<prd>', positional[0]);

    const { markdown } = readPlan(prd, { ctx });
    let slices;
    try {
      slices = slicesWithBlockers(markdown);
    } catch (error) {
      throw usageError(`omni board: ${error.message}`);
    }
    const topic = topicFor(prd, { ctx });
    const featureBranch = fillBranch(ctx.config.branches.feature, { topic });
    const repo = repoSlug('board', ctx, flags.repo);
    const ghEnv = githubEnv(ctx, { exec, env });
    const now = Date.now();
    const matchBy = ctx.config.board.matchBy;
    const subLabel = ctx.config.labels.sub;
    const staleMinutes = ctx.config.limits.claimStaleMinutes;

    const listed = fetchPrList({ repo, exec, env: ghEnv, matchBy, featureBranch, subLabel });
    const prs = fetchHeadCommitDates(listed, { repo, exec, env: ghEnv, now, staleMinutes });

    const result = boardFor({ slices, prs, now, limits: ctx.config.limits, config: ctx.config, prd: { topic } });

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
