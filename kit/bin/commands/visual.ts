// `omni visual <n> [--base <ref>]` — the proof step of a visual fix (PRD #541), run on its fix branch,
// mirroring `omni phase0`: one folder under `<paths.delivery>/visual/` for issue <n>, holding a
// before-after.html and its rounds of variations, `variations-r<k>.html` (PRD #627), each under the
// size cap with no base64 raster image, no other file, and every commit of the range
// `<base>..HEAD` signed, and (PRD 1342) every change to a law the range makes answered in the
// folder's `outbox/`. Prints `ok`, or `not ok` then one `- ` line per failed check
// (`kit/lib/visual/verdict.ts`). `--base` defaults to `<repo.remote>/<repo.defaultBranch>`; a bad
// ref is a usage error, exit 2.
import { visualVerdict } from '../../lib/visual/verdict.ts';
import { issueArg } from '../args.ts';
import { branchVerdictCommand, fixLaws } from '../branch-range.ts';

export const visual = branchVerdictCommand({
  verb: 'visual',
  read: issueArg,
  grade: ({ ctx, number, commits, base, exec }) => visualVerdict({ ctx, issue: number, commits, laws: fixLaws(ctx, number, base, exec) }),
});
