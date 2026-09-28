// game/cli/contributions.mjs --workspace <slug> — who authored each pull request merged into a sector
// repository's default branch, and who opened each omni:prd issue, over the last 40 days, upserted
// into public.contributions (PRD 328), which the app's dashboard reads: the week's chart and the PRDs
// created this season. The ledger job runs it right after game:xp.
//
// It never writes the ledger. A row here can be rewritten, backfilled or deleted, and the table
// dropped, without touching the ledger's permanent history; the ledger and the economy never read it.
// For each repository it reads, through gh as game/dossiers/github.mjs does, the default branch, the
// pull requests merged into it and the omni:prd issues created (in any state) since the window
// opened. A sub-PR merges into a feature branch, so it is never read. Each item becomes one row, its
// author's login in lower case, upserted on (workspace_id, kind, repo, number): a rerun on the same
// outputs writes identical rows, and a row outside the window is left as it is. An item with no author
// (a deleted account) is skipped. A repository it cannot read is skipped and logged, and the others
// still land; the run then exits 0. A workspace it cannot open, sectors it cannot read and a write that
// fails exit 1 (2 on a usage mistake), as every game script.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { configFrom } from '../config.mjs';
import { ghExec, toIso } from '../sources/github.mjs';
import { ghWhy } from '../dossiers/github.mjs';
import { openWorkspace } from './workspace.mjs';

/** How far back each run reads: the current season (a UTC month) and the chart's week, even on a month's first days. */
export const WINDOW_DAYS = 40;
const DAY = 86_400_000;
const LIMIT = '1000'; // the most one GitHub search returns: far above 40 days of merges in one repository
const PRD_LABEL = 'omni:prd';
const KEY = 'workspace_id,kind,repo,number';

/** The window's first instant: `WINDOW_DAYS` days before `now`. */
export const windowStart = (now) => new Date(now.getTime() - WINDOW_DAYS * DAY);

// What gh prints for `--json number,author,<time>`. A deleted account's author is null, or has no login.
const Author = z.object({ login: z.string().nullish() }).passthrough().nullish();
const itemsOf = (time) => z.array(z.object({ number: z.number().int().positive(), author: Author, [time]: z.string().nullish() }).passthrough());
const Merged = itemsOf('mergedAt');
const Opened = itemsOf('createdAt');

// GitHub names a deleted account `ghost` where it names one at all.
const loginOf = (author) => {
  const login = author?.login?.trim().toLowerCase();
  return login && login !== 'ghost' ? login : null;
};

/**
 * One repository's rows within the window: its default branch, the pull requests merged into it, and
 * its omni:prd issues. Any read that fails, or answers what does not parse, throws: the caller skips
 * the whole repository. Rows carry no workspace yet.
 */
export async function readRepository(exec, org, repo, start) {
  const slug = `${org}/${repo}`;
  const branch = (await exec(['api', `repos/${slug}`, '--jq', '.default_branch'])).trim();
  if (!branch || branch === 'null') throw new Error(`${slug} names no default branch`);
  // The search qualifier reads to the day; the exact instant is kept below.
  const since = start.toISOString().slice(0, 10);
  const merged = Merged.parse(JSON.parse(await exec([
    'pr', 'list', '-R', slug, '--base', branch, '--state', 'merged', '--search', `merged:>=${since}`, '--limit', LIMIT, '--json', 'number,author,mergedAt',
  ])));
  const opened = Opened.parse(JSON.parse(await exec([
    'issue', 'list', '-R', slug, '--label', PRD_LABEL, '--state', 'all', '--search', `created:>=${since}`, '--limit', LIMIT, '--json', 'number,author,createdAt',
  ])));
  const rows = [];
  const keep = (kind, item, time) => {
    const login = loginOf(item.author);
    const at = toIso(item[time]);
    if (!login || !at || Date.parse(at) < start.getTime()) return;
    rows.push({ kind, repo, number: item.number, login, at });
  };
  for (const pr of merged) keep('pr-merged', pr, 'mergedAt');
  for (const issue of opened) keep('prd-opened', issue, 'createdAt');
  return rows;
}

const order = (a, b) => a.kind.localeCompare(b.kind) || a.repo.localeCompare(b.repo) || a.number - b.number;

/**
 * Reads the workspace's sectors, then each of their repositories under `org`, and upserts every row
 * in one request. Returns { rows: what was written, read: [{ repo, merged, opened }], skipped: [{ repo, why }] }.
 */
export async function runContributions({ exec = ghExec, rest, workspaceId, org, now = new Date(), log = console.error }) {
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new Error('game:contributions: a workspace id is needed: every contributions row belongs to one workspace');
  }
  if (!org) throw new Error('game:contributions: the workspace has no github_org: set it before reading its GitHub');
  const sectors = await rest.select('sectors', `select=name,repos&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=name`);
  const { repos } = configFrom({ sectors });
  const start = windowStart(now);

  const found = new Map();
  const read = [];
  const skipped = [];
  for (const repo of repos) {
    let rows;
    try {
      rows = await readRepository(exec, org, repo, start);
    } catch (err) {
      const why = ghWhy(err);
      skipped.push({ repo, why });
      log(`${org}/${repo} skipped: ${why}`);
      continue;
    }
    read.push({ repo, merged: rows.filter((r) => r.kind === 'pr-merged').length, opened: rows.filter((r) => r.kind === 'prd-opened').length });
    for (const row of rows) found.set(`${row.kind} ${row.repo} ${row.number}`, { workspace_id: workspaceId, ...row });
  }

  const rows = [...found.values()].sort(order);
  if (rows.length) await rest.upsert('contributions', rows, KEY);
  return { rows, read, skipped };
}

const isMain = () => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

if (isMain()) {
  const { rest, workspace } = await openWorkspace({ usage: 'game:contributions --workspace <slug>' });
  if (!workspace.github_org) {
    console.error(`workspace "${workspace.slug}" has no github_org: set it before reading its GitHub`);
    process.exit(1);
  }
  try {
    const { rows, read, skipped } = await runContributions({ rest, workspaceId: workspace.id, org: workspace.github_org });
    const merged = rows.filter((r) => r.kind === 'pr-merged').length;
    console.log([
      `${workspace.slug}: ${read.length} of ${read.length + skipped.length} repositories read`,
      count(merged, 'merged pull request', 'merged pull requests'),
      count(rows.length - merged, 'PRD issue', 'PRD issues'),
      rows.length ? 'written to contributions' : 'nothing to write',
    ].join(' · '));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
