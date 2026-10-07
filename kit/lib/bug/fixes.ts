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
 */

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
function tableRows(body: string): string[][] {
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
