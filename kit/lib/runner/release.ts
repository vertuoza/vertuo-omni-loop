// The runner's watcher releases a dead job's claims (PRD 2175, "The watcher releases a dead job's
// claims"). When a job ends, done, failed, timed out or cancelled, or once the sweep finds a job the
// server marked lost, the runner releases every claim the job still holds, with `gh`, which the box is
// signed in to for its jobs:
//
// 1. it lists the repository's open pull requests that carry `labels.inProgress`, draft or ready (a
//    sub-PR marked ready still waits on the job to merge it, #2366), and keeps those whose status
//    comment (the `<markers.prefix>-status` marker) has the line `job: <this id>`, which `/omni:pr`'s
//    Claim mode writes when `OMNI_JOB` is set;
// 2. it swaps the label on each: `labels.inProgress` off, `labels.released` on. A released label the
//    repository lacks still lets `labels.inProgress` come off, and says so;
// 3. it posts one comment on each, naming the job, its runner and why it ended.
//
// A claim naming another job, or none, is never touched. Whatever fails is said in `releaseError`, at
// most 200 characters, beside the numbers released, at most 50: the job's final report carries both,
// as the app stores them. A `gh` that cannot list releases nothing.
//
// A job that ran as a GitHub App (PRD 2433, s3) is released as that app: every `gh` call runs with the job's
// token as `GH_TOKEN`, so the label and the comment are the app's bot's, never the machine's account. The
// caller names the token (`EndedJob.ghToken`); a job that had one and has none now is not released here.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { CONFIG_FILE, loadConfig, releasedLabel } from '../config.ts';
import type { ExecText } from '../context.ts';
import { makeMarkers } from '../markers.ts';

/** `gh` with these arguments: its standard output, or a throw when it fails. */
export type Gh = (args: readonly string[]) => string;

/** Where a job's claims live, and how they are known: the repository, its two labels and its status marker. */
export type ClaimsRepo = { slug: string; inProgress: string; released: string; statusMarker: string };

/** The job that ended: its id and the runner it ran on. */
export type ReleasedJob = { id: string; runner: string };

/** What a release did: the pull requests released, and what failed, or `null`. */
export type Released = { released: number[]; releaseError: string | null };

/** The most numbers a report carries, and the longest error: what the app stores (`JobUpdateSchema`). */
export const MAX_RELEASED = 50;
export const MAX_RELEASE_ERROR = 200;

/** A pull request as `gh pr list --json number,labels` gives it. */
const ListedSchema = z.array(z.object({
  number: z.number().int().positive(),
  labels: z.array(z.object({ name: z.string() })),
}));

/** One page of a pull request's comment bodies, as `--jq '[.[].body]'` prints it. */
const BodiesSchema = z.array(z.string());

/** The comment a released claim gets. */
export function alarmText(job: ReleasedJob, reason: string): string {
  return `Released: runner job \`${job.id}\` on \`${job.runner}\` ended (\`${reason}\`) while it held this claim. The next run reuses it if the plan and its territory still match, or closes it and rebuilds the slice.`;
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `body` has the line `job: <job>`, as `/omni:pr` writes it (`- job: <id> · runner <name>`). */
export function namesJob(body: string, job: string): boolean {
  return new RegExp(`^\\s*(?:[-*]\\s+)?job:\\s+\`?${escape(job)}\`?(?:\\s|$)`, 'm').test(body);
}

/** Why `gh` failed, in one line: the first line of its standard error, else of its message. */
function why(error: unknown): string {
  const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr) : '';
  const text = stderr.trim() === '' ? (error instanceof Error ? error.message : String(error)) : stderr;
  return text.trim().split('\n')[0]?.trim() ?? '';
}

/** A string cut to `max` characters, its last one an ellipsis when cut. */
const cut = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** What a release that could not run came to: nothing released, and `why`, cut to what the app stores. */
export function notReleased(why: string): Released {
  return { released: [], releaseError: cut(why, MAX_RELEASE_ERROR) };
}

/** The open pull requests, draft or ready, that carry `labels.inProgress`: their numbers. Throws what `gh` throws, or an unreadable answer. */
function candidates(repo: ClaimsRepo, gh: Gh): number[] {
  const out = gh(['pr', 'list', '--repo', repo.slug, '--state', 'open', '--label', repo.inProgress, '--limit', '100', '--json', 'number,labels']);
  let listed;
  try {
    listed = ListedSchema.parse(JSON.parse(out));
  } catch {
    throw new Error('gh pr list answered something unreadable');
  }
  return listed.filter((pr) => pr.labels.some((label) => label.name === repo.inProgress)).map((pr) => pr.number);
}

