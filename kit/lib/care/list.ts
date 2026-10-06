// PRD 1118: the pull requests one `/omni:mega-pr-care` run looks after, in merge order — the target
// PRs (and target landing PRs) first, by the plan's landing order, then the earliest wave among each
// target's slices, then the order of the plan's `## Repositories`; then the bug-fix PRs linked to the
// PRD, each bug's fix PRs in its fix plan's order followed by its record PR; the plan PR last. Pure:
// `kit/bin/commands/care.ts` (`omni care list`) reads GitHub and hands what it found here.
//
// A repository that could not be read is listed `unreadable`, never thrown; a target with no pull
// request opened yet is left out.
import type { IssueNumber, PrNumber } from '../ids.ts';
import { parsePr } from '../ids.ts';

/** The marker of the fix-plan comment `/omni:mega-bug-fix` keeps on a bug's issue. */
export const FIX_PLAN_MARKER = '<!-- omni-bug:fix-plan -->';

export type CareListKind = 'plan' | 'target' | 'landing' | 'bug-fix' | 'bug-record';

/** A pull request as read from GitHub. */
export type FoundPr = { number: PrNumber; state: string; url: string | null };

/** What a read found: the pull request, `unreadable` when its repository could not be read, `null`
 * when none was opened. */
export type Found = FoundPr | 'unreadable' | null;

/** One landing's place in its target's own chain. */
export type ListLanding = { landing: number; count: number; name: string };

export type CareListEntry = {
  /** The repository's `owner/name`. */
  repo: string;
  number: PrNumber | null;
  kind: CareListKind;
  /** The target's short name, `null` for the plan repository's own pull requests. */
  target: string | null;
  /** `open`, `merged`, `closed`, or `unreadable`. */
  state: string;
  url: string | null;
  landing?: ListLanding;
  bug?: IssueNumber;
};

/** One target pull request to place: a target's feature PR, or one landing of its chain. */
export type TargetStep = {
  name: string;
  slug: string;
  /** The landing's number in the plan (1 for a plan of one landing). */
  planLanding: number;
  /** The earliest wave among the target's slices in that landing. */
  wave: number | null;
  /** Its place in the target's chain, for a target of several landings; `null` otherwise. */
  landing: ListLanding | null;
  found: Found;
};

/** The entry of what a read found, or `null` when no pull request was opened. An unreadable one keeps
 * the number it is `known` by, when it has one. */
export function foundEntry<T extends Pick<CareListEntry, 'repo' | 'kind' | 'target'>>(
  base: T,
  found: Found,
  known: PrNumber | null = null,
): (T & Pick<CareListEntry, 'number' | 'state' | 'url'>) | null {
  if (found === null) return null;
  if (found === 'unreadable') return { ...base, number: known, state: 'unreadable', url: null };
  return { ...base, number: found.number, state: found.state.toLowerCase(), url: found.url };
}

/** The sort key of a target step: plan landing, earliest wave, `## Repositories` row. */
function rank(step: TargetStep, repositories: readonly string[]): number[] {
  const row = repositories.indexOf(step.name);
  return [step.planLanding, step.wave ?? Number.MAX_SAFE_INTEGER, row === -1 ? Number.MAX_SAFE_INTEGER : row];
}

function compareRanks(left: readonly number[], right: readonly number[]): number {
  for (const [index, value] of left.entries()) {
    const other = right[index] ?? 0;
    if (value !== other) return value - other;
  }
  return 0;
}

function targetEntry(step: TargetStep): CareListEntry | null {
  const base = { repo: step.slug, kind: step.landing === null ? ('target' as const) : ('landing' as const), target: step.name };
  const entry = foundEntry(base, step.found);
  if (entry === null || step.landing === null) return entry;
  return { ...entry, landing: step.landing };
}

/** Every pull request of the run, in merge order: targets, then each linked bug's, then the plan PR. */
export function mergeOrder({
  repositories,
  targets,
  bugs,
  plan,
}: {
  repositories: readonly string[];
  targets: readonly TargetStep[];
  bugs: readonly (readonly CareListEntry[])[];
  plan: CareListEntry | null;
}): CareListEntry[] {
  const ordered = [...targets].sort((left, right) => compareRanks(rank(left, repositories), rank(right, repositories)));
  const entries = ordered.map(targetEntry).filter((entry) => entry !== null);
  return [...entries, ...bugs.flat(), ...(plan === null ? [] : [plan])];
}

/** Whether a bug issue's body links it to PRD `prd` with its `For PRD #<prd>` line. */
export function linksPrd(body: string | null | undefined, prd: number): boolean {
  return new RegExp(`\\bFor PRD #${prd}(?!\\d)`).test(body ?? '');
}

const REFERENCE = /([\w.-]+\/[\w.-]+)#(\d+)|github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/;

/** The pull request a fix-plan table row names, or `null`. */
function rowPr(line: string): { slug: string; pr: PrNumber } | null {
  const match = line.match(REFERENCE);
  const slug = match?.[1] ?? match?.[3];
  const number = match?.[2] ?? match?.[4];
  return slug && number ? { slug, pr: parsePr(number) } : null;
}

/** The pull requests of a fix-plan comment's table, in its rows' order, each once; `[]` for a comment
 * without the fix-plan marker. */
export function fixPlanRows(body: string | null | undefined): { slug: string; pr: PrNumber }[] {
  const text = body ?? '';
  if (!text.includes(FIX_PLAN_MARKER)) return [];
  const rows: { slug: string; pr: PrNumber }[] = [];
  for (const line of text.split('\n')) {
    const found = line.trim().startsWith('|') ? rowPr(line) : null;
    if (found && !rows.some((row) => row.slug === found.slug && row.pr === found.pr)) rows.push(found);
  }
  return rows;
}
