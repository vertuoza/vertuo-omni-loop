// The Supervisor's nine checks (PRD omni-loop-34 s2, spec "2. The checks"): plain code over today's rows, no model
// call. Each check reads one workspace's snapshot (./store.ts reads it) and answers what it sees as fires, one per
// fingerprint (`stuck:silent:<job>`); ./watch.ts upserts a signal for each fire and closes the open signals no check
// fired again. Pure: no clock (the snapshot carries `now`), no database, no network.
//
//   silent-job          stuck   running, its runner seen within 90 s, no new line for 3× the step's usual time and at
//                               least 20 min ("the step's usual time": the seat's baseline, else 20 min)
//   queue-stuck         stuck   queued 15 min while no online runner holding the repository can take it
//   resume-loop         stuck   a job lost a third time: its chain was lost and resumed until no attempt is left
//   mission-not-moving  stuck   a mission running or waiting with no event for 2 h, its ledger run failed, or the same
//                               `/omni:repair` sent 3 times
//   waiting-too-long    stuck   a job Need human, Waiting on answers or Held for more than 4 h, not continued
//   same-failure        bug     3 jobs or more ended failed with the same reason or the same last line within 6 h
//   route-failing       bug     3 or more of the workspace's App 5xx on one route within 1 h
//   late-schedule       bug     background_jobs_health() reads late, or a scheduled kind failed 3 times in a row
//   runner-health       health  disk full within 6 h at the current rate, paused 30 min, offline with queued work,
//                               every account out
//
// Every fire carries the check's line with its figures (what a finding shows first), its evidence (ids and masked
// text, never a token: L-GDPR-2) and an evidence key, a digest of what does not move from look to look, so a
// dismissal is undone only when the evidence changes (spec "4. Findings and suggestions").
import { createHash } from 'node:crypto';
import { maskSecrets } from 'omni-loop/kit/lib/openrouter.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How long a runner stays online after its last check-in (apps/galaxy/src/runners/runners.contract.ts, LOST_AFTER_MS). */
const ONLINE_MS = 90_000;
/** The step's usual time when the seat keeps no baseline for it, and the least silence that fires. */
const DEFAULT_USUAL_MIN = 20;
/** The reasons of a job its runner lost (supabase/migrations/20270121100000_runner_resume.sql). */
const LOST_REASONS: readonly string[] = Object.freeze(['runner lost', 'the worktree could not be made', 'the tmux session could not be started']);
/** The outcomes of a job that waits on a person, and how the page names them. */
const WAITING: Readonly<Record<string, string>> = Object.freeze({ human: 'Need human', answers: 'Waiting on answers', held: 'Held' });

export type CheckName =
  | 'silent-job' | 'queue-stuck' | 'resume-loop' | 'mission-not-moving' | 'waiting-too-long'
  | 'same-failure' | 'route-failing' | 'late-schedule' | 'runner-health' | 'seat-offline';
export type SignalKind = 'stuck' | 'bug' | 'health';
export type Severity = 'high' | 'medium';

/** One piece of evidence: what it names (a job, a runner, a mission, a route, a ledger kind) and a masked line. */
export type Evidence = { of: 'job' | 'runner' | 'mission' | 'route' | 'kind'; id: string; text?: string };

/** An action the App already has, proposed on a check's finding (spec "4. Findings and suggestions"). */
export type Suggestion = { action: 'pause-mission' | 'open-mission' | 'stop-resume-job' | 'open-terminal'; label: string; target: Record<string, string> };

/** What a check saw: one signal's worth, by fingerprint. */
export type Fire = {
  fingerprint: string;
  check: CheckName;
  kind: SignalKind;
  severity: Severity;
  /** The finding's title, when the check writes it alone. */
  title: string;
  /** The check with its figures, shown first: "Silent job: no line for 52 min, 3× the 2.5 min usual". */
  checkLine: string;
  figures: Record<string, number | string>;
  evidence: Evidence[];
  /** A digest of the evidence that does not move from look to look. */
  evidenceKey: string;
  /** How long its signal stays open before the check raises a finding of it alone (a runner paused 30 min). */
  raiseAfterMs?: number;
  suggestions?: Suggestion[];
};

