// Where an Omni Loop bug stands once its fix leaves the team's hands (PRD 3088 s4): the App moves a bug's `state` from the
// Omni Loop repository's `pull_request`, `issues` and `release` deliveries, and a sweep reaches the same states when a
// delivery was missed. Nothing here calls GitHub or the database: both are ports (`BugTeamStore`, `BugGithub`), whose live
// sides are ./store.ts and ./github.ts.
//
//   fix pull request merged, closing the bug's issue   merged, with `fix_pr`
//   a release whose tag holds that merge commit        fixed, with `fixed_in` (the first such release, 0.0.N)
//   issue closed as not planned                        wont-fix
//   issue reopened (from merged, fixed or wont-fix)    open
//   fix pull request closed unmerged                   open
//
// A state only moves forward on the evidence it is given: a fixed bug stays fixed unless its issue is reopened, and a bug
// the team has not filed (no row) is never invented. Nothing in a bug row names a workspace, a repository of a customer or a
// login (L-GDPR-1, L-GDPR-2): the repository is the Omni Loop's own.
import { IssueNumberSchema, PrNumberSchema, type IssueNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { z } from 'zod';
import type { NewJob } from '../jobs/ledger.ts';
import { OMNI_LOOP_REPOSITORY } from './file.ts';

/** Where the bug team stands on a bug (supabase/migrations/20270127100000_omni_bug_team.sql). */
export const BUG_STATES = ['open', 'fixing', 'pr-opened', 'asked', 'merged', 'fixed', 'wont-fix'] as const;
export type BugState = (typeof BUG_STATES)[number];

/** A bug as the following reads it. */
export type TeamBug = { fingerprint: string; repo: string; issue: IssueNumber; state: BugState; fixPr: PrNumber | null; fixedIn: string | null };

/** What a following writes on a bug: its state, and the two facts that go with it. */
export type BugPatch = { state: BugState; fixPr?: PrNumber | null; fixedIn?: string | null };

/** `omni_bug_reports`, as the following reads and writes it. */
export type BugTeamStore = {
  /** The bug filed as the issue, or none. */
  byIssue: (repo: string, issue: IssueNumber) => Promise<TeamBug | null>;
  /** The bug whose fix pull request is `pr`, or none. */
  byFixPr: (repo: string, pr: PrNumber) => Promise<TeamBug | null>;
  /** Every bug in one of the states. */
  inStates: (states: readonly BugState[]) => Promise<TeamBug[]>;
  /** Writes the patch if the bug still is in `from` (another run may have moved it): whether it did. */
  move: (bug: TeamBug, patch: BugPatch) => Promise<boolean>;
};

/** The issue the sweep reads. */
export type IssueFacts = { open: boolean; notPlanned: boolean };
/** The fix pull request the sweep reads. */
export type PullFacts = { merged: boolean; open: boolean; mergeCommit: string | null };

/** The Omni Loop repository on GitHub, as the Omni App. */
export type BugGithub = {
  issue: (repo: string, issue: IssueNumber) => Promise<IssueFacts>;
  pull: (repo: string, pr: PrNumber) => Promise<PullFacts>;
  /** The tags of the repository's releases, newest first. */
  releases: (repo: string) => Promise<string[]>;
  /** Whether the commit is in the tag's history. */
  holds: (repo: string, sha: string, tag: string) => Promise<boolean>;
};

// ── The events ──────────────────────────────────────────────────────────────────

/** What a delivery says about a bug. */
export type BugEvent =
  | { kind: 'merged'; issue: IssueNumber; pr: PrNumber }
  | { kind: 'pr-closed'; pr: PrNumber }
  | { kind: 'not-planned'; issue: IssueNumber }
  | { kind: 'reopened'; issue: IssueNumber }
  | { kind: 'released'; tag: string };

export const BUG_FOLLOW_KIND = 'bug-follow';
/** One following at a time, so two deliveries of one bug never race. */
const BUG_FOLLOW_LANE = 'bug-follow';


const BugEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('merged'), issue: IssueNumberSchema, pr: PrNumberSchema }),
  z.object({ kind: z.literal('pr-closed'), pr: PrNumberSchema }),
  z.object({ kind: z.literal('not-planned'), issue: IssueNumberSchema }),
  z.object({ kind: z.literal('reopened'), issue: IssueNumberSchema }),
  z.object({ kind: z.literal('released'), tag: z.string().min(1) }),
]);

