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
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { RunnerJobEnv } from '../env/read.ts';

/** What every token reads as in a line the runner sends. */
const MASK = '***';

/** A job id as the runner names its files: letters, digits, dashes and underscores (the sweep's). */
const JOB_ID = /^[A-Za-z0-9_-]+$/;

/** The shortest start of a token masked at the end of a text: `ghs_` starts every one, so a few characters are no token. */
const MIN_START = 6;

const StoredTokenSchema = z.object({ token: z.string().min(1), expiresAt: z.string() });
const TokenFileSchema = z.object({ runner: z.string().min(1), tokens: z.array(StoredTokenSchema).min(1) });

/** One token and when it expires. */
export type GithubToken = z.output<typeof StoredTokenSchema>;
/** What a job's token file holds: its runner, and every token the job had, the current one last. */
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
 * Adds `grant` to the tokens of `file`, which only `runner` reads, keeping the ones it already held: a file
 * of another runner starts again. The file is replaced whole, so a reader never sees half of it.
 */
export function saveGithubToken(file: string, runner: string, grant: GithubToken): void {
  const held = readGithubToken(file);
  const past = held !== null && held.runner === runner ? held.tokens.filter((entry) => entry.token !== grant.token) : [];
  const text = JSON.stringify({ runner, tokens: [...past, { token: grant.token, expiresAt: grant.expiresAt }] });
  mkdirSync(dirname(file), { recursive: true });
  // Named like the file's own kind (`job-<id>.<ext>`), so the sweep takes it too if a crash leaves it.
  const next = `${file}tmp`;
  writeFileSync(next, text, { mode: 0o600 });
  chmodSync(next, 0o600);
  renameSync(next, file);
}

/** Removes `file`, when it is there. It never throws: a file it cannot remove is left to the sweep, and a job's end goes on. */
export function forgetGithubToken(file: string): void {
  try {
    rmSync(file, { force: true });
  } catch {
    // Nothing there to remove (a folder in the way), or nothing it may remove.
  }
}

/** The job's current token, or the one line saying why there is none. */
export type JobGithubToken = GithubToken | { refusal: string };

/**
 * The current token of the job a session runs: the token only inside a runner job whose file holds a token
 * of its own runner. Never another runner's, and never one for an id that names no file.
 */
export function jobGithubToken(job: RunnerJobEnv | null, home: string): JobGithubToken {
  if (job === null) return { refusal: 'this session is not a runner job.' };
  if (job.runner === null) return { refusal: 'this runner job names no runner.' };
  const file = githubTokenFile(home, job.job);
  const held = file === null ? null : readGithubToken(file);
  const current = held?.tokens.at(-1);
  if (held === null || current === undefined) return { refusal: `job ${job.job} does not run as a GitHub App.` };
  if (held.runner !== job.runner) return { refusal: `the token of job ${job.job} is another runner's.` };
  return current;
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
