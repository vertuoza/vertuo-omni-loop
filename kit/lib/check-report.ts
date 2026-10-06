// A guard's plumbing, shared by every `check-*.mjs` module: which files the repository tracks,
// a file's own text, and the two ways a guard's result becomes printable text. Every function here
// is pure or returns text — `kit/bin` is the only place that prints and sets the exit code.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-utils.mjs — changes in kit/porting/check-report.md.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** How much `git ls-files` may print: far above any real repository, yet a runaway git still stops. */
const LIST_MAX_BYTES = 256 * 1024 * 1024;

/**
 * Every file `git` tracks in `ctx.root` — or only under the folder `dir`, relative to it — sorted.
 * `-z` hands back every path exactly as git stores it, unquoted.
 */
export function trackedFiles(ctx: { root: string }, dir?: string): string[] {
  const args = ['ls-files', '-z'];
  if (dir) args.push('--', `${dir.replace(/\/+$/, '')}/`);
  return execFileSync('git', args, { cwd: ctx.root, encoding: 'utf8', maxBuffer: LIST_MAX_BYTES })
    .split('\0')
    .filter(Boolean)
    .sort();
}

/** `path`'s text, relative to `ctx.root`. */
export function readRepoFile(ctx: { root: string }, path: string): string {
  return readFileSync(join(ctx.root, path), 'utf8');
}

/** The text for a failed guard: `title` then every violation, indented — or `''` when there is none. */
export function formatFailure(title: string, violations: readonly string[]): string {
  if (violations.length === 0) return '';
  return [title, ...violations.map((line) => `  ${line}`)].join('\n');
}

/** The text for a guard that has nothing to fail on. */
export function formatPass(message: string): string {
  return message;
}
