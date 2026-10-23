// PRD 2485, s1: a repository's worktrees, as `git worktree list --porcelain` prints them, and which of
// them the kit made. A worktree is the kit's (`kit`) when it sits under the `worktrees` folder of the
// main checkout and its checked-out branch has the shape of `branches.slice`, `branches.feature` or
// `branches.phase0`, filled with any topic and slice. Every other one is `other`: outside the folder,
// on a branch no shape matches, or in detached HEAD. Pure: nothing here runs git.
import { isAbsolute, relative } from 'node:path';
import { WorkSliceIdSchema } from '../ids.ts';
import type { WorkSliceId } from '../ids.ts';
import type { Config } from '../types.ts';

/** One worktree of the repository. `branch` is the short name, `null` in detached HEAD. */
export type Worktree = {
  readonly path: string;
  readonly head: string | null;
  readonly branch: string | null;
  readonly locked: boolean;
  readonly prunable: boolean;
};

/** The branch shape a kit worktree matched. */
export type KitShape = 'slice' | 'feature' | 'phase0';

/** What a worktree is to the kit: its own, with the topic and slice its branch carries, or another's. */
export type WorktreeKind =
  | { readonly kind: 'kit'; readonly shape: KitShape; readonly topic: string; readonly slice: WorkSliceId | null }
  | { readonly kind: 'other' };

/** The branch templates the kit cuts its worktrees on, as the config declares them. */
export type KitBranches = Readonly<Pick<Config['branches'], 'slice' | 'feature' | 'phase0'>>;

const HEADS = 'refs/heads/';

/** The value of the line of `lines` that starts with `key` and a space, or `undefined`. */
function field(lines: readonly string[], key: string): string | undefined {
  const line = lines.find((candidate) => candidate.startsWith(`${key} `));
  return line?.slice(key.length + 1);
}

/** A flag line (`locked`, `prunable`), bare or with its reason. */
const flagged = (lines: readonly string[], key: string): boolean => lines.some((line) => line === key || line.startsWith(`${key} `));

/** The worktrees `git worktree list --porcelain` printed, the main checkout first, as git lists it. */
export function parseWorktreeList(text: string): Worktree[] {
  const out: Worktree[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((line) => line !== '');
    const path = field(lines, 'worktree');
    if (path === undefined) continue;
    const ref = field(lines, 'branch');
    out.push({
      path,
      head: field(lines, 'HEAD') ?? null,
      branch: ref === undefined ? null : ref.startsWith(HEADS) ? ref.slice(HEADS.length) : ref,
      locked: flagged(lines, 'locked'),
      prunable: flagged(lines, 'prunable'),
    });
  }
  return out;
}

/** A topic or a slice, as a PRD folder's topic and a slice id are written. */
const NAME = '[a-z0-9]+(?:-[a-z0-9]+)*';

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `template` as a pattern: `{topic}` and `{slice}` read as names, the rest as written. */
function shapePattern(template: string): RegExp {
  const seen = new Set<string>();
  const source = template
    .split(/(\{topic\}|\{slice\})/)
    .map((part) => {
      if (part !== '{topic}' && part !== '{slice}') return escape(part);
      const name = part.slice(1, -1);
      if (seen.has(name)) return `\\k<${name}>`;
      seen.add(name);
      return `(?<${name}>${NAME})`;
    })
    .join('');
  return new RegExp(`^${source}$`);
}

/** Whether `path` is inside the folder `folder` (never the folder itself). */
export function isInside(folder: string, path: string): boolean {
  const rest = relative(folder, path);
  return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
}

/** The shape `branch` has, tried as a slice, then a feature, then a phase-0 branch; `other` for none. */
export function shapeOf(branch: string, branches: KitBranches): WorktreeKind {
  const shapes: readonly KitShape[] = ['slice', 'feature', 'phase0'];
  for (const shape of shapes) {
    const groups = shapePattern(branches[shape]).exec(branch)?.groups;
    const topic = groups?.topic;
    if (topic === undefined) continue;
    const slice = WorkSliceIdSchema.safeParse(groups?.slice);
    return { kind: 'kit', shape, topic, slice: slice.success ? slice.data : null };
  }
  return { kind: 'other' };
}

/** Whether `worktree` is the kit's: see the top of this file. `folder` is the absolute `worktrees` folder. */
export function kindOf(worktree: Pick<Worktree, 'path' | 'branch'>, { folder, branches }: { folder: string; branches: KitBranches }): WorktreeKind {
  if (worktree.branch === null || !isInside(folder, worktree.path)) return { kind: 'other' };
  return shapeOf(worktree.branch, branches);
}
