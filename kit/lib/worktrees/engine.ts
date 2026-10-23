// PRD 2485, s1: what `omni worktrees` keeps and what it removes. The kit removes only a worktree it
// made (`./list.ts`), and only once its work is safe on the remote. A `kit` worktree is `safe` when
// every rule below holds; otherwise it is kept, with the first reason that fails, in this order:
//
// | reason        | rule                                                                              |
// | ------------- | --------------------------------------------------------------------------------- |
// | `uncommitted` | `git status --porcelain` in it is not empty                                       |
// | `unpushed`    | its HEAD is in no `<remote>/*` branch, read after one fetch per call               |
// | `claimed`     | its slice is claimed (in flight, or claimed but quiet) on the PRD's board          |
// | `red slice`   | its slice is not merged on the board while the PRD's feature PR is open           |
// | `in use`      | a process works inside it; a read of the processes that fails keeps it            |
//
// Once the feature PR is merged or closed, the board keeps nothing: only `uncommitted`, `unpushed` and
// `in use` do. Three more keep a worktree whatever the rules say: one git lists as `prunable` (its
// folder is gone) or `locked` (git refuses to remove it), one whose status git cannot read
// (`unreadable: <git's line>`), and a slice whose board cannot be read (`no board: <why>`). Feature
// and phase-0 worktrees have no slice, so the board never keeps them.
//
// Removing is `git worktree remove <path>`, then `git branch -d <branch>`: never `-D`, never
// `--force`. A removal git refuses is kept with git's reason; a branch git refuses to delete stays,
// and the line says so. `hint` counts, with no fetch, no board, no process read and no size, the kit's
// worktrees that are clean and whose HEAD a remote branch already holds. Every read of the machine goes
// through the injected `WorktreesHost`, and the board through `board`, so the rules are tested alone.
import { resolve } from 'node:path';
import type { PrdNumber, WorkSliceId } from '../ids.ts';
import type { SliceState } from '../board.ts';
import { isInside, kindOf, parseWorktreeList } from './list.ts';
import type { KitBranches, Worktree, WorktreeKind } from './list.ts';

/** What the engine reads of the machine, and how it removes. */
export type WorktreesHost = {
  /** `git worktree list --porcelain`; throws when the repository cannot be read. */
  list(): string;
  /** One fetch of the remote; a failure is ignored, and the last fetch is read. */
  fetch(): void;
  /** The heads among `heads` no `<remote>/*` branch holds; every one of them when git cannot say. */
  unpushed(heads: readonly string[]): ReadonlySet<string>;
  /** `git status --porcelain` in the worktree at `path`; rejects, with git's line, when git cannot read it. */
  status(path: string): Promise<string>;
  /** `git worktree remove <path>`: `null` once removed, else the reason git refused. */
  remove(path: string): string | null;
  /** `git branch -d <branch>`: `null` once deleted, else the reason git refused. */
  deleteBranch(branch: string): string | null;
  /** The worktree's size on disk, in bytes, or `null` when it cannot be measured. */
  size(path: string): number | null;
  /** The working directory of every process, or `null` when they cannot be read. */
  cwds(): readonly string[] | null;
  /** `path` with its links resolved, or as given when it cannot be. */
  realpath(path: string): string;
};

/** A PRD's board, as far as the rules read it: whether its feature PR is still open, and each slice's state. */
export type WorktreeBoard = { readonly featureOpen: boolean; readonly slices: Readonly<Record<string, SliceState>> };

/** Reads a PRD's board: the board, or one line saying why it cannot be read. */
export type BoardSeam = (prd: PrdNumber) => Promise<WorktreeBoard | string>;

/** What the engine works with. `folder` is the `worktrees` config value; `prdOf` maps a topic to its PRD. */
export type WorktreesSeams = {
  readonly host: WorktreesHost;
  readonly board: BoardSeam;
  readonly branches: KitBranches;
  readonly folder: string;
  readonly prdOf: (topic: string) => PrdNumber | null;
};

/** One worktree, as `list` reports it. `verdict` is `safe` or `kept: <reason>` for a kit one, `null` for another's. */
export type WorktreeEntry = {
  readonly path: string;
  readonly branch: string | null;
  readonly kind: 'kit' | 'other';
  readonly prd: PrdNumber | null;
  readonly verdict: string | null;
};

type Classified = Worktree & { readonly is: WorktreeKind; readonly real: string };

/** What one call reads once: the unpushed heads, the processes, each PRD's board. */
type Run = {
  readonly seams: WorktreesSeams;
  readonly unpushed: ReadonlySet<string>;
  cwds: readonly string[] | null | undefined;
  readonly boards: Map<PrdNumber, Promise<WorktreeBoard | string>>;
};

const SEP = ' · ';

