// Keeping a job's GitHub App token current (PRD 2433, s3). A token the app mints lasts an hour. With less than
// 5 minutes left, whoever needs it asks the Omni app for a fresh one: `omni runner github-token`, in the job's
// session, on every call; the runner, on every look at the running job and before it releases the job's claims.
// A refresh that fails is tried again a minute later, and the token the job still holds is used meanwhile. When
// it expires with no fresh one, the job has no token: the runner ends it `failed`, `github app: <why>`, and no
// machine account takes over (L-GDPR-2, never a person).
//
// Those callers are separate processes writing one file, `~/logs/job-<id>.github` (`github-token.ts`). A
// refresh therefore takes the file's lock, reads the file again under it, and asks only when the token is
// still due: callers at the same moment mint one token between them, and no past token is lost from the file,
// which would stop it being masked in what the runner sends. The minute a failed refresh waits is kept in the
// file too, so the session and the runner wait for the same one.
import { closeSync, openSync, rmSync, statSync } from 'node:fs';
import { maskTokens, noteFailedRefresh, readGithubToken, saveGithubToken } from './github-token.ts';
import type { GithubToken } from './github-token.ts';

/** How much life a token must have left not to be refreshed: with less than this, a fresh one is asked for. */
export const REFRESH_BEFORE_MS = 5 * 60 * 1000;
/** How long a failed refresh waits before it is tried again. */
export const RETRY_MS = 60 * 1000;
/** How long a refresh waits for the lock another holds, before it goes on with the token it has. */
const LOCK_WAIT_MS = 20_000;
/** How old a lock is when its holder is taken to be gone: more than the app's slowest answer (two 10 s calls and a sign-in renewal). */
const LOCK_STALE_MS = 60_000;
/** How long a refresh waits between two looks at a lock. */
const LOCK_POLL_MS = 100;
/** The longest reason a refresh keeps. */
const MAX_WHY = 200;

/** What a refresh needs of the world: the app, the clock and how to wait. A test hands it fakes. */
export type RefreshOptions = {
  /** The job's token file (`githubTokenFile`) and the runner whose tokens it holds. */
  file: string;
  runner: string;
  /** The job's id, as the app knows it. */
  job: string;
  /** Asks the app for a fresh token of `job`: throws with the app's own words when it cannot. */
  fetchToken: (job: string) => Promise<GithubToken>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

/**
 * What a job holds once its token was kept current: the token to use, and why a refresh failed when it did
 * (the token is then still valid: it has not expired); or no token, and why: it expired, or there is none.
 */
export type Kept = { token: GithubToken; failed: string | null } | { token: null; failed: string };

/** Whether `current` is within the last 5 minutes of its life, or past it. */
function due(current: GithubToken, at: number): { expired: boolean; soon: boolean } {
  const left = Date.parse(current.expiresAt) - at;
  // A date that does not read is no life left.
  return { expired: !(left > 0), soon: !(left >= REFRESH_BEFORE_MS) };
}

/** What stands when no fresh token came, `at` being the time it is: the token while it lives, else no token and why the job has none. */
function standing(current: GithubToken, at: number, why: string): Kept {
  return due(current, at).expired ? { token: null, failed: `its token expired and no fresh one came (${why})` } : { token: current, failed: why };
}

type Look = { done: Kept } | { current: GithubToken };

/** Reads the file: what it holds when no refresh is due, or the token that is due for one. */
function look(file: string, runner: string, at: number): Look {
  const held = readGithubToken(file);
  if (held === null) return { done: { token: null, failed: 'the job has no token kept on this machine' } };
  if (held.runner !== runner) return { done: { token: null, failed: "the token of the job is another runner's" } };
  const current = held.tokens.at(-1);
  if (current === undefined) return { done: { token: null, failed: 'the job has no token kept on this machine' } };
  if (!due(current, at).soon) return { done: { token: current, failed: null } };
  if (held.retry !== undefined && held.retry.at > at) return { done: standing(current, at, held.retry.why) };
  return { current };
}

/** Whether the lock at `path` is a dead process's: older than `LOCK_STALE_MS`, or gone. */
function isStale(path: string): boolean {
  try {
    return Date.now() - statSync(path).mtimeMs > LOCK_STALE_MS;
  } catch {
    return true;
  }
}

/** Whether `error` is the one `openSync(…, 'wx')` throws when the file is there. */
const exists = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'EEXIST';

/**
 * Takes the lock of `file`, `<file>lock` (named like the file's own kind, so the sweep takes one a crash leaves),
 * waiting for the holder up to `LOCK_WAIT_MS`: the way to give it back, or `null` when it could not be taken. The
 * lock of a process that died is taken after `LOCK_STALE_MS`; two processes taking it at that very moment may
 * both run, once, which a refresh that checks the file under the lock survives.
 */
async function lock(file: string, { now, sleep }: Pick<RefreshOptions, 'now' | 'sleep'>): Promise<(() => void) | null> {
  const path = `${file}lock`;
  const deadline = now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      closeSync(openSync(path, 'wx', 0o600));
      return () => {
        rmSync(path, { force: true });
      };
    } catch (error) {
      if (!exists(error)) return null;
    }
    if (isStale(path)) {
      try {
        rmSync(path, { force: true });
      } catch {
        return null;
      }
      continue;
    }
    if (now() >= deadline) return null;
    await sleep(LOCK_POLL_MS);
  }
}

/** The one line a failure reads as: its first line, cut, and no token in it. */
function reasonOf(error: unknown, tokens: readonly string[]): string {
  const text = error instanceof Error ? error.message : String(error);
  const line = maskTokens(text.split('\n')[0]?.trim() ?? '', tokens);
  const why = line === '' ? 'the app did not say why' : line;
  return why.length <= MAX_WHY ? why : `${why.slice(0, MAX_WHY - 1)}…`;
}

/**
 * The job's token, current: the file's own while it has 5 minutes left, else a fresh one the app gives, kept in
 * the file with every token it held. A refresh that fails is noted in the file and tried again a minute later:
 * until then the token the file holds is the answer, while it lives. Never throws: whatever goes wrong is `failed`.
 */
export async function keepGithubToken(options: RefreshOptions): Promise<Kept> {
  const { file, runner, job, fetchToken, now, sleep } = options;
  const first = look(file, runner, now());
  if ('done' in first) return first.done;
  const release = await lock(file, { now, sleep });
  if (release === null) return standing(first.current, now(), 'another refresh of the job’s token is taking too long');
  try {
    // Another process may have refreshed while this one waited.
    const again = look(file, runner, now());
    if ('done' in again) return again.done;
    const known = (readGithubToken(file)?.tokens ?? []).map((entry) => entry.token);
    let fresh: GithubToken;
    try {
      fresh = await fetchToken(job);
    } catch (error) {
      const why = reasonOf(error, known);
      try {
        noteFailedRefresh(file, runner, { at: now() + RETRY_MS, why });
      } catch {
        // A note that cannot be kept only means the next look tries again at once.
      }
      return standing(again.current, now(), why);
    }
    try {
      saveGithubToken(file, runner, fresh);
    } catch {
      // The detail names a folder of this machine: it stays here.
      return standing(again.current, now(), 'the fresh token could not be kept on this machine');
    }
    return { token: fresh, failed: null };
  } finally {
    try {
      release();
    } catch {
      // A lock that cannot be removed goes stale.
    }
  }
}
