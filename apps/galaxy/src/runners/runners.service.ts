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
// - A job's live lines (PRD 1904): a report's `lines`, numbered from `from`, are stored once each (a
//   report sent twice adds nothing), and a job keeps its last 20,000. When a job ends, the lines of the
//   workspace's ended jobs beyond the 50 most recent (the ones the Runners page lists) are deleted. A
//   member reads them after a sequence number, 5,000 at a time; anyone else is told there is no job.
// - A runner's health (PRD 2102): its owner's runner reports its machine every 15 s. The report, with
//   the server's time, becomes the runner's last health and counts as a check-in; each adds one sample,
//   and the runner's samples older than an hour are deleted. The Runners page reads each runner's last
//   health and its samples of the hour, oldest first. A report's machine tokens of the last 5 h are
//   stored in the sample as the sum of their four counts (`tokens_5h`).
// - A job's tokens (PRD 2102): a job report may carry the tokens of its worktree; they are stored in
//   `runner_jobs.tokens` and the page reads them with the job.
import {
  checkLine, ENDED_JOBS_SHOWN, JOB_LINES_KEPT, JOB_LINES_PAGE, LOG_TAIL_BYTES, LOG_TAIL_LINES, LOST_AFTER_MS, NEXT_HOLD_MS, SAMPLES_KEPT_MS,
  type Board, type HealthReport, type Job, type JobLines, type JobUpdate, type RegisterReply, type RegisterRequest, type Runner, type RunnerJob, type RunnerRefusal, type RunnerSample,
  type KeyJob, type KeySend, type RunnerState, type SendRequest, type Target,
} from './runners.contract';
import type { JobPatch, JobRow, JobRowStatus, RunnerRow, RunnersRepository, SampleRow } from './runners.repository';

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

/** The API key that sends: its id and name, its workspace, and the member who made it (the sender of record). */
type KeySender = { id: string; name: string; workspace: string; maker: string };

/** Who a runner's job reads as sent by: `@login`, or `API key <name> (@login)` for a key's (PRD 2022). */
const senderOf = (login: string | null, keyName: string | null): string | null =>
  keyName === null ? login : login ? `API key ${keyName} (@${login})` : `API key ${keyName}`;

function jobOf(row: JobRow, logins: Map<string, string>, keys: Map<string, string> = new Map()): Job {
  return {
    id: row.id, line: row.line, repo: row.repo, toRunner: row.to_runner, toFleet: row.to_fleet, sentBy: row.sent_by,
    sentByLogin: logins.get(row.sent_by) ?? null, sentByKey: row.sent_by_key === null ? null : keys.get(row.sent_by_key) ?? null, status: row.status, runner: row.runner_id, cancelRequested: row.cancel_requested,
    logTail: row.log_tail, prUrl: row.pr_url, exitCode: row.exit_code, reason: row.reason, tokens: row.tokens ?? null, queuedAt: row.queued_at,
    claimedAt: row.claimed_at, runningAt: row.running_at, endedAt: row.ended_at,
  };
}

function runnerOf(row: RunnerRow, used: number, now: Date, samples?: RunnerSample[]): Runner {
  return {
    id: row.id, name: row.name, owner: row.owner, fleet: row.fleet, slots: row.slots, used, repos: row.repos, version: row.version,
    lastSeenAt: row.last_seen_at, state: runnerState(row, used, now), health: row.health, ...(samples ? { samples } : {}),
  };
}

/** A token count's four figures added up; null for a count the runner could not read or never sent. */
const tokenSum = (counts: { input: number; output: number; cacheRead: number; cacheWrite: number } | null | undefined): number | null =>
  counts ? counts.input + counts.output + counts.cacheRead + counts.cacheWrite : null;

const sampleOf = (row: SampleRow): RunnerSample => ({
  at: row.at, cpu: row.cpu, memUsed: row.mem_used, memTotal: row.mem_total, diskFree: row.disk_free, tokens5h: row.tokens_5h,
});

/** The samples of each runner, oldest first as they are read. */
function samplesByRunner(rows: SampleRow[]): Map<string, RunnerSample[]> {
  const byRunner = new Map<string, RunnerSample[]>();
  for (const row of rows) {
    const held = byRunner.get(row.runner_id);
    if (held) held.push(sampleOf(row));
    else byRunner.set(row.runner_id, [sampleOf(row)]);
  }
  return byRunner;
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
    pr_url: report.prUrl, exit_code: report.exitCode, reason: report.reason, tokens: report.tokens,
  };
  const given: JobPatch = Object.fromEntries(Object.entries(carried).filter(([, column]) => column !== undefined));
  const starts = report.status === 'running' && job.running_at === null;
  return { ...given, status: report.status, ...(starts ? { running_at: now } : {}), ...(ENDED.includes(report.status) ? { ended_at: now } : {}) };
}

