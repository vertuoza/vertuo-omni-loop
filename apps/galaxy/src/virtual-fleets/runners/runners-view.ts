import type { Board, Job, MissionJobRole, Runner } from '../../runners/runners.contract';
import { gaugesOf, stateTone, waitingWords, type Gauge } from '../../runners/page/health';
import { START_COMMAND, canAnswer, cannotRunReason, couldTake, prWords, prdLineOf, statusTone, statusWords, stateWords, type Fleet, type PrdTitles } from '../../runners/page/model';

// An AI fleet's runners view (PRD 3233 s2): where the fleet's work runs, worked out from the Runners board and the ids of the
// fleet's missions. Pure, so every edge state is tested without a page. A job is the fleet's when it was sent to the fleet or
// belongs to one of its missions. The view lists the fleet's own runners, the Shared runners (another fleet's, or none) that run
// a job of its missions, and the jobs waiting for a slot, each with the reason in a few words.

/** The words of a job's role, as the Runners tab and the list read them. */
const ROLE_WORDS: Readonly<Record<MissionJobRole, string>> = {
  pm: 'PM', engineer: 'Engineer', qa: 'QA', reviewer: 'Reviewer', architect: 'Architect', supervisor: 'Supervisor',
};

/** A job of the fleet, as a row: its role, its PRD or pull request, its status in the Runners page's words and how long it has been in it. */
export type FleetJobRow = {
  id: string;
  role: MissionJobRole | null;
  /** `Engineer`, `QA`…; null for a job of no mission. */
  roleWords: string | null;
  line: string;
  repo: string;
  prd: { number: number; href: string; title: string } | null;
  pr: { words: string; href: string } | null;
  status: string;
  tone: ReturnType<typeof statusTone>;
  /** How long it has been in that status (`18 min`), or null when none counts. */
  since: string | null;
  /** The job waits on the viewer: `Answer` opens the Need human drawer. */
  canAnswer: boolean;
  /** Why it waits, for a queued job; null for any other. */
  reason: string | null;
};

/** A runner of the view. `shared`: it belongs to another fleet or none, and runs work of this one. */
export type FleetRunnerRow = {
  id: string;
  name: string;
  shared: boolean;
  state: Runner['state'];
  tone: string;
  stateWords: string;
  offline: boolean;
  slots: number;
  used: number;
  /** `3 of 3`. */
  slotsWords: string;
  /** A Shared runner: how many jobs it runs for the fleet, `1 for Orion`; null for the fleet's own. */
  forFleetWords: string | null;
  /** A Shared runner: why the fleet's work ran there, `No runner of Orion holds acme/storefront-api`; null for the fleet's own. */
  reason: string | null;
  repos: readonly string[];
  gauges: Gauge[] | null;
  /** The fleet's jobs it runs now. */
  jobs: FleetJobRow[];
};

