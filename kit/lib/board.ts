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
 *
 * **Landings.** A PRD whose plan has more than one landing is delivered as one branch per landing
 * (`branches.landing`), each with its own pull request into the default branch, stacked. The board is
 * then handed the ordered landing branches: a slice of landing n matches only a pull request into
 * landing n's branch (in `label` mode, one carrying `labels.sub` **and** targeting that branch), the
 * board reports each landing (its slices merged, open and not started, and the state of its own pull
 * request: `draft`, `ready`, `merged` or `absent`), and names the **current landing**, the
 * lowest-numbered one whose slices are not all merged. The frontier is that landing's only: a slice
 * of a later landing is never takeable early. A PRD of one landing gets no `landings` key and the
 * board it always got.
 */
import type { PrNumber, WorkSliceId } from './ids.ts';
import type { Config } from './types.ts';
import { sameWaveCollisions } from './inbox/territory.ts';

/** A label as `gh pr list --json labels` returns it: a name, or an object carrying one. */
export type PrLabel = string | { name?: string | null | undefined } | null | undefined;

/**
 * One pull request of a `gh pr list` payload, as far as the board reads it. Every field but the
 * head branch is optional: the board reads a missing one as "not known", as it always has.
 */
export type BoardPr = {
  number?: PrNumber | undefined;
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
  id: WorkSliceId;
  title?: string;
  territory: string[];
  /** `null` for a plan with no `wave` column: such a slice is never in the frontier's wave. */
  wave: number | null;
  blockedBy?: WorkSliceId[];
  /** In a plan repository: the short name of the repository the slice lands in. */
  repo?: string | null;
  /** The landing the slice reaches the default branch in; 1 when absent. */
  landing?: number;
};

/** One landing of a PRD, as the board is handed it: its number, its name and its branch. */
export type BoardLanding = { landing: number; name: string; branch: string };

/** The state of a landing's own pull request. */
export type LandingPrState = 'draft' | 'ready' | 'merged' | 'absent';

