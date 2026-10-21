// The kit's reading of a ◆ PRD of a repository at a pull request's head (PRD 1612, folded into PRD 1548's
// check): its folder read at that head through Git trees and blobs into a temporary folder, galaxy's judge
// asked for the approval in force (./judge-client.ts), and the kit's one judge run on what was read
// (`judgeApproval`, kit/lib/approval/approval.ts), so the check and `omni approval <n>` never disagree.
// ./repo-verdict.ts says the reading in the check's states.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { judgeApproval, UNREACHABLE_LINE, type ApprovalReading } from 'omni-loop/kit/lib/approval/approval.ts';
import { birthplaceOf } from 'omni-loop/kit/lib/approval/prd-state.ts';
import { ARTIFACT_KINDS } from 'omni-loop/kit/lib/dossier/folder.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { foldersLayout } from 'omni-loop/kit/lib/layout.ts';
import type { Config } from 'omni-loop/kit/lib/types.ts';
import type { GitHubClient } from '../outbox-check/github.ts';
import { SnapshotBoundError, snapshot } from '../snapshot/snapshot.ts';
import type { JudgeAnswer } from './judge-client.ts';

/** Asks galaxy's judge for PRD `prd` of `repo` (owner/name). */
export type AskJudge = (repo: string, prd: PrdNumber) => Promise<JudgeAnswer>;

/** Where a ◆ PRD's folder is read: a repository at a head, with its config's paths. */
export type RepoSource = { owner: string; repo: string; ref: string; paths: Config['paths'] };

/** The reading of a ◆ PRD's check held before the judge could answer, saying why. */
export function heldReading(why: string): ApprovalReading {
  return { state: 'unreachable', lines: [UNREACHABLE_LINE, why], url: null, approval: null, drift: [] };
}

/** The kit judge's reading of the PRD in `folder` at `source`'s head, or null for a ◇ PRD. The folder (and
 * any pinned file outside it) is read into a temporary folder, removed whatever happens. */
export async function readingAt(octokit: GitHubClient, source: RepoSource, folder: { prd: PrdNumber; dir: string }, ask: AskJudge): Promise<ApprovalReading | null> {
  const { owner, repo, ref, paths } = source;
  const root = mkdtempSync(join(tmpdir(), 'omni-approved-'));
  try {
    try {
      await snapshot(octokit, { owner, repo, ref, paths: [folder.dir], dest: root });
    } catch (error) {
      if (error instanceof SnapshotBoundError) return heldReading(error.message);
      throw error;
    }
    const ctx = { root, layout: foldersLayout(root, paths) };
    if (birthplaceOf(ctx, folder.prd) !== 'server') return null;
    const answer = await ask(`${owner}/${repo}`, folder.prd);
    if ('held' in answer) return heldReading(answer.held);
    const kept = new Set<string>(ARTIFACT_KINDS.map((entry) => entry.kind));
    const elsewhere = (answer.reply.approval?.files ?? []).filter((file) => !kept.has(file.kind)).map((file) => file.path);
    if (elsewhere.length > 0) await snapshot(octokit, { owner, repo, ref, paths: elsewhere, dest: root });
    return judgeApproval(ctx, folder.prd, answer.reply);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
