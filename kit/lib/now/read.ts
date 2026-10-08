// What `omni now` reads (PRD 1208's spec, "What a session is on"): the facts the status line reads
// (`../statusline/facts.ts`, PRD 324) for the session's folder and id, turned into the answer by
// `now.ts`. The work is read branch first, then record, as PRD 324 reads a PRD:
//
// 1. a fix branch (`branches.fix`) whose bug or visual fix has a folder, read by the heartbeat's work
//    finder (PRD 757, `findWork`);
// 2. the PRD the session's branch names, else the one its record names (the status line's own
//    reading), its stage and its board, read from the cached file with each slice's name;
// 3. the bug or visual fix the session's record names (`{ kind, number, at }`, PRD 1208's s2).
//
// A fix's folder is `<nnnn>-<topic>` under `<paths.delivery>/bugs/` or `<paths.delivery>/visual/`, in
// the checkout's working tree or on the base (`<repo.remote>/<repo.defaultBranch>`, else the local
// default branch); it is `merged` once its folder is on the base. A fix with no folder is no work.
// Nothing here prints, fetches, runs `gh`, writes a file or starts a process: the board's background
// refresh is never started from here. Anything that cannot be read reads as the session on nothing;
// it never throws.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findWork } from '../ask/heartbeat.ts';
import { bugRoot } from '../bug/verdict.ts';
import { loadConfig } from '../config.ts';
import { createContext } from '../context.ts';
import type { Context, ExecText } from '../context.ts';
import type { IssueNumber } from '../ids.ts';
import { findRoot } from '../init/repo.ts';
import { parseFolderName } from '../layout.ts';
import type { NamedSlice } from '../statusline/board-cache.ts';
import { readFacts } from '../statusline/facts.ts';
import type { CachedSlice } from '../statusline/schema.ts';
import { recordedWork } from '../statusline/sessions.ts';
import { visualRoot } from '../visual/verdict.ts';
import { NOTHING, nowOfFix, nowOfPrd } from './now.ts';
import type { FixKind, Now } from './now.ts';

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

/** The fix folders of one kind: those in the checkout's working tree, and those on the base. */
type FixFolders = { checkout: string[]; base: string[] };

/** `fn()`, or `fallback` when it throws. */
function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** `slice` with the name the cached board kept for it, when it kept one. */
function named(slice: CachedSlice): NamedSlice {
  return 'name' in slice && typeof slice.name === 'string' ? { ...slice, name: slice.name } : slice;
}

/** The context of the checkout `folder` sits in, or `null` when it is no repository or its config does not load. */
function contextOf(folder: string, exec: ExecText): Context | null {
  return attempt(() => {
    const root = findRoot(folder, exec);
    return createContext(root, loadConfig(root));
  }, null);
}

/** The base's ref: the remote-tracking default branch, else the local one, else `null`. */
function baseOf(ctx: Context, exec: ExecText): string | null {
  const { remote, defaultBranch } = ctx.config.repo;
  const refs = [`refs/remotes/${remote}/${defaultBranch}`, `refs/heads/${defaultBranch}`];
  return refs.find((ref) => attempt(() => exec('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: ctx.root, ...QUIET }) !== '', false)) ?? null;
}

/** The fix folders under `dir`, in the checkout and on `base`. */
function fixFolders(ctx: Context, dir: string, base: string | null, exec: ExecText): FixFolders {
  const checkout = attempt(() => readdirSync(join(ctx.root, dir), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name), []);
  const onBase = base ? attempt(() => exec('git', ['ls-tree', '-z', '-d', '--name-only', `${base}:${dir}`], { cwd: ctx.root, ...QUIET }).split('\0').filter(Boolean), []) : [];
  return { checkout, base: onBase };
}

/** The answer for the `kind` fix of issue `number`, among its `folders`; `null` when it has no folder. */
function fixNow(kind: FixKind, number: IssueNumber, { checkout, base }: FixFolders): Now | null {
  const folder = [...checkout, ...base].find((name) => parseFolderName(name)?.prd === number);
  const parsed = folder ? parseFolderName(folder) : null;
  return folder && parsed ? nowOfFix({ kind, number, topic: parsed.topic, merged: base.includes(folder) }) : null;
}

const isFixKind = (kind: string): kind is FixKind => kind === 'bug' || kind === 'visual';

/** The answer for `work` when it is a bug or visual fix, among `fixes`; `undefined` for any other work. */
function fixWorkNow(work: { kind: string; number?: IssueNumber } | null, fixes: Record<FixKind, FixFolders>): Now | undefined {
  if (!work?.number || !isFixKind(work.kind)) return undefined;
  return fixNow(work.kind, work.number, fixes[work.kind]) ?? NOTHING;
}

/** The session's work in the checkout of `ctx`, read branch first, then record. */
function readWork(ctx: Context, { folder, sessionId, exec, now }: { folder: string; sessionId: string | null; exec: ExecText; now: number }): Now {
  const base = baseOf(ctx, exec);
  const fixes: Record<FixKind, FixFolders> = { bug: fixFolders(ctx, bugRoot(ctx), base, exec), visual: fixFolders(ctx, visualRoot(ctx), base, exec) };
  const all = (kind: FixKind): string[] => [...fixes[kind].checkout, ...fixes[kind].base];
  const head = attempt(() => exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: folder, ...QUIET }).trim(), null);
  const onBranch = findWork({ claudeSessionId: null, drafts: null, branch: head, branches: ctx.config.branches, folders: { visual: all('visual'), bugs: all('bug') } });
  const fromBranch = fixWorkNow(onBranch, fixes);
  if (fromBranch) return fromBranch;
  const { prd } = readFacts({ currentDir: folder, projectDir: null, sessionId }, { cwd: folder, exec, now, spawn: null });
  if (prd) return nowOfPrd({ number: prd.number, topic: prd.topic, stage: prd.stage, slices: prd.slices?.map(named) ?? null });
  return fixWorkNow(recordedWork({ cwd: folder, exec, sessionId }), fixes) ?? NOTHING;
}

/**
 * What the session in `folder` (else the process's own `cwd`), whose id is `sessionId`, is on now,
 * as of `now` (milliseconds): git is run through `exec`, as of the last fetch.
 */
export function readNow({ cwd, folder, sessionId, exec, now }: { cwd: string; folder: string | null; sessionId: string | null; exec: ExecText; now: number }): Now {
  try {
    const where = folder ?? cwd;
    const ctx = contextOf(where, exec);
    return ctx ? readWork(ctx, { folder: where, sessionId, exec, now }) : NOTHING;
  } catch {
    return NOTHING;
  }
}
