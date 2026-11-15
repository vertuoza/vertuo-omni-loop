// The token of a job that runs as a GitHub App (PRD 2433, s2): where the runner keeps it on the machine,
// what `omni runner github-token` prints of it and to whom, and how everything the runner sends hides it.
//
// A job's token lives in `~/logs/job-<id>.github`, beside its log, readable by its owner alone, with the
// runner it belongs to and every token the job had (the current one last): a token the job had once is
// still a secret, so it stays known to the runner that masks the log (L-GDPR-2). The runner writes the
// file before the job's session starts and removes it when the job ends; the sweep takes one a crash left.
//
// `omni runner github-token` answers from that file, inside a job of the runner that wrote it: the
// credential helper, the `gh` on the job's `PATH` and `githubEnv` all read the token through it.
//
// The job's own `gh` sign-in (bug 2914) is kept beside it, in `~/logs/job-<id>.gh/`, the job's `GH_CONFIG_DIR`:
// every token the file gets is written there too, so any `gh` the job runs, the machine's own found first on a
// `PATH` a login shell reordered included, signs in as the app and never as the machine's login. It goes with
// the file.
//
// The runner and the session both refresh the token (s3, `github-refresh.ts`), so the file is written by
// more than one process: every write after the session starts holds the file's lock (`github-refresh.ts`),
// or a token one of them wrote could be lost from the file and stop being masked (L-GDPR-2). The file also
// keeps what a refresh needs to be shared: the Omni page to ask, and when a failed refresh may be tried
// again.
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import type { RunnerJobEnv } from '../env/read.ts';

/** What every token reads as in a line the runner sends. */
const MASK = '***';

/** A job id as the runner names its files: letters, digits, dashes and underscores (the sweep's). */
const JOB_ID = /^[A-Za-z0-9_-]+$/;

/** The shortest start of a token masked at the end of a text: `ghs_` starts every one, so a few characters are no token. */
const MIN_START = 6;

const StoredTokenSchema = z.object({ token: z.string().min(1), expiresAt: z.string() });
const RetrySchema = z.object({ at: z.number(), why: z.string() });
const TokenFileSchema = z.object({
  runner: z.string().min(1),
  tokens: z.array(StoredTokenSchema).min(1),
  page: z.string().min(1).optional(),
  retry: RetrySchema.optional(),
});

/** One token and when it expires. */
export type GithubToken = z.output<typeof StoredTokenSchema>;
/** When a refresh that failed may be tried again (epoch milliseconds), and why it failed. */
export type RefreshRetry = z.output<typeof RetrySchema>;
/**
 * What a job's token file holds: its runner, and every token the job had, the current one last. `page` is the
 * Omni page the session asks for a fresh token, and `retry` the failed refresh that waits for its minute.
 */
export type StoredGithubTokens = z.output<typeof TokenFileSchema>;

/** The file a job's tokens are kept in, `<home>/logs/job-<id>.github`, or `null` for an id no file is named after. */
export function githubTokenFile(home: string, job: string): string | null {
  return JOB_ID.test(job) ? join(home, 'logs', `job-${job}.github`) : null;
}

/** The tokens `file` holds, or `null` when it is missing or is not a token file. */
export function readGithubToken(file: string): StoredGithubTokens | null {
  try {
    const read = TokenFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return read.success ? read.data : null;
  } catch {
    return null;
  }
}

/**
 * The folder the job's own `gh` sign-in is kept in, `job-<id>.gh` beside its token `file`: the job's
 * `GH_CONFIG_DIR` (bug 2914).
 */
export function githubCliDir(file: string): string {
  return join(dirname(file), `${basename(file, '.github')}.gh`);
}

/** gh's `config.yml`: already in the shape gh writes (`version: "1"`), so gh never migrates the sign-in nor moves its token to a keychain. */
const GH_CONFIG = 'version: "1"\ngit_protocol: https\n';

/** Replaces `file` whole with `text` through `next`, readable by its owner alone, so a reader never sees half of it. */
function replaceWhole(file: string, next: string, text: string): void {
  writeFileSync(next, text, { mode: 0o600 });
  chmodSync(next, 0o600);
  renameSync(next, file);
}

/** Replaces `file` whole with `content`, readable by its owner alone, so a reader never sees half of it. */
function writeTokenFile(file: string, content: StoredGithubTokens): void {
  mkdirSync(dirname(file), { recursive: true });
  // Named like the file's own kind (`job-<id>.<ext>`), so the sweep takes it too if a crash leaves it.
  replaceWhole(file, `${file}tmp`, JSON.stringify(content));
}

/**
 * Signs the job's own `gh` in to github.com with `token`, in `dir`, which only its owner reads. gh reads that
 * token first: it never falls back to the machine's own sign-in, which an empty folder would let it do (its
 * keychain). The config goes first, so gh never finds a sign-in it would migrate.
 */
function writeGhSignIn(dir: string, token: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  replaceWhole(join(dir, 'config.yml'), join(dir, 'config.yml.tmp'), GH_CONFIG);
  replaceWhole(join(dir, 'hosts.yml'), join(dir, 'hosts.yml.tmp'), `github.com:\n    oauth_token: ${JSON.stringify(token)}\n    git_protocol: https\n`);
}

