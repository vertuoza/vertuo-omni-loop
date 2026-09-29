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
 * | `claimed-stale` | its matched pull request is a draft, its branch carries no commit beyond the  |
 * |                 | one it was claimed with, and that claim (`createdAt`) is older than          |
 * |                 | `limits.claimStaleMinutes`                                                    |
 * | `in-flight`     | it has a matched pull request that is none of the above                       |
 * | `runnable`      | it has no matched pull request and every slice it is blocked by is merged     |
 * | `blocked`       | it has no matched pull request and something it depends on is not merged      |
 *
 * **Across repositories** (PRD 563): in a plan repository each slice names the `repo` it lands in,
 * and `repos` maps each short name to `{ slug, readable }`. A slice then matches only a pull request
 * whose `slug` is its own repository's (the same branch name in two repositories ties two different
 * slices), every row carries `repo` and `slug`, and a slice of a repository that could not be read
 * (or that `repos` does not name) is `unreadable` — ahead of every row above — which holds it and
 * whatever it blocks, and nothing else. On a plan with no `repo` column, rows carry neither field.
 *
 * An **unknown head commit date** — the caller could not read one — is read as "yes, there is a
 * commit beyond the claim": this module will not call a claim stale on a signal it never actually
 * saw, so the state degrades to `in-flight` rather than `claimed-stale`.
 *
 * **Matching a pull request to a slice** is by head branch — `branches.slice` with `{topic}` (the
 * plan's own PRD folder name) and `{slice}` filled in — narrowed by `board.matchBy`: `base` keeps
 * only pull requests into the feature branch (`branches.feature` with `{topic}`); `label` keeps
 * only ones carrying `labels.sub`. A closed pull request that was never merged is treated as if it
 * never existed — an abandoned claim, not a claim on anything. When more than one candidate
 * remains, a merged one wins; otherwise the most recently updated one does.
 *
 * **The runnable frontier** is the lowest wave that still holds a slice a wave may take —
 * `runnable`, or `claimed-stale` (a cold claim is the kit's to reclaim, not a person's to wait on;
 * PRD #7 §2.1.3). Within that wave, a pair that shares ground (`sameWaveCollisions`,
 * `kit/lib/inbox/territory.mjs`) may not both be taken: the plan's own order decides which one is
 * — the earlier slice is kept and the later one deferred — rather than dropping both, so one
 * colliding pair costs the wave a single slice, not two.
 */
import { sameWaveCollisions } from './inbox/territory.mjs';

/** `template` with `{topic}` and `{slice}` filled in from `values` — the same shape
 * `branches.feature` and `branches.slice` are declared in (`kit/lib/config.mjs`). A placeholder
 * `values` does not carry is left untouched. Exported so the CLI half can compute the same feature
 * branch name to narrow its own `gh pr list` call. */
export function fillBranch(template, values) {
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
 * "yes, assume it has moved on": this module will not call a claim stale on a signal it never
 * actually saw. */
function hasCommitBeyondClaim(pr) {
  if (!pr.headCommitDate || !pr.createdAt) return true;
  return new Date(pr.headCommitDate).getTime() > new Date(pr.createdAt).getTime();
}

/** A claim gone cold: a draft that has moved no further than the commit it was claimed with, and
 * whose claim itself (`createdAt`) is older than `staleMinutes`. Never reads `updatedAt` — a
 * comment or a label change updates that field without moving the branch at all, which would let a
 * genuinely cold claim keep reading as fresh. */
function isClaimedStale(pr, now, staleMinutes) {
  if (!pr.isDraft) return false;
  if (hasCommitBeyondClaim(pr)) return false;
  const ageMs = now - new Date(pr.createdAt).getTime();
  return ageMs > staleMinutes * 60 * 1000;
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

const TAKEABLE_STATES = new Set(['runnable', 'claimed-stale']);

/**
 * The lowest wave that still holds a slice a wave may take — `runnable`, or `claimed-stale` (the
 * kit's own claim to reclaim, not a person's to wait on). Within that wave, a pair that shares
 * ground ({@link sameWaveCollisions}) may not both be taken: read in plan order (the order `rows`
 * itself carries), the first of a colliding pair is kept and the rest deferred — never both
 * dropped, so one collision costs the wave one slice, not two.
 *
 * `takeable` is the whole set a wave may start (`runnable` ∪ `claimed-stale`, collision-resolved);
 * `runnable` narrows that to the ones with nothing at all claiming them yet — both read the plan's
 * own order, so a caller that only ever wants to know what a fresh wave can pick up still can.
 *
 * @param {Array<{ id: string, territory: string[], wave: number, state: string }>} rows
 */
export function runnableFrontier(rows) {
  const takeableRows = rows.filter((row) => TAKEABLE_STATES.has(row.state));
  if (takeableRows.length === 0) return { wave: null, runnable: [], takeable: [], excluded: [], collisions: [] };

  const wave = Math.min(...takeableRows.map((row) => row.wave));
  const inWave = takeableRows.filter((row) => row.wave === wave);
  const collisions = sameWaveCollisions(inWave);

  const collidesWith = new Map();
  for (const { left, right } of collisions) {
    if (!collidesWith.has(left)) collidesWith.set(left, new Set());
    if (!collidesWith.has(right)) collidesWith.set(right, new Set());
    collidesWith.get(left).add(right);
    collidesWith.get(right).add(left);
  }

  const kept = [];
  const excluded = [];
  for (const row of inWave) {
    const rivals = collidesWith.get(row.id);
    const alreadyKeptRival = rivals && kept.some((keptRow) => rivals.has(keptRow.id));
    if (alreadyKeptRival) excluded.push(row.id);
    else kept.push(row);
  }

  return {
    wave,
    takeable: kept.map((row) => row.id),
    runnable: kept.filter((row) => row.state === 'runnable').map((row) => row.id),
    excluded,
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
 * @param {Record<string, { slug: string, readable: boolean }> | null} [input.repos] — a plan
 *   repository's repositories by short name; each pull request then carries the `slug` it was read
 *   from. Ignored on a plan with no `repo` column.
 */
export function boardFor({ slices, prs = [], now = Date.now(), limits, config, prd, repos = null }) {
  const { topic } = prd;
  const featureBranch = fillBranch(config.branches.feature, { topic });
  const live = prs.filter(isLive);
  const acrossRepos = slices.some((slice) => (slice.repo ?? null) !== null);
  const repoOf = (slice) => (acrossRepos ? repos?.[slice.repo] ?? { slug: null, readable: false } : null);

  const matched = slices.map((slice) => {
    const repo = repoOf(slice);
    if (repo && !repo.readable) return null;
    const sliceBranch = fillBranch(config.branches.slice, { topic, slice: slice.id });
    const candidates = live.filter(
      (pr) =>
        pr.headRefName === sliceBranch &&
        (!repo || pr.slug === repo.slug) &&
        matchesFeature(pr, { matchBy: config.board.matchBy, featureBranch, subLabel: config.labels.sub }),
    );
    return pickPr(candidates);
  });

  const mergedById = new Map(slices.map((slice, index) => [slice.id, Boolean(matched[index] && isMerged(matched[index]))]));

  const rows = slices.map((slice, index) => {
    const pr = matched[index];
    const repo = repoOf(slice);
    const rest = { ...slice };
    delete rest.repo;
    const blockersMerged = (slice.blockedBy ?? []).every((blockerId) => mergedById.get(blockerId) === true);
    if (!repo) {
      return { ...rest, pr, state: stateFor({ pr, blockersMerged, now, limits, needsFixLabel: config.labels.needsFix }) };
    }
    const state = repo.readable
      ? stateFor({ pr, blockersMerged, now, limits, needsFixLabel: config.labels.needsFix })
      : 'unreadable';
    return { ...rest, repo: slice.repo, slug: repo.slug, pr, state };
  });

  return { prd: { topic }, slices: rows, frontier: runnableFrontier(rows) };
}
