// The runners' rules (PRD 1830 s1; ADR-0095): who may register, claim, report, send, cancel and give a
// runner to a fleet, and what a runner's state is. Plain functions over a repository and a clock, so
// they are tested on realistic rows with a fixed clock (./runners.service.test.ts).
//
// - A runner registers by name, in the workspace its repositories belong to for its owner; a name is
//   its owner's alone.
// - `next` counts as a check-in, then holds up to 40 s for a job the runner may claim (runner_claim()).
// - A runner silent for over 90 s leaves its claimed and running jobs failed, `runner lost`: each
//   `next`, each job update and each read of the Runners page marks them first, before it counts the
//   caller's own check-in, so a runner back from silence finds its jobs lost. Nothing is retried.
// - A job's status only goes forward: claimed, running, then done, failed or cancelled. A report on a
//   job that has ended is refused, and the runner stops it.
// - Anyone of the workspace sends to any runner, or to a runner with no fleet; only a fleet's players
//   and the workspace's owners send to a fleet, or to a runner in one. The repository is the
//   workspace's (repo_workspace()).
// - The sender or a workspace owner cancels a job: a queued one at once, a claimed or running one at
//   its runner's next report. Only an owner sets a runner's fleet.
import {
  checkLine, ENDED_JOBS_SHOWN, LOG_TAIL_BYTES, LOG_TAIL_LINES, LOST_AFTER_MS, NEXT_HOLD_MS,
  type Board, type Job, type JobUpdate, type RegisterReply, type RegisterRequest, type Runner, type RunnerJob, type RunnerRefusal,
  type RunnerState, type SendRequest, type Target,
} from './runners.contract';
import type { JobPatch, JobRow, JobRowStatus, RunnerRow, RunnersRepository } from './runners.repository';

/** The time, and a pause: real in production, fixed in tests. */
export type Clock = { now: () => Date; sleep: (ms: number) => Promise<void> };

/** A rule's answer: its value, or why not, in plain words. */
export type Served<T> = { ok: true; value: T } | { ok: false; kind: RunnerRefusal; error: string };

/** Who sends: whether they own the workspace, and their fleet. */
type Sender = { owner: boolean; fleet: string | null };

/** Where a job goes: one runner, a fleet, or neither (any runner). */
type Addressed = { toRunner: string | null; toFleet: string | null };

/** How often a held `next` looks for a job again. */
export const NEXT_POLL_MS = 2_000;

const ok = <T>(value: T): Served<T> => ({ ok: true, value });
const no = (kind: RunnerRefusal, error: string): Served<never> => ({ ok: false, kind, error });

const ACTIVE: readonly JobRowStatus[] = ['claimed', 'running'];
const ENDED: readonly JobRowStatus[] = ['done', 'failed', 'cancelled'];

/** Where a status stands in a job's life: a report never goes back. */
const STEP: Record<JobRowStatus, number> = { queued: 0, claimed: 1, running: 2, done: 3, failed: 3, cancelled: 3 };

/** The last 200 lines of a log, and at most its last 16 KB. */
export function cutLogTail(text: string): string {
  const lines = text.split('\n').slice(-LOG_TAIL_LINES).join('\n');
  const bytes = new TextEncoder().encode(lines);
  if (bytes.length <= LOG_TAIL_BYTES) return lines;
  // Cut on a character's first byte, so no character is split.
  let start = bytes.length - LOG_TAIL_BYTES;
  while (start < bytes.length && ((bytes[start] ?? 0) & 0xc0) === 0x80) start += 1;
  return new TextDecoder().decode(bytes.slice(start));
}

/** A runner's state at `now`: offline after 90 s of silence, busy when every slot holds a job. */
export function runnerState(runner: Pick<RunnerRow, 'last_seen_at' | 'slots'>, used: number, now: Date): RunnerState {
  if (now.getTime() - Date.parse(runner.last_seen_at) > LOST_AFTER_MS) return 'offline';
  return used >= runner.slots ? 'busy' : 'online';
}

