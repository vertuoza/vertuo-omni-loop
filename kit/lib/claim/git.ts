// PRD 2175, s3: the git reads `checkClaim` (`./check.ts`) takes, read for real in a checkout. Every
// read is of the remote's refs as last fetched (`<remote>/<feature branch>`, `<remote>/<slice
// branch>`): nothing is checked out, fetched or written.
import type { ExecText } from '../context.ts';
import type { ClaimCommit, ClaimGit } from './check.ts';

const TAB = '\t';

/** `git <args>` in `root`, its stdout as text; throws when git fails. */
function git(root: string, exec: ExecText, args: readonly string[]): string {
  return exec('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Whether `ref` names a commit git can read here. */
export function refExists({ root, exec, ref }: { root: string; exec: ExecText; ref: string }): boolean {
  try {
    git(root, exec, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * The reads of a claim on `sliceRef`, cut from `featureRef`. The branch's own commits are those
 * `featureRef` does not hold, along the first parent: a merge of the feature branch into the slice
 * branch brings none of the feature branch's own. A slice branch git cannot read has none. Its
 * changed files are its diff from where it last met the feature branch (`featureRef...sliceRef`), so
 * a merge of the feature branch never counts what the feature branch changed.
 */
export function claimGit({ root, exec, featureRef, sliceRef }: { root: string; exec: ExecText; featureRef: string; sliceRef: string }): ClaimGit {
  return {
    ownCommits(): ClaimCommit[] {
      let text: string;
      try {
        text = git(root, exec, ['log', '--first-parent', `--format=%H${TAB}%s`, `${featureRef}..${sliceRef}`, '--']);
      } catch {
        return [];
      }
      return text
        .split('\n')
        .filter((line) => line.includes(TAB))
        .map((line) => {
          const at = line.indexOf(TAB);
          return { sha: line.slice(0, at), subject: line.slice(at + 1) };
        });
    },
    fileAt(ref: string, path: string): string | null {
      try {
        return git(root, exec, ['show', `${ref}:${path}`]);
      } catch {
        return null;
      }
    },
    changedFiles(): string[] {
      return git(root, exec, ['diff', '--name-only', '--no-renames', `${featureRef}...${sliceRef}`, '--'])
        .split('\n')
        .filter(Boolean);
    },
  };
}
