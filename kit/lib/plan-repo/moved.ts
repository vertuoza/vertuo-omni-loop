// What moved in a plan repository's targets since its plan read them, as `omni plan moved` reports it
// (PRD 563, s2). Each target row of the plan's `## Repositories` table is compared, through the gh
// reader `omni targets` uses (`./targets.ts`), from its `read at` commit to the target's default
// branch today, and gets one row `{ repo, state, files, slices, detail }`:
//
// - `moved`: at least one changed file falls under the territory of a slice that lands in it;
//   `files` names them, in the order GitHub listed them, and `slices` the slices they fall under.
// - `ok`: nothing under those territories changed, even when the head moved.
// - `unreachable`: gh cannot read the target, or cannot compare `read at` with its default branch;
//   `detail` says why.
//
// The plan repository's own row is never read: its slices land in the checkout this runs in.
// Read-only: nothing is cloned, nothing is written.
import { execFileSync } from 'node:child_process';
import { covers } from '../inbox/territory.ts';
import type { ExecRaw } from '../context.ts';
import type { Slice } from '../types.ts';
import type { PlanRepository } from '../inbox/territory.ts';
import type { GhCompareFile } from './gh-schema.ts';
import { ghReader, Unreachable } from './targets.ts';
import type { GhReader } from './targets.ts';

/** What moved in one target since the plan read it. */
export type MovedRow = {
  repo: string;
  state: 'ok' | 'moved' | 'unreachable';
  files: string[];
  slices: string[];
  detail: string | null;
};

/** What the comparison reads of a slice: its id, its repository and its ground. */
type MovedSlice = Pick<Slice, 'id' | 'repo' | 'territory'>;

/** One compared target's verdict, before it is folded into its row. */
type Compared = Pick<MovedRow, 'state'> & Partial<Pick<MovedRow, 'files' | 'slices' | 'detail'>>;

/** The part of an `owner/name` slug after the `/`: the name a plan's `repo` column uses. */
const shortName = (slug: string): string => slug.slice(slug.indexOf('/') + 1);

/** Every path one compared file names: its own, and the one it was renamed from. */
const pathsOf = (file: GhCompareFile): string[] =>
  [file.filename, file.previous_filename].filter((path): path is string => Boolean(path));

function compareRow(gh: GhReader, { slug, readAt, slices }: { slug: string; readAt: string; slices: readonly MovedSlice[] }): Compared {
  const branch = gh.repository(slug).default_branch;
  const compared = gh.compare(slug, readAt, branch);
  if (compared === null) return { state: 'unreachable', detail: `read at ${readAt.slice(0, 7)} cannot be compared with ${branch}` };
  if ((compared.ahead_by ?? 0) === 0) return { state: 'ok' };
  const files: string[] = [];
  const hit = new Set<string>();
  for (const file of compared.files ?? []) {
    const under = slices.filter((slice) => pathsOf(file).some((path) => covers(slice.territory, path)));
    if (under.length === 0) continue;
    files.push(file.filename);
    for (const slice of under) hit.add(slice.id);
  }
  if (files.length === 0) return { state: 'ok' };
  return { state: 'moved', files, slices: slices.map((slice) => slice.id).filter((id) => hit.has(id)) };
}

/**
 * One row per target row of `repositories` (the plan's `## Repositories`), in its order, the plan
 * repository's own row left out. `slices` are the plan's slices (each with `repo` and `territory`),
 * `planSlug` the plan repository's slug, `targets` its config's `plan.targets`. Never throws for
 * what GitHub answers: a target it cannot read is a row.
 */
export function planMoved(
  {
    slices,
    repositories,
    planSlug,
    targets,
  }: { slices: readonly MovedSlice[]; repositories: readonly PlanRepository[]; planSlug: string; targets: readonly { repo: string }[] },
  { exec = execFileSync, env }: { exec?: ExecRaw; env?: NodeJS.ProcessEnv | undefined } = {},
): MovedRow[] {
  const gh = ghReader({ exec, env });
  const slugOf = new Map(targets.map((target) => [shortName(target.repo), target.repo]));
  return repositories
    .filter((row) => row.repo !== shortName(planSlug))
    .map((row): MovedRow => {
      const base: MovedRow = { repo: row.repo, state: 'ok', files: [], slices: [], detail: null };
      const slug = slugOf.get(row.repo);
      if (!slug) return { ...base, state: 'unreachable', detail: 'not a target of this plan repository' };
      try {
        const found = compareRow(gh, { slug, readAt: row.readAt, slices: slices.filter((slice) => slice.repo === row.repo) });
        return { ...base, ...found };
      } catch (error) {
        if (error instanceof Unreachable) return { ...base, state: 'unreachable', detail: error.message };
        throw error;
      }
    });
}

const SHOWN = 3;

/** What a row says after its state: the files and slices of a moved row, the reason of an unreachable one. */
function detailOf(row: MovedRow): string {
  if (row.state === 'moved') {
    const count = `${row.files.length} ${row.files.length === 1 ? 'file' : 'files'}`;
    const owners = row.slices.map((id) => `${id}'s`).join(', ');
    const where = row.slices.length === 1 ? 'territory' : 'territories';
    const shown = row.files.slice(0, SHOWN).join(', ') + (row.files.length > SHOWN ? ', …' : '');
    return `${count} under ${owners} ${where} (${shown})`;
  }
  return row.detail ?? '';
}

/** The rows as the lines of a table: repository, state, and what the state rests on. */
export function movedTable(rows: readonly MovedRow[]): string[] {
  const cells = rows.map((row): [string, string, string] => [row.repo, row.state, detailOf(row)]);
  const widths = [0, 1].map((i) => Math.max(0, ...cells.map((line) => (line[i] ?? '').length)));
  const [repoWidth = 0, stateWidth = 0] = widths;
  return cells.map(([repo, state, detail]) =>
    detail ? `${repo.padEnd(repoWidth)}   ${state.padEnd(stateWidth)}   ${detail}` : `${repo.padEnd(repoWidth)}   ${state}`,
  );
}