/** The absolute `worktrees` folder of the repository whose worktrees are `all`: under the main checkout, git's first. */
function folderOf(seams: WorktreesSeams, all: readonly Pick<Worktree, 'path'>[]): string | null {
  const main = all[0];
  return main === undefined ? null : seams.host.realpath(resolve(main.path, seams.folder));
}

/** The worktrees of the repository, each classed, the main checkout first and the others by path.
 * Throws when the repository cannot be read. */
function survey(seams: WorktreesSeams): Classified[] {
  const [main, ...linked] = parseWorktreeList(seams.host.list());
  if (main === undefined) return [];
  const all = [main, ...linked.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))];
  const folder = folderOf(seams, all);
  if (folder === null) return [];
  return all.map((worktree) => {
    const real = seams.host.realpath(worktree.path);
    return { ...worktree, real, is: kindOf({ path: real, branch: worktree.branch }, { folder, branches: seams.branches }) };
  });
}

function startRun(seams: WorktreesSeams, worktrees: readonly Classified[]): Run {
  const heads = worktrees.flatMap((worktree) => (worktree.head === null || worktree.prunable ? [] : [worktree.head]));
  return { seams, unpushed: heads.length === 0 ? new Set() : seams.host.unpushed(heads), cwds: undefined, boards: new Map() };
}

/** The first line of what git said when it failed, without its `error:` or `fatal:` prefix. */
export function gitLine(text: string): string {
  const line = text.split('\n').find((candidate) => candidate.trim() !== '') ?? 'git refused';
  return line.replace(/^(?:error|fatal|warning): /, '').trim();
}

/** The board of the PRD whose topic is `topic`, read once per call, or why it cannot be read. */
function boardOf(topic: string, run: Run): Promise<WorktreeBoard | string> {
  const prd = run.seams.prdOf(topic);
  if (prd === null) return Promise.resolve(`no PRD folder for ${topic}`);
  const known = run.boards.get(prd);
  if (known !== undefined) return known;
  const pending = run.seams.board(prd);
  run.boards.set(prd, pending);
  return pending;
}

/** Why `board` keeps the worktree of `slice`, or `null`: nothing once the feature PR is merged or closed. */
function sliceReason(board: WorktreeBoard, slice: WorkSliceId): string | null {
  if (!board.featureOpen) return null;
  const state = Object.hasOwn(board.slices, slice) ? board.slices[slice] : undefined;
  if (state === 'merged') return null;
  return state === 'in-flight' || state === 'claimed-stale' ? 'claimed' : 'red slice';
}

/** Why the board keeps a slice worktree, or `null` when it does not; it never keeps any other. */
async function boardReason({ is }: Classified, run: Run): Promise<string | null> {
  if (is.kind !== 'kit' || is.slice === null) return null;
  const board = await boardOf(is.topic, run);
  return typeof board === 'string' ? `no board: ${board}` : sliceReason(board, is.slice);
}

/** Whether a process works inside the worktree; a read that fails says yes. */
function inUse(worktree: Classified, run: Run): boolean {
  if (run.cwds === undefined) run.cwds = run.seams.host.cwds();
  if (run.cwds === null) return true;
  return run.cwds.some((cwd) => cwd === worktree.real || isInside(worktree.real, cwd));
}

/** Why git's own reads keep the worktree (its folder gone, its status unreadable or not empty, its
 * HEAD on no remote branch), or `null`. */
async function gitReason(worktree: Classified, run: Run): Promise<string | null> {
  if (worktree.prunable) return 'prunable';
  let status: string;
  try {
    status = await run.seams.host.status(worktree.path);
  } catch (error) {
    return `unreadable: ${gitLine(error instanceof Error ? error.message : String(error))}`;
  }
  if (status.trim() !== '') return 'uncommitted';
  return worktree.head === null || run.unpushed.has(worktree.head) ? 'unpushed' : null;
}

/** Why the worktree is kept, or `null` when it is safe to remove: see the top of this file. */
async function keepReason(worktree: Classified, run: Run): Promise<string | null> {
  const reason = (await gitReason(worktree, run)) ?? (await boardReason(worktree, run));
  if (reason !== null) return reason;
  if (inUse(worktree, run)) return 'in use';
  return worktree.locked ? 'locked' : null;
}

const UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

/** A size in bytes as a person reads it: `512 B`, `12 KB`, `1.4 MB`, `186.0 GB`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${Math.round(value)} ${UNITS[0]}` : `${value.toFixed(1)} ${UNITS[unit]}`;
}

/** Every worktree, `kit` or `other`, and each kit one's verdict. Fetches once first. */
export async function listWorktrees(seams: WorktreesSeams): Promise<WorktreeEntry[]> {
  seams.host.fetch();
  const all = survey(seams);
  const run = startRun(seams, all);
  const out: WorktreeEntry[] = [];
  for (const worktree of all) {
    const { is } = worktree;
    if (is.kind === 'other') {
      out.push({ path: worktree.path, branch: worktree.branch, kind: 'other', prd: null, verdict: null });
      continue;
    }
    const reason = await keepReason(worktree, run);
    out.push({ path: worktree.path, branch: worktree.branch, kind: 'kit', prd: seams.prdOf(is.topic), verdict: reason === null ? 'safe' : `kept: ${reason}` });
  }
  return out;
}

