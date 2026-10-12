// PRD 1208, slice s3: the roadmap a loop plan drives, so that `omni loop push start` keeps it in
// `loop.json` and `omni now` shows the roadmap above the loop's work. The loop plan does not say which
// roadmap it was made for; `omni next --roadmap <n>` drives exactly roadmap n's PRDs, so the plan
// drives roadmap n when its PRDs are exactly the PRDs of roadmap n's rows, and of no other roadmap of
// the inbox. A roadmap that does not parse drives nothing; two roadmaps of the same PRDs, or none,
// read as `null`.
import { readRepoFile } from '../check-report.ts';
import type { Context } from '../context.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { roadmapFiles } from '../roadmap/index.ts';
import { parseRoadmap } from '../roadmap/parse.ts';

/** The PRDs, once each, in number order, as one key. */
const keyOf = (prds: readonly number[]): string => [...new Set(prds)].sort((a, b) => a - b).join(',');

/** The roadmap of the inbox whose rows name exactly `prds`, or `null` for none or two. */
export function roadmapDriving(ctx: Pick<Context, 'root' | 'layout'>, prds: readonly PrdNumber[]): IssueNumber | null {
  const wanted = keyOf(prds);
  const matching = roadmapFiles(ctx).filter((entry) => {
    try {
      const parsed = parseRoadmap(readRepoFile(ctx, entry.file));
      return parsed.ok && parsed.roadmap.roadmap === entry.number && keyOf(parsed.roadmap.prds.map((row) => row.prd)) === wanted;
    } catch {
      return false;
    }
  });
  return matching.length === 1 ? (matching[0]?.number ?? null) : null;
}
