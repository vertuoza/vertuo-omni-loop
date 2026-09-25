// `omni board <prd> [--json] [--repo owner/name]` — the loop's view of a PRD's slices, rebuilt from
// GitHub on every run. Reads the plan's own slice table (`parsePlanSlices`, plus the `blocked by`
// column read the same narrow way `omni plan check` already does), fetches every pull request with
// `gh pr list --json … --state all --limit 200`, and hands both to `boardFor`
// (`kit/lib/board.mjs`) — the one place the state and the runnable frontier are decided.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardFor } from '../../lib/board.mjs';
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

const PR_FIELDS = [
  'number',
  'title',
  'headRefName',
  'baseRefName',
  'state',
  'isDraft',
  'mergedAt',
  'body',
  'labels',
  'updatedAt',
  'createdAt',
  'commits',
];

/** The head commit's own date — the most recent entry `gh pr list --json commits` returns — or
 * `null` when the payload carries none. */
function headCommitDate(pr) {
  const commits = pr.commits ?? [];
  const last = commits.at(-1);
  return last?.committedDate ?? last?.authoredDate ?? null;
}

/** Every pull request of `repo`, flattened to what `boardFor` reads: the `commits` array collapses
 * to the one date the staleness rule needs. */
function fetchPrs({ repo, exec, env }) {
  const options = { encoding: 'utf8', ...(env ? { env } : {}) };
  const raw = exec(
    'gh',
    ['pr', 'list', '--repo', repo, '--json', PR_FIELDS.join(','), '--state', 'all', '--limit', '200'],
    options,
  );
  return JSON.parse(raw).map((pr) => ({
    number: pr.number,
    title: pr.title,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    state: pr.state,
    isDraft: pr.isDraft,
    mergedAt: pr.mergedAt,
    body: pr.body,
    labels: pr.labels,
    updatedAt: pr.updatedAt,
    createdAt: pr.createdAt,
    headCommitDate: headCommitDate(pr),
  }));
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
    const repo = repoSlug('board', ctx, flags.repo);
    const prs = fetchPrs({ repo, exec, env: githubEnv(ctx, { exec, env }) });

    const result = boardFor({ slices, prs, limits: ctx.config.limits, config: ctx.config, prd: { topic } });

    if (flags.json) {
      println(stdout, JSON.stringify(result, null, 2));
      return 0;
    }

    println(stdout, `omni board — PRD ${prd}: ${slices.length} slice(s).`);
    for (const row of result.slices) println(stdout, tableLine(row));

    if (result.frontier.wave === null) {
      println(stdout, 'omni board — runnable frontier: none — nothing is runnable right now.');
    } else {
      const taken = result.frontier.slices.join(', ') || '(none — every runnable slice collides with another)';
      println(stdout, `omni board — runnable frontier: wave ${result.frontier.wave} — ${taken}`);
      if (result.frontier.excluded.length > 0) {
        println(
          stdout,
          `omni board — excluded by a same-wave territory collision: ${result.frontier.excluded.join(', ')}`,
        );
      }
    }
    return 0;
  },
};
