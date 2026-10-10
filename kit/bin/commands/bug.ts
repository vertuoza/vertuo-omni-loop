// `omni bug <n> [--base <ref>]` — the proof step of a bug fix (PRD #556), run on its fix branch,
// shaped like `omni visual`: one folder under `<paths.delivery>/bugs/` for issue <n>, holding a
// complete bug.md whose reproduction file the range `<base>..HEAD` changes, and every commit of that
// range signed, and (PRD 1342) every change to a law the range makes answered in the folder's outbox.
// Prints `ok`, or `not ok` then one `- ` line per failed check
// (`kit/lib/bug/verdict.ts`). It runs no test. `--base` defaults to
// `<repo.remote>/<repo.defaultBranch>`; a bad ref is a usage error, exit 2.
import { issueArg } from '../args.ts';
import { bugVerdict } from '../../lib/bug/verdict.ts';
import { branchVerdictCommand, fixLaws, loggedPaths } from '../branch-range.ts';

export const bug = branchVerdictCommand({
  verb: 'bug',
  read: issueArg,
  paths: loggedPaths,
  grade: ({ ctx, number, changed, commits, base, exec }) => bugVerdict({ ctx, issue: number, changed, commits, laws: fixLaws(ctx, number, base, exec) }),
});
