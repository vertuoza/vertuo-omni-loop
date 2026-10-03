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
 * only `kit/bin/commands/board.ts` calls `gh` and the system clock. That is also the whole test
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
 * `kit/lib/inbox/territory.ts`) may not both be taken: the plan's own order decides which one is
 * — the earlier slice is kept and the later one deferred — rather than dropping both, so one
 * colliding pair costs the wave a single slice, not two.
 */
import { sameWaveCollisions } from './inbox/territory.ts';

/** A label as `gh pr list --json labels` returns it: a name, or an object carrying one. */
export type PrLabel = string | { name?: string | null | undefined } | null | undefined;

/**
 * One pull request of a `gh pr list` payload, as far as the board reads it. Every field but the
 * head branch is optional: the board reads a missing one as "not known", as it always has.
 */
export type BoardPr = {
  number?: number | undefined;
  title?: string | undefined;
  headRefName?: string | undefined;
  baseRefName?: string | undefined;
  state?: string | undefined;
  isDraft?: boolean | undefined;
  mergedAt?: string | null | undefined;
  body?: string | undefined;
  labels?: readonly PrLabel[] | null | undefined;
  updatedAt?: string | undefined;
  createdAt?: string | null | undefined;
  /** The head commit's own date, when known. */
  headCommitDate?: string | null | undefined;
  /** In a plan repository: the repository the pull request was read from. */
  slug?: string | null | undefined;
};

/** One slice of the plan, as the board reads it. */
export type BoardSlice = {
  id: string;
  title?: string;
  territory: string[];
  /** `null` for a plan with no `wave` column: such a slice is never in the frontier's wave. */
  wave: number | null;
  blockedBy?: string[];
  /** In a plan repository: the short name of the repository the slice lands in. */
  repo?: string | null;
};

/** A slice's state on the board, in the order it is decided. */
export type SliceState = 'merged' | 'stuck' | 'claimed-stale' | 'in-flight' | 'runnable' | 'blocked' | 'unreadable';

/** One row of the board: the slice (less its `repo`), its matched pull request and its state. */
export type BoardRow<S extends BoardSlice = BoardSlice> = Omit<S, 'repo'> & {
  pr: BoardPr | null;
  state: SliceState;
  repo?: string | null | undefined;
  slug?: string | null | undefined;
};

/** What the board's frontier reads of a row. */
export type FrontierRow = { id: string; territory: string[]; wave: number | null; state: string };

/** The wave a person or a wave runner should take next. */
export type Frontier = {
  wave: number | null;
  runnable: string[];
  takeable: string[];
  excluded: string[];
  collisions: ReturnType<typeof sameWaveCollisions>;
};

/** The config sections the board reads. */
export type BoardConfig = {
  branches: { feature: string; slice: string };
  board: { matchBy: string };
  labels: { sub: string; needsFix: string };
};

/** A plan repository's repositories by short name. */
export type BoardRepos = Record<string, { slug: string | null; readable: boolean }>;

/** `template` with `{topic}` and `{slice}` filled in from `values` — the same shape
 * `branches.feature` and `branches.slice` are declared in (`kit/lib/config.ts`). A placeholder
 * `values` does not carry is left untouched. Exported so the CLI half can compute the same feature
 * branch name to narrow its own `gh pr list` call. */
export function fillBranch(template: string, values: { topic?: string; slice?: string }): string {
  return template.replace(/\{(topic|slice)\}/g, (whole: string, key: 'topic' | 'slice') => (values[key] ?? whole));
}

/** Merged, by whichever shape a pull-request-list payload happens to carry. */
function isMerged(pr: BoardPr): boolean {
  return pr.state === 'MERGED' || Boolean(pr.mergedAt);
}

/** A pull request worth matching at all: merged, or still open. A closed-and-never-merged pull
 * request is a dropped claim — it must not shadow the slice it once claimed. */
function isLive(pr: BoardPr): boolean {
  return isMerged(pr) || pr.state === 'OPEN';
}

/** Whether `pr` carries a label named `name`, in either shape `gh pr list --json labels` returns
 * (an array of strings, or of `{ name }` objects). */
function hasLabel(pr: BoardPr, name: string): boolean {
  return (pr.labels ?? []).some((label) => (typeof label === 'string' ? label : label?.name) === name);
}

/** Whether `matchBy` accepts `pr` as belonging to this feature at all — the coarse filter applied
 * before the fine one (the head branch, which is what actually ties a pull request to one slice). */
function matchesFeature(pr: BoardPr, { matchBy, featureBranch, subLabel }: { matchBy: string; featureBranch: string; subLabel: string }): boolean {
  return matchBy === 'label' ? hasLabel(pr, subLabel) : pr.baseRefName === featureBranch;
}

/** A date's time, or `NaN` for a missing one — exactly what `new Date(undefined)` reads as. */
function timeOf(date: string | null | undefined): number {
  return date === undefined ? Number.NaN : new Date(date ?? 0).getTime();
}

/** The one pull request a slice's candidates resolve to: a merged one over an open one, and the
 * most recently updated among ties — `null` when there are no candidates at all. */
function pickPr(candidates: BoardPr[]): BoardPr | null {
  if (candidates.length === 0) return null;
  const merged = candidates.filter(isMerged);
  const pool = merged.length > 0 ? merged : candidates;
  return pool.reduce<BoardPr | null>((best, pr) => {
    if (!best) return pr;
    return timeOf(pr.updatedAt) > timeOf(best.updatedAt) ? pr : best;
  }, null);
}

