/**
 * **A bug fixed across target repositories** (PRD 1118, slice s2).
 *
 * `/omni:mega-bug-fix` records a fix whose code lives in a plan repository's targets: its `bug.md`
 * carries a `## Fixes` table, `| order | repository | pull request | what changes |`, one row per
 * target in merge order, and its Reproduction and Guard sections give one `- **<target>:** …` line
 * per row. What `omni bug <n>` checks of such a record, each failure one line naming the row:
 *
 * 1. The table has at least one row.
 * 2. Each row's repository is one of `plan.targets`, named by its slug (`acme/backend`) or by its
 *    name (`backend`).
 * 3. Each row names a pull request (`#41`, `acme/backend#41` or its link), in that repository.
 * 4. The orders run 1..k in the rows' order, with no gap and no repeat.
 * 5. Reproduction and Guard each hold a non-empty line keyed by the row's repository (its slug or
 *    its name).
 *
 * PRD 2741: the proof's cited commit must be the head of one of the rows' pull requests (`rowHeadFaults`).
 */
import { z } from 'zod';
import type { ExecText } from '../context.ts';
import type { Head } from './proof-body.ts';

/** What a `## Fixes` check reads of the config: the plan's targets, absent outside a plan repository. */
export type FixesConfig = { plan?: { targets: readonly { repo: string }[] } | undefined };

/** The sections that give one line per target. */
const PER_TARGET: readonly string[] = ['Reproduction', 'Guard'];

const REFERENCE = /^(?:([\w.-]+\/[\w.-]+))?#(\d+)$|github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/;

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The value of a `- **<key>:** value` line in `body`: `undefined` with no such line, else trimmed. */
export function boldField(body: string, key: string): string | undefined {
  const match = new RegExp(`^\\s*(?:[-*]\\s+)?\\*\\*${escape(key)}:\\*\\*(.*)$`, 'm').exec(body);
  return match ? (match[1] ?? '').trim() : undefined;
}

/** The cells of a markdown table row, trimmed and unquoted from backticks. */
function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim().replace(/^`+|`+$/g, ''));
}

/** The table's data rows: every `|` line after the header and its `---` separator. */
export function tableRows(body: string): string[][] {
  const lines = body.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  return lines.slice(1).filter((line) => !/^\|?[\s:|-]+$/.test(line.trim())).map(cells);
}

/** The plan target a repository cell names, by its slug or by the name after its `/`. */
function targetOf(config: FixesConfig, cell: string): string | undefined {
  return config.plan?.targets.map(({ repo }) => repo).find((repo) => repo === cell || repo.split('/')[1] === cell);
}

function prViolation(slug: string, cell: string): string | null {
  const match = REFERENCE.exec(cell);
  if (match === null) return 'no pull request.';
  const named = match[1] ?? match[3];
  const number = match[2] ?? match[4];
  return named === undefined || named === slug ? null : `the pull request ${named}#${number} is not in ${slug}.`;
}

function orderViolation(cell: string, next: number, seen: ReadonlySet<number>): string | null {
  const order = /^\d+$/.test(cell) ? Number(cell) : Number.NaN;
  if (order === next) return null;
  if (seen.has(order)) return `order ${order} repeats an earlier row; ${next} is next.`;
  return Number.isNaN(order) ? `order "${cell}", where ${next} is next.` : `order ${order}, where ${next} is next.`;
}

function lineViolations(sections: ReadonlyMap<string, string>, slug: string): string[] {
  const name = slug.split('/')[1] ?? slug;
  return PER_TARGET.filter((section) => {
    const body = sections.get(section) ?? '';
    return !(boldField(body, slug) || boldField(body, name));
  }).map((section) => `the ${section} has no **${name}:** line.`);
}