/** One landing on the board: its slices' counts and its own pull request. */
export type LandingRow = BoardLanding & {
  slices: string[];
  merged: number;
  open: number;
  notStarted: number;
  complete: boolean;
  pr: { number: number | null; state: LandingPrState };
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
export type FrontierRow = { id: WorkSliceId; territory: string[]; wave: number | null; state: string };

/** The wave a person or a wave runner should take next. */
export type Frontier = {
  wave: number | null;
  runnable: WorkSliceId[];
  takeable: WorkSliceId[];
  excluded: WorkSliceId[];
  collisions: ReturnType<typeof sameWaveCollisions>;
};

/** The config sections the board reads: the branch templates as the config declares them. */
export type BoardConfig = {
  branches: Pick<Config['branches'], 'feature' | 'slice'> & { landing?: string };
  board: { matchBy: string };
  labels: { sub: string; needsFix: string };
};

/** A plan repository's repositories by short name. */
export type BoardRepos = Record<string, { slug: string | null; readable: boolean }>;

/** What a branch template's placeholders are filled with. */
type BranchValues = { topic?: string; slice?: WorkSliceId; landing?: number; landings?: number; name?: string };

/** `template` with `{topic}`, `{slice}`, `{landing}`, `{landings}` and `{name}` filled in from
 * `values` — the shape `branches.feature`, `branches.slice` and `branches.landing` are declared in
 * (`kit/lib/config.ts`). A placeholder `values` does not carry is left untouched. Exported so the
 * CLI half can compute the same feature branch name to narrow its own `gh pr list` call. */
export function fillBranch(template: string, values: BranchValues): string {
  return template.replace(/\{(topic|slice|landings|landing|name)\}/g, (whole: string, key: keyof BranchValues) => {
    const value = values[key];
    return value === undefined ? whole : String(value);
  });
}

/**
 * A PRD's landing branches, in order: one landing, named after its plan's, on `branches.feature`, as
 * a PRD always had; more than one, each on `branches.landing` with `{topic}`, `{landing}`,
 * `{landings}` and `{name}` filled.
 */
export function landingBranches(
  branches: { feature: string; landing: string },
  { topic, landings }: { topic: string; landings: readonly { landing: number; name: string }[] },
): BoardLanding[] {
  if (landings.length <= 1) {
    return [{ landing: 1, name: landings[0]?.name ?? 'landing-1', branch: fillBranch(branches.feature, { topic }) }];
  }
  return landings.map(({ landing, name }) => ({
    landing,
    name,
    branch: fillBranch(branches.landing, { topic, landing, landings: landings.length, name }),
  }));
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
function matchesFeature(
  pr: BoardPr,
  { matchBy, featureBranch, subLabel, landed }: { matchBy: string; featureBranch: string; subLabel: string; landed: boolean },
): boolean {
  if (matchBy !== 'label') return pr.baseRefName === featureBranch;
  return hasLabel(pr, subLabel) && (!landed || pr.baseRefName === featureBranch);
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

  const collidesWith = new Map<WorkSliceId, Set<WorkSliceId>>();
  const rivalsOf = (id: WorkSliceId): Set<WorkSliceId> => {
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
  const excluded: WorkSliceId[] = [];
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
 * - `landings` — the PRD's landing branches in order (`landingBranches`); by default its one
 *   landing, on the feature branch. With more than one, the result also carries `landings` and
 *   `currentLanding`, and the frontier is the current landing's.
 */
export function boardFor<S extends BoardSlice>({
  slices,
  prs = [],
  now = Date.now(),
  limits,
  config,
  prd,
  repos = null,
  landings = null,
}: {
  slices: readonly S[];
  prs?: readonly BoardPr[];
  now?: number;
  limits: { claimStaleMinutes: number };
  config: BoardConfig;
  prd: { topic: string };
  repos?: BoardRepos | null;
  landings?: readonly BoardLanding[] | null;
}): { prd: { topic: string }; slices: BoardRow<S>[]; frontier: Frontier; landings?: LandingRow[]; currentLanding?: number | null } {
  const { topic } = prd;
  const ordered = landings ?? [{ landing: 1, name: 'landing-1', branch: fillBranch(config.branches.feature, { topic }) }];
  const landed = ordered.length > 1;
  const branchOf = (slice: S) => ordered.find((entry) => entry.landing === (slice.landing ?? 1))?.branch ?? '';
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
        matchesFeature(pr, { matchBy: config.board.matchBy, featureBranch: branchOf(slice), subLabel: config.labels.sub, landed }),
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

  if (!landed) return { prd: { topic }, slices: rows, frontier: runnableFrontier(rows) };

  const landingRows = ordered.map((entry) => landingRow(entry, { rows, slices, live }));
  const currentLanding = landingRows.find((row) => !row.complete)?.landing ?? null;
  const inCurrent = new Set(slices.filter((slice) => (slice.landing ?? 1) === currentLanding).map((slice) => slice.id));
  return {
    prd: { topic },
    slices: rows,
    frontier: runnableFrontier(rows.filter((row) => inCurrent.has(row.id))),
    landings: landingRows,
    currentLanding,
  };
}

/** States a slice is open in: it has a pull request, not yet merged. */
const OPEN_STATES = new Set<SliceState>(['stuck', 'claimed-stale', 'in-flight']);

/** One landing's row: its slices' counts, and its own pull request read from the payload (the one
 * whose head is the landing's branch). */
function landingRow<S extends BoardSlice>(
  entry: BoardLanding,
  { rows, slices, live }: { rows: readonly BoardRow<S>[]; slices: readonly S[]; live: readonly BoardPr[] },
): LandingRow {
  const ids = slices.filter((slice) => (slice.landing ?? 1) === entry.landing).map((slice) => slice.id);
  const own = rows.filter((row) => ids.includes(row.id));
  const merged = own.filter((row) => row.state === 'merged').length;
  const open = own.filter((row) => OPEN_STATES.has(row.state)).length;
  const pr = pickPr(live.filter((candidate) => candidate.headRefName === entry.branch));
  return {
    ...entry,
    slices: ids,
    merged,
    open,
    notStarted: own.length - merged - open,
    complete: merged === own.length,
    pr: { number: pr?.number ?? null, state: landingPrState(pr) },
  };
}

/** A landing pull request's state: merged, draft, ready (open and not a draft), or absent. */
function landingPrState(pr: BoardPr | null): LandingPrState {
  if (!pr) return 'absent';
  if (isMerged(pr)) return 'merged';
  return pr.isDraft ? 'draft' : 'ready';
}