function jobOf(row: JobRow, logins: Map<string, string>): Job {
  return {
    id: row.id, line: row.line, repo: row.repo, toRunner: row.to_runner, toFleet: row.to_fleet, sentBy: row.sent_by,
    sentByLogin: logins.get(row.sent_by) ?? null, status: row.status, runner: row.runner_id, cancelRequested: row.cancel_requested,
    logTail: row.log_tail, prUrl: row.pr_url, exitCode: row.exit_code, reason: row.reason, queuedAt: row.queued_at,
    claimedAt: row.claimed_at, runningAt: row.running_at, endedAt: row.ended_at,
  };
}

function runnerOf(row: RunnerRow, used: number, now: Date): Runner {
  return {
    id: row.id, name: row.name, owner: row.owner, fleet: row.fleet, slots: row.slots, used, repos: row.repos, version: row.version,
    lastSeenAt: row.last_seen_at, state: runnerState(row, used, now),
  };
}

/** Whether a sender may use a fleet's runners: one of its players, or a workspace owner. */
const inFleet = (sender: Sender, fleet: string) => sender.owner || sender.fleet === fleet;

/** A job's ending in words: its status, and its reason when it has one. */
const endedWords = (job: JobRow) => (job.reason ? `${job.status}, ${job.reason}` : job.status);

/** Why this report cannot be taken on the job as it stands, or null. */
function reportRefusal(job: JobRow, report: JobUpdate): Served<never> | null {
  if (ENDED.includes(job.status)) return no('conflict', `This job has ended: ${endedWords(job)}. Stop it.`);
  if (STEP[report.status] < STEP[job.status]) return no('conflict', `This job is ${job.status} already: it cannot go back to ${report.status}.`);
  return null;
}

/** The columns a report writes: its status, what it carries, and the time it starts or ends the run. */
function reportPatch(job: JobRow, report: JobUpdate, now: string): JobPatch {
  const carried = {
    log_tail: report.logTail === undefined ? undefined : cutLogTail(report.logTail),
    pr_url: report.prUrl, exit_code: report.exitCode, reason: report.reason,
  };
  const given: JobPatch = Object.fromEntries(Object.entries(carried).filter(([, column]) => column !== undefined));
  const starts = report.status === 'running' && job.running_at === null;
  return { ...given, status: report.status, ...(starts ? { running_at: now } : {}), ...(ENDED.includes(report.status) ? { ended_at: now } : {}) };
}

const usedBy = (jobs: JobRow[], runnerId: string) => jobs.filter((job) => job.runner_id === runnerId && ACTIVE.includes(job.status)).length;

