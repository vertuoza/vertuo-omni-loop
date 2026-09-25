/**
 * **The loop's view of a PRD's slices — rebuilt from GitHub every time, never remembered** (PRD #7,
 * slice s3).
 *
 * The upstream skills this plugin composes used to work this out in prose, against a live `gh`
 * call, on every run: read the plan, list the feature branch's sub pull requests, and reason in
 * English about which slice is merged, in flight, stuck, runnable or blocked. That prose is real
 * policy — it decides what a wave may take next — so PRD #7 (§2.1.3, "policy lives in code, not
 * prose") makes it a pure function instead: `boardFor` takes the plan's own slices and an
 * already-fetched pull-request list and returns one row per slice, plus the wave a person or a wave
 * runner should take next.
 *
 * **Pure throughout.** Nothing here shells out or reads a clock beyond the `now` it is handed —
 * only `kit/bin/commands/board.mjs` calls `gh` and the system clock. That is also the whole test
 * seam: every state below is reachable by constructing `{ slices, prs }` by hand.
 *
 * **A slice's state, in the order it is decided** (earlier rows win):
 *
 * | State           | When                                                                          |
 * | --------------- | ------------------------------------------------------------------------------ |
 * | `merged`        | its matched pull request is merged                                            |
 * | `stuck`         | its matched pull request carries the configured `labels.needsFix`             |
 * | `claimed-stale` | its matched pull request is a draft, was last updated longer ago than         |
 * |                 | `limits.claimStaleMinutes`, and carries no commit later than the claim itself |
 * | `in-flight`     | it has a matched pull request that is none of the above                       |
 * | `runnable`      | it has no matched pull request and every slice it is blocked by is merged     |
 * | `blocked`       | it has no matched pull request and something it depends on is not merged      |
 *
 * **Matching a pull request to a slice** is by head branch — `branches.slice` with `{topic}` (the
 * plan's own PRD folder name) and `{slice}` filled in — narrowed by `board.matchBy`: `base` keeps
 * only pull requests into the feature branch (`branches.feature` with `{topic}`); `label` keeps
 * only ones carrying `labels.sub`. A closed pull request that was never merged is treated as if it
 * never existed — an abandoned claim, not a claim on anything. When more than one candidate
 * remains, a merged one wins; otherwise the most recently updated one does.
 *
 * **The runnable frontier** is the lowest wave that still holds a runnable slice, with any pair
 * that shares ground in that same wave (`sameWaveCollisions`, `kit/lib/inbox/territory.mjs`)
 * excluded from what can actually be taken next — the plan should never let two colliding slices
 * reach the same wave, and a frontier that quietly ran them both would be the collision made real.
 */
import { sameWaveCollisions } from './inbox/territory.mjs';

/** `template` with `{topic}` and `{slice}` filled in from `values` — the same shape
 * `branches.feature` and `branches.slice` are declared in (`kit/lib/config.mjs`). A placeholder
 * `values` does not carry is left untouched. */
function fillBranch(template, values) {
  return template.replace(/\{(topic|slice)\}/g, (whole, key) => (values[key] ?? whole));
}

/** Merged, by whichever shape a pull-request-list payload happens to carry. */
function isMerged(pr) {
  return pr.state === 'MERGED' || Boolean(pr.mergedAt);
}

/** A pull request worth matching at all: merged, or still open. A closed-and-never-merged pull
 * request is a dropped claim — it must not shadow the slice it once claimed. */
function isLive(pr) {
  return isMerged(pr) || pr.state === 'OPEN';
}

/** Whether `pr` carries a label named `name`, in either shape `gh pr list --json labels` returns
 * (an array of strings, or of `{ name }` objects). */
function hasLabel(pr, name) {
  return (pr.labels ?? []).some((label) => (typeof label === 'string' ? label : label?.name) === name);
}

/** Whether `matchBy` accepts `pr` as belonging to this feature at all — the coarse filter applied
 * before the fine one (the head branch, which is what actually ties a pull request to one slice). */
function matchesFeature(pr, { matchBy, featureBranch, subLabel }) {
  return matchBy === 'label' ? hasLabel(pr, subLabel) : pr.baseRefName === featureBranch;
}

/** The one pull request a slice's candidates resolve to: a merged one over an open one, and the
 * most recently updated among ties — `null` when there are no candidates at all. */
function pickPr(candidates) {
  if (candidates.length === 0) return null;
  const merged = candidates.filter(isMerged);
  const pool = merged.length > 0 ? merged : candidates;
  return pool.reduce((best, pr) => {
    if (!best) return pr;
    return new Date(pr.updatedAt).getTime() > new Date(best.updatedAt).getTime() ? pr : best;
  }, null);
}

/** Whether `pr`'s head carries a commit later than the claim that opened it — read from the head
 * commit's date against the pull request's own `createdAt`. Unknown (either date missing) reads as
 * "no commit beyond the claim": a claim this module cannot vouch for is not one it will excuse from
 * staleness. */