/** The payload of a `bug-follow` job. */
export const BugFollowDataSchema = z.object({ event: BugEventSchema, delivery: z.string().min(1) });

const DeliverySchema = z.looseObject({
  action: z.string().nullish(),
  repository: z.looseObject({ full_name: z.string().nullish() }).nullish(),
  issue: z.looseObject({ number: IssueNumberSchema, state_reason: z.string().nullish(), pull_request: z.unknown().optional() }).nullish(),
  pull_request: z.looseObject({ number: PrNumberSchema, merged: z.boolean().nullish(), body: z.string().nullish() }).nullish(),
  release: z.looseObject({ tag_name: z.string().nullish(), draft: z.boolean().nullish(), prerelease: z.boolean().nullish() }).nullish(),
});

/** The issues a pull request body closes (`Closes #12`, `fixes #12`, `Resolved #12`). */
const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi;
export function closedIssues(body: string | null | undefined): IssueNumber[] {
  if (!body) return [];
  return [...body.matchAll(CLOSING)].flatMap((found) => { const n = IssueNumberSchema.safeParse(Number(found[1])); return n.success ? [n.data] : []; });
}

/**
 * The delivery's events, pure: only the Omni Loop repository's own (`repo`) says anything about a bug. A merged pull
 * request becomes one `merged` per issue it closes, an unmerged close a `pr-closed`, an issue closed as not planned a
 * `not-planned`, a reopened one a `reopened`, a published release (not a draft, not a prerelease) a `released`.
 */
export function toBugEvents(event: string, delivery: unknown, repo: string = OMNI_LOOP_REPOSITORY): BugEvent[] {
  const read = DeliverySchema.safeParse(delivery);
  if (!read.success || read.data.repository?.full_name?.toLowerCase() !== repo.toLowerCase()) return [];
  const { action } = read.data;
  if (event === 'pull_request') return action === 'closed' ? pullEvents(read.data.pull_request) : [];
  if (event === 'issues') return issueEvents(action, read.data.issue);
  if (event === 'release') return action === 'published' ? releaseEvents(read.data.release) : [];
  return [];
}

type Delivery = z.infer<typeof DeliverySchema>;

/** A closed pull request: one `merged` per issue it closes, or, unmerged, a `pr-closed` when it names an issue to close (any other close is no news; the sweep reads the rest). */
function pullEvents(pull: Delivery['pull_request']): BugEvent[] {
  if (!pull) return [];
  const closed = closedIssues(pull.body);
  if (pull.merged === true) return closed.map((issue) => ({ kind: 'merged', issue, pr: pull.number }));
  return closed.length > 0 ? [{ kind: 'pr-closed', pr: pull.number }] : [];
}

/** An issue (not a pull request seen as one) closed as not planned, or reopened. */
function issueEvents(action: string | null | undefined, issue: Delivery['issue']): BugEvent[] {
  if (!issue || issue.pull_request !== undefined) return [];
  if (action === 'closed') return issue.state_reason === 'not_planned' ? [{ kind: 'not-planned', issue: issue.number }] : [];
  return action === 'reopened' ? [{ kind: 'reopened', issue: issue.number }] : [];
}

/** A published release that is neither a draft nor a prerelease. */
function releaseEvents(release: Delivery['release']): BugEvent[] {
  if (!release?.tag_name || release.draft === true || release.prerelease === true) return [];
  return [{ kind: 'released', tag: release.tag_name }];
}

const eventKey = (event: BugEvent): string => {
  switch (event.kind) {
    case 'merged': return `merged:${String(event.issue)}:${String(event.pr)}`;
    case 'pr-closed': return `pr-closed:${String(event.pr)}`;
    case 'not-planned': return `not-planned:${String(event.issue)}`;
    case 'reopened': return `reopened:${String(event.issue)}`;
    case 'released': return `released:${event.tag}`;
  }
};