/** Whether `pr`'s head carries a commit later than the claim that opened it — read from the head
 * commit's date against the pull request's own `createdAt`. Unknown (either date missing) reads as
 * "yes, assume it has moved on": this module will not call a claim stale on a signal it never
 * actually saw. */
function hasCommitBeyondClaim(pr: Pick<BoardPr, 'headCommitDate' | 'createdAt'>): boolean {
  if (!pr.headCommitDate || !pr.createdAt) return true;
  return new Date(pr.headCommitDate).getTime() > new Date(pr.createdAt).getTime();
}

/** A claim gone cold: a draft that has moved no further than the commit it was claimed with, and
 * whose claim itself (`createdAt`) is older than `staleMinutes`. Never reads `updatedAt` — a
 * comment or a label change updates that field without moving the branch at all, which would let a
 * genuinely cold claim keep reading as fresh. Exported so the Engineering board's Loop health panel
 * (PRD 714) calls the kit's own rule, and it and `omni board` always agree. */
export function isClaimedStale(pr: Pick<BoardPr, 'isDraft' | 'createdAt' | 'headCommitDate'>, now: number, staleMinutes: number): boolean {
  if (!pr.isDraft) return false;
  if (hasCommitBeyondClaim(pr)) return false;
  const ageMs = now - timeOf(pr.createdAt);
  return ageMs > staleMinutes * 60 * 1000;
}

/** One slice's state, given its matched pull request (or `null`) and whether every slice it is
 * blocked by is already merged. */
function stateFor({
  pr,
  blockersMerged,
  now,
  limits,
  needsFixLabel,
}: {
  pr: BoardPr | null;
  blockersMerged: boolean;
  now: number;
  limits: { claimStaleMinutes: number };
  needsFixLabel: string;
}): SliceState {
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
 */
export function runnableFrontier(rows: readonly FrontierRow[]): Frontier {
  const takeableRows = rows.filter((row) => TAKEABLE_STATES.has(row.state));
  if (takeableRows.length === 0) return { wave: null, runnable: [], takeable: [], excluded: [], collisions: [] };

  // A wave read as `Math.min` reads it: `null` counts as 0, though no row of wave `null` is in it.
  const wave = Math.min(...takeableRows.map((row) => Number(row.wave)));
  const inWave = takeableRows.filter((row) => row.wave === wave);
  const collisions = sameWaveCollisions(inWave);

  const collidesWith = new Map<string, Set<string>>();
  const rivalsOf = (id: string): Set<string> => {
    let rivals = collidesWith.get(id);
    if (!rivals) {
      rivals = new Set();
      collidesWith.set(id, rivals);
    }
    return rivals;
  };
  for (const { left, right } of collisions) {
    const leftRivals = rivalsOf(left);
    const rightRivals = rivalsOf(right);
    leftRivals.add(right);
    rightRivals.add(left);
  }

  const kept: FrontierRow[] = [];
  const excluded: string[] = [];
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
 * - `slices` — from `parsePlanSlices` (`kit/lib/inbox/territory.ts`), each widened with its own
 *   `blocked by` ids (that module deliberately reads `id`, `slice`, `territory` and `wave` only —
 *   the CLI half reads `blocked by` itself, the same narrow way `omni plan check` already does).
 * - `prs` — a `gh pr list` payload: `number`, `title`, `headRefName`, `baseRefName`, `state`,
 *   `isDraft`, `mergedAt`, `body`, `labels`, `updatedAt`, `createdAt` and `headCommitDate` (the
 *   head commit's own date, when known).
 * - `now` — milliseconds since epoch; defaults to the real clock. This is the only place this
 *   module reads one.
 * - `prd.topic` is the PRD folder's own topic (`kit/lib/layout.ts`'s `parseFolderName`), which
 *   fills `{topic}` in the branch templates.
 * - `repos` — a plan repository's repositories by short name; each pull request then carries the
 *   `slug` it was read from. Ignored on a plan with no `repo` column.
 */
export function boardFor<S extends BoardSlice>({
  slices,
  prs = [],
  now = Date.now(),
  limits,
  config,
  prd,
  repos = null,
}: {
  slices: readonly S[];
  prs?: readonly BoardPr[];
  now?: number;
  limits: { claimStaleMinutes: number };
  config: BoardConfig;
  prd: { topic: string };
  repos?: BoardRepos | null;
}): { prd: { topic: string }; slices: BoardRow<S>[]; frontier: Frontier } {
  const { topic } = prd;
  const featureBranch = fillBranch(config.branches.feature, { topic });
  const live = prs.filter(isLive);
  const acrossRepos = slices.some((slice) => (slice.repo ?? null) !== null);
  // `String(slice.repo)` is the key JavaScript itself would look up for a missing repo name.
  const repoOf = (slice: S) => (acrossRepos ? repos?.[String(slice.repo)] ?? { slug: null, readable: false } : null);

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

  const mergedById = new Map(
    slices.map((slice, index) => {
      const pr = matched[index];
      return [slice.id, Boolean(pr && isMerged(pr))];
    }),
  );

  const rows = slices.map((slice, index): BoardRow<S> => {
    const pr = matched[index] ?? null;
    const repo = repoOf(slice);
    // The row carries its own `repo` (below), or none: never the slice's raw one.
    const rest: Omit<S, 'repo'> & { repo?: string | null } = { ...slice };
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
