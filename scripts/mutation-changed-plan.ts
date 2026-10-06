// What `pnpm mutation:changed` does (PRD 1072), run by scripts/mutation-changed.ts: the delivery core's
// files changed against a base, the Stryker run on those alone, and the line it ends with, which the
// bug-fix skill records.
import { matchesGlob } from 'node:path';
import stryker from '../stryker.config.ts';
import type { Changes } from './check-changed-steps.ts';
import { survivorLine, survivorsOf, tally, type parseReport } from './mutation-report.ts';

/** The globs `stryker.config.ts` mutates: the delivery core, its tests excluded by a `!` pattern. */
export const corePatterns: readonly string[] = stryker.mutate;

/** Whether `path` is one Stryker mutates: it matches a pattern, and no `!` pattern. */
export function isCoreFile(path: string, patterns: readonly string[]): boolean {
  const excluded = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
  const included = patterns.filter((p) => !p.startsWith('!'));
  return included.some((p) => matchesGlob(path, p)) && !excluded.some((p) => matchesGlob(path, p));
}

/** The changed core files (tracked or not, a deleted one left out), sorted: what the run mutates. */
export function planMutation({ tracked, untracked }: Changes, patterns: readonly string[]): string[] {
  return [...new Set([...tracked, ...untracked])].filter((path) => isCoreFile(path, patterns)).sort();
}

/** pnpm's arguments for a Stryker run of `files` alone, with the repository's config. */
export function mutationArgs(files: readonly string[]): string[] {
  return ['exec', 'stryker', 'run', 'stryker.config.ts', '--mutate', files.join(',')];
}

/**
 * What the run of `files` printed last: each mutant the tests let through, with its file and line,
 * then `mutation: <k> killed, <s> survived in <files>`, where killed counts the timed out and survived
 * the uncovered, as the score does.
 */
export function changedSummary(report: ReturnType<typeof parseReport>, files: readonly string[]): string[] {
  const counts = tally(files.flatMap((file) => report.files[file]?.mutants ?? []));
  return [
    ...survivorsOf(report, files).map((survivor) => `- ${survivorLine(survivor)}`),
    `mutation: ${String(counts.killed + counts.timedOut)} killed, ${String(counts.survived + counts.noCoverage)} survived in ${files.join(', ')}`,
  ];
}
