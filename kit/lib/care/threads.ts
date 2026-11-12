// PRD 2739, s3: the review threads of one PRD's pull requests, read through the loop's reads (PRD 1665):
// its feature PRs and its sub-PRs into the feature branch, every one not closed. `omni care reply
// --verdict later` reads them to find the thread it answers. `omni ship` never does (BR-PRODUCT-130):
// it reads the items those replies recorded.
import type { LoopChangeDetail } from '../loop-reads/contract.ts';
import type { LoopReads } from '../loop-reads/port.ts';

/** The feature PRs from `branch` in `repo` and its sub-PRs, every one not closed, each with its review.
 * Throws the reads' `LoopReadError` when they cannot be read. */
export async function prdReviews(repo: string, branch: string, reads: LoopReads): Promise<LoopChangeDetail[]> {
  const [features, intoBranch] = await Promise.all([reads.changes({ repo, head: branch, state: 'all' }), reads.changes({ repo, base: branch, state: 'all' })]);
  const changes = [...features, ...intoBranch].filter((change) => change.state !== 'closed');
  return Promise.all(changes.map((change) => reads.change(repo, change.number)));
}
