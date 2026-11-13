// The runner's restore (PRD 2809, s5): a job the app queued because its runner lost the one before it is a resume, and
// its claim carries its attempt, the earlier jobs of its chain and the saves they left (`resume.claim.ts`). Before the
// session starts, in the checkout its worktree was cut from:
//
// 1. Each save is fetched, oldest first, so the newest wins a branch two saved: a portable one from its signed link, a
//    local one this runner keeps from its own bundle beside the kept folder (`checkpoint.ts`). Each branch it holds comes
//    back as `refs/heads/omni-checkpoint/<branch>`, the ref it was saved under, and no other branch moves.
// 2. Each restored branch is read against origin's: it fast-forwards from it, origin already holds it, it diverged, or
//    origin has no such branch.
// 3. The note `~/logs/job-<id>.resume.md` says the attempt (`2 of 3`), each branch and how it stands, the handoff note
//    the save carried, what could not come (a local save on another runner: `3 files on feat/x--s3 stayed on box-1`), the
//    rule to take a branch's checkpoint before anything else, and that a claim naming an earlier job of the chain is
//    this job's. The session's prompt points at it.
//
// The chain beside the log (`~/logs/job-<id>.chain.json`, every job's): its attempt and the earlier jobs, read again when
// the job ends, and by the sweep for a job it finds stranded. A job its runner lost whose skill resumes, under its third
// attempt, leaves its claims with its chain: the resume takes them over, and no other job may. Nothing here calls GitHub.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { ExecText } from '../context.ts';
import { savesIn } from './checkpoint.ts';
import type { CheckpointManifest } from './checkpoint.manifest.ts';
import { checkRunnerLine, RESUMABLE_SKILLS } from './line.ts';
import type { ResumeClaim, ResumeSave } from './resume.claim.ts';

/** The most attempts a chain has: the third loss queues none. */
const MAX_ATTEMPTS = 3;

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };

const ChainSchema = z.object({ attempt: z.number().int().min(1).max(MAX_ATTEMPTS), chain: z.array(z.string()) });

/** A job's place in its chain: its attempt, and the earlier jobs, oldest first (none for a first attempt). */
export type Chain = z.output<typeof ChainSchema>;

/** The chain of a job someone sent: attempt 1, no earlier job. */
export const FIRST: Chain = Object.freeze({ attempt: 1, chain: [] });

/** Where a job's chain is kept, beside its log. */
const chainPath = (home: string, job: string): string => join(home, 'logs', `job-${job}.chain.json`);

/** Where a resume's note is written, beside its log, never in the worktree. */
export const resumeNotePath = (home: string, job: string): string => join(home, 'logs', `job-${job}.resume.md`);

/** The chain of a claimed job: its resume's, else a first attempt's. */
export const chainOf = (resume: ResumeClaim | null): Chain => (resume === null ? FIRST : { attempt: resume.attempt, chain: [...resume.chain] });

/** Keeps a job's chain beside its log, for its end and for the sweep. */
export function keepChain(home: string, job: string, chain: Chain): void {
  mkdirSync(join(home, 'logs'), { recursive: true });
  writeFileSync(chainPath(home, job), `${JSON.stringify(chain)}\n`);
}

/** The chain kept for `job`, or `null` when none was (a job of an older kit) or it does not read. */
export function readChain(home: string, job: string): Chain | null {
  try {
    const read = ChainSchema.safeParse(JSON.parse(readFileSync(chainPath(home, job), 'utf8')));
    return read.success ? read.data : null;
  } catch {
    return null;
  }
}

/**
 * Whether a lost job's chain carries on (PRD 2809): its line runs a resumable skill and it was not the third attempt, so
 * the app queued its resume, which takes its claims over. Its runner then releases none of them.
 */
export function chainCarriesOn(line: string, chain: Chain): boolean {
  const checked = checkRunnerLine(line);
  return checked.ok && checked.kind === 'omni' && RESUMABLE_SKILLS.includes(checked.skill) && chain.attempt < MAX_ATTEMPTS;
}

/** Whether the app's refusal of a report says its runner lost the job: `This job has ended: failed, runner lost. Stop it.` */
export const lostWords = (words: string): boolean => /\bfailed, runner lost\b/.test(words);

/** How a restored branch stands against origin's. */
export type Standing = 'fast-forward' | 'on origin' | 'diverged' | 'new' | 'detached';

/** A branch restored as its checkpoint: the job and runner that saved it, its name (`null` detached), its ref, what it holds and how it stands. */
export type Restored = { job: string; runner: string; branch: string | null; ref: string; path: string; files: number; commits: number; standing: Standing };

/** A save, or a branch of one, that could not come: whose, on which runner, what it held, and why. */
export type Behind = { job: string; runner: string; branch: string | null; files: number; commits: number; why: string };

export type RestoreOptions = {
  exec: ExecText;
  /** The checkout the resume's worktree was cut from: the refs land there, and every worktree of it sees them. */
  checkout: string;
  /** Where `wt/` and `logs/` live, the kept saves of this runner among them. */
  home: string;
  /** This runner's name: a local save it made is restored from its own disk. */
  runner: string;
  resume: ResumeClaim;
  /** Fetches a portable save's bundle from its signed link: throws when it cannot. */
  download: (url: string) => Promise<Uint8Array>;
};