function rowViolations(config: FixesConfig, sections: ReadonlyMap<string, string>, row: string[], index: number, seen: Set<number>): string[] {
  const [orderCell = '', repoCell = '', prCell = ''] = row;
  const order = orderViolation(orderCell, index, seen);
  seen.add(Number(orderCell));
  const slug = targetOf(config, repoCell);
  if (slug === undefined) return [`Fixes row ${index}: ${repoCell} is not a repository of plan.targets.`];
  const problems = [order, prViolation(slug, prCell), ...lineViolations(sections, slug)];
  return problems.filter((problem) => problem !== null).map((problem) => `Fixes row ${index} (${slug}): ${problem}`);
}

/** Every failure of a record's `## Fixes` section, `fixes` its body, as lines naming the row. */
export function fixesViolations(config: FixesConfig, sections: ReadonlyMap<string, string>, fixes: string): string[] {
  const rows = tableRows(fixes);
  if (rows.length === 0) return ['the "## Fixes" table has no rows.'];
  const seen = new Set<number>();
  return rows.flatMap((row, index) => rowViolations(config, sections, row, index + 1, seen));
}

/** A pull request a `## Fixes` row names: its repository's slug and its number. */
export type PullRef = { repo: string; number: number };

/** One row's pull request label and the head it was read at (PRD 2741). */
export type RowHead = { label: string; head: Head };

/**
 * The pull request of each row of a `## Fixes` table that names one in a repository it can resolve
 * (a plan target by slug or name, else the slug as written, for a product's repositories); a row
 * without either is already a fault of `fixesViolations` and is left out here (PRD 2741).
 */
export function fixesPulls(config: FixesConfig, fixes: string): PullRef[] {
  return tableRows(fixes).flatMap(([, repoCell = '', prCell = '']) => {
    const slug = targetOf(config, repoCell) ?? (repoCell.includes('/') ? repoCell : undefined);
    const match = REFERENCE.exec(prCell);
    const number = Number(match?.[2] ?? match?.[4]);
    return slug === undefined || !(number > 0) ? [] : [{ repo: slug, number }];
  });
}

const HeadAnswerSchema = z.object({ headRefOid: z.string().min(1), commits: z.array(z.object({ oid: z.string() })).optional() });

/** The head of `repo#number` read through `gh pr view`; `unread` with gh's own words when it cannot be. */
export function readPullHead({ exec, root, repo, number }: { exec: ExecText; root: string; repo: string; number: number }): Head {
  const label = `${repo}#${number}`;
  try {
    const text = exec('gh', ['pr', 'view', String(number), '--repo', repo, '--json', 'headRefOid,commits'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const answer = HeadAnswerSchema.safeParse(JSON.parse(text));
    if (!answer.success) return { kind: 'unread', label, why: 'gh gave no head commit' };
    const { headRefOid, commits } = answer.data;
    return { kind: 'read', sha: headRefOid, commits: (commits ?? []).map((commit) => commit.oid), subject: `${label}'s head`, of: label };
  } catch (error) {
    const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? String((error as { stderr: unknown }).stderr).trim() : '';
    const why = stderr || (error instanceof Error ? error.message : 'gh failed');
    return { kind: 'unread', label, why: why.split('\n')[0] ?? 'gh failed' };
  }
}

/**
 * The faults of a proof citing `cited` against the heads of a `## Fixes` record's pull requests
 * (PRD 2741): none when it is the head of one of them, else each head named; a head that could not be
 * read is `not judged` and never a pass (BL-GATE-1).
 */
export function rowHeadFaults(cited: string, rows: readonly RowHead[]): string[] {
  const lower = cited.toLowerCase();
  if (rows.some(({ head }) => head.kind === 'read' && head.sha.toLowerCase().startsWith(lower))) return [];
  const unread = rows.flatMap(({ head }) => (head.kind === 'unread' ? [`not judged: could not read the head of ${head.label}: ${head.why}`] : []));
  if (unread.length > 0) return unread;
  const heads = rows.flatMap(({ label, head }, index) => (head.kind === 'read' ? [`${label} ${index === 0 ? 'is ' : ''}at ${head.sha.slice(0, 7)}`] : []));
  return heads.length === 0 ? [] : [`the proof cites green at ${cited}, the head of no Fixes row: ${heads.join(', ')}`];
}
