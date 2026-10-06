// game/cli/contributions.ts --workspace <slug> — who authored each pull request merged into a sector
// repository's default branch, who opened each omni:prd issue, and when each PRD started (its phase-0
// PR merged) and shipped (its feature PR merged), over the last 40 days, upserted into
// public.contributions (PRD 328, PRD 572), which the app's dashboards read. The ledger job runs it
// right after game:xp.
//
// It never writes the ledger. A row here can be rewritten, backfilled or deleted, and the table
// dropped, without touching the ledger's permanent history; the ledger and the economy never read it.
// For each repository it reads, through gh as game/dossiers/github.ts does, the default branch, the
// pull requests merged into it and the omni:prd issues created (in any state) since the window
// opened. A sub-PR merges into a feature branch, so it is never read. A merged PR labelled
// omni:phase-0 whose body holds `Refs #<n>` also gives a prd-started row for PRD <n>, and one labelled
// omni:feature whose body holds `Closes #<n>` a prd-shipped row, both credited to the PRD issue's author
// (from the listed issues, else `gh issue view`, once per PRD) at the PR's merge; a PRD whose issue
// cannot be read is skipped and logged, and the rest of its repository still lands. Each item becomes one row, its
// author's login in lower case, upserted on (workspace_id, kind, repo, number): a rerun on the same
// outputs writes identical rows, and a row outside the window is left as it is. An item with no author
// (a deleted account) is skipped. A repository it cannot read is skipped and logged, and the others
// still land; the run then exits 0. A workspace it cannot open, sectors it cannot read and a write that
// fails exit 1 (2 on a usage mistake), as every game script.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { configFrom } from '../config.ts';
import { ghExec, toIso, type Exec } from '../sources/github.ts';
import type { InsertRow, SupabaseRest } from '../sources/supabase.ts';
import { ghWhy } from '../dossiers/github.ts';
import { openWorkspace } from './workspace.ts';
import { PrdNumberSchema, PrNumberSchema, type PrdNumber } from '../../kit/lib/ids.ts';

