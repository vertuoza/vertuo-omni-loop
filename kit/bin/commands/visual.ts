// `omni visual <n> [--base <ref>]` — the proof step of a visual fix (PRD #541), run on its fix branch,
// mirroring `omni phase0`: one folder under `<paths.delivery>/visual/` for issue <n>, holding a
// before-after.html and its rounds of variations, `variations-r<k>.html` (PRD #627), each under the
// size cap with no base64 raster image, no other file, and every commit of the range
// `<base>..HEAD` signed. Prints `ok`, or `not ok` then one `- ` line per failed check
// (`kit/lib/visual/verdict.ts`). `--base` defaults to `<repo.remote>/<repo.defaultBranch>`; a bad
// ref is a usage error, exit 2.
import { visualVerdict } from '../../lib/visual/verdict.ts';
import { branchVerdictCommand } from '../branch-range.ts';

export const visual = branchVerdictCommand({
  verb: 'visual',
  grade: ({ ctx, number, commits }) => visualVerdict({ ctx, issue: number, commits }),
});
