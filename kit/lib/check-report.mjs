// A guard's plumbing, shared by every `check-*.mjs` module: which files the repository tracks,
// a file's own text, and the two ways a guard's result becomes printable text. Every function here
// is pure or returns text — `kit/bin` is the only place that prints and sets the exit code.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-utils.mjs — changes in kit/porting/check-report.md.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Every file `git` tracks in `ctx.root`, sorted. */
export function trackedFiles(ctx) {
  return execFileSync('git', ['ls-files'], { cwd: ctx.root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .sort();
}

/** `path`'s text, relative to `ctx.root`. */
export function readRepoFile(ctx, path) {
  return readFileSync(join(ctx.root, path), 'utf8');
}

/** The text for a failed guard: `title` then every violation, indented — or `''` when there is none. */
export function formatFailure(title, violations) {
  if (violations.length === 0) return '';
  return [title, ...violations.map((line) => `  ${line}`)].join('\n');
}

/** The text for a guard that has nothing to fail on. */
export function formatPass(message) {
  return message;
}