export type FleetRunnersView = {
  fleet: Fleet;
  /** The runners whose fleet is this one. */
  own: FleetRunnerRow[];
  /** The runners of another fleet or none that run a job of the fleet's missions. */
  shared: FleetRunnerRow[];
  /** The fleet's queued jobs, each with its reason. */
  waiting: FleetJobRow[];
  /** The fleet's jobs that wait on an answer. */
  answers: FleetJobRow[];
  /** `none-in-workspace` (no runner at all), `none-of-its-own` (no runner of the fleet), or null. */
  empty: 'none-in-workspace' | 'none-of-its-own' | null;
  /** The words of the empty state: `No runner in this workspace.`, `No runner of its own.`, or null. */
  emptyWords: string | null;
  /** The command that starts a runner, with `No runner in this workspace.` only. */
  startCommand: string | null;
  /** The notes of the tab: `<k> jobs wait for <runner>.` when every runner of the fleet is offline. */
  notes: string[];
  /** Its runners, own then Shared, for the list's Runs on line. */
  runsOn: FleetRunnerRow[];
  /** The line's one warning: `No runner of its own`, `Its only runner is offline`, or null. */
  warning: string | null;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** How long ago `iso` was, in the Runners page's short words: `18 min`, `3 h`, `2 d`; under a minute, `now`. */
function ago(iso: string, now: Date): string {
  const ms = Math.max(0, now.getTime() - Date.parse(iso));
  if (ms < MIN) return 'now';
  if (ms < HOUR) return `${String(Math.floor(ms / MIN))} min`;
  if (ms < DAY) return `${String(Math.floor(ms / HOUR))} h`;
  return `${String(Math.floor(ms / DAY))} d`;
}

/** When the job entered the status it reads now; null for a status with no time that counts. */
function statusFrom(job: Job): string | null {
  switch (job.status) {
    case 'queued': return job.queuedAt;
    case 'claimed': return job.claimedAt;
    case 'running': return job.runningAt ?? job.claimedAt;
    case 'done': return job.endedAt;
    default: return null;
  }
}

/** Why the runners a job could go to are paused, in a few words: out of tokens until a time, one runner paused, or both or every one. */
function pausedWords(paused: string, live: readonly Runner[]): string {
  const tokens = /^Waiting: every runner out of tokens( until \d\d:\d\d)?/.exec(paused);
  if (tokens) return `Out of tokens${tokens[1] ?? ''}`;
  const [only] = live;
  if (live.length === 1 && only !== undefined) return `${only.name} is paused`;
  return live.length === 2 ? 'Both runners paused' : 'Every runner paused';
}

/** Why a queued job waits, in a few words, or null when a runner is free for it and nothing holds it. */
function waitsFor(job: Job, runners: readonly Runner[], fleets: readonly Fleet[]): string | null {
  const cannot = cannotRunReason(job, runners, fleets);
  if (cannot !== null) return `Cannot run: ${cannot}`;
  const able = runners.filter((runner) => couldTake(job, runner));
  const [first] = able;
  if (first === undefined) return null;
  const live = able.filter((runner) => runner.state !== 'offline');
  if (live.length === 0) return able.length === 1 ? `Waits for ${first.name}.` : 'Every runner offline';
  const paused = waitingWords(job, runners);
  if (paused !== null) return pausedWords(paused, live);
  const busy = live.filter((runner) => runner.used >= runner.slots);
  const [full] = busy;
  return full !== undefined && busy.length === live.length ? `Waits for ${full.name}: ${String(full.used)} of ${String(full.slots)} busy` : null;
}

/** A job of the fleet as a row; `reason` is why a queued job waits, null for any other. */
function jobRowOf(job: Job, reason: string | null, now: Date, prds: PrdTitles): FleetJobRow {
  const from = statusFrom(job);
  const role = job.role ?? null;
  const cannot = reason?.startsWith('Cannot run') === true;
  return {
    id: job.id, role, roleWords: role === null ? null : ROLE_WORDS[role], line: job.line, repo: job.repo,
    prd: prdLineOf(job, prds), pr: job.prUrl === null ? null : { words: prWords(job.prUrl), href: job.prUrl },
    status: statusWords(job, now, cannot), tone: statusTone(job.status, job.outcome, cannot),
    since: from === null ? null : ago(from, now), canAnswer: canAnswer(job), reason,
  };
}

/** The note under the tab when every runner of the fleet is offline and jobs wait: `<k> jobs wait for <runner>.`; none otherwise. */
function offlineNotes(own: readonly FleetRunnerRow[], queued: readonly Job[], runners: readonly Runner[]): string[] {
  const [only] = own;
  if (only === undefined || !own.every((row) => row.offline) || queued.length === 0) return [];
  const jobs = own.length === 1 ? queued.filter((job) => runners.some((runner) => runner.id === only.id && couldTake(job, runner))).length : queued.length;
  const who = own.length === 1 ? only.name : 'its runners';
  if (jobs === 0) return [];
  return [jobs === 1 ? `1 job waits for ${who}.` : `${String(jobs)} jobs wait for ${who}.`];
}

/** The fleet's runners view, from the Runners board (members only), the fleet, the ids of its missions and the clock. `prds` are the PRD titles the page knows; `fleets` the workspace's fleets, for a job's reason. */
export function fleetRunnersView(board: Board, fleet: Fleet, missionIds: readonly string[], now: Date, prds: PrdTitles = {}, fleets: readonly Fleet[] = [fleet]): FleetRunnersView {
  const ofMission = (job: Job): boolean => job.missionId != null && missionIds.includes(job.missionId);
  const theirs = board.jobs.filter((job) => job.toFleet === fleet.name || ofMission(job));
  const known = fleets.some((f) => f.name === fleet.name) ? fleets : [...fleets, fleet];
  const running = theirs.filter((job) => job.status === 'claimed' || job.status === 'running');
  const noneHolds = (repo: string): boolean => !board.runners.some((other) => other.fleet === fleet.name && other.repos.includes(repo));
  const rowFor = (runner: Runner, shared: boolean): FleetRunnerRow => {
    const here = running.filter((job) => job.runner === runner.id);
    const repo = here.find((job) => noneHolds(job.repo))?.repo;
    return {
      id: runner.id, name: runner.name, shared, state: runner.state, tone: stateTone(runner), stateWords: stateWords(runner, now), offline: runner.state === 'offline',
      slots: runner.slots, used: runner.used, slotsWords: `${String(runner.used)} of ${String(runner.slots)}`,
      forFleetWords: shared ? `${String(here.length)} for ${fleet.label}` : null,
      reason: shared && repo !== undefined ? `No runner of ${fleet.label} holds ${repo}` : null,
      repos: runner.repos, gauges: gaugesOf(runner), jobs: here.map((job) => jobRowOf(job, null, now, prds)),
    };
  };
  const own = board.runners.filter((runner) => runner.fleet === fleet.name).map((runner) => rowFor(runner, false));
  const shared = board.runners
    .filter((runner) => runner.fleet !== fleet.name && running.some((job) => job.runner === runner.id && ofMission(job)))
    .map((runner) => rowFor(runner, true));
  const queued = theirs.filter((job) => job.status === 'queued');
  const empty = board.runners.length === 0 ? 'none-in-workspace' : own.length === 0 ? 'none-of-its-own' : null;
  const [only] = own;
  return {
    fleet, own, shared, empty,
    waiting: queued.map((job) => jobRowOf(job, waitsFor(job, board.runners, known), now, prds)),
    answers: theirs.filter((job) => canAnswer(job)).map((job) => jobRowOf(job, null, now, prds)),
    emptyWords: empty === 'none-in-workspace' ? 'No runner in this workspace.' : empty === 'none-of-its-own' ? 'No runner of its own.' : null,
    startCommand: empty === 'none-in-workspace' ? START_COMMAND : null,
    notes: offlineNotes(own, queued, board.runners), runsOn: [...own, ...shared],
    warning: only === undefined ? 'No runner of its own' : own.length === 1 && only.offline ? 'Its only runner is offline' : null,
  };
}