/** How far back each run reads: the current season (a UTC month) and the chart's week, even on a month's first days. */
export const WINDOW_DAYS = 40;
const DAY = 86_400_000;
const LIMIT = '1000'; // the most one GitHub search returns: far above 40 days of merges in one repository
const PRD_LABEL = 'omni:prd';
// The PRD stages a merged pull request marks: the label it carries, and the link its body holds to the
// PRD issue — the Omni Loop's own shapes for a phase-0 PR (`Refs #n`) and a feature PR (`Closes #n`).
// GitHub reads its closing keywords in any case, so these do too.
const STAGES = [
  { kind: 'prd-started', label: 'omni:phase-0', link: /\bRefs #(\d+)\b/i },
  { kind: 'prd-shipped', label: 'omni:feature', link: /\bCloses #(\d+)\b/i },
];
const KEY = 'workspace_id,kind,repo,number';

/** The window's first instant: `WINDOW_DAYS` days before `now`. */
export const windowStart = (now: Date): Date => new Date(now.getTime() - WINDOW_DAYS * DAY);

// What gh prints for `--json number,author,<time>`. A deleted account's author is null, or has no login.
const Author = z.object({ login: z.string().nullish() }).loose().nullish();
const Merged = z.array(z.object({
  number: PrNumberSchema,
  author: Author,
  mergedAt: z.string().nullish(),
  labels: z.array(z.object({ name: z.string() }).loose()).nullish(),
  body: z.string().nullish(),
}).loose());
const Viewed = z.object({ author: Author }).loose();
const Opened = z.array(z.object({ number: PrdNumberSchema, author: Author, createdAt: z.string().nullish() }).loose());

type Author = z.infer<typeof Author>;
/** A contributions row before it is given its workspace. */
export type Contribution = Omit<InsertRow<'contributions'>, 'workspace_id'> & { kind: string; repo: string; number: number; login: string; at: string };
type Log = (message: string) => void;

// GitHub names a deleted account `ghost` where it names one at all.
const loginOf = (author: Author): string | null => {
  const login = author?.login?.trim().toLowerCase();
  return login && login !== 'ghost' ? login : null;
};

/** The PRD stage a merged pull request marks, as `{ kind, prd }`, or null: its label and its link both, naming a PRD number. */
export function stageOf(pr: { labels?: Array<{ name: string }> | null | undefined; body?: string | null | undefined }): { kind: string; prd: PrdNumber } | null {
  const labels = new Set((pr.labels ?? []).map((l) => l.name));
  for (const { kind, label, link } of STAGES) {
    const linked = labels.has(label) ? link.exec(pr.body ?? '')?.[1] : undefined;
    const prd = linked === undefined ? null : PrdNumberSchema.safeParse(Number(linked));
    if (prd?.success) return { kind, prd: prd.data };
  }
  return null;
}

/**
 * One repository's rows within the window: its default branch, the pull requests merged into it, its
 * omni:prd issues, and the PRD stages its merged pull requests mark. Any of the three list reads that
 * fails, or answers what does not parse, throws: the caller skips the whole repository. A PRD issue
 * that cannot be viewed skips that PRD's stages only, logged. Rows carry no workspace yet.
 */
export async function readRepository(exec: Exec, org: string, repo: string, start: Date, log: Log = console.error): Promise<Contribution[]> {
  const slug = `${org}/${repo}`;
  const branch = (await exec(['api', `repos/${slug}`, '--jq', '.default_branch'])).trim();
  if (!branch || branch === 'null') throw new Error(`${slug} names no default branch`);
  // The search qualifier reads to the day; the exact instant is kept below.
  const since = start.toISOString().slice(0, 10);
  const merged = Merged.parse(JSON.parse(await exec([
    'pr', 'list', '-R', slug, '--base', branch, '--state', 'merged', '--search', `merged:>=${since}`, '--limit', LIMIT, '--json', 'number,author,mergedAt,labels,body',
  ])));
  const opened = Opened.parse(JSON.parse(await exec([
    'issue', 'list', '-R', slug, '--label', PRD_LABEL, '--state', 'all', '--search', `created:>=${since}`, '--limit', LIMIT, '--json', 'number,author,createdAt',
  ])));
  const rows: Contribution[] = [];
  const keep = (kind: string, item: { number: number; author?: Author }, time: string | null | undefined) => {
    const login = loginOf(item.author);
    const at = toIso(time);
    if (!login || !at || Date.parse(at) < start.getTime()) return;
    rows.push({ kind, repo, number: item.number, login, at });
  };
  for (const pr of merged) keep('pr-merged', pr, pr.mergedAt);
  for (const issue of opened) keep('prd-opened', issue, issue.createdAt);

  // Each PRD's author: the listed issues first, then one view per PRD older than the window.
  const authors = new Map<PrdNumber, Author>(opened.map((issue) => [issue.number, issue.author]));
  const unreadable = new Set<PrdNumber>();
  const authorOf = async (prd: PrdNumber): Promise<Author | undefined> => {
    if (authors.has(prd)) return authors.get(prd);
    if (unreadable.has(prd)) return undefined;
    try {
      const { author } = Viewed.parse(JSON.parse(await exec(['issue', 'view', String(prd), '-R', slug, '--json', 'author'])));
      authors.set(prd, author);
      return author;
    } catch (err) {
      unreadable.add(prd);
      log(`${slug} PRD #${prd} skipped: ${ghWhy(err)}`);
      return undefined;
    }
  };
  for (const pr of merged) {
    const stage = stageOf(pr);
    if (!stage) continue;
    const at = toIso(pr.mergedAt);
    if (!at || Date.parse(at) < start.getTime()) continue;
    const author = await authorOf(stage.prd);
    if (author === undefined) continue;
    keep(stage.kind, { number: stage.prd, author }, at);
  }
  return rows;
}

const order = (a: Contribution, b: Contribution): number => a.kind.localeCompare(b.kind) || a.repo.localeCompare(b.repo) || a.number - b.number;

/**
 * Reads the workspace's sectors, then each of their repositories under `org`, and upserts every row
 * in one request. Returns { rows: what was written, read: [{ repo, merged, opened }], skipped: [{ repo, why }] }.
 */
export async function runContributions(
  { exec = ghExec, rest, workspaceId, org, now = new Date(), log = console.error }: { exec?: Exec; rest: SupabaseRest; workspaceId: string | undefined; org: string | null | undefined; now?: Date; log?: Log },
): Promise<{
  rows: InsertRow<'contributions'>[];
  read: Array<{ repo: string; merged: number; opened: number; started: number; shipped: number }>;
  skipped: Array<{ repo: string; why: string }>;
}> {
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new Error('game:contributions: a workspace id is needed: every contributions row belongs to one workspace');
  }
  if (!org) throw new Error('game:contributions: the workspace has no github_org: set it before reading its GitHub');
  const sectors = await rest.select('sectors', `select=name,repos&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=name`);
  const { repos } = configFrom({ sectors });
  const start = windowStart(now);

  const found = new Map<string, InsertRow<'contributions'> & Contribution>();
  const read: Array<{ repo: string; merged: number; opened: number; started: number; shipped: number }> = [];
  const skipped: Array<{ repo: string; why: string }> = [];
  for (const repo of repos) {
    let rows: Contribution[];
    try {
      rows = await readRepository(exec, org, repo, start, log);
    } catch (err) {
      const why = ghWhy(err);
      skipped.push({ repo, why });
      log(`${org}/${repo} skipped: ${why}`);
      continue;
    }
    const n = (kind: string): number => rows.filter((r) => r.kind === kind).length;
    read.push({ repo, merged: n('pr-merged'), opened: n('prd-opened'), started: n('prd-started'), shipped: n('prd-shipped') });
    for (const row of rows) found.set(`${row.kind} ${row.repo} ${row.number}`, { workspace_id: workspaceId, ...row });
  }

  const rows = [...found.values()].sort(order);
  if (rows.length) await rest.upsert('contributions', rows, KEY);
  return { rows, read, skipped };
}

const isMain = (): boolean => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

if (isMain()) {
  const { rest, workspace } = await openWorkspace({ usage: 'game:contributions --workspace <slug>' });
  if (!workspace.github_org) {
    console.error(`workspace "${workspace.slug}" has no github_org: set it before reading its GitHub`);
    process.exit(1);
  }
  try {
    const { rows, read, skipped } = await runContributions({ rest, workspaceId: workspace.id, org: workspace.github_org });
    const merged = rows.filter((r) => r.kind === 'pr-merged').length;
    const opened = rows.filter((r) => r.kind === 'prd-opened').length;
    console.log([
      `${workspace.slug}: ${read.length} of ${read.length + skipped.length} repositories read`,
      count(merged, 'merged pull request', 'merged pull requests'),
      count(opened, 'PRD issue', 'PRD issues'),
      count(rows.length - merged - opened, 'PRD stage', 'PRD stages'),
      rows.length ? 'written to contributions' : 'nothing to write',
    ].join(' · '));
  } catch (err) {
    console.error(err instanceof Error ? err.message : undefined);
    process.exit(1);
  }
}