/** What a restore brought back, what it could not, and the newest handoff note the saves carried. */
export type Restore = { restored: Restored[]; behind: Behind[]; handoff: string | null };

const whyOf = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';

/** Every branch of `manifest` as staying behind, for `why`; a save that failed with no branch, once, naming its failure. */
function allBehind(save: ResumeSave, why: string): Behind[] {
  const { job, runner, branches, failed } = save.manifest;
  if (branches.length === 0) return [{ job, runner, branch: null, files: 0, commits: 0, why: failed ?? why }];
  return branches.map(({ branch, files, commits }) => ({ job, runner, branch, files, commits, why }));
}

/** Whether `ref` resolves to a commit in `checkout`. */
function resolves(exec: ExecText, checkout: string, ref: string): boolean {
  try {
    exec('git', ['-C', checkout, 'rev-parse', '--verify', '-q', `${ref}^{commit}`], QUIET);
    return true;
  } catch {
    return false;
  }
}

/** Whether `older` is an ancestor of `newer` in `checkout`. */
function ancestor(exec: ExecText, checkout: string, older: string, newer: string): boolean {
  try {
    exec('git', ['-C', checkout, 'merge-base', '--is-ancestor', older, newer], QUIET);
    return true;
  } catch {
    return false;
  }
}

/** How the checkpoint `ref` of `branch` stands against origin's `branch`, as the checkout last fetched it. */
export function standingOf(exec: ExecText, checkout: string, branch: string | null, ref: string): Standing {
  if (branch === null) return 'detached';
  const theirs = `refs/remotes/origin/${branch}`;
  if (!resolves(exec, checkout, theirs)) return 'new';
  if (ancestor(exec, checkout, ref, theirs)) return 'on origin';
  return ancestor(exec, checkout, theirs, ref) ? 'fast-forward' : 'diverged';
}

/** Fetches the refs of `manifest` from the bundle at `file` into the checkout, each over the one an earlier save left. */
function fetchBundle(exec: ExecText, checkout: string, file: string, manifest: CheckpointManifest): void {
  const refs = manifest.branches.map(({ ref }) => `+${ref}:${ref}`);
  exec('git', ['-C', checkout, 'fetch', '-q', '--no-tags', '--no-write-fetch-head', file, ...refs], QUIET);
}

/** The bundle of a save, as a file: a portable one downloaded to a scratch folder (`scratch` set to remove), a local one of this runner's own disk. */
async function bundleOf(options: RestoreOptions, save: ResumeSave): Promise<{ file: string; scratch: string | null } | { why: string }> {
  if (save.kind === 'portable') {
    if (save.url === null) return { why: 'the app gave no link to its bundle' };
    let bytes: Uint8Array;
    try {
      bytes = await options.download(save.url);
    } catch (error) {
      return { why: `its bundle could not be downloaded: ${whyOf(error)}` };
    }
    const scratch = mkdtempSync(join(tmpdir(), 'omni-resume-'));
    const file = join(scratch, 'checkpoint.bundle');
    writeFileSync(file, bytes);
    return { file, scratch };
  }
  if (save.manifest.runner !== options.runner) return { why: `its save stayed on ${save.manifest.runner}` };
  const kept = savesIn(options.home).find((local) => local.job === save.job);
  if (kept === undefined || kept.bundle === null || !existsSync(kept.bundle)) return { why: `its save is no longer on ${options.runner}` };
  if (kept.lost !== null) return { why: `its save on ${options.runner} went ${kept.lost.why}` };
  return { file: kept.bundle, scratch: null };
}

/** Restores one save: its branches fetched and read against origin's, or every one of them behind, saying why. */
async function restoreOne(options: RestoreOptions, save: ResumeSave): Promise<{ restored: Restored[]; behind: Behind[] }> {
  if (save.manifest.branches.length === 0) return { restored: [], behind: allBehind(save, 'its save failed') };
  const bundle = await bundleOf(options, save);
  if ('why' in bundle) return { restored: [], behind: allBehind(save, bundle.why) };
  try {
    fetchBundle(options.exec, options.checkout, bundle.file, save.manifest);
  } catch (error) {
    return { restored: [], behind: allBehind(save, `its bundle could not be fetched: ${whyOf(error)}`) };
  } finally {
    if (bundle.scratch !== null) rmSync(bundle.scratch, { recursive: true, force: true });
  }
  const { job, runner } = save.manifest;
  return {
    restored: save.manifest.branches.map(({ branch, ref, path, files, commits }) => ({ job, runner, branch, ref, path, files, commits, standing: standingOf(options.exec, options.checkout, branch, ref) })),
    behind: [],
  };
}

/**
 * Restores the saves of a resume's chain into the checkout, oldest first: each branch as `omni-checkpoint/<branch>`, a
 * branch two saves hold read from the newest. Never throws: what could not come is said, with why.
 */
