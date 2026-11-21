// One run of the Omni Loop bug team (PRD 3088 s3, spec sections 1 to 4 and 8): an `omni-bugs` mission, read and written around
// ./bug-team.ts's decisions, over the mission's store (./store.ts) and the team's one GitHub read (./bug-team.github.ts). No model
// call. ./job.ts runs it in place of a mission of PRDs' run.
//
//   the budget  first, as any mission's (PRD 3040, ./budget-run.ts): its jobs carry the mission's id, so the mission's budget and
//               its fleet's `Tokens per day` count them. Over a cap the run reads the mission paused: no bug is taken, and the
//               jobs at work end as ever
//   the ends    each `fixing` bug whose latest job ended moves to its next state and tries, once (its row moves only while it still
//               holds what the run read); an `open` bug whose job is at work (a send whose move was lost) reads `fixing`
//   the pick    while the mission runs or waits, the open bugs' issues are read, and the bugs ./bug-team.ts picks are each sent
//               `/omni:bug-fix #<issue>` under `mission:<id>:bug:<issue>:run:<k>`, to the fleet's runners when one holds the
//               repository, else any runner of the workspace; each turns `fixing`, and the room gets `bug-taken`. Issues it cannot
//               read (no GitHub here, no installation): nothing is taken, and the mission says why
//   conclude    never `delivered`: running while a bug fix works or was sent, waiting otherwise, a minute on, naming each bug set
//               aside on its question; paused or stopped stays so, sending nothing, its jobs' ends still read
import { type IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import { askedWords, atWork, bugAfter, candidatesOf, latestOf, nextK, pickBugs, runningOf, takenEvent, type Bug, type BugJob, type IssueRead } from './bug-team.ts';
import type { MissionBugIssues } from './bug-team.github.ts';
import { runBudget } from './budget-run.ts';
import type { MissionBugTeam, MissionRecord, MissionStore } from './store.ts';
import { cut, recordedKeys, unrecorded, WAKE_MS, type Concluded, type NewEvent } from './supervisor.ts';

/** What one run of the team did: the mission's new state, whether a bug fix still works, whether it moved, what it sent and said. */
export type BugTeamRun = { next: Concluded; running: boolean; moved: boolean; sent: number; events: number };

/** What a run works from: the store, the mission as read, the run's time and the team's GitHub read (null: none here). */
export type BugTeamAt = { store: MissionStore; mission: MissionRecord; now: number; issues: MissionBugIssues | null };

/** A store without the team's reads: no bug, nothing sent. */
const NO_TEAM: MissionBugTeam = {
  bugs: () => Promise.resolve([]),
  jobs: () => Promise.resolve([]),
  send: () => Promise.resolve(null),
  move: () => Promise.resolve(false),
};

/** One bug as the run settles it: the bug as it now stands, and what the room is told, if anything. */
async function settleOne(team: MissionBugTeam, mission: MissionRecord, bug: Bug, jobs: readonly BugJob[]): Promise<{ bug: Bug; event: NewEvent | null }> {
  const latest = latestOf(jobs, bug.issue);
  if (bug.state === 'open' && latest !== undefined && atWork(latest)) {
    // Its job was sent, its row not moved: it is being fixed, and the room is told once, by its job's key.
    const moved = await team.move(bug, { ...bug, state: 'fixing' });
    return moved ? { bug: { ...bug, state: 'fixing' }, event: takenEvent(bug, latest.job, mission.repo) } : { bug, event: null };
  }
  const after = bug.state === 'fixing' ? bugAfter(bug, { repo: mission.repo, jobs }) : null;
  if (after === null || !(await team.move(bug, after.move))) return { bug, event: null };
  return { bug: { ...bug, ...after.move }, event: after.event };
}

/** Each bug's ended job read into its next state, once: the bugs as they now stand, and what the room is told. */
async function settle(team: MissionBugTeam, mission: MissionRecord, read: readonly Bug[], jobs: readonly BugJob[]): Promise<{ bugs: Bug[]; events: NewEvent[] }> {
  const bugs: Bug[] = [];
  const events: NewEvent[] = [];
  for (const one of read) {
    const settled = await settleOne(team, mission, one, jobs);
    bugs.push(settled.bug);
    if (settled.event !== null) events.push(settled.event);
  }
  return { bugs, events };
}

/** The open bugs' issues, as GitHub says them; or why they cannot be read here. */
async function readIssues(at: BugTeamAt, candidates: readonly Bug[]): Promise<{ issues: ReadonlyMap<IssueNumber, IssueRead>; why: string | null }> {
  const none = new Map<IssueNumber, IssueRead>();
  if (at.issues === null) return { issues: none, why: "the app cannot read the Omni Loop bugs' issues here: it has no GitHub access" };
  const installation = await at.store.installation(at.mission);
  if (installation === null) return { issues: none, why: "the Omni Loop bugs' issues cannot be read: the workspace has not installed the Omni GitHub App" };
  return { issues: await at.issues.read({ installation, repo: at.mission.repo, issues: candidates.map((bug) => bug.issue) }), why: null };
}

/** The bugs this run takes, each sent its bug fix and moved to `fixing`: the bugs and jobs as they now stand, and the room's events. */
async function take(at: BugTeamAt, team: MissionBugTeam, mission: MissionRecord, state: { bugs: Bug[]; jobs: BugJob[] }): Promise<{ sent: number; events: NewEvent[]; why: string | null }> {
  const candidates = candidatesOf(state.bugs, state.jobs);
  if (candidates.length === 0 || runningOf(state.bugs, state.jobs) >= mission.parallel) return { sent: 0, events: [], why: null };
  const read = await readIssues({ ...at, mission }, candidates);
  const picks = pickBugs({ bugs: state.bugs, jobs: state.jobs, issues: read.issues, parallel: mission.parallel });
  if (picks.length === 0) return { sent: 0, events: [], why: read.why };
  const toFleet = await at.store.fleetRunners(mission);
  const events: NewEvent[] = [];
  let sent = 0;
  for (const bug of picks) {
    const k = nextK(state.jobs, bug.issue);
    const job = await team.send({ mission, issue: bug.issue, k, toFleet });
    // A key already held: a run before this one sent it, and the next run reads it at work.
    if (job === null) continue;
    sent += 1;
    state.jobs.push({ issue: bug.issue, k, job, attempts: [{ id: job, status: 'queued', outcome: null, reason: null, prUrl: null }] });
    if (await team.move(bug, { ...bug, state: 'fixing' })) state.bugs = state.bugs.map((one) => (one.issue === bug.issue ? { ...one, state: 'fixing' } : one));
    events.push(takenEvent(bug, job, mission.repo));
  }
  return { sent, events, why: read.why };
}

/** What the team concludes: never delivered; running while a bug fix works, waiting otherwise, naming what waits on a person. */
function teamNext(mission: MissionRecord, { running, waits, now }: { running: boolean; waits: readonly string[]; now: number }): Concluded {
  if (mission.status !== 'running' && mission.status !== 'waiting') return { status: mission.status, waitingOn: mission.waitingOn, nextWakeAt: null };
  const waitingOn = waits.length > 0 ? cut(waits.join(' · ')) : null;
  return { status: running ? 'running' : 'waiting', waitingOn, nextWakeAt: new Date(now + WAKE_MS).toISOString() };
}

/** One run of an `omni-bugs` mission: the budget, each bug's ended job read, the next bugs taken, recorded and set. */
export async function bugTeamRun(at: BugTeamAt): Promise<BugTeamRun> {
  const { store, now } = at;
  const budget = await runBudget(store, at.mission, now);
  const mission = budget.mission;
  const team = store.bugTeam ?? NO_TEAM;
  const [read, jobs, recorded] = await Promise.all([team.bugs(mission.repo), team.jobs(mission.id), store.events(mission.id)]);
  const settled = await settle(team, mission, read, jobs);
  const state = { bugs: settled.bugs, jobs: [...jobs] };
  const moving = mission.status === 'running' || mission.status === 'waiting';
  const taken = moving ? await take(at, team, mission, state) : { sent: 0, events: [], why: null };
  const running = state.jobs.some(atWork);
  const waits = [...(taken.why === null ? [] : [taken.why]), ...askedWords(state.bugs)];
  const next = budget.finish(teamNext(mission, { running: running || taken.sent > 0, waits, now }));
  const events = unrecorded([...settled.events, ...taken.events], recordedKeys(recorded));
  await store.record(mission.id, [...budget.events, ...events], new Date(now));
  const moved = await store.update(mission.id, budget.from, next);
  return { next, running, moved, sent: taken.sent, events: events.length };
}