/** The `bug-follow` jobs of a delivery: one per event, keyed by the delivery so a delivery GitHub sends twice is one job. */
export function toBugJobs(event: string, delivery: unknown, deliveryId: string, repo: string = OMNI_LOOP_REPOSITORY): NewJob[] {
  return toBugEvents(event, delivery, repo).map((one) => ({
    kind: BUG_FOLLOW_KIND,
    key: `${BUG_FOLLOW_KIND}:${deliveryId}:${eventKey(one)}`,
    subject: repo,
    payload: { event: one, delivery: deliveryId },
    lane: BUG_FOLLOW_LANE,
    maxTries: 4,
  }));
}

// ── The states ──────────────────────────────────────────────────────────────────

/** A tag `v0.0.N` as the version `0.0.N` the database keeps, or none. */
export function versionOf(tag: string): string | null {
  const found = /^v((?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5}))$/.exec(tag);
  return found?.[1] ?? null;
}

/** Orders two versions `a.b.c`. */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((version) => version.split('.').map(Number));
  for (let i = 0; i < 3; i += 1) {
    const diff = (x?.[i] ?? 0) - (y?.[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const TERMINAL: ReadonlySet<BugState> = new Set(['fixed', 'wont-fix']);
const REOPENABLE: ReadonlySet<BugState> = new Set(['merged', 'fixed', 'wont-fix']);

type Followed1 = Exclude<BugEvent, { kind: 'released' }>;

const mergedPatch = (bug: TeamBug, pr: PrNumber): BugPatch | null => (TERMINAL.has(bug.state) ? null : { state: 'merged', fixPr: pr });
const prClosedPatch = (bug: TeamBug, pr: PrNumber): BugPatch | null => (bug.state === 'pr-opened' && bug.fixPr === pr ? { state: 'open', fixPr: null } : null);
const notPlannedPatch = (bug: TeamBug): BugPatch | null => (TERMINAL.has(bug.state) ? null : { state: 'wont-fix' });
const reopenedPatch = (bug: TeamBug): BugPatch | null => (REOPENABLE.has(bug.state) ? { state: 'open', fixPr: null, fixedIn: null } : null);

/** What an event does to a bug, pure: the patch, or none when the bug stays as it is. */
function patchFor(bug: TeamBug, event: Followed1): BugPatch | null {
  switch (event.kind) {
    case 'merged': return mergedPatch(bug, event.pr);
    case 'pr-closed': return prClosedPatch(bug, event.pr);
    case 'not-planned': return notPlannedPatch(bug);
    case 'reopened': return reopenedPatch(bug);
  }
}

/**
 * The first of `tags` (oldest first) whose release holds the bug's merge commit: its version, or none. A tag that is no
 * `v0.0.N` is no kit release and is skipped.
 */
async function firstReleaseHolding({ github, repo, mergeCommit, tags }: { github: BugGithub; repo: string; mergeCommit: string; tags: readonly string[] }): Promise<string | null> {
  const versions = tags.flatMap((tag) => {
    const version = versionOf(tag);
    return version ? [{ tag, version }] : [];
  });
  versions.sort((a, b) => compareVersions(a.version, b.version));
  for (const { tag, version } of versions) if (await github.holds(repo, mergeCommit, tag)) return version;
  return null;
}

/** Turns a merged bug `fixed` when one of `tags` holds its merge commit; whether it did. */
async function release({ bug, tags, store, github }: { bug: TeamBug; tags: readonly string[]; store: BugTeamStore; github: BugGithub }): Promise<boolean> {
  if (bug.state !== 'merged' || bug.fixPr === null) return false;
  const { mergeCommit } = await github.pull(bug.repo, bug.fixPr);
  if (!mergeCommit) return false;
  const fixedIn = await firstReleaseHolding({ github, repo: bug.repo, mergeCommit, tags });
  return fixedIn === null ? false : store.move(bug, { state: 'fixed', fixedIn });
}

/** What following an event did. */
export type Followed = { moved: number };

/** Follows one event: the bug it names moves, or none does. A release moves every merged bug it holds. */
export async function followBugEvent({ event, repo = OMNI_LOOP_REPOSITORY, store, github }: { event: BugEvent; repo?: string; store: BugTeamStore; github: BugGithub }): Promise<Followed> {
  if (event.kind === 'released') {
    let moved = 0;
    for (const bug of await store.inStates(['merged'])) if (await release({ bug, tags: [event.tag], store, github })) moved += 1;
    return { moved };
  }
  const bug = event.kind === 'pr-closed' ? await store.byFixPr(repo, event.pr) : await store.byIssue(repo, event.issue);
  const patch = bug ? patchFor(bug, event) : null;
  return { moved: bug && patch && (await store.move(bug, patch)) ? 1 : 0 };
}

// ── The sweep ───────────────────────────────────────────────────────────────────

/** What a sweep did, in counts only. */
export type BugSweep = { read: number; moved: number };

/** The states a sweep reads: every one a missed delivery could still move. `fixed` is final, short of a reopening it does not see. */
const SWEPT: readonly BugState[] = ['fixing', 'pr-opened', 'asked', 'merged', 'wont-fix'];

/** What a pull request says of a bug that waits on it, pure: merged once its issue is closed, open again once it was closed unmerged. */
function pullPatch(bug: TeamBug, issue: IssueFacts, pull: PullFacts | null): BugPatch | null {
  if (!pull || bug.fixPr === null) return null;
  if (pull.merged) return issue.open ? null : { state: 'merged', fixPr: bug.fixPr };
  return pull.open ? null : { state: 'open', fixPr: null };
}

/** What the issue and the fix pull request say of a bug, pure: the patch they call for, or none. */
function sweepPatch(bug: TeamBug, issue: IssueFacts, pull: PullFacts | null): BugPatch | null {
  if (bug.state === 'wont-fix') return issue.open ? { state: 'open', fixPr: null, fixedIn: null } : null;
  return !issue.open && issue.notPlanned ? { state: 'wont-fix' } : pullPatch(bug, issue, pull);
}

/** One bug of the sweep: the moves it made (the state the facts call for, then the release that holds its merge). */
async function sweepOne({ bug, store, github, tagsOf }: { bug: TeamBug; store: BugTeamStore; github: BugGithub; tagsOf: () => Promise<string[]> }): Promise<number> {
  const issue = await github.issue(bug.repo, bug.issue);
  const pull = bug.state === 'pr-opened' && bug.fixPr !== null ? await github.pull(bug.repo, bug.fixPr) : null;
  const patch = sweepPatch(bug, issue, pull);
  let current = bug;
  let moved = 0;
  if (patch) {
    if (!(await store.move(bug, patch))) return 0;
    moved = 1;
    current = { ...bug, ...patch, fixPr: patch.fixPr === undefined ? bug.fixPr : patch.fixPr };
  }
  if (current.state !== 'merged') return moved;
  return moved + ((await release({ bug: current, tags: await tagsOf(), store, github })) ? 1 : 0);
}

/**
 * The sweep, run at the team's wake: reads each bug's issue and fix pull request, and the releases, and reaches the states
 * the deliveries would have. A bug whose reading fails is left as it is for the next sweep.
 */
export async function sweepBugs({ store, github, repo = OMNI_LOOP_REPOSITORY, log = () => undefined }: { store: BugTeamStore; github: BugGithub; repo?: string; log?: (line: string) => void }): Promise<BugSweep> {
  const bugs = (await store.inStates(SWEPT)).filter((bug) => bug.repo === repo);
  let tags: Promise<string[]> | null = null;
  const tagsOf = () => (tags ??= github.releases(repo));
  let moved = 0;
  for (const bug of bugs) {
    try {
      moved += await sweepOne({ bug, store, github, tagsOf });
    } catch (error) {
      log(`bug sweep: #${String(bug.issue)} left as it is — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { read: bugs.length, moved };
}
