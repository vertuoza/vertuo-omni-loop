// A touch (PRD 902, s3): omni-app saw a webhook say something changed on GitHub — an issue, a comment, a
// pull request, a review, a check suite, a push into the delivery folder or onto a feature or phase-0
// branch — and POSTs `{ repository, issue?, pr?, branch? }` here, read from the payload alone, signed
// with the stage event's HMAC (STAGE_EVENT_SECRET, ../stages/event/event.ts).
//
//   - a missing secret, or a bad or missing signature → 401, nothing marked;
//   - a signed body that is not a touch → 400;
//   - no workspace owns the repository, or no dossier's snapshot matches → 202, logged;
//   - matched → each dossier's snapshot is marked stale (../dossier/snapshot/), and one refresh per
//     dossier runs after the response, under the snapshot's lease → 200.
//
// A touch resolves to the dossiers of its repository whose snapshot names it: the PRD the issue is (a
// PRD's number is its issue's), the PRD the branch's topic is in prd_topics, or the phase-0, feature or
// retro pull request the snapshot holds. Only a dossier with a snapshot can be stale: one with none is
// read on its first visit anyway.
//
// Bursts coalesce. A touch that lands while a refresh holds the lease moves the stale mark past the
// refresh's start, so the refresh's end leaves it set; the refresh started by a touch then runs one
// follow-up read. Every other touch's refresh finds the lease held and does nothing.
import 'server-only';
import { z } from 'zod';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { IssueNumberSchema, PrdNumberSchema, PrNumberSchema, type IssueNumber, type PrdNumber, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { UNREAD, type GithubSummary } from '../dossier/github/summary';
import { refreshSnapshot, staleSnapshot, type SnapshotDeps, type SnapshotDossier } from '../dossier/snapshot/snapshot';
import { STAGE_SIGNATURE_HEADER, verifySignature } from '../stages/event/event';

export type Touch = { repository: string; issue?: IssueNumber; pr?: PrNumber; branch?: string };

/** A dossier's snapshot, as a touch is matched against it. */
export type TouchedSnapshot = { dossierId: string; summary: GithubSummary };

export type TouchedDeps = {
  /** STAGE_EVENT_SECRET; unset, every touch is refused. */
  secret: string | undefined;
  /** The workspaces that own a repository (`owner/name`). */
  workspacesOf: (repository: string) => Promise<string[]>;
  /** The PRD a topic is in the workspace's repository (prd_topics); null when none. */
  prdByTopic: (workspace: string, repository: string, topic: string) => Promise<PrdNumber | null>;
  /** The workspace's dossiers' snapshots. */
  snapshotsOf: (workspace: string) => Promise<TouchedSnapshot[]>;
  /** The snapshot's own deps: its store, the reader, the clock, and what runs after the response. */
  snapshot: SnapshotDeps;
  log?: (line: string) => void;
};

export type Reply = { status: number; body: { ok?: true; stale?: number; error?: string } };

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

const TouchBody = z.object({
  repository: z.string().regex(REPOSITORY),
  issue: IssueNumberSchema.optional(),
  pr: PrNumberSchema.optional(),
  branch: z.string().min(1).optional(),
});

/** A well-formed touch, or null. */
export function parseTouch(value: unknown): Touch | null {
  const parsed = TouchBody.safeParse(value);
  if (!parsed.success) return null;
  const { repository, issue, pr, branch } = parsed.data;
  return { repository, ...(issue === undefined ? {} : { issue }), ...(pr === undefined ? {} : { pr }), ...(branch === undefined ? {} : { branch }) };
}

/** The kit's default branch shapes: the webhook cannot read a repository's own config, and nor can this. */
const BRANCHES = (() => {
  const { branches } = parseConfig('kit: 1');
  return [branches.slice, branches.phase0, branches.retro, branches.feature];
})();

/** The topic a feature, slice, phase-0 or retro branch carries, by the kit's shapes; null for any other. */
export function topicOfBranch(branch: string): string | null {
  for (const template of BRANCHES) {
    const pattern = template.split(/(\{topic\}|\{slice\})/).map((part) => {
      if (part === '{topic}') return '(?<topic>[^/]+?)';
      if (part === '{slice}') return '[^/]+?';
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    const topic = new RegExp(`^${pattern}$`).exec(branch)?.groups?.['topic'];
    if (topic) return topic;
  }
  return null;
}

const why = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error));

/** The numbers of the pull requests a snapshot holds. */
function pullsOf(summary: GithubSummary): number[] {
  return [summary.phase0, summary.feature, summary.retro].flatMap((pull) => (pull && pull !== UNREAD ? [pull.number] : []));
}

/** The issue a snapshot holds, when it read one. */
function issueOf(summary: GithubSummary): number | null {
  return summary.issue && summary.issue !== UNREAD ? summary.issue.number : null;
}

/** The workspace's dossiers the touch names, each as the snapshot refreshes it. */
async function resolve(touch: Touch, workspace: string, deps: TouchedDeps): Promise<SnapshotDossier[]> {
  const prds = new Set<number>();
  const asPrd = PrdNumberSchema.safeParse(touch.issue);
  if (asPrd.success) prds.add(asPrd.data);
  const topic = touch.branch === undefined ? null : topicOfBranch(touch.branch);
  const byTopic = topic === null ? null : await deps.prdByTopic(workspace, touch.repository, topic);
  if (byTopic !== null) prds.add(byTopic);

  const repository = touch.repository.toLowerCase();
  return (await deps.snapshotsOf(workspace))
    .filter(({ summary }) => summary.repo.toLowerCase() === repository)
    .filter(({ summary }) => prds.has(summary.prd)
      || (touch.pr !== undefined && pullsOf(summary).includes(touch.pr))
      || (touch.issue !== undefined && issueOf(summary) === touch.issue))
    .map(({ dossierId, summary }) => ({ id: dossierId, workspace_id: workspace, home_repo: summary.repo, prd: summary.prd }));
}

/** Marks the snapshot stale. While a refresh holds its lease, the mark moves to now, past the refresh's
 * start, so the refresh's end leaves it set and its follow-up reads again. */
async function markTouched(dossier: SnapshotDossier, deps: SnapshotDeps): Promise<void> {
  const now = new Date(deps.now()).toISOString();
  const kept = await deps.store.read(dossier.id);
  if (kept?.refreshingUntil && kept.refreshingUntil >= now) await deps.store.current(dossier.id, now);
  await staleSnapshot(dossier.id, deps);
}

/** The refresh a touch starts, after the response: none when the snapshot is current again or another
 * refresh holds the lease; else one read, and one follow-up when it is still stale at its end. */
export async function refreshAfterTouch(dossier: SnapshotDossier, deps: SnapshotDeps): Promise<void> {
  const log = deps.log ?? console.error;
  const stale = async () => {
    try {
      return (await deps.store.read(dossier.id))?.staleSince != null;
    } catch (error) {
      log(`touch: the snapshot of ${dossier.home_repo}#${dossier.prd} could not be read — ${why(error)}`);
      return false;
    }
  };
  if (!(await stale())) return;
  if ((await refreshSnapshot(dossier, 'background', deps)) !== 'refreshed') return;
  if (await stale()) await refreshSnapshot(dossier, 'background', deps);
}

export async function receiveTouch(request: { body: string; headers: Headers }, deps: TouchedDeps): Promise<Reply> {
  const log = deps.log ?? console.error;
  if (!deps.secret) {
    log('touch: STAGE_EVENT_SECRET is not set on this deployment, every touch is refused');
    return { status: 401, body: { error: 'touches are not accepted here' } };
  }
  if (!verifySignature(deps.secret, request.body, request.headers.get(STAGE_SIGNATURE_HEADER))) {
    return { status: 401, body: { error: 'bad signature' } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(request.body);
  } catch {
    return { status: 400, body: { error: 'the body is not JSON' } };
  }
  const touch = parseTouch(parsed);
  if (!touch) return { status: 400, body: { error: 'the body is not a touch' } };

  const what = `${touch.repository}${touch.issue ? ` issue #${touch.issue}` : ''}${touch.pr ? ` pull request #${touch.pr}` : ''}${touch.branch ? ` on ${touch.branch}` : ''}`;
  try {
    const dossiers: SnapshotDossier[] = [];
    for (const workspace of await deps.workspacesOf(touch.repository)) dossiers.push(...(await resolve(touch, workspace, deps)));
    if (dossiers.length === 0) {
      log(`touch: ${what} matched no dossier`);
      return { status: 202, body: { stale: 0 } };
    }
    for (const dossier of dossiers) {
      await markTouched(dossier, deps.snapshot);
      deps.snapshot.later(() => refreshAfterTouch(dossier, deps.snapshot));
    }
    return { status: 200, body: { ok: true, stale: dossiers.length } };
  } catch (error) {
    log(`touch: ${what} could not be resolved — ${why(error)}`);
    return { status: 500, body: { error: 'the touch could not be resolved' } };
  }
}