/** A job of the workspace, as the checks read it. Its last line is masked already. */
export type WatchJob = {
  id: string;
  repo: string;
  line: string;
  status: 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'cancelled';
  outcome: string | null;
  reason: string | null;
  runnerId: string | null;
  toRunner: string | null;
  toFleet: string | null;
  queuedAt: string;
  runningAt: string | null;
  endedAt: string | null;
  resumeAfter: string | null;
  attempt: number;
  /** When its newest live line was written; null when it wrote none. */
  lastLineAt: string | null;
  /** The last line of its log, masked; null when none. */
  lastLine: string | null;
  /** Whether a later job continues it (its answers came in). */
  continued: boolean;
};

/** A runner of the workspace. */
export type WatchRunner = {
  id: string;
  name: string;
  fleet: string | null;
  repos: readonly string[];
  lastSeenAt: string;
  /** Why it paused itself (its health report), or null. */
  paused: string | null;
  /** Its accounts' states, or null when it keeps no accounts file. */
  accounts: readonly ('ready' | 'active' | 'out')[] | null;
  /** Its free disk over the last hour, oldest first (bytes). */
  disk: readonly { at: string; free: number }[];
};

/** A mission of the workspace, running or waiting. */
export type WatchMission = {
  id: string;
  number: number;
  title: string;
  status: string;
  /** Its newest mission event; null when it has none. */
  lastEventAt: string | null;
  /** When it last changed, read when it has no event. */
  updatedAt: string;
  /** Whether its run on the App's ledger failed. */
  runFailed: boolean;
  /** How many times each repair cause was sent, by fingerprint. */
  repairs: Readonly<Record<string, number>>;
};

/** One of the workspace's App 5xx of the last hour. */
export type WatchError = { route: string; status: number; at: string };

/** The App's ledger: what its health reads late, and the scheduled kinds whose last 3 runs failed. */
export type LedgerHealth = { late: number; scheduledLate: number; failing: readonly string[] };

/** One workspace, as the checks read it at `now`. */
export type WatchSnapshot = {
  now: number;
  jobs: readonly WatchJob[];
  runners: readonly WatchRunner[];
  missions: readonly WatchMission[];
  errors: readonly WatchError[];
  ledger: LedgerHealth;
  /** The step's usual time in minutes, by skill (`wave`), from the seat's long-term memory (./baselines.ts). */
  baselines: Readonly<Record<string, number>>;
};

export type Check = (snapshot: WatchSnapshot) => Fire[];

/** A digest of `parts`: what a dismissal compares. */
export function evidenceKey(parts: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
}

/** A number of minutes as a line reads it: `52`, `2.5`. */
function minutes(ms: number): string {
  return String(Number((ms / MINUTE).toFixed(1)));
}

const hours = (ms: number): string => String(Number((ms / HOUR).toFixed(1)));
const age = (iso: string | null, now: number): number => (iso === null ? Number.POSITIVE_INFINITY : now - Date.parse(iso));
const online = (runner: WatchRunner, now: number): boolean => age(runner.lastSeenAt, now) <= ONLINE_MS;
/** `text` masked, on one line, cut to `max` characters. */
const clean = (text: string, max = 200): string => {
  const line = maskSecrets(text).replace(/\s+/g, ' ').trim();
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
};
/** A job's skill: `/omni:wave 7` reads `wave`; a repository's own `/qa-sweep` reads `qa-sweep`. */
export function skillOf(line: string): string {
  return /^\/(?:omni:)?([a-z][a-z0-9-]*)/.exec(line)?.[1] ?? 'job';
}

