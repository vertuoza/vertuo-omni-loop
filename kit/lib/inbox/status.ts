/**
 * **Status is derived, never written** (PRD #1015, slice s2).
 *
 * Whether a PRD is unplanned, planned, in flight, stalled or done is already recorded unforgeably
 * in the branch and its pull requests. A status field in a file would go stale, and a shared
 * per-PRD status file is a guaranteed conflict between concurrent worktree subagents. `deriveStatus`
 * computes the status instead, from a pull-request-list payload and a last-commit date the caller
 * already has. **This module performs no I/O of its own** — it never calls out to a host, never
 * reads a file, never opens a network connection.
 *
 * A feature pull request's body carries the configured `prLinks.feature` marker (by default
 * `Closes #{prd}`) — the same text a workflow greps for to find the PRD a feature pull request
 * closes. A sub-pull-request's body carries `prLinks.sub` instead (by default `Part of #{prd}`).
 * Both are read from the pull request **body**, never from a branch name — a renamed or free-form
 * branch would otherwise silently strand a PRD's status, and a sub-PR's branch name never mentions
 * the PRD at all. Matching is anchored right after the number (a word boundary), so a longer PRD
 * number never falsely matches a shorter one: `Closes #123` never matches `Closes #1234`.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/inbox-status.mjs — changes in kit/porting/inbox--status.md.

/** What the rule reads of one pull request, in whichever shape its list payload carries. */
export type StatusPr = {
  body?: string | null;
  isDraft?: boolean;
  state?: string;
  mergedAt?: string | null;
  merged?: boolean;
};

/** The two `{prd}` link templates a feature and a sub pull request's body carry. */
export type PrLinks = { feature: string; sub: string };

/** A PRD's derived status. */
export type PrdStatus = 'unplanned' | 'planned' | 'in-flight' | 'stalled' | 'done';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a regex out of a `{prd}` link template (e.g. `'Closes #{prd}'`) and a PRD number: the
 * text around `{prd}` is escaped, the number is substituted verbatim, and a word boundary sits
 * right after it so a longer PRD number can never falsely match a shorter one.
 */
function prLinkPattern(template: string, prd: string | number): RegExp {
  const [before = '', after = ''] = template.split('{prd}');
  return new RegExp(`${escapeRegExp(before)}${Number(prd)}\\b${escapeRegExp(after)}`);
}

/** Whether a pull request's body names this PRD through the given link template. */
function refersTo(template: string, body: string | null | undefined, prd: string | number): boolean {
  return prLinkPattern(template, prd).test(body ?? '');
}

/** Merged, by whichever shape a pull-request-list payload happens to carry. */
function isMerged(pr: StatusPr): boolean {
  return pr.state === 'MERGED' || Boolean(pr.mergedAt) || pr.merged === true;
}

/** The one pull request that closes this PRD — `null` when none does. Matched by body, not branch. */
export function findFeaturePr<P extends StatusPr>(prd: string | number, prs: readonly P[], prLinks: PrLinks): P | null {
  return prs.find((pr) => refersTo(prLinks.feature, pr.body, prd)) ?? null;
}

/** Every pull request that declares itself part of this PRD. Matched by body, not branch. */
export function findSubPrs<P extends StatusPr>(prd: string | number, prs: readonly P[], prLinks: PrLinks): P[] {
  return prs.filter((pr) => refersTo(prLinks.sub, pr.body, prd));
}

function daysSince(date: string | number | Date, now: number): number {
  return (now - new Date(date).getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * The whole rule, as one pure function of a PRD number, a pull-request-list-shaped payload, a
 * last-commit date, how many quiet days make an in-flight PRD read as stalled, and the two link
 * templates a feature/sub pull request's body carries.
 *
 * | Signal                                          | Status      |
 * | ------------------------------------------------ | ----------- |
 * | No feature pull request                           | unplanned   |
 * | Draft feature pull request, no sub-PR merged      | planned     |
 * | A sub-PR merged, or the feature PR out of draft   | in-flight   |
 * | In flight, no commit for `stallDays`              | stalled     |
 * | Feature pull request merged                       | done        |
 *
 * @param {object} input
 * @param {string | number} input.prd - the PRD issue number.
 * @param {object[]} input.featurePrs - a pull-request-list payload: the feature pull request and
 *   its sub-pull-requests, in any order, open or closed. Each entry is read for `body`, `isDraft`,
 *   `state` and `mergedAt`.
 * @param {string | number | Date | null} [input.lastCommit] - the feature branch's last commit
 *   date. Ignored whenever the verdict does not depend on it (unplanned, planned, done).
 * @param {number} [input.now] - milliseconds since epoch, for a deterministic test. Defaults to
 *   the real clock; this is the only place this module reads one, and it opens no connection to
 *   get there.
 * @param {number} input.stallDays - how many quiet days make an in-flight PRD read as stalled.
 * @param {{ feature: string, sub: string }} input.prLinks - the two `{prd}` link templates.
 * @returns {'unplanned' | 'planned' | 'in-flight' | 'stalled' | 'done'}
 */
export function deriveStatus({
  prd,
  featurePrs,
  lastCommit = null,
  now = Date.now(),
  stallDays,
  prLinks,
}: {
  prd: string | number;
  featurePrs: readonly StatusPr[] | null | undefined;
  lastCommit?: string | number | Date | null;
  now?: number;
  stallDays: number;
  prLinks: PrLinks;
}): PrdStatus {
  const prs = featurePrs ?? [];

  const featurePr = findFeaturePr(prd, prs, prLinks);
  if (!featurePr) return 'unplanned';
  if (isMerged(featurePr)) return 'done';

  const aSubPrMerged = findSubPrs(prd, prs, prLinks).some(isMerged);
  const outOfDraft = featurePr.isDraft === false;
  if (!aSubPrMerged && !outOfDraft) return 'planned';

  if (lastCommit != null && daysSince(lastCommit, now) >= stallDays) return 'stalled';
  return 'in-flight';
}