/**
 * Adds `grant` to the tokens of `file`, which only `runner` reads, keeping the ones it already held: a file
 * of another runner starts again. A fresh token ends the wait of a failed refresh. `page`, the Omni page a
 * session asks for a fresh token, is kept as the file held it unless given. It reads then writes: once a
 * session runs, only a holder of the file's lock calls it (`github-refresh.ts`).
 */
export function saveGithubToken(file: string, runner: string, grant: GithubToken, page?: string): void {
  const held = readGithubToken(file);
  const same = held !== null && held.runner === runner;
  const past = same ? held.tokens.filter((entry) => entry.token !== grant.token) : [];
  const asked = page ?? (same ? held.page : undefined);
  writeTokenFile(file, { runner, tokens: [...past, { token: grant.token, expiresAt: grant.expiresAt }], ...(asked === undefined ? {} : { page: asked }) });
  // After the file: the token is known to the masking before any gh can use it.
  writeGhSignIn(githubCliDir(file), grant.token);
}

/**
 * Notes that a refresh failed, `retry.at` being when it may be tried again: every process that looks at the
 * file waits for it. Nothing changes in a file that is missing or another runner's. Called under the file's lock.
 */
export function noteFailedRefresh(file: string, runner: string, retry: RefreshRetry): void {
  const held = readGithubToken(file);
  if (held !== null && held.runner === runner) writeTokenFile(file, { ...held, retry });
}

/**
 * Removes `file` and the job's `gh` sign-in, when they are there. It never throws: what it cannot remove is left
 * to the sweep, and a job's end goes on.
 */
export function forgetGithubToken(file: string): void {
  try {
    rmSync(githubCliDir(file), { recursive: true, force: true });
  } catch {
    // Nothing there to remove, or nothing it may remove.
  }
  try {
    rmSync(file, { force: true });
  } catch {
    // Nothing there to remove (a folder in the way), or nothing it may remove.
  }
}

/** The token file of the job a session runs, whose runner it is, and what it holds. */
export type OwnJobToken = { file: string; runner: string; job: string; held: StoredGithubTokens; current: GithubToken };

/**
 * The token file of the job a session runs: only inside a runner job whose file holds a token of its own
 * runner. Never another runner's, and never one for an id that names no file. Else the one line saying why.
 */
export function ownJobToken(job: RunnerJobEnv | null, home: string): OwnJobToken | { refusal: string } {
  if (job === null) return { refusal: 'this session is not a runner job.' };
  if (job.runner === null) return { refusal: 'this runner job names no runner.' };
  const file = githubTokenFile(home, job.job);
  const held = file === null ? null : readGithubToken(file);
  const current = held?.tokens.at(-1);
  if (file === null || held === null || current === undefined) return { refusal: `job ${job.job} does not run as a GitHub App.` };
  if (held.runner !== job.runner) return { refusal: `the token of job ${job.job} is another runner's.` };
  return { file, runner: job.runner, job: job.job, held, current };
}

/** The job's current token, or the one line saying why there is none. */
export type JobGithubToken = GithubToken | { refusal: string };

/**
 * The current token of the job a session runs: the token only inside a runner job whose file holds a token
 * of its own runner (`ownJobToken`), as it stands in the file: it is not refreshed here.
 */
export function jobGithubToken(job: RunnerJobEnv | null, home: string): JobGithubToken {
  const own = ownJobToken(job, home);
  return 'refusal' in own ? own : own.current;
}

/** How many characters at the end of `text` start one of `tokens`, none shorter than `MIN_START`: 0 for none. */
function startedAtEnd(text: string, tokens: readonly string[]): number {
  let longest = 0;
  for (const token of tokens) {
    for (let length = token.length - 1; length >= Math.max(MIN_START, longest + 1); length -= 1) {
      if (text.endsWith(token.slice(0, length))) {
        longest = length;
        break;
      }
    }
  }
  return longest;
}

/**
 * `text` with every token of `tokens` replaced by `***`, the longer first, and the start of one the text ends
 * on too (a log still being written may stop in the middle of a token). The lines stay the lines: a token
 * never holds a newline.
 */
export function maskTokens(text: string, tokens: readonly string[]): string {
  const known = [...new Set(tokens)].filter((token) => token !== '').sort((a, b) => b.length - a.length);
  if (known.length === 0) return text;
  const masked = known.reduce((out, token) => out.split(token).join(MASK), text);
  const started = startedAtEnd(masked, known);
  return started === 0 ? masked : `${masked.slice(0, masked.length - started)}${MASK}`;
}

/** Every token job `job` had, past ones too: none for a job that does not run as an app. */
export function jobTokens(home: string, job: string): string[] {
  const file = githubTokenFile(home, job);
  const held = file === null ? null : readGithubToken(file);
  return held === null ? [] : held.tokens.map((entry) => entry.token);
}

/** `text` with every token job `job` had, past ones too, replaced by `***`; as it is for a job with none. */
export function maskJobTokens(home: string, job: string, text: string): string {
  return maskTokens(text, jobTokens(home, job));
}
