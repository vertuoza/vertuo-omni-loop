// PRD 1138: which of a repository's generated outputs (the config's `generated` section) a diff made
// stale. Pure: the caller hands it the changed paths; the skills, never the kit, run the builds.
import type { ExecText } from '../context.ts';
import { parseNameStatus } from '../git.ts';
import { covers } from '../inbox/territory.ts';

/** One `generated` entry of the config: the output's path prefix, its sources and its build. */
export type GeneratedEntry = { readonly path: string; readonly from: readonly string[]; readonly build: string };

/** An entry, graded against a diff: stale when a changed path is under one of its `from` prefixes. */
export type GeneratedState = GeneratedEntry & { readonly stale: boolean };

/**
 * The paths a range (`<base>..<head>`, or any range `git diff` reads) changed, in `root`. Renames
 * arrive as a delete and an add, so a moved source makes its output stale. Throws when git cannot
 * read the range.
 */
export function rangePaths({ root, range, exec }: { root: string; range: string; exec: ExecText }): string[] {
  const text = exec('git', ['diff', '--name-status', '--no-renames', range, '--'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return parseNameStatus(text).map(({ path }) => path);
}

/** Every entry in config order, each stale or fresh for these changed paths. */
export function staleness(entries: readonly GeneratedEntry[], changed: readonly string[]): GeneratedState[] {
  return entries.map((entry) => ({ ...entry, stale: changed.some((path) => covers(entry.from, path)) }));
}
