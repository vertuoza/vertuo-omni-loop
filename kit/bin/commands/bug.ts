// `omni bug <n> [--base <ref>] [--body-file <file>]` — the proof step of a bug fix (PRD #556), run on
// its fix branch, shaped like `omni visual`: one folder under `<paths.delivery>/bugs/` for issue <n>,
// holding a complete bug.md whose reproduction file the range `<base>..HEAD` changes, and every commit
// of that range signed, and (PRD 1342) every change to a law the range makes answered in the folder's
// outbox, and (PRD 2100) the pull request's body carrying its `## Proof` (`kit/lib/bug/proof-body.ts`):
// the body in `--body-file`, else the open pull request of the current branch, read through `gh`.
// Prints `ok`, or `not ok` then one `- ` line per failed check (`kit/lib/bug/verdict.ts`). It runs no
// test. `--base` defaults to `<repo.remote>/<repo.defaultBranch>`; a bad ref, or a `--body-file` that
// cannot be read, is a usage error, exit 2.
//
// `omni bug film <n> --before <file> --after <file> [--out <dir>]` (PRD 1972) makes the before/after GIF
// and the run's folder: see `./bug-film.ts`.
import { issueArg, parseArgs, println, readUserFile, usageError } from '../args.ts';
import { loggedPaths, fixLaws, rangeBase, rangeCommits } from '../branch-range.ts';
import { openPullRequest } from '../../lib/bug/proof-body.ts';
import type { ProofSource } from '../../lib/bug/proof-body.ts';
import { bugVerdict } from '../../lib/bug/verdict.ts';
import { synchronous } from '../synchronous.ts';
import type { Command, CommandIo } from '../io.ts';
import { film } from './bug-film.ts';

const USAGE = 'usage: omni bug <n> [--base <ref>] [--body-file <file>]';

/** Grades the fix of issue `<n>` on the current branch; the exit code. */
function grade(args: string[], { ctx, stdout, exec }: CommandIo): number {
  const { positional, flags } = parseArgs('bug', args, { values: ['base', 'body-file'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const issue = issueArg('bug', '<n>', positional[0]);
  const file = flags['body-file'];
  const written: ProofSource | undefined = file === undefined ? undefined : { kind: 'file', body: readUserFile('bug', ctx, file) };
  const base = rangeBase('bug', ctx, flags, exec);
  const verdict = bugVerdict({
    ctx,
    issue,
    changed: loggedPaths(ctx.root, base, exec),
    commits: ctx.config.signature === null ? undefined : rangeCommits(ctx.root, base, exec),
    laws: fixLaws(ctx, issue, base, exec),
    proof: () => written ?? openPullRequest({ root: ctx.root, exec }),
  });
  println(stdout, verdict.ok ? 'ok' : 'not ok');
  for (const failure of verdict.failures) println(stdout, `- ${failure}`);
  return verdict.ok ? 0 : 1;
}

export const bug: Command = {
  run: (args, io) => (args[0] === 'film' ? synchronous(film)(args.slice(1), io) : synchronous(grade)(args, io)),
};