/** What removing one worktree did: its line, and the bytes it freed. */
type Removal = { readonly line: string; readonly freed: number };

/** Removes the safe `worktree`, then its branch, and says what git did; `size` and `bytes` are as measured. */
function removeNow(host: WorktreesHost, { path, branch }: Classified, { size, bytes }: { size: string; bytes: number }): Removal {
  const refused = host.remove(path);
  if (refused !== null) return { line: `kept ${path}${SEP}${refused}`, freed: 0 };
  const kept = branch === null ? null : host.deleteBranch(branch);
  const tail = kept === null ? '' : `${SEP}branch ${String(branch)} kept: ${kept}`;
  return { line: `removed ${path}${SEP}${size}${tail}`, freed: bytes };
}

/** Removes `worktree` when the rules let it (only measures it under `dryRun`), and says what it did. */
async function removeIfSafe(worktree: Classified, run: Run, dryRun: boolean): Promise<Removal> {
  const reason = await keepReason(worktree, run);
  if (reason !== null) return { line: `kept ${worktree.path}${SEP}${reason}`, freed: 0 };
  const bytes = run.seams.host.size(worktree.path);
  const size = bytes === null ? 'size unknown' : formatSize(bytes);
  if (dryRun) return { line: `would remove ${worktree.path}${SEP}${size}`, freed: bytes ?? 0 };
  return removeNow(run.seams.host, worktree, { size, bytes: bytes ?? 0 });
}

/**
 * Removes every safe kit worktree (of PRD `prd` alone, when given), one line per kit worktree, then
 * the total freed. Under `dryRun` it removes nothing and says what it would.
 */
export async function pruneWorktrees(seams: WorktreesSeams, { prd, dryRun }: { prd: PrdNumber | null; dryRun: boolean }): Promise<string[]> {
  seams.host.fetch();
  const chosen = survey(seams).filter(({ is }) => is.kind === 'kit' && (prd === null || seams.prdOf(is.topic) === prd));
  const run = startRun(seams, chosen);
  const lines: string[] = [];
  let total = 0;
  for (const worktree of chosen) {
    const { line, freed } = await removeIfSafe(worktree, run, dryRun);
    lines.push(line);
    total += freed;
  }
  lines.push(`${dryRun ? 'would free' : 'freed'} ${formatSize(total)}`);
  return lines;
}

/**
 * The same rules on the one worktree at `path` (resolved against `cwd`): the caller says it made it,
 * so a detached worktree under the `worktrees` folder is removed too. A worktree of no shape or outside
 * the folder is kept as not the kit's; a path that is no worktree says so.
 */
export async function removeWorktree(seams: WorktreesSeams, { path, cwd }: { path: string; cwd: string }): Promise<string> {
  seams.host.fetch();
  const all = survey(seams);
  const wanted = seams.host.realpath(resolve(cwd, path));
  const worktree = all.find((candidate) => candidate.real === wanted);
  if (worktree === undefined) return `no worktree at ${path}`;
  const folder = folderOf(seams, all);
  const detachedInside = worktree.branch === null && folder !== null && isInside(folder, worktree.real);
  if (worktree.is.kind === 'other' && !detachedInside) return `kept ${worktree.path}${SEP}not the kit's`;
  return (await removeIfSafe(worktree, startRun(seams, [worktree]), false)).line;
}

/** Whether git reads the worktree at `path` as clean; one it cannot read is not. */
async function isClean(host: WorktreesHost, path: string): Promise<boolean> {
  try {
    return (await host.status(path)).trim() === '';
  } catch {
    return false;
  }
}

/**
 * The hint a session starts with: how many kit worktrees, unlocked, are clean and already held by a
 * remote branch, or `null` when none is. No fetch, no board, no process read, no size; every status at once.
 */
export async function worktreesHint(seams: WorktreesSeams): Promise<string | null> {
  const kit = survey(seams).filter((worktree) => worktree.is.kind === 'kit' && !worktree.locked && !worktree.prunable);
  const heads = kit.flatMap(({ head }) => (head === null ? [] : [head]));
  const unpushed = heads.length === 0 ? new Set<string>() : seams.host.unpushed(heads);
  const pushed = kit.filter(({ head }) => head !== null && !unpushed.has(head));
  const clean = await Promise.all(pushed.map(({ path }) => isClean(seams.host, path)));
  const count = clean.filter(Boolean).length;
  if (count === 0) return null;
  return `${count} ${count === 1 ? 'worktree' : 'worktrees'} of the kit can be removed: omni worktrees prune`;
}
