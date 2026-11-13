// `fleet-board` as a job of the ledger (PRD omni-loop-3 s3; PRD 2530 s2): what the `fleetBoard` function
// did, moved over. A pull request the loop signed, into the default branch, goes on the GitHub project board of its
// author's fleet. `/api/github` adds one job per pull request (../webhook/webhook.ts), keyed `<owner/name>#<pr>`,
// lower case, in no lane, with 4 tries; its payload is the request (./events.ts), never a token (L-GDPR-2). A run
// decides, workspace by workspace:
//
//   workspaces   every workspace that tracks the repository through the delivery's own installation (./store.ts):
//                each is handled on its own, with its own fleets
//   fleet        the author's active fleet there, its login matched case-insensitively; none, or a fleet with no
//                board: nothing is called and nothing is written
//                when the author has none: the fleet of the person who sent the runner job whose `prs` holds the
//                pull request's link; a runner reports its pull requests a little after opening them, so a look
//                that finds no job holding the link yet ends the run `later`, one minute on, its look number in
//                `progress`; the 10th look that finds none goes on with no fleet; a job sent by an API key gives
//                no fleet
//   add          the card, through GitHub's GraphQL (./github.ts): the project's node id, then
//                `addProjectV2ItemById`; a refusal is an answer, never retried
//   note         the outcome on the fleet: `Added #<n> · <owner>/<repo>`, or `Not added: ask an org admin` (the App
//                may not write the organization's projects), or `Not added: no such project`
//
// The job ends `done` once a workspace's fleet was noted, else `skipped`, with why for each workspace. A GitHub
// error of 5xx or a rate limit throws, and the worker retries the job (../jobs/worker.ts). Nothing is ever posted on
// the pull request. A job re-runs whole: adding a card already on the board changes nothing, so a second run is
// harmless. No store (no database): the job ends `skipped` before reading anything.
import { z } from 'zod';
import { parseOrThrow } from 'omni-loop/kit/lib/schema/parse-or-throw.ts';
import type { JobFields, NewJob } from '../jobs/ledger.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import { FleetBoardDataSchema, type FleetBoardData } from './events.ts';
import { addToBoard, type Added, type GraphqlOctokit } from './github.ts';
import { NOTE_MAX, type Fleet, type FleetBoardStore } from './store.ts';

export const FLEET_BOARD_KIND = 'fleet-board';

/** A board add's tries: the 4th that throws fails it. */
const MAX_TRIES = 4;

/** A runner reports the pull requests of a job a little after opening them: look ten times, a minute apart. */
export const LOOKS = 10;
const WAIT_MS = 60_000;

/** The job of a loop pull request: one per pull request, however many deliveries name it. */
export function fleetBoardJob({ installationId, owner, repo, repository, prNumber, nodeId, url, author }: FleetBoardData): NewJob {
  const subject = repository.toLowerCase();
  return {
    kind: FLEET_BOARD_KIND,
    key: `${subject}#${String(prNumber)}`,
    subject,
    payload: { installationId, owner, repo, repository, prNumber, nodeId, url, author },
    maxTries: MAX_TRIES,
  };
}

/** What the run did in one workspace. */
type WorkspaceOutcome = { workspace: string; skipped: string } | { workspace: string; fleet: string; skipped: string } | { workspace: string; fleet: string; note: string };

/** What an earlier run kept: the last look that found no job holding the link. */
const ProgressSchema = z.looseObject({ look: z.number().int().min(1).max(LOOKS).optional() });

export type FleetBoardDeps = {
  octokitFor: OctokitFor<GraphqlOctokit>;
  /** The fleets, as the service role; `null` (no database): nothing is read or added. */
  store: FleetBoardStore | null;
  /** The clock the note is dated with, and a look again is due by. */
  now?: () => Date;
  log?: (line: string) => void;
};

