/**
 * **A slice declares the ground it stands on, and this says when it stepped off it** (PRD #985).
 *
 * A plan used to carry this rule as prose — "two slices that edit the same file sit in different
 * waves" — and a slice never said which files it edits. So the rule was a hope. When a wave
 * collapsed into conflicts, nothing said which slice had reached outside its lane, and the
 * planner's guess was never graded against what the wave actually did.
 *
 * A slice now declares a **territory**: a list of repo-relative path prefixes it owns. Two things
 * follow, and both are computation rather than judgement:
 *
 * 1. **Waves come from the collision matrix.** Two slices whose territories intersect may never
 *    share a wave — `sameWaveCollisions` is the whole rule, and `collisionRows` renders the matrix
 *    a plan prints. A planner who puts a colliding pair in one wave is caught by a test, not by a
 *    reviewer remembering the sentence.
 * 2. **A sub-PR's diff is compared against its slice's declaration at merge time.** `breaches`
 *    names every changed path no declared prefix covers, for a merge step to report.
 *
 * **A breach is reported, never fatal.** `territoryVerdict` always carries `fatal: false` — failing
 * a sub-PR on day one would bite on legitimate spillover before anyone knows what normal looks
 * like (PRD #985, decisions). The breach is a signal that explains a degraded wave — the planner
 * was wrong about the ground — not a verdict on the work.
 *
 * Matching is deliberately dull: a prefix covers a path when the path starts with it, after a
 * trailing `*` is dropped. That is why a directory is declared with its trailing slash — two
 * sibling directories that merely start the same are kept apart only by the slash. No glob
 * language, because a territory that needs interpreting is a territory two people read
 * differently.
 *
 * What this cannot see: two slices that will both create files in one directory neither has named
 * yet. Their declarations do not intersect and the matrix stays quiet, so a planner may still add a
 * row by hand. Everything the declarations DO say is computed here.
 *
 * Pure throughout: every function here takes already-read markdown or already-computed data —
 * nothing here touches a filesystem or shells out. Reading the plan and computing a diff against a
 * base branch is a caller's job.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/check-territory.mjs — changes in kit/porting/inbox--territory.md.
import type { Slice } from '../types.ts';

export type { Slice };

/** One row of a plan's `## Repositories` table. */
export type PlanRepository = { repo: string; role: string; readAt: string; knowledge: string };

/** Two slices whose declarations intersect, and the ground they share. */
export type Collision = { left: string; right: string; shared: string[] };

/** One slice's diff graded against its declaration. */
export type TerritoryVerdict = {
  slice: string;
  unknownSlice: boolean;
  declared: string[];
  breaches: string[];
  fatal: false;
  lines: string[];
};

/** The ground a slice declares: the only field the matching reads. */
type Declared = Pick<Slice, 'territory'>;

/** What the collision matrix reads of a slice: `repo` may be absent on a hand-built row. */
type CollidingSlice = Pick<Slice, 'id' | 'territory'> & { repo?: string | null; wave?: number | null };

/** A cell that declares nothing: an em dash, or nothing at all. */
const NOTHING = /^[—–-]?$/;

/** The ids one `blocked by` cell names — comma- or space-separated, backticks stripped. `[]` for a
 * cell that declares nothing (an em dash, a bare hyphen, or empty). */
