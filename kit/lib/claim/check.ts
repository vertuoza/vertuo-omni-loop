// PRD 2175, s3: **a takeover reuses the same work, or rebuilds.** A `claimed-stale` slice (a dead
// runner job's released claim, or a claim quiet past `limits.claimDeadMinutes`) still holds a branch
// of someone else's commits. `/omni:wave` takes it over only when the work is still the same work:
// the slice's plan row is the one it was claimed under, and the branch stayed inside its territory.
// `checkClaim` decides it mechanically, so two runs reach the same answer:
//
// | outcome                                  | line                                   |
// | ---------------------------------------- | -------------------------------------- |
// | the row is gone from the feature branch  | `rebuild: slice not in the plan`       |
// | no `chore(<slice>): claim` on the branch | `rebuild: no claim commit`             |
// | the row's territory changed (as a set)   | `rebuild: plan row changed: territory` |
// | the row's title changed                  | `rebuild: plan row changed: title`     |
// | a changed file outside the territory     | `rebuild: outside territory: <path>`   |
// | same work                                | `reuse`                                |
//
// Checked in that order, and the first that holds is the answer: each later check reads what an
// earlier one found (the claim's plan needs the claim commit). A row the claim's plan does not hold
// reads as a changed territory. A path is inside when it starts with a territory entry, as
// `/omni:wave` step 4 reads it: the PRD's outbox dir and a generated entry's `path` are never
// outside. Pure: git is the injected `ClaimGit` (`./git.ts` reads it for real).
import { breaches, parsePlanSlices } from '../inbox/territory.ts';
import type { Generated } from '../inbox/territory.ts';
import type { WorkSliceId } from '../ids.ts';

/** One commit of the slice branch: its sha and its subject line. */
export type ClaimCommit = { readonly sha: string; readonly subject: string };

/** What the check reads of git. */
export type ClaimGit = {
  /** The slice branch's own commits (none the feature branch holds), newest first, first parent only. */
  ownCommits(): readonly ClaimCommit[];
  /** The text of `path` at `ref`, or `null` when git cannot read it there. */
  fileAt(ref: string, path: string): string | null;
  /** Every file the slice branch changed since it last met the feature branch. */
  changedFiles(): readonly string[];
};

/** What the check is asked about. */
export type ClaimCheckInput = {
  readonly slice: WorkSliceId;
  /** The PRD's `plan.md`, from the repository's root. */
  readonly planPath: string;
  /** The feature branch on the remote (`origin/feat/<topic>`), whose plan row is today's. */
  readonly featureRef: string;
  /** The PRD's outbox dir, from the repository's root, or `null` when it has none. */
  readonly outboxDir: string | null;
  readonly generated: readonly Generated[];
};

/** The answer, and the one line `omni claim check` prints for it. */
export type ClaimVerdict = { readonly reuse: true; readonly line: 'reuse' } | { readonly reuse: false; readonly line: `rebuild: ${string}` };

type Row = { readonly title: string; readonly territory: readonly string[] };

const rebuild = (reason: string): ClaimVerdict => ({ reuse: false, line: `rebuild: ${reason}` });

/** The slice's row in a plan's text, or `null` when there is no text, no slice table or no row. */
function rowIn(markdown: string | null, slice: WorkSliceId): Row | null {
  if (markdown === null) return null;
  try {
    return parsePlanSlices(markdown).find((row) => row.id === slice) ?? null;
  } catch {
    return null;
  }
}

/** Two territories declare the same ground: the same prefixes, whatever their order. */
function sameTerritory(left: readonly string[], right: readonly string[]): boolean {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((prefix) => b.has(prefix));
}

/** Reuse or rebuild a stale claim of `input.slice`: see the table at the top of this file. */
export function checkClaim(input: ClaimCheckInput, git: ClaimGit): ClaimVerdict {
  const now = rowIn(git.fileAt(input.featureRef, input.planPath), input.slice);
  if (now === null) return rebuild('slice not in the plan');

  const subject = `chore(${input.slice}): claim`;
  const claim = git.ownCommits().find((commit) => commit.subject === subject);
  if (claim === undefined) return rebuild('no claim commit');

  const then = rowIn(git.fileAt(claim.sha, input.planPath), input.slice) ?? { title: '', territory: [] };
  if (!sameTerritory(then.territory, now.territory)) return rebuild('plan row changed: territory');
  if (then.title.trim() !== now.title.trim()) return rebuild('plan row changed: title');

  const owned = input.outboxDir === null ? now.territory : [...now.territory, `${input.outboxDir}/`];
  const [outside] = breaches(git.changedFiles(), owned, input.generated);
  if (outside !== undefined) return rebuild(`outside territory: ${outside}`);
  return { reuse: true, line: 'reuse' };
}
