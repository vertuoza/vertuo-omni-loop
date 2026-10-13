import type { JobPatch, JobRow, JobRowStatus, NewJob, NewRunner, RunnerRow, RunnersRepository } from '../runners.repository';

// The runners' storage in memory (PRD 1830 s1), for the service's and the controller's tests: the same
// rows the two tables hold, the claim's rules as runner_claim() applies them, and runners_mark_lost(),
// as supabase/migrations/20261207100000_runners.sql writes them and supabase/checks/runners.sql proves
// them. A realistic workspace: Olga owns it and plays in the fleet cia, Mo plays in cia, Pia in pirates,
// Sam in no fleet; Eve belongs to another workspace.

export const WORKSPACE = '00000000-0000-4000-8000-000001830001';
export const ELSEWHERE = '00000000-0000-4000-8000-000001830002';

export const OLGA = '00000000-0000-4000-8000-0000018300a1';
export const MO = '00000000-0000-4000-8000-0000018300b1';
export const PIA = '00000000-0000-4000-8000-0000018300c1';
export const SAM = '00000000-0000-4000-8000-0000018300d1';
export const EVE = '00000000-0000-4000-8000-0000018300e1';

export const SHARED = '00000000-0000-4000-8000-0000018301a1';
export const CIA_BOX = '00000000-0000-4000-8000-0000018301b1';
export const OTHER = '00000000-0000-4000-8000-0000018301c1';

/** The fixed clock's start. */
export const T0 = new Date('2026-10-13T12:00:00.000Z');

type Member = { workspaceId: string; userId: string; role: 'owner' | 'member'; team: string | null; login: string | null };

const MEMBERS: Member[] = [
  { workspaceId: WORKSPACE, userId: OLGA, role: 'owner', team: 'cia', login: 'olga' },
  { workspaceId: WORKSPACE, userId: MO, role: 'member', team: 'cia', login: 'mo' },
  { workspaceId: WORKSPACE, userId: PIA, role: 'member', team: 'pirates', login: 'pia' },
  { workspaceId: WORKSPACE, userId: SAM, role: 'member', team: null, login: null },
  { workspaceId: ELSEWHERE, userId: EVE, role: 'owner', team: null, login: 'eve' },
];

const FLEETS = [{ workspaceId: WORKSPACE, name: 'cia' }, { workspaceId: WORKSPACE, name: 'pirates' }];

/** Which workspace owns a repository's GitHub organisation. */
const ORGS: Record<string, string> = { vertuoza: WORKSPACE, elsewhere: ELSEWHERE };

/** A runner row, seen at `T0` unless told otherwise. */
export function runnerRow(more: Partial<RunnerRow> & Pick<RunnerRow, 'id' | 'name'>): RunnerRow {
  return { workspace_id: WORKSPACE, owner: OLGA, fleet: null, slots: 4, repos: ['vertuoza/app'], version: '0.0.387', last_seen_at: T0.toISOString(), ...more };
}

/** Olga's three runners: a shared one with one slot, one of the fleet cia, one that holds another repository. */
export const RUNNERS: RunnerRow[] = [
  runnerRow({ id: SHARED, name: 'shared', slots: 1 }),
  runnerRow({ id: CIA_BOX, name: 'cia-box', fleet: 'cia' }),
  runnerRow({ id: OTHER, name: 'other', repos: ['vertuoza/other'] }),
];

let jobSeq = 0;

