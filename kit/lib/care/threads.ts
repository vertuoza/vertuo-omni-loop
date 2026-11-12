// PRD 2739, s3: the review threads of one PRD's pull requests, read through the loop's reads (PRD 1665):
// its feature PRs that are not closed, and its sub-PRs into the feature branch that `subs` keeps. Both
// `omni care reply --verdict later` (to find the thread it answers) and `omni ship` (to find the
// threads a `later` reply answered) read them here.
import type { LoopChange, LoopChangeDetail } from '../loop-reads/contract.ts';
import type { LoopReads } from '../loop-reads/port.ts';

/** Which sub-PRs count: `merged` only (what shipped into the feature branch), or every one not closed. */
type Subs = 'merged' | 'not-closed';

const keptSub: Record<Subs, (change: LoopChange) => boolean> = {
  merged: (change) => change.state === 'merged',
  'not-closed': (change) => change.state !== 'closed',
};

/** The feature PRs from `branch` in `repo` and its sub-PRs `subs` keeps, each with its review. Throws
 * the reads' `LoopReadError` when they cannot be read. */
export async function prdReviews(repo: string, branch: string, reads: LoopReads, subs: Subs): Promise<LoopChangeDetail[]> {
  const [features, intoBranch] = await Promise.all([reads.changes({ repo, head: branch, state: 'all' }), reads.changes({ repo, base: branch, state: 'all' })]);
  const changes = [...features.filter((change) => change.state !== 'closed'), ...intoBranch.filter(keptSub[subs])];
  return Promise.all(changes.map((change) => reads.change(repo, change.number)));
}