/** Whether the status comment of `number` names `job`: every page of its comments read. */
function heldBy(repo: ClaimsRepo, number: number, job: string, gh: Gh): boolean {
  const out = gh(['api', `repos/${repo.slug}/issues/${String(number)}/comments`, '--paginate', '--jq', '[.[].body]']);
  const bodies = out.split('\n').filter((line) => line.trim() !== '').flatMap((line) => BodiesSchema.parse(JSON.parse(line)));
  return bodies.some((body) => body.includes(repo.statusMarker) && namesJob(body, job));
}

/** Swaps the labels of `number`: whether `labels.inProgress` came off, and what went wrong. */
function swap(repo: ClaimsRepo, number: number, gh: Gh): { off: boolean; problem: string | null } {
  const edit = ['pr', 'edit', String(number), '--repo', repo.slug, '--remove-label', repo.inProgress];
  try {
    gh([...edit, '--add-label', repo.released]);
    return { off: true, problem: null };
  } catch (error) {
    const added = why(error);
    try {
      gh(edit);
      return { off: true, problem: `${repo.released} could not be added (${added})` };
    } catch (again) {
      return { off: false, problem: why(again) };
    }
  }
}

/**
 * Releases the claims `job` still holds in `repo`, `reason` being why it ended: swaps their label,
 * posts the alarm on each, and answers the numbers released and what failed.
 */
export function release(job: ReleasedJob, repo: ClaimsRepo, reason: string, gh: Gh): Released {
  let numbers: number[];
  try {
    numbers = candidates(repo, gh);
  } catch (error) {
    return { released: [], releaseError: cut(why(error), MAX_RELEASE_ERROR) };
  }
  const released: number[] = [];
  const problems: string[] = [];
  for (const number of numbers) {
    try {
      if (!heldBy(repo, number, job.id, gh)) continue;
    } catch (error) {
      problems.push(`#${String(number)}: ${why(error)}`);
      continue;
    }
    const swapped = swap(repo, number, gh);
    if (swapped.problem !== null) problems.push(`#${String(number)}: ${swapped.problem}`);
    if (!swapped.off) continue;
    released.push(number);
    try {
      gh(['pr', 'comment', String(number), '--repo', repo.slug, '--body', alarmText(job, reason)]);
    } catch (error) {
      problems.push(`#${String(number)}: the alarm could not be posted (${why(error)})`);
    }
  }
  return { released: released.slice(0, MAX_RELEASED), releaseError: problems.length === 0 ? null : cut(problems.join('; '), MAX_RELEASE_ERROR) };
}

/**
 * A job that ended, as the runner releases it: its id, its runner, its repository and why it ended. `ghToken`
 * is the token of the GitHub App the job ran as (PRD 2433): the `gh` calls run with it. `null`, or none, is
 * the machine's own `gh`, as a job with no app always had.
 */
export type EndedJob = ReleasedJob & { repo: string; reason: string; ghToken?: string | null };

/** Releases an ended job's claims. */
export type Releaser = (ended: EndedJob) => Released;

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };

const NOTHING: Released = { released: [], releaseError: null };

/**
 * The runner's releaser: reads the labels and the status marker from the config of the checkout the
 * job ran in, then releases with `gh`. A repository it does not hold, or one with no config, has no
 * claim to release; a config it cannot read is said.
 */
export function releaser({ exec, checkouts, env = {} }: { exec: ExecText; checkouts: ReadonlyMap<string, string>; env?: Readonly<Record<string, string | undefined>> }): Releaser {
  return (ended) => {
    // A job's token is `GH_TOKEN`, which `gh` reads before any login of the machine, on top of the runner's own environment.
    const token = ended.ghToken ?? null;
    const options: ExecFileSyncOptionsWithStringEncoding = token === null ? QUIET : { ...QUIET, env: { ...env, GH_TOKEN: token } };
    const gh: Gh = (args) => exec('gh', args, options);
    const checkout = checkouts.get(ended.repo);
    if (checkout === undefined || !existsSync(join(checkout, CONFIG_FILE))) return { ...NOTHING };
    let repo: ClaimsRepo;
    try {
      const { labels, markers } = loadConfig(checkout);
      repo = { slug: ended.repo, inProgress: labels.inProgress, released: releasedLabel(labels), statusMarker: makeMarkers(markers.prefix).status };
    } catch {
      return { released: [], releaseError: `the config of ${ended.repo} could not be read` };
    }
    return release(ended, repo, ended.reason, gh);
  };
}