export function runnersService(store: RunnersRepository, clock: Clock) {
  const iso = () => clock.now().toISOString();
  const markLost = () => store.markLost(new Date(clock.now().getTime() - LOST_AFTER_MS).toISOString());

  /** The runner the caller owns, or why not. */
  async function ownRunner(caller: string, runnerId: string): Promise<Served<RunnerRow>> {
    const runner = await store.runner(runnerId);
    if (!runner) return no('missing', 'No such runner. Register it again.');
    if (runner.owner !== caller) return no('forbidden', 'This runner was registered by someone else.');
    return ok(runner);
  }

  /** Whether a person of the workspace may send to this target, or why not. */
  async function mayTarget(workspaceId: string, sender: Sender, target: Target): Promise<Served<Addressed>> {
    if (target.kind === 'any') return ok({ toRunner: null, toFleet: null });
    return target.kind === 'fleet' ? mayFleet(workspaceId, sender, target.fleet) : mayRunner(workspaceId, sender, target.runner);
  }

  async function mayFleet(workspaceId: string, sender: Sender, fleet: string): Promise<Served<Addressed>> {
    if (!(await store.fleetExists(workspaceId, fleet))) return no('missing', `No fleet ${fleet} in this workspace.`);
    if (!inFleet(sender, fleet)) return no('forbidden', `Only the players of ${fleet} and the workspace's owners send to its runners.`);
    return ok({ toRunner: null, toFleet: fleet });
  }

  async function mayRunner(workspaceId: string, sender: Sender, runnerId: string): Promise<Served<Addressed>> {
    const runner = await store.runner(runnerId);
    if (runner?.workspace_id !== workspaceId) return no('missing', 'No such runner in this workspace.');
    if (runner.fleet !== null && !inFleet(sender, runner.fleet)) {
      return no('forbidden', `${runner.name} serves ${runner.fleet}: only its players and the workspace's owners send to it.`);
    }
    return ok({ toRunner: runner.id, toFleet: null });
  }

  /** The one workspace all the repositories belong to for the caller, or why not. */
  async function workspaceOf(caller: string, repos: string[]): Promise<Served<string>> {
    let workspaceId: string | null = null;
    for (const repo of repos) {
      const placed = await store.place(caller, repo);
      if (!placed.workspaceId) return no('forbidden', `${repo} is not in your workspace: ${placed.refusal ?? 'no workspace of yours owns it'}.`);
      if (workspaceId !== null && placed.workspaceId !== workspaceId) return no('forbidden', `${repo} belongs to another workspace than ${repos[0] ?? ''}: a runner serves one workspace.`);
      workspaceId = placed.workspaceId;
    }
    return workspaceId === null ? no('malformed', 'A runner holds at least one repository.') : ok(workspaceId);
  }

  /** The job's runner, when the caller owns it; why not otherwise. */
  async function reporting(caller: string, jobId: string): Promise<Served<string>> {
    const found = await store.job(jobId);
    if (!found) return no('missing', 'No such job.');
    const owned = found.runner_id ? await ownRunner(caller, found.runner_id) : null;
    return owned?.ok ? ok(owned.value.id) : no('forbidden', 'This job was claimed by none of your runners.');
  }

  /** Nothing, when the caller sent the job or owns its workspace; why not otherwise. */
  async function cancelling(caller: string, jobId: string): Promise<Served<null>> {
    const found = await store.job(jobId);
    const member = found ? await store.member(found.workspace_id, caller) : null;
    if (!found || !member) return no('missing', 'No such job.');
    return found.sent_by === caller || member.owner ? ok(null) : no('forbidden', 'Only its sender or a workspace owner cancels a job.');
  }

  return {
    /** Registers the runner by its name, or registers it again with its slots, repositories and version. */
    async register(caller: string, request: RegisterRequest): Promise<Served<RegisterReply>> {
      const repos = [...new Set(request.repos.map((repo) => repo.toLowerCase()))];
      const placed = await workspaceOf(caller, repos);
      if (!placed.ok) return placed;
      const workspaceId = placed.value;
      const seen = { slots: request.slots, repos, version: request.version, last_seen_at: iso() };
      const existing = await store.runnerNamed(workspaceId, request.name);
      if (existing && existing.owner !== caller) return no('forbidden', `A runner named ${request.name} was registered by someone else: pick another name.`);
      const runner = existing
        ? await store.updateRunner(existing.id, seen)
        : await store.insertRunner({ workspaceId, owner: caller, name: request.name, slots: seen.slots, repos, version: seen.version, seenAt: seen.last_seen_at });
      return ok({ id: runner.id, name: runner.name, fleet: runner.fleet });
    },

    /** Counts as a check-in, then holds up to 40 s for a job the runner may claim; null when none came. */
    async next(caller: string, runnerId: string): Promise<Served<RunnerJob | null>> {
      const owned = await ownRunner(caller, runnerId);
      if (!owned.ok) return owned;
      const deadline = clock.now().getTime() + NEXT_HOLD_MS;
      for (;;) {
        await markLost();
        await store.updateRunner(runnerId, { last_seen_at: iso() });
        const job = await store.claim(runnerId);
        if (job) {
          const logins = await store.logins(job.workspace_id, [job.sent_by]);
          return ok({ id: job.id, line: job.line, repo: job.repo, sentBy: logins.get(job.sent_by) ?? null });
        }
        if (clock.now().getTime() + NEXT_POLL_MS > deadline) return ok(null);
        await clock.sleep(NEXT_POLL_MS);
      }
    },

    /** A runner's report on a job it claimed: answers whether a cancel waits. */
    async update(caller: string, jobId: string, report: JobUpdate): Promise<Served<{ cancel: boolean }>> {
      const runnerId = await reporting(caller, jobId);
      if (!runnerId.ok) return runnerId;
      await markLost();
      await store.updateRunner(runnerId.value, { last_seen_at: iso() });
      const job = await store.job(jobId);
      if (!job) return no('missing', 'No such job.');
      const refusal = reportRefusal(job, report);
      if (refusal) return refusal;
      const updated = await store.updateJob(jobId, [job.status], reportPatch(job, report, iso()));
      if (!updated) return no('conflict', 'This job changed meanwhile. Report again.');
      return ok({ cancel: !ENDED.includes(updated.status) && updated.cancel_requested });
    },

    /** Queues a job: a listed line, for a repository of the workspace, to a target the sender may use. */
    async send(caller: string, request: SendRequest): Promise<Served<Job>> {
      const line = checkLine(request.line);
      if (!line.ok) return no('malformed', line.reason);
      const repo = request.repo.toLowerCase();
      const placed = await store.place(caller, repo);
      if (!placed.workspaceId) return no('forbidden', `${repo} is not in your workspace: ${placed.refusal ?? 'no workspace of yours owns it'}.`);
      const sender = await store.member(placed.workspaceId, caller);
      if (!sender) return no('forbidden', `${repo} is not in your workspace.`);
      const target = await mayTarget(placed.workspaceId, sender, request.target);
      if (!target.ok) return target;
      const job = await store.insertJob({ workspaceId: placed.workspaceId, line: request.line, repo, ...target.value, sentBy: caller });
      return ok(jobOf(job, await store.logins(job.workspace_id, [caller])));
    },

    /** Cancels a job: a queued one at once, a claimed or running one at its runner's next report. */
    async cancel(caller: string, jobId: string): Promise<Served<Job>> {
      const allowed = await cancelling(caller, jobId);
      if (!allowed.ok) return allowed;
      await markLost();
      const job = await store.job(jobId);
      if (!job) return no('missing', 'No such job.');
      if (ENDED.includes(job.status)) return no('conflict', `This job has ended: ${job.status}.`);
      // A queued job ends at once; a claimed or running one waits for its runner to kill it.
      const patch: JobPatch = job.status === 'queued' ? { status: 'cancelled', cancel_requested: true, ended_at: iso() } : { cancel_requested: true };
      const updated = await store.updateJob(jobId, [job.status], patch);
      if (!updated) return no('conflict', 'This job changed meanwhile. Try again.');
      return ok(jobOf(updated, await store.logins(updated.workspace_id, [updated.sent_by])));
    },

    /** Gives the runner to a fleet, or makes it shared: a workspace owner only. */
    async setFleet(caller: string, runnerId: string, fleet: string | null): Promise<Served<Runner>> {
      const runner = await store.runner(runnerId);
      const member = runner ? await store.member(runner.workspace_id, caller) : null;
      if (!runner || !member) return no('missing', 'No such runner.');
      if (!member.owner) return no('forbidden', 'Only a workspace owner gives a runner to a fleet.');
      if (fleet !== null && !(await store.fleetExists(runner.workspace_id, fleet))) return no('missing', `No fleet ${fleet} in this workspace.`);
      const updated = await store.updateRunner(runnerId, { fleet });
      const active = await store.activeJobs(runner.workspace_id);
      return ok(runnerOf(updated, usedBy(active, runnerId), clock.now()));
    },

    /** The Runners page's read: the workspace's runners with their state, its jobs (queued and running
     * first, then the last 50 that ended), and what the viewer may do. A member only. */
    async board(caller: string, workspaceId: string): Promise<Served<Board>> {
      const viewer = await store.member(workspaceId, caller);
      if (!viewer) return no('forbidden', 'You are not a member of this workspace.');
      await markLost();
      const [runners, active, ended] = await Promise.all([store.runners(workspaceId), store.activeJobs(workspaceId), store.endedJobs(workspaceId, ENDED_JOBS_SHOWN)]);
      const jobs = [...active, ...ended];
      const logins = await store.logins(workspaceId, [...new Set(jobs.map((job) => job.sent_by))]);
      const now = clock.now();
      return ok({
        runners: runners.map((runner) => runnerOf(runner, usedBy(active, runner.id), now)),
        jobs: jobs.map((job) => jobOf(job, logins)),
        viewer: { id: caller, owner: viewer.owner, fleet: viewer.fleet },
      });
    },
  };
}

export type RunnersService = ReturnType<typeof runnersService>;
