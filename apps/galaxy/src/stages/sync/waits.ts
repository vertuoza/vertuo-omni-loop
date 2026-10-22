// The waits (PRD 2377, s1): what in a repository waits on a person to ship, whose turn it is and since
// when, as the stages sync records it in public.waits (supabase/migrations/20261226090000_waits.sql).
// s1 computes the two kinds a pull request shows, `review` and `merge`; s2 the other three, `approval`,
// `outbox` and `law` (below). Spec §1:
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
import { foldersOf, type RepoSnapshot, type ServerBorn, type SnapshotPull, type SnapshotReview, type SyncConfig } from './core';
import { lawQuestion } from '../outbox/escalation';
import type { WaitingQuestion } from '../outbox/store';
import type { RecordLine } from 'omni-loop/kit/lib/escalation/comments.ts';
import { parsePrd, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';

/** The five kinds of wait (spec §1). */
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
  /** The GitHub logins of the members the repository's product asks to approve its ◆ PRDs. */
  approvers(workspaceId: string, repository: string): Promise<string[]>;
  /** The open items that wait on a person (human-action or high), stored for each PRD given that has any. */
  outboxes(workspaceId: string, repository: string, prds: readonly PrdNumber[]): Promise<Map<PrdNumber, WaitingQuestion[]>>;
  /** When each PRD given reached stage `prd`; a PRD with none is left out. */
  reached(workspaceId: string, repository: string, prds: readonly PrdNumber[]): Promise<Map<PrdNumber, string>>;
};

/** The kinds `review` and `merge` read a pull request's reviews for. */
const PULL_KINDS: ReadonlySet<WaitKind> = new Set(['review', 'merge']);
const LAW_KINDS: ReadonlySet<WaitKind> = new Set(['law']);

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
  const prd = branchPrd(config, folders, pull, true);
  return prd === null ? null : { prd };
}