/** A queued job, sent by Mo to any runner unless told otherwise. */
export function jobRow(more: Partial<JobRow> = {}): JobRow {
  jobSeq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(1830020000 + jobSeq).padStart(12, '0')}`, workspace_id: WORKSPACE, line: '/omni:yolo 1717',
    repo: 'vertuoza/app', to_runner: null, to_fleet: null, sent_by: MO, status: 'queued', runner_id: null, cancel_requested: false,
    log_tail: '', pr_url: null, exit_code: null, reason: null, queued_at: T0.toISOString(), claimed_at: null, running_at: null,
    ended_at: null, ...more,
  };
}

/** The fake's tables, and the clock it stamps writes with. */
export function fakeStore({ runners = RUNNERS, jobs = [], now = () => T0 }: { runners?: RunnerRow[]; jobs?: JobRow[]; now?: () => Date } = {}) {
  const calls: string[] = [];
  const state = { runners: runners.map((row) => ({ ...row })), jobs: jobs.map((row) => ({ ...row })), calls };
  const stamp = () => now().toISOString();
  // As runner_claim() reads them: a queued job of its workspace, for a repository it holds…
  const takeable = (runner: RunnerRow, job: JobRow) =>
    job.workspace_id === runner.workspace_id && job.status === 'queued' && !job.cancel_requested && runner.repos.includes(job.repo);
  // …sent to it, to its fleet, or, for a runner with no fleet only, to any runner.
  const addressed = (runner: RunnerRow, job: JobRow) => (job.to_runner === null ? job.to_fleet === runner.fleet : job.to_runner === runner.id);
  const may = (runner: RunnerRow, job: JobRow) => takeable(runner, job) && addressed(runner, job);

  const store: RunnersRepository = {
    member: (workspaceId, userId) => {
      const found = MEMBERS.find((m) => m.workspaceId === workspaceId && m.userId === userId);
      return Promise.resolve(found ? { owner: found.role === 'owner', fleet: found.team } : null);
    },
    place: (userId, repo) => {
      const owning = ORGS[repo.split('/')[0] ?? ''];
      if (owning && MEMBERS.some((m) => m.workspaceId === owning && m.userId === userId)) return Promise.resolve({ workspaceId: owning, refusal: null });
      return Promise.resolve({ workspaceId: null, refusal: owning ? `you are not a member of the workspace that owns ${repo}` : `no workspace owns ${repo}` });
    },
    fleetExists: (workspaceId, fleet) => Promise.resolve(FLEETS.some((f) => f.workspaceId === workspaceId && f.name === fleet)),
    logins: (workspaceId, userIds) => Promise.resolve(new Map(MEMBERS.flatMap((m) => (
      m.workspaceId === workspaceId && userIds.includes(m.userId) && m.login ? [[m.userId, m.login] as const] : []
    )))),
    runner: (id) => Promise.resolve(state.runners.find((r) => r.id === id) ?? null),
    runnerNamed: (workspaceId, name) => Promise.resolve(state.runners.find((r) => r.workspace_id === workspaceId && r.name === name) ?? null),
    runners: (workspaceId) => Promise.resolve(state.runners.filter((r) => r.workspace_id === workspaceId).sort((a, b) => a.name.localeCompare(b.name))),
    insertRunner: (runner: NewRunner) => {
      const row = runnerRow({
        id: `00000000-0000-4000-8000-${String(1830010000 + state.runners.length).padStart(12, '0')}`, workspace_id: runner.workspaceId,
        owner: runner.owner, name: runner.name, slots: runner.slots, repos: runner.repos, version: runner.version, last_seen_at: runner.seenAt,
      });
      state.runners.push(row);
      state.calls.push(`insert runner ${runner.name}`);
      return Promise.resolve(row);
    },
    updateRunner: (id, patch) => {
      const row = state.runners.find((r) => r.id === id);
      if (!row) return Promise.reject(new Error('runners: no row'));
      Object.assign(row, patch);
      return Promise.resolve({ ...row });
    },
    markLost: (cutoff) => {
      let lost = 0;
      for (const job of state.jobs) {
        const runner = state.runners.find((r) => r.id === job.runner_id);
        if (runner && (job.status === 'claimed' || job.status === 'running') && Date.parse(runner.last_seen_at) < Date.parse(cutoff)) {
          Object.assign(job, { status: 'failed', reason: 'runner lost', ended_at: stamp() });
          lost += 1;
        }
      }
      return Promise.resolve(lost);
    },
    claim: (runnerId) => {
      state.calls.push(`claim ${runnerId}`);
      const runner = state.runners.find((r) => r.id === runnerId);
      if (!runner) return Promise.resolve(null);
      const busy = state.jobs.filter((j) => j.runner_id === runner.id && (j.status === 'claimed' || j.status === 'running')).length;
      if (busy >= runner.slots) return Promise.resolve(null);
      const job = state.jobs.filter((j) => may(runner, j)).sort((a, b) => a.queued_at.localeCompare(b.queued_at) || a.id.localeCompare(b.id))[0];
      if (!job) return Promise.resolve(null);
      Object.assign(job, { status: 'claimed', runner_id: runner.id, claimed_at: stamp() });
      return Promise.resolve({ ...job });
    },
    job: (id) => {
      const found = state.jobs.find((j) => j.id === id);
      return Promise.resolve(found ? { ...found } : null);
    },
    insertJob: (job: NewJob) => {
      const row = jobRow({ workspace_id: job.workspaceId, line: job.line, repo: job.repo, to_runner: job.toRunner, to_fleet: job.toFleet, sent_by: job.sentBy, queued_at: stamp() });
      state.jobs.push(row);
      return Promise.resolve({ ...row });
    },
    updateJob: (id, from: readonly JobRowStatus[], patch: JobPatch) => {
      const row = state.jobs.find((j) => j.id === id && from.includes(j.status));
      if (!row) return Promise.resolve(null);
      Object.assign(row, patch);
      return Promise.resolve({ ...row });
    },
    activeJobs: (workspaceId) => Promise.resolve(state.jobs.filter((j) => j.workspace_id === workspaceId && ['queued', 'claimed', 'running'].includes(j.status))),
    endedJobs: (workspaceId, limit) => Promise.resolve(state.jobs
      .filter((j) => j.workspace_id === workspaceId && j.ended_at !== null)
      .sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''))
      .slice(0, limit)),
  };
  return { store, state };
}