function hasCommitBeyondClaim(pr) {
  if (!pr.headCommitDate || !pr.createdAt) return false;
  return new Date(pr.headCommitDate).getTime() > new Date(pr.createdAt).getTime();
}

/** A claim gone cold: a draft whose last update is older than `staleMinutes` and that has moved no
 * further than the commit it was claimed with. */
function isClaimedStale(pr, now, staleMinutes) {
  if (!pr.isDraft) return false;
  const ageMs = now - new Date(pr.updatedAt).getTime();
  if (ageMs < staleMinutes * 60 * 1000) return false;
  return !hasCommitBeyondClaim(pr);
}

/** One slice's state, given its matched pull request (or `null`) and whether every slice it is
 * blocked by is already merged. */
function stateFor({ pr, blockersMerged, now, limits, needsFixLabel }) {
  if (!pr) return blockersMerged ? 'runnable' : 'blocked';
  if (isMerged(pr)) return 'merged';
  if (hasLabel(pr, needsFixLabel)) return 'stuck';
  if (isClaimedStale(pr, now, limits.claimStaleMinutes)) return 'claimed-stale';
  return 'in-flight';
}

/**
 * The lowest wave that still holds a runnable slice, with any slice that shares ground with
 * another runnable slice in that same wave excluded — {@link sameWaveCollisions} is the whole rule.
 *
 * @param {Array<{ id: string, territory: string[], wave: number, state: string }>} rows
 */
export function runnableFrontier(rows) {
  const runnable = rows.filter((row) => row.state === 'runnable');
  if (runnable.length === 0) return { wave: null, slices: [], excluded: [], collisions: [] };

  const wave = Math.min(...runnable.map((row) => row.wave));
  const inWave = runnable.filter((row) => row.wave === wave);
  const collisions = sameWaveCollisions(inWave);
  const collidingIds = new Set(collisions.flatMap((pair) => [pair.left, pair.right]));

  return {
    wave,
    slices: inWave.filter((row) => !collidingIds.has(row.id)).map((row) => row.id),
    excluded: inWave.filter((row) => collidingIds.has(row.id)).map((row) => row.id),
    collisions,
  };
}

/**
 * The whole board: one row per slice, plus the runnable frontier.
 *
 * @param {object} input
 * @param {Array<{ id: string, title?: string, territory: string[], wave: number, blockedBy?: string[] }>} input.slices
 *   — from `parsePlanSlices` (`kit/lib/inbox/territory.mjs`), each widened with its own `blocked by`
 *   ids (that module deliberately reads `id`, `slice`, `territory` and `wave` only — the CLI half
 *   reads `blocked by` itself, the same narrow way `omni plan check` already does).
 * @param {object[]} [input.prs] — a `gh pr list` payload: `number`, `title`, `headRefName`,
 *   `baseRefName`, `state`, `isDraft`, `mergedAt`, `body`, `labels`, `updatedAt`, `createdAt` and
 *   `headCommitDate` (the head commit's own date, when known).
 * @param {number} [input.now] — milliseconds since epoch; defaults to the real clock. This is the
 *   only place this module reads one.
 * @param {{ claimStaleMinutes: number }} input.limits
 * @param {{ branches: { feature: string, slice: string }, board: { matchBy: 'base' | 'label' }, labels: { sub: string, needsFix: string } }} input.config
 * @param {{ topic: string }} input.prd — `topic` is the PRD folder's own topic
 *   (`kit/lib/layout.mjs`'s `parseFolderName`), which fills `{topic}` in the branch templates.
 */
export function boardFor({ slices, prs = [], now = Date.now(), limits, config, prd }) {
  const { topic } = prd;
  const featureBranch = fillBranch(config.branches.feature, { topic });
  const live = prs.filter(isLive);

  const matched = new Map(
    slices.map((slice) => {
      const sliceBranch = fillBranch(config.branches.slice, { topic, slice: slice.id });
      const candidates = live.filter(
        (pr) =>
          pr.headRefName === sliceBranch &&
          matchesFeature(pr, { matchBy: config.board.matchBy, featureBranch, subLabel: config.labels.sub }),
      );
      return [slice.id, pickPr(candidates)];
    }),
  );

  const mergedById = new Map([...matched].map(([id, pr]) => [id, Boolean(pr && isMerged(pr))]));

  const rows = slices.map((slice) => {
    const pr = matched.get(slice.id) ?? null;
    const blockersMerged = (slice.blockedBy ?? []).every((blockerId) => mergedById.get(blockerId) === true);
    const state = stateFor({ pr, blockersMerged, now, limits, needsFixLabel: config.labels.needsFix });
    return { ...slice, pr, state };
  });

  return { prd: { topic }, slices: rows, frontier: runnableFrontier(rows) };
}