export async function restoreSaves(options: RestoreOptions): Promise<Restore> {
  const byRef = new Map<string, Restored>();
  const behind: Behind[] = [];
  let handoff: string | null = null;
  for (const save of options.resume.saves) {
    const one = await restoreOne(options, save);
    for (const branch of one.restored) {
      byRef.delete(branch.ref);
      byRef.set(branch.ref, branch);
    }
    behind.push(...one.behind);
    handoff = save.manifest.handoff ?? handoff;
  }
  // A branch a later save brought back is no longer behind.
  const back = new Set([...byRef.values()].map(({ branch }) => branch));
  return { restored: [...byRef.values()], behind: behind.filter(({ branch }) => branch === null || !back.has(branch)), handoff };
}

const count = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;

/** `ref` as a person types it: `omni-checkpoint/<branch>`. */
const shortRef = (ref: string): string => ref.replace(/^refs\/heads\//, '');

/** What a saved branch holds, read by a person: `3 files, 1 commit`. */
const held = ({ files, commits }: { files: number; commits: number }): string => `${count(files, 'file', 'files')}, ${count(commits, 'commit', 'commits')}`;

const STANDING: Readonly<Record<Standing, (branch: string) => string>> = {
  'fast-forward': (branch) => `fast-forwards from origin's \`${branch}\``,
  'on origin': (branch) => `origin's \`${branch}\` already holds it: nothing to take`,
  diverged: (branch) => `diverged from origin's \`${branch}\`: merge it`,
  new: () => 'origin has no such branch: check it out from the checkpoint',
  detached: () => 'was detached: check it out from the checkpoint',
};

/** One line of the note per restored branch. */
function restoredLine(restored: Restored): string {
  const name = restored.branch === null ? `\`${restored.path}\` (detached)` : `\`${restored.branch}\``;
  return `- ${name} as \`${shortRef(restored.ref)}\` (job ${restored.job} on ${restored.runner}): ${held(restored)}; ${STANDING[restored.standing](restored.branch ?? '')}.`;
}

/** One line of the note per branch, or save, that could not come. */
function behindLine(left: Behind): string {
  if (left.branch === null && left.files === 0 && left.commits === 0) return `- The save of job ${left.job} on ${left.runner}: ${left.why}.`;
  const what = left.branch === null ? 'a detached worktree' : left.branch;
  return `- ${count(left.files, 'file', 'files')} and ${count(left.commits, 'commit', 'commits')} on ${what} stayed on ${left.runner} (job ${left.job}): ${left.why}.`;
}

/** The resume's note, as `~/logs/job-<id>.resume.md` holds it. */
export function resumeNote(job: string, resume: ResumeClaim, { restored, behind, handoff }: Restore): string {
  const earlier = resume.chain.map((id) => `\`${id}\``).join(', ');
  const lost = resume.chain.at(-1) ?? '';
  const lines = [
    `# Job ${job}: attempt ${String(resume.attempt)} of ${String(MAX_ATTEMPTS)}`,
    '',
    `This job resumes job \`${lost}\`, which its runner lost. Its chain's earlier jobs: ${earlier}. Start from what GitHub holds and the saves below.`,
    '',
    '## The saved branches',
    '',
    ...(restored.length === 0 ? ['Nothing was saved: start over from what GitHub holds.'] : restored.map(restoredLine)),
    '',
  ];
  if (restored.length > 0) {
    lines.push(
      '## The rule',
      '',
      'After you check out a branch listed above, and before anything else, take its checkpoint:',
      '',
      '    git merge --ff-only omni-checkpoint/<branch>',
      '',
      'When it diverged from origin\'s, `git merge omni-checkpoint/<branch>` instead, and resolve. A branch origin has not got is',
      'checked out from its checkpoint (`git switch -c <branch> omni-checkpoint/<branch>`). Push it once taken.',
      '',
    );
  }
  if (behind.length > 0) lines.push('## What stayed behind', '', ...behind.map(behindLine), '');
  lines.push(
    '## The claims',
    '',
    `A claim whose status comment names job ${earlier} is this chain's: take it over as this job's (its \`job:\` line rewritten to \`${job}\`) and build on it. No other job takes it.`,
    '',
  );
  if (handoff !== null) lines.push('## The handoff note', '', handoff, '');
  return `${lines.join('\n').trimEnd()}\n`;
}

/** The lines the session's prompt gets after the job's line: where the note is, and that it comes first. */
export const resumePointer = (resume: ResumeClaim, path: string): string =>
  `This job is attempt ${String(resume.attempt)} of ${String(MAX_ATTEMPTS)}: it resumes job ${resume.chain.at(-1) ?? ''}, which its runner lost. Before anything else, read ${path} and follow it.`;

/** The line the runner prints once a resume's saves are restored. */
export function resumedLine(job: string, resume: ResumeClaim, { restored, behind }: Restore): string {
  const back = restored.length === 0 ? 'nothing saved came back' : `${count(restored.length, 'branch', 'branches')} came back`;
  return `job ${job}: attempt ${String(resume.attempt)} of ${String(MAX_ATTEMPTS)}, ${back}${behind.length === 0 ? '' : ` · ${String(behind.length)} stayed behind`}`;
}