/** Silent job: running, its runner seen within 90 s, no line for 3× the step's usual time and at least 20 min. */
export const silentJob: Check = ({ now, jobs, runners, baselines }) => {
  const seen = new Set(runners.filter((runner) => online(runner, now)).map((runner) => runner.id));
  return jobs.flatMap((job) => {
    if (job.status !== 'running' || job.runnerId === null || !seen.has(job.runnerId)) return [];
    const quiet = age(job.lastLineAt ?? job.runningAt, now);
    const step = skillOf(job.line);
    const usualMin = baselines[step];
    const usual = (usualMin ?? DEFAULT_USUAL_MIN) * MINUTE;
    if (!Number.isFinite(quiet) || quiet < Math.max(3 * usual, DEFAULT_USUAL_MIN * MINUTE)) return [];
    const usualText = usualMin === undefined ? `the ${String(DEFAULT_USUAL_MIN)} min default (no usual time kept yet)` : `the ${minutes(usual)} min usual`;
    return [{
      fingerprint: `stuck:silent:${job.id}`, check: 'silent-job', kind: 'stuck', severity: 'medium',
      title: `A ${step} job has written nothing for ${minutes(quiet)} min`,
      checkLine: `Silent job: no line for ${minutes(quiet)} min, 3× ${usualText}`,
      figures: { silentMin: Number(minutes(quiet)), usualMin: Number(minutes(usual)), step },
      evidence: [{ of: 'job', id: job.id, text: clean(job.line) }, { of: 'runner', id: job.runnerId }],
      evidenceKey: evidenceKey([job.id, job.lastLineAt]),
      suggestions: [
        { action: 'stop-resume-job', label: 'Stop and resume the job', target: { job: job.id } },
        { action: 'open-terminal', label: 'Open its Terminal', target: { job: job.id } },
      ],
    }];
  });
};

/** Whether `runner` can take `job` now: online, not paused, holding its repository, and the job's target. */
function canTake(runner: WatchRunner, job: WatchJob, now: number): boolean {
  if (!online(runner, now) || runner.paused !== null) return false;
  if (!runner.repos.includes(job.repo.toLowerCase())) return false;
  if (job.toRunner !== null) return job.toRunner === runner.id;
  return job.toFleet === null || job.toFleet === runner.fleet;
}

/** Queue nobody can take: queued 15 min (from its resume time, for a resume) while no online runner can take it. */
export const queueStuck: Check = ({ now, jobs, runners }) =>
  jobs.flatMap((job) => {
    if (job.status !== 'queued') return [];
    const since = Math.max(Date.parse(job.queuedAt), job.resumeAfter === null ? 0 : Date.parse(job.resumeAfter));
    const waited = now - since;
    if (waited < 15 * MINUTE || runners.some((runner) => canTake(runner, job, now))) return [];
    return [{
      fingerprint: `stuck:queue:${job.id}`, check: 'queue-stuck', kind: 'stuck', severity: 'medium',
      title: `A job for ${job.repo} waits with no runner to take it`,
      checkLine: `Queue nobody can take: queued ${minutes(waited)} min, no online runner can take ${job.repo}`,
      figures: { queuedMin: Number(minutes(waited)), runners: runners.length },
      evidence: [{ of: 'job', id: job.id, text: clean(job.line) }],
      evidenceKey: evidenceKey([job.id]),
    }];
  });

/** Resume loop: a job lost on its third attempt within a day, so its chain was lost 3 times and nothing resumes it. */
export const resumeLoop: Check = ({ now, jobs }) =>
  jobs.flatMap((job) => {
    if (job.status !== 'failed' || job.attempt < 3 || job.reason === null || !LOST_REASONS.includes(job.reason)) return [];
    if (age(job.endedAt, now) > 24 * HOUR) return [];
    return [{
      fingerprint: `stuck:resume-loop:${job.id}`, check: 'resume-loop', kind: 'stuck', severity: 'medium',
      title: `A ${skillOf(job.line)} job was lost 3 times`,
      checkLine: `Resume loop: lost ${String(job.attempt)} times, nothing resumes it now`,
      figures: { attempts: job.attempt },
      evidence: [{ of: 'job', id: job.id, text: clean(job.line) }],
      evidenceKey: evidenceKey([job.id]),
    }];
  });