function keyJobOf(row: JobRow, runnerName: string | null): KeyJob {
  return {
    id: row.id, line: row.line, repo: row.repo, status: row.status, runner: runnerName, prUrl: row.pr_url, exitCode: row.exit_code,
    reason: row.reason, queuedAt: row.queued_at, claimedAt: row.claimed_at, runningAt: row.running_at, endedAt: row.ended_at,
  };
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

  /** The names of the API keys that sent these jobs. */
  const keysOf = (workspaceId: string, jobs: JobRow[]) =>
    store.keyNames(workspaceId, [...new Set(jobs.flatMap((job) => (job.sent_by_key === null ? [] : [job.sent_by_key])))]);

  /** The name of the runner that holds the job, or null. */
  async function runnerNameOf(job: JobRow): Promise<string | null> {
    return job.runner_id === null ? null : (await store.runner(job.runner_id))?.name ?? null;
  }

  /** Queues the job as `caller`, a member of the workspace the repository belongs to; for a key, that must be the key's. */
  async function queue(caller: string, request: SendRequest, key: KeySender | null): Promise<Served<JobRow>> {
    const line = checkLine(request.line);
    if (!line.ok) return no('malformed', line.reason);
    const repo = request.repo.toLowerCase();
    const placed = await placement(caller, repo, key?.workspace ?? null);
    if (!placed.ok) return placed;
    const sender = await store.member(placed.value, caller);
    if (!sender) return no('forbidden', `${repo} is not in your workspace.`);
    const target = await mayTarget(placed.value, sender, request.target);
    if (!target.ok) return target;
    return ok(await store.insertJob({ workspaceId: placed.value, line: request.line, repo, ...target.value, sentBy: caller, sentByKey: key?.id ?? null }));
  }

  /** The workspace the repository belongs to for the person, which must be `only` when that is given. */
  async function placement(caller: string, repo: string, only: string | null): Promise<Served<string>> {
    const placed = await store.place(caller, repo);
    if (!placed.workspaceId || (only !== null && placed.workspaceId !== only)) {
      return no('forbidden', `${repo} is not in your workspace${placed.refusal ? `: ${placed.refusal}` : ''}.`);
    }
    return ok(placed.workspaceId);
  }

  /** Stores the report's lines once each, then keeps the job's last 20,000. */
  async function appendLines(job: JobRow, report: JobUpdate): Promise<void> {
    const { from, lines } = report;
    if (from === undefined || lines === undefined || lines.length === 0) return;
    await store.appendLines(lines.map((text, i) => ({ job_id: job.id, workspace_id: job.workspace_id, seq: from + i, text })));
    const last = from + lines.length - 1;
    if (last > JOB_LINES_KEPT) await store.trimLines(job.id, last - JOB_LINES_KEPT);
  }

  /** After a job ends: the lines of the workspace's ended jobs beyond the 50 the Runners page lists go. */
  const retainLines = (job: JobRow) => (ENDED.includes(job.status) ? store.retainLines(job.workspace_id, ENDED_JOBS_SHOWN) : Promise.resolve(0));

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
          const keyName = job.sent_by_key === null ? null : (await store.keyNames(job.workspace_id, [job.sent_by_key])).get(job.sent_by_key) ?? null;
          return ok({ id: job.id, line: job.line, repo: job.repo, sentBy: senderOf(logins.get(job.sent_by) ?? null, keyName) });
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
      // The lines first: a report that fails after them is sent again, and adds nothing the second time.
      await appendLines(job, report);
      const updated = await store.updateJob(jobId, [job.status], reportPatch(job, report, iso()));
      if (!updated) return no('conflict', 'This job changed meanwhile. Report again.');
      await retainLines(updated);
      return ok({ cancel: !ENDED.includes(updated.status) && updated.cancel_requested });
    },

    /** A runner's health report (PRD 2102), from its owner: its last health and a check-in, one sample
     * more, and its samples older than an hour gone. Answers when the server took it. */
    async health(caller: string, runnerId: string, report: HealthReport): Promise<Served<{ at: string }>> {
      const owned = await ownRunner(caller, runnerId);
      if (!owned.ok) return owned;
      await markLost();
      const now = clock.now();
      const at = now.toISOString();
      await store.updateRunner(runnerId, { health: { ...report, at }, last_seen_at: at });
      await store.insertSample({
        runner_id: runnerId, workspace_id: owned.value.workspace_id, at,
        cpu: report.cpu, mem_used: report.memUsed, mem_total: report.memTotal, disk_free: report.diskFree, tokens_5h: tokenSum(report.tokens?.last5h),
      });
      await store.trimSamples(runnerId, new Date(now.getTime() - SAMPLES_KEPT_MS).toISOString());
      return ok({ at });
    },

    /** Queues a job: a listed line, for a repository of the workspace, to a target the sender may use. */
    async send(caller: string, request: SendRequest): Promise<Served<Job>> {
      const queued = await queue(caller, request, null);
      if (!queued.ok) return queued;
      return ok(jobOf(queued.value, await store.logins(queued.value.workspace_id, [caller])));
    },

    /** Queues a job for a program's API key (PRD 2022): as its maker would send it, in the key's workspace
     * only, to a runner by its name or a fleet, and marked as sent by the key. */
    async sendByKey(key: KeySender, request: KeySend): Promise<Served<KeyJob>> {
      if (request.runner !== undefined && request.fleet !== undefined) {
        return no('malformed', 'Name a runner or a fleet, not both.');
      }
      let target: Target = { kind: 'any' };
      if (request.fleet !== undefined) target = { kind: 'fleet', fleet: request.fleet };
      if (request.runner !== undefined) {
        const named = await store.runnerNamed(key.workspace, request.runner);
        if (!named) return no('missing', `No runner named ${request.runner} in this workspace.`);
        target = { kind: 'runner', runner: named.id };
      }
      const queued = await queue(key.maker, { line: request.line, repo: request.repo, target }, key);
      return queued.ok ? ok(keyJobOf(queued.value, await runnerNameOf(queued.value))) : queued;
    },

    /** A job a key of this workspace queued, as a key reads it: none for another workspace's, or a person's. */
    async keyJob(workspaceId: string, jobId: string): Promise<Served<KeyJob>> {
      await markLost();
      const job = await store.job(jobId);
      if (job?.workspace_id !== workspaceId || job.sent_by_key === null) return no('missing', 'No such job.');
      return ok(keyJobOf(job, await runnerNameOf(job)));
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
      await retainLines(updated);
      return ok(jobOf(updated, await store.logins(updated.workspace_id, [updated.sent_by]), await keysOf(updated.workspace_id, [updated])));
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

    /** A job's live lines after `after`, for a member of its workspace: at most 5,000 in order, whether
     * more follow, the first it holds, and its log tail only when it holds no line. */
    async lines(caller: string, jobId: string, after: number): Promise<Served<JobLines>> {
      const job = await store.job(jobId);
      const member = job ? await store.member(job.workspace_id, caller) : null;
      if (!job || !member) return no('missing', 'No such job.');
      const [read, first] = await Promise.all([store.lines(jobId, after, JOB_LINES_PAGE + 1), store.firstLine(jobId)]);
      const logTail = first === null && job.log_tail !== '' ? job.log_tail : null;
      return ok({ status: job.status, lines: read.slice(0, JOB_LINES_PAGE), more: read.length > JOB_LINES_PAGE, first, logTail });
    },

    /** The Runners page's read: the workspace's runners with their state, their last health and their
     * samples of the last hour, its jobs (queued and running first, then the last 50 that ended), and what
     * the viewer may do. A member only. */
    async board(caller: string, workspaceId: string): Promise<Served<Board>> {
      const viewer = await store.member(workspaceId, caller);
      if (!viewer) return no('forbidden', 'You are not a member of this workspace.');
      await markLost();
      const [runners, active, ended] = await Promise.all([store.runners(workspaceId), store.activeJobs(workspaceId), store.endedJobs(workspaceId, ENDED_JOBS_SHOWN)]);
      const jobs = [...active, ...ended];
      const logins = await store.logins(workspaceId, [...new Set(jobs.map((job) => job.sent_by))]);
      const keys = await keysOf(workspaceId, jobs);
      const now = clock.now();
      const samples = samplesByRunner(await store.samples(runners.map((runner) => runner.id), new Date(now.getTime() - SAMPLES_KEPT_MS).toISOString()));
      return ok({
        runners: runners.map((runner) => runnerOf(runner, usedBy(active, runner.id), now, samples.get(runner.id) ?? [])),
        jobs: jobs.map((job) => jobOf(job, logins, keys)),
        viewer: { id: caller, owner: viewer.owner, fleet: viewer.fleet },
      });
    },
  };
}

export type RunnersService = ReturnType<typeof runnersService>;
