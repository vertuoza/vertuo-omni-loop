/**
 * What `omni visual <n>` and `omni bug <n>` grade alike (PRD #627): a fix's one folder for its issue,
 * whatever that folder must hold, and a signature on every commit of the branch.
 */
import { carriesTrailer, trailerLine } from './signature.mjs';

function signatureViolations(ctx, commits) {
  const { signature } = ctx.config;
  const trailer = trailerLine(signature);
  if (trailer === null || commits === undefined) return [];
  return commits
    .filter((commit) => !carriesTrailer(commit.message, signature))
    .map((commit) => `unsigned: ${commit.sha} ${commit.message.split('\n')[0]} has no "${trailer}" line.`);
}

/**
 * Grades one issue's fix: exactly one of `folders` (`<root>/<prefix><slug>`), graded by `grade(folder)`,
 * then the commits' signatures.
 *
 * @param {{ ctx: object, issue: number, root: string, prefix: string, folders: string[],
 *   grade: (folder: string) => string[], commits?: { sha: string, message: string }[] }} options
 * @returns {{ ok: boolean, folder: string | null, failures: string[] }}
 */
export function fixVerdict({ ctx, issue, root, prefix, folders, grade, commits }) {
  const failures = [];
  let folder = null;
  if (folders.length === 0) {
    failures.push(`no folder ${root}/${prefix}<slug>/ for issue ${issue}.`);
  } else if (folders.length > 1) {
    failures.push(`${folders.length} folders for issue ${issue}, one expected: ${folders.join(', ')}.`);
  } else {
    [folder] = folders;
    failures.push(...grade(folder));
  }
  failures.push(...signatureViolations(ctx, commits));
  return { ok: failures.length === 0, folder, failures };
}