function blockedByCell(cell: string | undefined): string[] {
  const text = (cell ?? '').trim();
  if (NOTHING.test(text)) return [];
  return text
    .split(/[\s,]+/)
    .map((token) => token.replace(/`/g, '').trim())
    .filter(Boolean);
}

/**
 * The backticked paths in one `territory` cell, in the order they are written.
 *
 * Only backticked tokens count. A cell of prose declares nothing, which `breaches` then reports as
 * every path being outside — loudly wrong is the right answer for a territory nobody wrote.
 */
export function territoryPrefixes(cell: string | undefined): string[] {
  const text = (cell ?? '').trim();
  if (NOTHING.test(text)) return [];
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => (match[1] ?? '').trim()).filter(Boolean);
}

/** A declared prefix ending in `*` covers the same ground with or without the star. */
function prefixOf(declaration: string): string {
  return declaration.replace(/\*+$/, '');
}

/** One row of a markdown table, as its cells. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableRow(line: string | undefined): line is string {
  return line !== undefined && line.trim().startsWith('|');
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

/** The cells of each row under the table header at `headerIndex`, up to the table's end, its
 * separator rows skipped. */
function bodyRows(lines: readonly string[], headerIndex: number): string[][] {
  const rows: string[][] = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isTableRow(line)) break;
    if (isSeparatorRow(line)) continue;
    rows.push(cells(line));
  }
  return rows;
}

/**
 * Every slice a plan declares: its id, title, the ground it owns, the ids it is blocked by, and the
 * wave it runs in.
 *
 * Throws when the plan holds no slice table, and when that table has no `territory` column. A plan
 * written in the old shape must be loud: a guard that reads an absent column as an empty
 * declaration would grade every slice as breaching everything, or — worse, depending on which way
 * it shrugged — as breaching nothing at all.
 *
 * `blockedBy` reads `[]` for a plan with no `blocked by` column at all — a plan predating that
 * column declares no blocks, rather than throwing the way a missing `territory` column does.
 */
export function parsePlanSlices(markdown: string): Slice[] {
  const lines = markdown.split('\n');

  // Find the first table whose header starts with `id` AND contains a `territory` column
  let headerIndex = -1;
  let foundAnyIdTable = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isTableRow(line) && /^\|\s*id\s*\|/i.test(line.trim())) {
      foundAnyIdTable = true;
      const header = cells(line).map((name) => name.toLowerCase());
      if (header.indexOf('territory') !== -1) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    // If we found id tables but none had territory, throw the territory error
    if (foundAnyIdTable) {
      throw new Error(
        "This plan's slice table has no `territory` column; it predates the territory discipline and cannot be graded.",
      );
    }
    // Otherwise, no id table was found at all
    throw new Error('No slice table was found in this plan; its slices declare no territory.');
  }

  const header = cells(lines[headerIndex] ?? '').map((name) => name.toLowerCase());
  const column = (name: string): number => header.indexOf(name);

  const slices: Slice[] = [];
  for (const row of bodyRows(lines, headerIndex)) {
    const id = row[column('id')];
    if (!id) continue;
    slices.push({
      id,
      repo: column('repo') === -1 ? null : plainCell(row[column('repo')]),
      title: column('slice') === -1 ? '' : (row[column('slice')] ?? ''),
      territory: territoryPrefixes(row[column('territory')]),
      blockedBy: column('blocked by') === -1 ? [] : blockedByCell(row[column('blocked by')]),
      wave: column('wave') === -1 ? null : Number(row[column('wave')]),
    });
  }
  if (slices.length === 0) {
    throw new Error('The slice table holds no slice; there is nothing to grade.');
  }
  return slices;
}

/** A cell's text with its backticks stripped: `''` for an empty cell, never `null`. */
function plainCell(cell: string | undefined): string {
  return (cell ?? '').replace(/`/g, '').trim();
}

/**
 * The rows of a plan's `## Repositories` table (PRD 549), in the order they are written: each
 * repository a plan repository's slices land in, with its `role`, the commit its territories were
 * `read at`, and how its `knowledge` was read. `[]` when the plan has no such heading, or no table
 * under it — an ordinary plan names no repository.
 */
export function parsePlanRepositories(markdown: string): PlanRepository[] {
  const lines = markdown.split('\n');
  const heading = lines.findIndex((line) => /^##\s+repositories\s*$/i.test(line.trim()));
  if (heading === -1) return [];

  let headerIndex = -1;
  for (let i = heading + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^#{1,2}\s/.test(line.trim())) break;
    if (isTableRow(line)) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) return [];

  const header = cells(lines[headerIndex] ?? '').map((name) => name.toLowerCase());
  const at = (row: string[], name: string): string => (header.indexOf(name) === -1 ? '' : plainCell(row[header.indexOf(name)]));
  const rows: PlanRepository[] = [];
  for (const row of bodyRows(lines, headerIndex)) {
    const repo = at(row, 'repo');
    if (!repo) continue;
    rows.push({ repo, role: at(row, 'role'), readAt: at(row, 'read at'), knowledge: at(row, 'knowledge') });
  }
  return rows;
}

/** True when one of the declared prefixes owns this path. */
export function covers(territory: readonly string[], path: string): boolean {
  return territory.some((declaration) => path.startsWith(prefixOf(declaration)));
}

/** The changed paths no declared prefix owns — the breach, in the order the diff listed them. */
export function breaches(paths: readonly string[], territory: readonly string[]): string[] {
  return paths.filter((path) => !covers(territory, path));
}

/** The ground two slices both claim: every declaration of one that meets a declaration of the other. */
export function sharedGround(left: Declared, right: Declared): string[] {
  const shared = new Set<string>();
  for (const a of left.territory) {
    for (const b of right.territory) {
      const [x, y] = [prefixOf(a), prefixOf(b)];
      if (x.startsWith(y)) shared.add(x.length >= y.length ? y : x);
      else if (y.startsWith(x)) shared.add(x);
    }
  }
  return [...shared];
}

/**
 * Every pair of slices whose declarations intersect, in slice order. Only slices of one repository
 * can meet (PRD 549): a territory is a path in its slice's `repo`, and two slices with no `repo`
 * (`null`, an ordinary plan) share one repository, as they always did.
 */
export function collisions(slices: readonly CollidingSlice[]): Collision[] {
  const pairs: Collision[] = [];
  for (const [i, a] of slices.entries()) {
    for (const b of slices.slice(i + 1)) {
      if ((a.repo ?? null) !== (b.repo ?? null)) continue;
      const shared = sharedGround(a, b);
      if (shared.length > 0) pairs.push({ left: a.id, right: b.id, shared });
    }
  }
  return pairs;
}

/**
 * The pairs a plan may not contain: intersecting territories in one wave. Siblings in a wave merge
 * one after another, so shared ground turns the second into a conflict.
 */
export function sameWaveCollisions(slices: readonly CollidingSlice[]): (Collision & { wave: number | null | undefined })[] {
  const waveOf = new Map(slices.map((slice) => [slice.id, slice.wave]));
  return collisions(slices)
    .filter(({ left, right }) => waveOf.get(left) === waveOf.get(right))
    .map((pair) => ({ ...pair, wave: waveOf.get(pair.left) }));
}

/** The collision matrix a plan prints, computed from the declarations rather than asserted. */
export function collisionRows(slices: readonly CollidingSlice[]): { pair: string; shared: string; resolved: string }[] {
  const waveOf = new Map(slices.map((slice) => [slice.id, slice.wave]));
  return collisions(slices).map(({ left, right, shared }) => ({
    pair: `${left} · ${right}`,
    shared: shared.map((ground) => `\`${ground}\``).join(', '),
    resolved: `${left} w${waveOf.get(left)} · ${right} w${waveOf.get(right)}`,
  }));
}

/**
 * One slice's diff against its own declaration.
 *
 * `fatal` is always `false`, and it is a field rather than a comment so the caller that merges can
 * read the policy instead of remembering it.
 */
export function territoryVerdict(
  slices: readonly Pick<Slice, 'id' | 'territory'>[],
  sliceId: string,
  changedPaths: readonly string[],
): TerritoryVerdict {
  const slice = slices.find((candidate) => candidate.id === sliceId);
  if (!slice) {
    return {
      slice: sliceId,
      unknownSlice: true,
      declared: [],
      breaches: [],
      fatal: false,
      lines: [`Territory: the plan holds no slice ${sliceId}; its diff was not graded.`],
    };
  }
  const outside = breaches(changedPaths, slice.territory);
  const lines =
    outside.length === 0
      ? [`Territory: ${slice.id} stayed inside the ${slice.territory.length} path(s) it declared.`]
      : [
          `Territory breach — ${slice.id} touched ${outside.length} path(s) it never declared:`,
          ...outside.map((path) => `  ${path}`),
          `  declared: ${slice.territory.join(', ') || '(nothing)'}`,
          '  Reported, not fatal: the merge proceeds, and the plan was wrong about the ground.',
        ];
  return {
    slice: slice.id,
    unknownSlice: false,
    declared: slice.territory,
    breaches: outside,
    fatal: false,
    lines,
  };
}
