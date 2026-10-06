// `omni concept <n> [--base <ref>]` — the proof step of a concept (PRD 686), run on its concept
// branch, mirroring `omni visual`: one folder under the inbox's concepts folder for concept <n>,
// holding a valid concept.md, its vision tour, its debate and its boards, every page self-contained
// and under the size cap, no file outside that folder changed since `<base>`, and every commit of
// `<base>..HEAD` signed. Prints `ok`, or `not ok` then one `- ` line per failed check
// (`kit/lib/concept/verdict.ts`). `--base` defaults to `<repo.remote>/<repo.defaultBranch>`; a bad
// ref is a usage error, exit 2.
import { conceptVerdict } from '../../lib/concept/verdict.ts';
import { positiveInt } from '../args.ts';
import { branchPaths, branchVerdictCommand } from '../branch-range.ts';

export const concept = branchVerdictCommand({
  verb: 'concept',
  read: positiveInt,
  paths: branchPaths,
  grade: ({ ctx, number, changed, commits }) => conceptVerdict({ ctx, concept: number, changed, commits }),
});
