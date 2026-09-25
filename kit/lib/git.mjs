// The one place `git diff --name-status` is shelled out from for a review range. Kept separate
// from any outbox module so a repository-agnostic caller (this task's own
// `kit/lib/outbox/check-decision-coverage.mjs`, and later `kit/lib/outbox/comment.mjs`) never
// shells out to git a second way.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-decision-coverage.mjs — changes in kit/porting/outbox--check-decision-coverage.md.
import { execFileSync } from 'node:child_process';

function git(args, cwd, exec) {
  return exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Parses `git diff --name-status` output into `{ path, status }[]`, one entry per line — the one
 * implementation; the coverage and comment modules re-export it. A rename
 * arrives as a delete and an add because the caller passes `--no-renames` (since git 2.9 rename
 * detection is on by default, and an `R` would let a moved test file escape the `test-removed` rule). */
export function parseNameStatus(nameStatus) {
  return nameStatus
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t');
      return { status: status[0], path: paths.at(-1) };
    });
}

/**
 * The range's own changes, in `ctx.root` — `{ path, status }[]`. Uses the three-dot form
 * (`base...HEAD`), so a merge of the base branch into the range being graded never widens what
 * counts as the range's own changes. Throws when `base` cannot be read — a guard that silently
 * graded nothing would look identical to a range with nothing risky in it.
 *
 * @param {{ ctx: { root: string }, base: string, exec?: Function }} options
 * @returns {{ path: string, status: string }[]}
 */
export function rangeChanges({ ctx, base, exec = execFileSync }) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], ctx.root, exec);
  } catch (error) {
    throw new Error(
      `Cannot read ${base} — this guard cannot tell what this range changed. ` +
        `Fetch the base first (e.g. \`git fetch origin main\`).\n${error.message}`,
    );
  }
  return parseNameStatus(git(['diff', '--name-status', '--no-renames', `${base}...HEAD`], ctx.root, exec));
}
