/**
 * Pure decision behind the `settle` job in the CI workflow: has the pull request this run belongs
 * to already moved past the commit this run is grading?
 *
 * `cancel-in-progress` only cancels a run once the NEXT one already exists — by the time it fires,
 * this run's build/test/coverage jobs have already started. `settle` waits out a short burst of
 * pushes, reads the pull request's CURRENT head live, and every expensive job downstream skips
 * itself when this run's commit is no longer that head.
 *
 * Fails OPEN, always: an unreadable head (the live API read failed, or returned nothing) is
 * `fresh`, never `stale`. A transient API error must never SKIP the checks that decide whether a
 * pull request can merge — it may only ever cost the wasted minutes this job exists to save.
 *
 * A push to the default branch never goes stale: the commit that triggered the run already IS the
 * ref's head, and there is nothing later to compare it against. That decision belongs to the CLI
 * half (a later task), not to this function — `decideStale` only ever answers the pull_request
 * question.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/settle-head.mjs — changes in kit/porting/outbox--settle-head.md.

/**
 * @param {string} runSha - the head commit this workflow run was triggered for.
 * @param {string} headSha - the pull request's head commit, read live from the API ('' if unread).
 * @param {string} apiError - non-empty when the live read failed.
 * @returns {'stale' | 'fresh'}
 */
export function decideStale(runSha, headSha, apiError) {
  if (apiError) return 'fresh';
  if (!headSha) return 'fresh';
  if (headSha === runSha) return 'fresh';
  return 'stale';
}
