// `pnpm install` runs this as the root package's `prepare` (PRD 1814): inside a git work tree it points
// `core.hooksPath` at the tracked `.githooks/`, so every commit and push, by any agent or person, goes
// through the same gate. Worktrees share the repository's config, so one install serves them all,
// each running its own `.githooks/`. Outside a git work tree (a tarball, a container build) it skips.
import { spawnSync } from 'node:child_process';

const inside = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
  process.stdout.write('install-hooks: not a git work tree, git hooks skipped\n');
} else {
  const set = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
  if (set.status === 0) process.stdout.write('install-hooks: git hooks on (core.hooksPath .githooks)\n');
  process.exitCode = set.status ?? 1;
}