/** The handler of the `fleet-board` kind. */
export function fleetBoardHandler({ octokitFor, store, now = () => new Date(), log = noteTo('fleet-board') }: FleetBoardDeps): JobHandler {
  return async (job): Promise<JobResult> => {
    const data = parseOrThrow(FleetBoardDataSchema, job.payload, `The ${FLEET_BOARD_KIND} job carries an unexpected shape`);
    const pull = `${data.repository}#${String(data.prNumber)}`;
    if (!store) return { outcome: 'skipped', reason: 'no database to read the fleets from' };

    const look = (ProgressSchema.parse(job.progress ?? {}).look ?? 0) + 1;
    const workspaces = await store.workspaces({ installationId: data.installationId, repository: data.repository });
    const fleets = await fleetsOf({ store, workspaces, data, look });
    if (fleets === null) {
      log(`fleet board: ${pull}: no runner job holds it yet, look ${String(look)} of ${String(LOOKS)}: looking again in a minute`);
      const progress: JobFields = { look };
      return { outcome: 'later', at: new Date(now().getTime() + WAIT_MS), progress };
    }

    const outcomes: WorkspaceOutcome[] = [];
    for (const workspace of workspaces) outcomes.push(await addCard({ octokitFor, store, now, data, workspace, fleet: fleets.get(workspace) ?? null }));
    const said = `${pull}: ${outcomes.length > 0 ? outcomes.map(outcomeLine).join('; ') : 'no workspace tracks it on this installation'}`;
    log(`fleet board: ${said}`);
    return outcomes.some((outcome) => 'note' in outcome) ? { outcome: 'done' } : { outcome: 'skipped', reason: said };
  };
}

/** Adds the card to the board of the workspace's fleet, and notes it there; with no fleet or no board, nothing. */
async function addCard({
  octokitFor,
  store,
  now,
  data,
  workspace,
  fleet,
}: { octokitFor: OctokitFor<GraphqlOctokit>; store: FleetBoardStore; now: () => Date; data: FleetBoardData; workspace: string; fleet: Fleet | null }): Promise<WorkspaceOutcome> {
  if (!fleet) return { workspace, skipped: 'the author, and the sender of a runner job holding the pull request, are in no active fleet' };
  const board = fleet.projectUrl;
  if (!board) return { workspace, fleet: fleet.name, skipped: 'the fleet has no board' };
  const added = await addToBoard(await octokitFor(data.installationId), { url: board, contentId: data.nodeId });
  const note = noteOf(added, data);
  await store.note({ workspace, fleet: fleet.name, projectUrl: board, note, at: now().toISOString() });
  return { workspace, fleet: fleet.name, note };
}

/** One workspace's outcome, as the run's line says it. */
function outcomeLine(outcome: WorkspaceOutcome): string {
  const where = 'fleet' in outcome ? `${outcome.workspace} ${outcome.fleet}` : outcome.workspace;
  return `${where}: ${'note' in outcome ? outcome.note : outcome.skipped}`;
}

/**
 * The fleet each workspace adds the card for: the author's, else the one of the person who sent the runner job
 * holding the pull request's link. `null` when no job holds the link yet on a look before the last: the run looks
 * again later.
 */
async function fleetsOf({ store, workspaces, data, look }: { store: FleetBoardStore; workspaces: string[]; data: FleetBoardData; look: number }): Promise<Map<string, Fleet | null> | null> {
  const fleets = new Map<string, Fleet | null>();
  const pending: string[] = [];
  for (const workspace of workspaces) {
    const fleet = await store.fleetOf({ workspace, login: data.author });
    fleets.set(workspace, fleet);
    if (!fleet) pending.push(workspace);
  }
  if (pending.length === 0) return fleets;
  const answers = new Map<string, Fleet | null>();
  let found = false;
  for (const workspace of pending) {
    const answer = await store.jobFleet({ workspace, url: data.url });
    answers.set(workspace, answer.fleet);
    found ||= answer.found;
  }
  // The link is one job's: once a workspace holds it, the others have none to wait for.
  if (found) for (const [workspace, fleet] of answers) fleets.set(workspace, fleet);
  else if (look < LOOKS) return null;
  return fleets;
}

/** The fleet's note for what adding the card came to, at most `NOTE_MAX` characters. */
function noteOf(added: Added, { owner, repo, prNumber }: Pick<FleetBoardData, 'owner' | 'repo' | 'prNumber'>): string {
  if (added.outcome === 'added') return `Added #${String(prNumber)} · ${owner}/${repo}`.slice(0, NOTE_MAX);
  return added.reason === 'permission' ? 'Not added: ask an org admin' : 'Not added: no such project';
}
