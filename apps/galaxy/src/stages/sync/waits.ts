// The waits (PRD 2377, s1): what in a repository waits on a person to ship, whose turn it is and since
// when, as the stages sync records it in public.waits (supabase/migrations/20261224090000_waits.sql).
// This slice computes the two kinds a pull request shows, `review` and `merge` (spec §1):
//
// - The pull requests counted are open, ready (not draft) and into the default branch: a feature PR or a
//   phase-0 PR whose PRD is known (its folder's topic, else the link line its body carries), or a bug fix
//   or visual update (`labels.bug`, `labels.visual`), which has no PRD. A sub-PR goes into its feature
//   branch, so it never counts.
// - `review`: no standing review approves it, nor asks for changes, or a review was asked again after
//   the last that did. Its turn is the reviewers asked (logins and `org/team`s; none, "any approver"),
//   since it was last marked ready or asked for review again, else since it was opened.
// - `merge`: a standing review approves it, none asks for changes, and no check run failed. Its turn is
//   the PRD's owner (who opened its dossier); with none, whoever approved it; with neither, "anyone who
//   can merge" (empty). Since the latest approval.
// - A pull request whose latest decisive review asked for changes waits on its author: no wait.
//
// Then they are kept as a stage is (spec §2): a wait still seen keeps its `since` and moves its `turn` and
// `seen_at`; one no longer seen is ended, never deleted; one seen again after it ended is a new row. Only
// what the run read is ever ended: a pull request the run did not list (unchanged since the last sync),
// or whose reviews could not be read, keeps its open rows as they are.
import { foldersOf, type RepoSnapshot, type SnapshotPull, type SnapshotReview, type SyncConfig } from './core';
import { parsePrd, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';

/** The five kinds of wait (spec §1); this slice computes `review` and `merge`. */
export const WAIT_KINDS = ['approval', 'outbox', 'law', 'review', 'merge'] as const;
export type WaitKind = (typeof WAIT_KINDS)[number];

/** A wait the sync saw: its PRD (null for a bug fix or visual update), its pull request (null for an
 * `approval`), its kind, whose turn it is (empty: anyone) and when it began. */
export type SeenWait = { prd: PrdNumber | null; pr: PrNumber | null; kind: WaitKind; turn: string[]; since: string };
/** An open wait as stored: its row's id and the last sync that saw it. */
export type StoredWait = SeenWait & { id: string; seen_at: string };
/** What a run changes: the waits it opens, the open ones it saw again, and the ids of those it ends. */
export type WaitChanges = { opened: (SeenWait & { seen_at: string })[]; refreshed: StoredWait[]; ended: string[] };

/** The one way into the stored waits (./waits.repository.ts; ./waits.fake.ts in the tests). */
export type WaitStore = {
  /** The repository's open waits in the workspace. */
  openWaits(workspaceId: string, repository: string): Promise<StoredWait[]>;
  /** Writes a run's changes: the ended ones ended at `at`, the refreshed ones' turn and seen_at, the new rows. */
  applyWaits(workspaceId: string, repository: string, changes: WaitChanges, at: string): Promise<void>;
  /** The GitHub login of the owner (who opened its dossier) of each PRD given that has one. */
  owners(workspaceId: string, repository: string, prds: readonly PrdNumber[]): Promise<Map<PrdNumber, string>>;
};

/** The kinds a pull request's waits are computed from in this slice. */
const PULL_KINDS: ReadonlySet<WaitKind> = new Set(['review', 'merge']);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The topic a branch of `shape` names, or null when it is not one: `{topic}` is the topic, any other placeholder one segment. */
function topicOf(shape: string, branch: string): string | null {
  const parts = shape.split(/(\{\w+\})/).map((part) => {
    if (part === '{topic}') return '(?<topic>.+)';
    return /^\{\w+\}$/.test(part) ? '[^/]+' : escape(part);
  });
  return new RegExp(`^${parts.join('')}$`).exec(branch)?.groups?.topic ?? null;
}

/** The PRD a body's link line names through `template` (`Closes #{prd}`), or null. */
function linkedPrd(template: string, body: string | null): PrdNumber | null {
  const [before = '', after = ''] = template.split('{prd}');
  const found = new RegExp(`${escape(before)}(\\d+)\\b${escape(after)}`).exec(body ?? '')?.[1];
  return found === undefined ? null : parsePrd(Number(found));
}

type Counted = { prd: PrdNumber | null };

/**
 * Whether the waits count `pull`, and its PRD: an open, ready pull request into the default branch that
 * is a bug fix or visual update (no PRD), or a feature or phase-0 PR whose PRD is known. Null otherwise.
 * The reader (./github.ts) asks it before reading a pull request's reviews and checks.
 */
export function waitedPull(
  config: SyncConfig, folders: Pick<RepoSnapshot, 'inbox' | 'shipped'>, pull: Pick<SnapshotPull, 'state' | 'draft' | 'base' | 'head' | 'labels' | 'body'>,
): Counted | null {
  if (pull.state !== 'open' || pull.draft || pull.base !== config.defaultBranch) return null;
  if (pull.labels.includes(config.labels.bug) || pull.labels.includes(config.labels.visual)) return { prd: null };
  const topics = new Map(foldersOf({ repository: '', config, issues: [], pulls: [], ...folders }).map((f) => [f.topic, f.prd]));
  for (const [shape, link] of [[config.branches.feature, config.prLinks.feature], [config.branches.phase0, config.prLinks.phase0]] as const) {
    const topic = topicOf(shape, pull.head);
    if (topic === null) continue;
    const prd = topics.get(topic) ?? linkedPrd(link, pull.body);
    if (prd !== null) return { prd };
  }
  return null;
}

const DECISIVE: ReadonlySet<string> = new Set(['APPROVED', 'CHANGES_REQUESTED']);
/** The review states that say where their author stands; a comment alone leaves it as it was. */
const STANDING: ReadonlySet<string> = new Set([...DECISIVE, 'DISMISSED']);

const at = (time: string | null | undefined) => (time ? Date.parse(time) : Number.NEGATIVE_INFINITY);
const latest = (times: readonly (string | null)[]) =>
  times.filter((t): t is string => t !== null).sort((a, b) => at(a) - at(b)).at(-1) ?? null;

/** Where a pull request's reviews stand: each author's latest approval, request for changes or dismissal. */
type Standing = { approvals: SnapshotReview[]; changesAsked: boolean; lastDecided: string | null };

function standingOf(reviews: readonly SnapshotReview[]): Standing {
  const standing = new Map<string | null, SnapshotReview>();
  for (const review of [...reviews].sort((a, b) => at(a.submitted_at) - at(b.submitted_at))) {
    if (STANDING.has(review.state)) standing.set(review.login, review);
  }
  const decisive = [...standing.values()].filter((r) => DECISIVE.has(r.state));
  return {
    approvals: decisive.filter((r) => r.state === 'APPROVED'),
    changesAsked: decisive.some((r) => r.state === 'CHANGES_REQUESTED'),
    lastDecided: latest(decisive.map((r) => r.submitted_at)),
  };
}

/** What a counted pull request waits for: a review, a merge, or nothing (its author: changes asked, or a red check after approval). */
function waitingFor(pull: SnapshotPull, { approvals, changesAsked, lastDecided }: Standing): 'review' | 'merge' | null {
  if (lastDecided !== null && at(pull.requested_at) > at(lastDecided)) return 'review';
  if (changesAsked) return null;
  if (approvals.length === 0) return 'review';
  return pull.checksRed === true ? null : 'merge';
}

/** The review or merge wait of one counted pull request whose reviews were read, or null when it waits on its author. */
function pullWait(pull: SnapshotPull, reviews: readonly SnapshotReview[], prd: PrdNumber | null, owners: ReadonlyMap<PrdNumber, string>): SeenWait | null {
  const standing = standingOf(reviews);
  const kind = waitingFor(pull, standing);
  if (kind === 'review') return { prd, pr: pull.number, kind, turn: [...pull.requested], since: latest([pull.ready_at, pull.requested_at]) ?? pull.created_at };
  if (kind === null) return null;
  const approvers = [...new Set(standing.approvals.map((r) => r.login).filter((login): login is string => login !== null))];
  const owner = prd === null ? undefined : owners.get(prd);
  return { prd, pr: pull.number, kind, turn: owner === undefined ? approvers : [owner], since: latest(standing.approvals.map((r) => r.submitted_at)) ?? pull.created_at };
}

/** A repository's pull-request waits, and which stored waits the run read well enough to end. */
export type PullWaits = { waits: SeenWait[]; covers: (wait: Pick<SeenWait, 'pr' | 'kind'>) => boolean };

/** The `review` and `merge` waits `snapshot`'s pull requests show, `owners` giving each PRD's owner's login. */
export function waitsOfPulls(snapshot: RepoSnapshot, owners: ReadonlyMap<PrdNumber, string>): PullWaits {
  const { config } = snapshot;
  if (!config) return { waits: [], covers: () => false };
  const waits: SeenWait[] = [];
  const read = new Set<PrNumber>();
  for (const pull of snapshot.pulls) {
    const counted = waitedPull(config, snapshot, pull);
    if (counted === null) {
      read.add(pull.number);
      continue;
    }
    if (pull.reviews === null) continue;
    read.add(pull.number);
    const wait = pullWait(pull, pull.reviews, counted.prd, owners);
    if (wait) waits.push(wait);
  }
  return { waits, covers: ({ pr, kind }) => pr !== null && PULL_KINDS.has(kind) && read.has(pr) };
}

/** A wait's identity: its PRD, its pull request and its kind. */
const keyOf = ({ prd, pr, kind }: Pick<SeenWait, 'prd' | 'pr' | 'kind'>) => `${prd ?? ''}|${pr ?? ''}|${kind}`;

/** What a run changes in the open waits: each seen one refreshed (its since kept) or opened, each covered
 * one no longer seen ended; one the run does not cover is left as it is. */
export function reconcileWaits(
  open: readonly StoredWait[], seen: readonly SeenWait[], covers: (wait: StoredWait) => boolean, syncedAt: string,
): WaitChanges {
  const stored = new Map(open.map((wait) => [keyOf(wait), wait]));
  const changes: WaitChanges = { opened: [], refreshed: [], ended: [] };
  const kept = new Set<string>();
  for (const wait of seen) {
    const key = keyOf(wait);
    if (kept.has(key)) continue;
    kept.add(key);
    const was = stored.get(key);
    if (was) changes.refreshed.push({ ...was, turn: [...wait.turn], seen_at: syncedAt });
    else changes.opened.push({ ...wait, seen_at: syncedAt });
  }
  for (const wait of open) if (!kept.has(keyOf(wait)) && covers(wait)) changes.ended.push(wait.id);
  return changes;
}

/** Computes and records the pull-request waits of one repository's snapshot: reads the owners of the PRDs
 * a merge waits on (none read when none does), then writes what changed. Throws what the store throws. */
export async function recordWaits(store: WaitStore, workspaceId: string, snapshot: RepoSnapshot, syncedAt: string): Promise<void> {
  const repository = snapshot.repository.toLowerCase();
  const merging = [...new Set(waitsOfPulls(snapshot, new Map()).waits
    .filter((w) => w.kind === 'merge' && w.prd !== null).map((w) => w.prd))]
    .filter((prd): prd is PrdNumber => prd !== null).sort((a, b) => a - b);
  const owners = merging.length === 0 ? new Map<PrdNumber, string>() : await store.owners(workspaceId, repository, merging);
  const { waits, covers } = waitsOfPulls(snapshot, owners);
  const open = await store.openWaits(workspaceId, repository);
  const changes = reconcileWaits(open, waits, covers, syncedAt);
  if (changes.opened.length + changes.refreshed.length + changes.ended.length === 0) return;
  await store.applyWaits(workspaceId, repository, changes, syncedAt);
}
