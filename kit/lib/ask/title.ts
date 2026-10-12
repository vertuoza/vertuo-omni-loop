// The title a terminal's ask session opens with, `<repo slug> · <branch>`: read by `omni ask hook pre`
// and, since PRD 1180, by the post hook when it opens a session of its own. Apart from `./mode.ts`,
// which the hooks' module is imported by.
import type { StdioOptions } from 'node:child_process';
import { basename } from 'node:path';
import type { ExecText } from '../context.ts';

/** The longest title the contract takes for a session. */
const TITLE_MAX = 200;

const QUIET: { encoding: 'utf8'; stdio: StdioOptions } = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** The branch the checkout is on, or the short commit when it is on none. */
export function currentBranch(root: string, exec: ExecText): string {
  return (
    attempt(() => exec('git', ['branch', '--show-current'], { cwd: root, ...QUIET }).trim())
    || attempt(() => exec('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, ...QUIET }).trim())
    || 'HEAD'
  );
}

/** `<repo slug> · <branch>`, the folder's name standing in for a slug the checkout cannot give. */
export function sessionTitle({ slug, branch, root }: { slug: string | null | undefined; branch: string; root: string }): string {
  return `${slug || basename(root)} · ${branch}`.slice(0, TITLE_MAX);
}