/** Mission not moving: no event for 2 h, its ledger run failed, or the same `/omni:repair` sent 3 times. */
export const missionNotMoving: Check = ({ now, missions }) =>
  missions.flatMap((mission) => {
    if (mission.status !== 'running' && mission.status !== 'waiting') return [];
    const [cause, sent] = Object.entries(mission.repairs).reduce<[string, number]>((top, entry) => (entry[1] > top[1] ? entry : top), ['', 0]);
    const quiet = age(mission.lastEventAt ?? mission.updatedAt, now);
    let checkLine: string;
    let figures: Record<string, number | string>;
    let key: unknown[];
    if (sent >= 3) {
      checkLine = `Mission not moving: the same /omni:repair sent ${String(sent)} times`;
      figures = { repairs: sent };
      key = ['repair', cause];
    } else if (mission.runFailed) {
      checkLine = 'Mission not moving: its run on the App failed';
      figures = {};
      key = ['run-failed'];
    } else if (quiet >= 2 * HOUR) {
      checkLine = `Mission not moving: no mission event for ${hours(quiet)} h`;
      figures = { quietHours: Number(hours(quiet)) };
      key = ['quiet', mission.lastEventAt];
    } else {
      return [];
    }
    return [{
      fingerprint: `stuck:mission:${mission.id}`, check: 'mission-not-moving', kind: 'stuck', severity: 'medium',
      title: `Mission #${String(mission.number)} is not moving`,
      checkLine, figures,
      evidence: [{ of: 'mission', id: mission.id, text: clean(mission.title) }],
      evidenceKey: evidenceKey([mission.id, ...key]),
      suggestions: [
        { action: 'pause-mission', label: 'Pause the mission', target: { mission: mission.id } },
        { action: 'open-mission', label: 'Open the mission', target: { mission: mission.id } },
      ],
    }];
  });

/** Waiting too long: a job Need human, Waiting on answers or Held for more than 4 h, which nothing continued. */
export const waitingTooLong: Check = ({ now, jobs }) =>
  jobs.flatMap((job) => {
    const label = job.outcome === null ? undefined : WAITING[job.outcome];
    if (job.status !== 'done' || label === undefined || job.continued) return [];
    const waited = age(job.endedAt, now);
    if (!Number.isFinite(waited) || waited <= 4 * HOUR) return [];
    return [{
      fingerprint: `stuck:waiting:${job.id}`, check: 'waiting-too-long', kind: 'stuck', severity: 'medium',
      title: `A ${skillOf(job.line)} job waits on a person`,
      checkLine: `Waiting too long: ${label} for ${hours(waited)} h`,
      figures: { waitedHours: Number(hours(waited)), state: label },
      evidence: [{ of: 'job', id: job.id, text: clean(job.line) }],
      evidenceKey: evidenceKey([job.id]),
    }];
  });

type FailureGroup = { by: 'reason' | 'line'; text: string; ids: string[] };

/** The failed jobs of the last 6 h, grouped by their reason and by their last line, masked. */
function failureGroups(jobs: readonly WatchJob[], now: number): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();
  const add = (by: FailureGroup['by'], raw: string | null, id: string) => {
    const text = raw === null ? '' : clean(raw, 160);
    if (text === '') return;
    const group = groups.get(`${by}\n${text}`) ?? { by, text, ids: [] };
    group.ids.push(id);
    groups.set(`${by}\n${text}`, group);
  };
  for (const job of jobs) {
    if (job.status !== 'failed' || age(job.endedAt, now) > 6 * HOUR) continue;
    add('reason', job.reason, job.id);
    add('line', job.lastLine, job.id);
  }
  return [...groups.values()];
}