/** The PRD a feature PR (and, with `phase0`, a phase-0 PR) of `pull`'s branch belongs to: its folder's topic, else its link line. */
function branchPrd(
  config: SyncConfig, folders: Pick<RepoSnapshot, 'inbox' | 'shipped'>, pull: Pick<SnapshotPull, 'head' | 'body'>, phase0: boolean,
): PrdNumber | null {
  const topics = new Map(foldersOf({ repository: '', config, issues: [], pulls: [], ...folders }).map((f) => [f.topic, f.prd]));
  const shapes = [[config.branches.feature, config.prLinks.feature], ...(phase0 ? [[config.branches.phase0, config.prLinks.phase0]] : [])] as const;
  for (const [shape, link] of shapes) {
    const topic = topicOf(shape, pull.head);
    if (topic === null) continue;
    const prd = topics.get(topic) ?? linkedPrd(link, pull.body);
    if (prd !== null) return prd;
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

/** What a kind makes of a counted pull request: its wait, none, or `unread` when a read it needs failed (its rows stay as they are). */
type Decided = SeenWait | null | 'unread';

/** Walks the pull requests for `kinds`: one not counted (closed, merged, a draft, a sub-PR…) was read and has
 * no wait; a counted one is `decide`d, and covered unless it came back `unread`. */
function walkPulls(
  snapshot: RepoSnapshot, kinds: ReadonlySet<WaitKind>, decide: (pull: SnapshotPull, prd: PrdNumber | null, config: SyncConfig) => Decided,
): PullWaits {
  const { config } = snapshot;
  if (!config) return { waits: [], covers: () => false };
  const waits: SeenWait[] = [];
  const read = new Set<PrNumber>();
  for (const pull of snapshot.pulls) {
    const counted = waitedPull(config, snapshot, pull);
    const wait = counted === null ? null : decide(pull, counted.prd, config);
    if (wait === 'unread') continue;
    read.add(pull.number);
    if (wait) waits.push(wait);
  }
  return { waits, covers: ({ pr, kind }) => pr !== null && kinds.has(kind) && read.has(pr) };
}

/** The `review` and `merge` waits `snapshot`'s pull requests show, `owners` giving each PRD's owner's login. */
export function waitsOfPulls(snapshot: RepoSnapshot, owners: ReadonlyMap<PrdNumber, string>): PullWaits {
  return walkPulls(snapshot, PULL_KINDS, (pull, prd) => (pull.reviews === null ? 'unread' : pullWait(pull, pull.reviews, prd, owners)));
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

/** The logins of `logins` once each, compared in lower case, in order. */
const unique = (logins: readonly string[]) => {
  const seen = new Set<string>();
  return logins.filter((login) => !seen.has(login.toLowerCase()) && seen.add(login.toLowerCase()));
};

/** The PRD of an open draft feature PR into the default branch; null for any other pull request. */
function draftFeature(snapshot: RepoSnapshot, pull: SnapshotPull): PrdNumber | null {
  const { config } = snapshot;
  if (!config || pull.state !== 'open' || !pull.draft || pull.base !== config.defaultBranch) return null;
  return branchPrd(config, snapshot, pull, false);
}

/** An open item that waits on a person: a held law is its own kind, not an outbox item. */
const isItem = (item: WaitingQuestion) => item.question !== lawQuestion(item.id);

/**
 * The `outbox` waits (spec §1): a draft feature PR into the default branch whose PRD has open `high` or
 * `human-action` items. Its turn is the PRD's owner and whoever the escalation record asks about those
 * items; since, the sync that first saw it. Every pull request listed is covered, so a feature PR now
 * ready, closed or with no item left ends its wait.
 */
export function outboxWaits(
  snapshot: RepoSnapshot, outboxes: ReadonlyMap<PrdNumber, readonly WaitingQuestion[]>, owners: ReadonlyMap<PrdNumber, string>, syncedAt: string,
): PullWaits {
  if (!snapshot.config) return { waits: [], covers: () => false };
  const waits: SeenWait[] = [];
  const listed = new Set<PrNumber>();
  for (const pull of snapshot.pulls) {
    listed.add(pull.number);
    const prd = draftFeature(snapshot, pull);
    const items = prd === null ? [] : (outboxes.get(prd) ?? []).filter(isItem);
    if (prd === null || items.length === 0) continue;
    const owner = owners.get(prd);
    waits.push({ prd, pr: pull.number, kind: 'outbox', turn: unique([...(owner === undefined ? [] : [owner]), ...items.flatMap((item) => item.asked ?? [])]), since: syncedAt });
  }
  return { waits, covers: ({ pr, kind }) => pr !== null && kind === 'outbox' && listed.has(pr) };
}

/** When the escalation record first held each law-locked pull request's laws; `null` when it could not be read; absent when it holds none. */
export type HeldSince = ReadonlyMap<PrNumber, string | null>;

/**
 * The `law` waits (spec §1): an open, ready pull request into the default branch whose `law-locked` check
 * is red. Its turn is every owner and delegate `laws.owners` names; since, the escalation record's
 * first-held time (`heldSince`), else the sync that first saw it. A pull request whose record could not
 * be read (`null`) or whose check was not read is left as it is.
 */
export function lawWaits(snapshot: RepoSnapshot, heldSince: HeldSince, syncedAt: string): PullWaits {
  return walkPulls(snapshot, LAW_KINDS, (pull, prd, config) => {
    if (pull.lawLocked === null) return 'unread';
    const held = heldSince.get(pull.number);
    if (pull.lawLocked.length === 0) return null;
    if (held === null) return 'unread';
    return { prd, pr: pull.number, kind: 'law', turn: unique(config.lawOwners), since: held ?? syncedAt };
  });
}

/**
 * The `approval` waits (spec §1): each ◆ PRD not yet approved, asked of the product's approvers (its author
 * left out; the author alone when nobody else is asked), since it reached stage `prd`, else the sync that
 * first saw it. `serverBorn` null (not read) covers nothing.
 */
export function approvalWaits(
  serverBorn: readonly ServerBorn[] | null, approvers: readonly string[], owners: ReadonlyMap<PrdNumber, string>,
  reached: ReadonlyMap<PrdNumber, string>, syncedAt: string,
): PullWaits {
  if (serverBorn === null) return { waits: [], covers: () => false };
  const waits = serverBorn.filter((born) => born.approved_at === null).map(({ prd }): SeenWait => {
    const author = owners.get(prd);
    const asked = unique(approvers.filter((login) => login.toLowerCase() !== author?.toLowerCase()));
    return { prd, pr: null, kind: 'approval', turn: asked.length > 0 || author === undefined ? asked : [author], since: reached.get(prd) ?? syncedAt };
  });
  return { waits, covers: ({ kind }) => kind === 'approval' };
}

/** What a run may add to the pull-request waits. */
export type WaitSources = {
  /** The repository's ◆ PRDs with their first approval; null (the default) when they could not be read. */
  serverBorn?: readonly ServerBorn[] | null;
  /** The escalation record on a PRD's feature PR; null when it carries none. Throws when it cannot be read. */
  record?: (ref: { pr: PrNumber; prd: PrdNumber }) => Promise<RecordLine[] | null>;
};

/** The first time the record held any of `laws`; undefined for none. */
function firstHeld(record: readonly RecordLine[] | null, laws: readonly string[]): string | undefined {
  const times = (record ?? []).filter((line) => line.kind === 'law' && laws.includes(line.thing)).map((line) => line.firstHeld);
  return times.sort((a, b) => at(a) - at(b))[0];
}

/** For each law-locked pull request with a PRD, since when its record holds its laws. */
async function heldSinceOf(snapshot: RepoSnapshot, record: WaitSources['record']): Promise<HeldSince> {
  const held = new Map<PrNumber, string | null>();
  if (!record) return held;
  for (const { pr, prd, laws } of lawLockedPulls(snapshot)) {
    const since = await record({ pr, prd }).then((lines) => firstHeld(lines, laws), () => null);
    if (since !== undefined) held.set(pr, since);
  }
  return held;
}

/** The counted pull requests of a PRD whose `law-locked` check holds laws, with those laws. */
function lawLockedPulls({ config, ...snapshot }: RepoSnapshot): { pr: PrNumber; prd: PrdNumber; laws: string[] }[] {
  if (!config) return [];
  return snapshot.pulls.flatMap((pull) => {
    const prd = waitedPull(config, snapshot, pull)?.prd ?? null;
    return prd === null || !pull.lawLocked?.length ? [] : [{ pr: pull.number, prd, laws: pull.lawLocked }];
  });
}

const sorted = (prds: Iterable<PrdNumber>) => [...new Set(prds)].sort((a, b) => a - b);

/** Computes and records the waits of one repository's snapshot, the five kinds, reading from the store
 * only what a kind needs (owners, approvers, stored items, stages), then writes what changed. Throws what
 * the store throws. */
export async function recordWaits(
  store: WaitStore, workspaceId: string, snapshot: RepoSnapshot, syncedAt: string, sources: WaitSources = {},
): Promise<void> {
  const repository = snapshot.repository.toLowerCase();
  const serverBorn = sources.serverBorn ?? null;
  const unapproved = (serverBorn ?? []).filter((born) => born.approved_at === null).map((born) => born.prd);
  const drafts = sorted(snapshot.pulls.flatMap((pull) => draftFeature(snapshot, pull) ?? []));
  const outboxes = drafts.length === 0 ? new Map<PrdNumber, WaitingQuestion[]>() : await store.outboxes(workspaceId, repository, drafts);
  const merging = waitsOfPulls(snapshot, new Map()).waits.flatMap((w) => (w.kind === 'merge' && w.prd !== null ? [w.prd] : []));
  const asking = [...outboxes].filter(([, items]) => items.some(isItem)).map(([prd]) => prd);
  const needed = sorted([...merging, ...asking, ...unapproved]);
  const owners = needed.length === 0 ? new Map<PrdNumber, string>() : await store.owners(workspaceId, repository, needed);
  const approvers = unapproved.length === 0 ? [] : await store.approvers(workspaceId, repository);
  const reached = unapproved.length === 0 ? new Map<PrdNumber, string>() : await store.reached(workspaceId, repository, sorted(unapproved));
  const heldSince = await heldSinceOf(snapshot, sources.record);

  const parts = [
    waitsOfPulls(snapshot, owners),
    outboxWaits(snapshot, outboxes, owners, syncedAt),
    lawWaits(snapshot, heldSince, syncedAt),
    approvalWaits(serverBorn, approvers, owners, reached, syncedAt),
  ];
  const open = await store.openWaits(workspaceId, repository);
  const changes = reconcileWaits(open, parts.flatMap((part) => part.waits), (wait) => parts.some((part) => part.covers(wait)), syncedAt);
  if (changes.opened.length + changes.refreshed.length + changes.ended.length === 0) return;
  await store.applyWaits(workspaceId, repository, changes, syncedAt);
}
