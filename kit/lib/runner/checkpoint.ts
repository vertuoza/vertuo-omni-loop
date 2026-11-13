// The runner's save (PRD 2809, s2): before a job's folder `~/wt/<repo>-job-<id>` is removed — at the end of
// the job, or by the sweep after a restart — the runner keeps what GitHub does not hold.
//
// 1. It lists the checkout's worktrees that are the folder or sit inside it (`git worktree list --porcelain`):
//    the job's own, and those its skill made, one per slice.
// 2. For each, it finds the uncommitted changes (tracked files, and new files git does not ignore; a nested
//    worktree is never part of its parent's) and the commits not on `origin`
//    (`git rev-list HEAD --not --remotes=origin`). Nothing in any: nothing is written (the common case).
// 3. Otherwise each worktree with work gets a snapshot commit, made through a temporary index
//    (`GIT_INDEX_FILE`, `add -A`, `write-tree`, `commit-tree`), so no branch moves and no file changes, and one
//    git bundle `<folder>.checkpoint.bundle` holds `refs/heads/omni-checkpoint/<branch>` for each, at its
//    snapshot or its head, with only the commits `origin` lacks. A detached worktree is
//    `omni-checkpoint/detached/<its path in the folder>`. A file git ignores (a `.env`) never enters it.
// 4. The save is local: the folder is kept, and the manifest `<folder>.checkpoint.json` beside it says what it
//    holds, until when it is kept (`KEEP_DAYS`), and its size, folder and bundle together. The sweep removes a
//    kept folder at that date, or the oldest first while the kept saves pass the runner's `--keep-budget`, its
//    manifest then saying what was lost (`sweep.ts`). A save that fails keeps the folder all the same, its
//    manifest saying why.
// 5. `sendSave` (s4) sends it: a signed upload link from the app (`POST /api/runners/jobs/<id>/checkpoint`), the
//    bundle to the private bucket `runner-checkpoints`, then its manifest (`checkpoint.manifest.ts`, the handoff note
//    masked and cut to 8 KB) recorded `portable`, the runner's own manifest saying where it went (`sent`). A save that
//    failed, a bundle over 100 MB, or an upload that fails or is refused is recorded `local` instead, saying why.
//
// The bundle is made in a scratch bare repository that borrows the checkout's objects, so not a ref of the
// checkout is written. The snapshot is authored by the job's app when the runner knows it, else by the runner.
import { copyFileSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { ExecText } from '../context.ts';
import { processEnv } from '../env/read.ts';
import type { CheckpointApi, RecordedSave } from './api.ts';
import { CHECKPOINT_BYTES_MAX, manifestHandoff } from './checkpoint.manifest.ts';
import type { CheckpointManifest } from './checkpoint.manifest.ts';

/** How many days a local save is kept on the runner. */
export const KEEP_DAYS = 7;
/** The disk the kept saves may take on a runner, in GB, unless `--keep-budget` says otherwise. */
export const KEEP_BUDGET_GB = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
/** Where every saved branch's ref lives, in the bundle and once restored. */
const CHECKPOINT_REFS = 'refs/heads/omni-checkpoint/';

const SavedBranchSchema = z.object({
  /** The branch the worktree was on, `null` when it was detached. */
  branch: z.string().nullable(),
  ref: z.string(),
  /** The worktree's path in the job's folder, `.` for the folder itself. */
  path: z.string(),
  /** The commit origin had that the saved work starts from, `null` when origin had none of it. */
  base: z.string().nullable(),
  head: z.string(),
  files: z.number().int().nonnegative(),
  commits: z.number().int().nonnegative(),
});

const LocalSaveSchema = z.object({
  job: z.string(),
  repo: z.string(),
  runner: z.string(),
  kind: z.literal('local'),
  savedAt: z.string(),
  keepUntil: z.string(),
  folder: z.string(),
  bundle: z.string().nullable(),
  bundleBytes: z.number().int().nonnegative(),
  /** The folder and the bundle together: what the save takes of the runner's keep budget. */
  bytes: z.number().int().nonnegative(),
  branches: z.array(SavedBranchSchema),
  /** Why the save failed, its folder kept all the same; `null` when it did not. */
  failed: z.string().nullable(),
  /** When the folder went before its date, over the keep budget, and why; `null` while it is kept. */
  lost: z.object({ at: z.string(), why: z.string() }).nullable(),
  /** When its bundle reached the app's bucket, and at which path (PRD 2809, s4); absent or `null` while it did not. */
  sent: z.object({ at: z.string(), path: z.string() }).nullish(),
});

/** One worktree's saved work. */
type SavedBranch = z.output<typeof SavedBranchSchema>;
/** A job's save kept on its runner, as its manifest holds it. */
export type LocalSave = z.output<typeof LocalSaveSchema>;

/** A worktree of the checkout: its folder, its commit and its branch, `null` when detached. */
export type Worktree = { path: string; head: string; branch: string | null };

/** Who a snapshot commit is by. */
export type Author = { name: string; email: string };

export type SaveOptions = {
  exec: ExecText;
  /** The checkout the job's worktree was cut from. */
  checkout: string;
  /** The job's folder, `~/wt/<repo>-job-<id>`. */
  folder: string;
  job: string;
  repo: string;
  runner: string;
  /** The job's app, when the runner knows it: the snapshot's author. */
  author: Author | null;
  now: number;
};

/** The manifest and the bundle of the save of `folder`, beside it. */
export function savePaths(folder: string): { manifest: string; bundle: string } {
  return { manifest: `${folder}.checkpoint.json`, bundle: `${folder}.checkpoint.bundle` };
}

/** The save `path` holds, or `null` when it is missing or is no save. */
export function readSave(path: string): LocalSave | null {
  try {
    const read = LocalSaveSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    return read.success ? read.data : null;
  } catch {
    return null;
  }
}

/** Writes `save` as its manifest, beside its folder. */
export function writeSave(save: LocalSave): void {
  writeFileSync(savePaths(save.folder).manifest, `${JSON.stringify(save, null, 2)}\n`);
}

/** Every save whose manifest sits in `~/wt`, kept or lost. */
export function savesIn(home: string): LocalSave[] {
  const wt = join(home, 'wt');
  let names: string[];
  try {
    names = readdirSync(wt);
  } catch {
    return [];
  }
  return names.filter((name) => name.endsWith('.checkpoint.json')).flatMap((name) => readSave(join(wt, name)) ?? []);
}

/** Whether `folder` is kept for its save: its manifest reads, and its folder did not go. */
export function isKept(folder: string): boolean {
  const save = readSave(savePaths(folder).manifest);
  return save !== null && save.lost === null;
}

/** The bytes under `path`, symbolic links counted as themselves and never followed. */
export function sizeOf(path: string): number {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.size;
  let names: string[];
  try {
    names = readdirSync(path);
  } catch {
    return stat.size;
  }
  return names.reduce((total, name) => total + sizeOf(join(path, name)), stat.size);
}

/** `bytes` read by a person: KB under a megabyte, MB under a gigabyte, else GB with one decimal. */
export function sizeText(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${String(Math.round(kb))} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${String(Math.round(mb))} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

const count = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;

/** What a save holds, read by a person: `2 branches, 4 files, 1 commit`. */
export function savedText({ branches }: Pick<LocalSave, 'branches'>): string {
  const sum = (key: 'files' | 'commits'): number => branches.reduce((total, branch) => total + branch[key], 0);
  return [count(branches.length, 'branch', 'branches'), count(sum('files'), 'file', 'files'), count(sum('commits'), 'commit', 'commits')].join(', ');
}

/** The line the runner prints once it kept a job's folder for its save. */
export function savedLine(save: LocalSave): string {
  const until = `${save.keepUntil.slice(0, 16).replace('T', ' ')} UTC`;
  if (save.failed !== null) return `job ${save.job}: its folder is kept until ${until}: ${save.failed}`;
  return `job ${save.job}: kept its work not on origin until ${until}: ${savedText(save)} · ${sizeText(save.bytes)}`;
}

/** `path` with its symbolic links resolved, or as it is when it cannot be. */
function real(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/** Whether `path` is `folder` or sits inside it. */
const within = (path: string, folder: string): boolean => path === folder || path.startsWith(`${folder}${sep}`);

/** The checkout's worktrees, as `git worktree list --porcelain` gives them; none when git cannot read it. */
function worktreesOf(exec: ExecText, checkout: string): Worktree[] {
  let out: string;
  try {
    out = exec('git', ['-C', checkout, 'worktree', 'list', '--porcelain'], QUIET);
  } catch {
    return [];
  }
  return out.split('\n\n').flatMap((block) => {
    const lines = block.split('\n');
    const field = (name: string): string | undefined => lines.find((line) => line.startsWith(`${name} `))?.slice(name.length + 1);
    const path = field('worktree');
    const head = field('HEAD');
    if (path === undefined || head === undefined || lines.includes('bare')) return [];
    const branch = field('branch');
    return [{ path, head, branch: branch === undefined ? null : branch.replace(/^refs\/heads\//, '') }];
  });
}

/** The checkout's worktrees that are `folder` or sit inside it, the folder first, each on a folder that is there. */
export function worktreesIn(exec: ExecText, checkout: string, folder: string): Worktree[] {
  if (!existsSync(folder)) return [];
  const root = real(folder);
  return worktreesOf(exec, checkout)
    .filter((worktree) => existsSync(worktree.path))
    .map((worktree) => ({ ...worktree, path: real(worktree.path) }))
    .filter((worktree) => within(worktree.path, root))
    .sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path))
    .map((worktree) => ({ ...worktree, path: join(folder, relative(root, worktree.path)) }));
}

/** The ref a worktree's save is kept under: its branch's, else `detached/<its path in the folder>`. */
function refOf(worktree: Worktree, path: string): string {
  if (worktree.branch !== null) return `${CHECKPOINT_REFS}${worktree.branch}`;
  const parts = path === '.' ? ['root'] : path.split('/').map((part) => part.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+/, '') || 'x');
  return `${CHECKPOINT_REFS}detached/${parts.join('/')}`;
}

/** `path` of `worktree`, read by git: absolute as it is, else under the worktree. */
function gitPath(exec: ExecText, worktree: string, name: string): string {
  const path = exec('git', ['-C', worktree, 'rev-parse', '--git-path', name], QUIET).trim();
  return isAbsolute(path) ? path : join(worktree, path);
}

/**
 * What `worktree` holds that origin does not: its uncommitted changes, snapshotted through a temporary index
 * (the worktrees in `nested` left out), and its commits not on origin. `null` when it holds neither.
 */
function unsavedOf(options: SaveOptions, worktree: Worktree, nested: readonly string[]): SavedBranch | null {
  const { exec, folder, job, runner, author } = options;
  const at = worktree.path;
  const scratch = mkdtempSync(join(tmpdir(), 'omni-checkpoint-index-'));
  try {
    const index = join(scratch, 'index');
    const env = { ...processEnv(), GIT_INDEX_FILE: index };
    const own = gitPath(exec, at, 'index');
    if (existsSync(own)) copyFileSync(own, index);
    else exec('git', ['-C', at, 'read-tree', 'HEAD'], { ...QUIET, env });
    const excluded = nested.map((path) => `:(exclude)${relative(at, path).split(sep).join('/')}`);
    exec('git', ['-C', at, 'add', '-A', '--', '.', ...excluded], { ...QUIET, env });
    const tree = exec('git', ['-C', at, 'write-tree'], { ...QUIET, env }).trim();
    const headTree = exec('git', ['-C', at, 'rev-parse', `${worktree.head}^{tree}`], QUIET).trim();
    const files = tree === headTree ? 0 : exec('git', ['-C', at, 'diff-tree', '-r', '--name-only', '--no-renames', headTree, tree], QUIET).split('\n').filter(Boolean).length;
    const commits = Number.parseInt(exec('git', ['-C', at, 'rev-list', '--count', worktree.head, '--not', '--remotes=origin'], QUIET).trim(), 10) || 0;
    if (files === 0 && commits === 0) return null;
    const who = author ?? { name: `omni runner ${runner}`, email: `${runner}@runner.omni.invalid` };
    const message = `chore(checkpoint): the work of job ${job} not on origin, saved by runner ${runner}`;
    const head = files === 0 ? worktree.head : exec('git', ['-C', at, '-c', `user.name=${who.name}`, '-c', `user.email=${who.email}`, 'commit-tree', tree, '-p', worktree.head, '-m', message], QUIET).trim();
    const path = relative(real(folder), real(at)).split(sep).join('/') || '.';
    return { branch: worktree.branch, ref: refOf(worktree, path), path, base: baseOf(exec, at, worktree.head, commits), head, files, commits };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** The commit origin had that `head`'s unpushed commits start from: `head` itself when there are none, `null` when origin had none of it. */
function baseOf(exec: ExecText, worktree: string, head: string, commits: number): string | null {
  if (commits === 0) return head;
  const boundary = exec('git', ['-C', worktree, 'rev-list', '--boundary', head, '--not', '--remotes=origin'], QUIET)
    .split('\n')
    .find((line) => line.startsWith('-'));
  return boundary === undefined ? null : boundary.slice(1);
}

/**
 * Writes one bundle at `file` holding each of `found`'s refs at its head, with only the commits origin lacks:
 * made in a scratch bare repository borrowing the checkout's objects, so not a ref of the checkout is written.
 */
function writeBundle(exec: ExecText, checkout: string, found: readonly SavedBranch[], file: string): void {
  const common = gitPath(exec, checkout, 'objects');
  const scratch = mkdtempSync(join(tmpdir(), 'omni-checkpoint-bundle-'));
  try {
    exec('git', ['init', '-q', '--bare', scratch], QUIET);
    writeFileSync(join(scratch, 'objects', 'info', 'alternates'), `${common}\n`);
    for (const { ref, head } of found) exec('git', ['-C', scratch, 'update-ref', ref, head], QUIET);
    const onOrigin = [...new Set(exec('git', ['-C', checkout, 'for-each-ref', '--format=%(objectname)', 'refs/remotes/origin'], QUIET).split('\n').filter(Boolean))];
    exec('git', ['-C', scratch, 'bundle', 'create', '-q', file, ...found.map(({ ref }) => ref), ...(onOrigin.length === 0 ? [] : ['--not', ...onOrigin])], QUIET);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** The local save of `options`'s folder: its manifest written beside it, its size counted. */
function keep(options: SaveOptions, branches: SavedBranch[], bundle: string | null, failed: string | null): LocalSave {
  const bundleBytes = bundle === null ? 0 : statSync(bundle).size;
  const save: LocalSave = {
    job: options.job,
    repo: options.repo,
    runner: options.runner,
    kind: 'local',
    savedAt: new Date(options.now).toISOString(),
    keepUntil: new Date(options.now + KEEP_DAYS * DAY_MS).toISOString(),
    folder: options.folder,
    bundle,
    bundleBytes,
    bytes: sizeOf(options.folder) + bundleBytes,
    branches,
    failed,
    lost: null,
  };
  writeSave(save);
  return save;
}

/** What `sendSave` needs: the save, the app's checkpoint calls, the job's handoff note as written and the secrets to mask in it. */
export type SendOptions = {
  save: LocalSave;
  api: CheckpointApi;
  handoff: string | null;
  /** The job's tokens and its accounts' keys: never in a manifest. */
  secrets: readonly string[];
  now: number;
};

/** Where a save ended up: in the bucket (`portable`), or on its runner (`local`, and why), as the app recorded it, or `null` when the app heard nothing of it. */
export type Sent = { kind: 'portable'; why: null; recorded: RecordedSave } | { kind: 'local'; why: string; recorded: RecordedSave | null };

/** The manifest of `save` as the app reads it: no folder of the runner, the handoff masked and cut. */
function manifestOf(save: LocalSave, kind: CheckpointManifest['kind'], handoff: string | null, failed: string | null): CheckpointManifest {
  return {
    job: save.job, runner: save.runner, repo: save.repo, kind, savedAt: save.savedAt, keepUntil: save.keepUntil, bundleBytes: save.bundleBytes, bytes: save.bytes,
    branches: save.branches.map(({ branch, ref, path, base, head, files, commits }) => ({ branch, ref, path, base, head, files, commits })),
    handoff, failed,
  };
}

const whyOf = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';

/**
 * Sends a save to the app (PRD 2809, s4): the bundle through a signed link to the private bucket, then its manifest
 * recorded `portable`, the runner's own manifest saying where it went. A save that failed, a bundle over 100 MB, or an
 * upload that fails or is refused is recorded `local`, saying why, and its folder stays as it is. Never throws: when the
 * app hears nothing, the save stays local, unrecorded.
 */
export async function sendSave({ save, api, handoff, secrets, now }: SendOptions): Promise<Sent> {
  const note = manifestHandoff(handoff, secrets);
  const local = async (why: string): Promise<Sent> => {
    try {
      return { kind: 'local', why, recorded: await api.record(save.job, { kind: 'local', manifest: manifestOf(save, 'local', note, why) }) };
    } catch {
      return { kind: 'local', why, recorded: null };
    }
  };
  if (save.failed !== null || save.bundle === null) return local(save.failed ?? 'the save holds no bundle');
  if (save.bundleBytes > CHECKPOINT_BYTES_MAX) return local('the bundle is over 100 MB');
  try {
    const link = await api.link(save.job, save.bundleBytes);
    await api.upload(link, new Uint8Array(readFileSync(save.bundle)));
    const recorded = await api.record(save.job, { kind: 'portable', path: link.path, manifest: manifestOf(save, 'portable', note, null) });
    writeSave({ ...save, sent: { at: new Date(now).toISOString(), path: link.path } });
    return { kind: 'portable', why: null, recorded };
  } catch (error) {
    return local(`the upload failed: ${whyOf(error)}`);
  }
}

/**
 * Saves the work of the job's folder origin does not hold, before the folder goes: `null` when there is none
 * (nothing written, and the folder may go), else the local save kept beside it (the folder stays). A save
 * that fails keeps the folder too, its manifest saying why.
 */
export function saveJob(options: SaveOptions): LocalSave | null {
  const { exec, checkout, folder } = options;
  const { bundle } = savePaths(folder);
  try {
    const worktrees = worktreesIn(exec, checkout, folder);
    const found = worktrees.flatMap((worktree) => {
      const nested = worktrees.filter((other) => other !== worktree && within(other.path, worktree.path)).map((other) => other.path);
      return unsavedOf(options, worktree, nested) ?? [];
    });
    if (found.length === 0) return null;
    writeBundle(exec, checkout, found, bundle);
    return keep(options, found, bundle, null);
  } catch (error) {
    rmSync(bundle, { force: true });
    const why = (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';
    return keep(options, [], null, `the save failed: ${why}`);
  }
}