/** Same failure, many jobs: 3 jobs or more ended failed with the same reason, or the same last line, within 6 h. */
export const sameFailure: Check = ({ now, jobs }) => {
  const told = new Set<string>();
  return failureGroups(jobs, now).flatMap((group): Fire[] => {
    const ids = [...group.ids].sort();
    // The same jobs failing with the same reason and the same last line are told once, by their reason.
    if (ids.length < 3 || told.has(ids.join(','))) return [];
    told.add(ids.join(','));
    const what = group.by === 'reason' ? 'the same reason' : 'the same last line';
    return [{
      fingerprint: `bug:same-failure:${evidenceKey([group.by, group.text]).slice(0, 16)}`, check: 'same-failure', kind: 'bug', severity: 'high',
      title: `${String(ids.length)} jobs failed with ${what}`,
      checkLine: `Same failure, many jobs: ${String(ids.length)} jobs failed with ${what} within 6 h: ${group.text}`.slice(0, 300),
      figures: { jobs: ids.length },
      evidence: ids.slice(0, 49).map((id): Evidence => ({ of: 'job', id })),
      evidenceKey: evidenceKey(ids),
    }];
  });
};

/** App route failing: 3 or more of the workspace's App 5xx on one route within 1 h. */
export const routeFailing: Check = ({ now, errors }) => {
  const byRoute = new Map<string, WatchError[]>();
  for (const error of errors) {
    if (age(error.at, now) > HOUR) continue;
    byRoute.set(error.route, [...(byRoute.get(error.route) ?? []), error]);
  }
  return [...byRoute.entries()].flatMap(([route, seen]) => {
    if (seen.length < 3) return [];
    const statuses = [...new Set(seen.map((error) => error.status))].sort();
    return [{
      fingerprint: `bug:route:${route.replace(/\s+/g, '-').slice(0, 180)}`, check: 'route-failing', kind: 'bug', severity: 'high',
      title: `The App answers ${statuses.join(', ')} on ${route}`,
      checkLine: `App route failing: ${String(seen.length)} × 5xx on ${route} within 1 h`,
      figures: { errors: seen.length, statuses: statuses.join(',') },
      evidence: [{ of: 'route', id: route }],
      evidenceKey: evidenceKey([route, statuses]),
    }];
  });
};

/** Late schedule: the ledger's health reads late, or a scheduled kind failed 3 times in a row. */
export const lateSchedule: Check = ({ ledger }) => {
  const fires: Fire[] = [];
  if (ledger.late + ledger.scheduledLate > 0) {
    fires.push({
      fingerprint: 'bug:late-schedule', check: 'late-schedule', kind: 'bug', severity: 'medium',
      title: 'The App\'s job ledger runs late',
      checkLine: `Late schedule: ${String(ledger.late)} jobs late, ${String(ledger.scheduledLate)} schedules with no run for 3 periods`,
      figures: { late: ledger.late, scheduledLate: ledger.scheduledLate },
      evidence: [],
      evidenceKey: evidenceKey(['late']),
    });
  }
  for (const kind of ledger.failing) {
    fires.push({
      fingerprint: `bug:late-schedule:${kind}`, check: 'late-schedule', kind: 'bug', severity: 'medium',
      title: `The App's ${kind} job keeps failing`,
      checkLine: `Late schedule: ${kind} failed 3 times in a row`,
      figures: { failed: 3 },
      evidence: [{ of: 'kind', id: kind }],
      evidenceKey: evidenceKey([kind]),
    });
  }
  return fires;
};

/** How long until `runner`'s disk is full at the rate of its last hour, or null when it is not filling. */
export function fullIn(runner: WatchRunner): number | null {
  const first = runner.disk[0];
  const last = runner.disk.at(-1);
  if (!first || !last || last === first) return null;
  const spent = first.free - last.free;
  const over = Date.parse(last.at) - Date.parse(first.at);
  if (spent <= 0 || over <= 0) return null;
  return (last.free / spent) * over;
}

type RunnerCheck = (runner: WatchRunner, snapshot: WatchSnapshot) => Fire | null;

const diskFilling: RunnerCheck = (runner, { now }) => {
  const full = fullIn(runner);
  if (!online(runner, now) || full === null || full > 6 * HOUR) return null;
  return {
    fingerprint: `health:disk:${runner.id}`, check: 'runner-health', kind: 'health', severity: 'high',
    title: `${runner.name}'s disk fills up`,
    checkLine: `Runner health: ${runner.name}'s disk is full in about ${hours(full)} h at the current rate`,
    figures: { fullInHours: Number(hours(full)), freeBytes: runner.disk.at(-1)?.free ?? 0 },
    evidence: [{ of: 'runner', id: runner.id }],
    evidenceKey: evidenceKey([runner.id, 'disk']),
  };
};

const runnerPaused: RunnerCheck = (runner, { now }) => {
  if (!online(runner, now) || runner.paused === null) return null;
  const why = clean(runner.paused, 80);
  return {
    fingerprint: `health:paused:${runner.id}`, check: 'runner-health', kind: 'health', severity: 'medium',
    title: `${runner.name} is paused`,
    checkLine: `Runner health: ${runner.name} paused for 30 min or more: ${why}`,
    figures: { paused: why },
    evidence: [{ of: 'runner', id: runner.id }],
    evidenceKey: evidenceKey([runner.id, 'paused', runner.paused]),
    raiseAfterMs: 30 * MINUTE,
  };
};

const offlineWithWork: RunnerCheck = (runner, { now, jobs }) => {
  if (online(runner, now)) return null;
  const waiting = jobs.filter((job) => job.status === 'queued' && (job.toRunner === runner.id || runner.repos.includes(job.repo.toLowerCase())));
  if (waiting.length === 0) return null;
  const offline = minutes(age(runner.lastSeenAt, now));
  return {
    fingerprint: `health:offline:${runner.id}`, check: 'runner-health', kind: 'health', severity: 'high',
    title: `${runner.name} is offline with work queued for it`,
    checkLine: `Runner health: ${runner.name} offline for ${offline} min, ${String(waiting.length)} jobs queued it could take`,
    figures: { offlineMin: Number(offline), queued: waiting.length },
    evidence: [{ of: 'runner', id: runner.id }, ...waiting.slice(0, 20).map((job): Evidence => ({ of: 'job', id: job.id }))],
    evidenceKey: evidenceKey([runner.id, 'offline']),
  };
};

const accountsOut: RunnerCheck = (runner, { now }) => {
  const accounts = runner.accounts ?? [];
  if (!online(runner, now) || accounts.length === 0 || accounts.some((state) => state !== 'out')) return null;
  return {
    fingerprint: `health:accounts:${runner.id}`, check: 'runner-health', kind: 'health', severity: 'high',
    title: `Every account of ${runner.name} is out`,
    checkLine: `Runner health: every account of ${runner.name} is out (${String(accounts.length)})`,
    figures: { accounts: accounts.length },
    evidence: [{ of: 'runner', id: runner.id }],
    evidenceKey: evidenceKey([runner.id, 'accounts']),
  };
};

/** Runner health: disk full within 6 h, paused 30 min, offline with queued work, every account out. */
export const runnerHealth: Check = (snapshot) =>
  snapshot.runners.flatMap((runner) => [diskFilling, runnerPaused, offlineWithWork, accountsOut].flatMap((check) => check(runner, snapshot) ?? []));

/** The nine checks, in the spec's order. */
export const CHECKS: readonly Check[] = Object.freeze([
  silentJob, queueStuck, resumeLoop, missionNotMoving, waitingTooLong, sameFailure, routeFailing, lateSchedule, runnerHealth,
]);

/** Every check over `snapshot`: one fire per fingerprint, the first kept. */
export function runChecks(snapshot: WatchSnapshot, checks: readonly Check[] = CHECKS): Fire[] {
  const seen = new Set<string>();
  return checks.flatMap((check) => check(snapshot)).filter((fire) => {
    if (seen.has(fire.fingerprint)) return false;
    seen.add(fire.fingerprint);
    return true;
  });
}
