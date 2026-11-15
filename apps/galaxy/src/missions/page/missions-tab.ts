import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import type { MissionAction, MissionStatus } from '../missions.contract';

// The Missions tab's rules (PRD 2842 s7, the `mission-start` screen), pure so each is tested without a
// browser: a mission's status in words, its progress (`2 of 4 merged · 1 ready`), each PRD it waits a person
// on (what to do and where), and the one button its status allows. A mission is never shown as a person's.

export const WORDS = {
  tab: 'Missions',
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  starting: 'Starting…',
  pausing: 'Pausing…',
  resuming: 'Resuming…',
  empty: 'No mission yet. A mission is written with /omni:mission.',
  brief: 'Brief',
  notStarted: 'Not started',
  noPrd: 'No PRD sent yet',
  level: 'Level',
  changeLevel: 'Change for this mission',
  branch: 'Branch',
  upToDate: 'up to date',
  behind: 'behind the default branch',
  noneOnBranch: 'no PRD on it yet',
  pull: 'Mission pull request',
} as const;

/** A level in the words the fleet's drawer and this tab use (PRD 2896). */
export const LEVEL_WORDS: Readonly<Record<MissionLevel, string>> = {
  'with-you': 'Reviews with you',
  'own-branch': 'Own branch',
  alone: 'Works alone',
};
export const LEVELS: readonly MissionLevel[] = ['with-you', 'own-branch', 'alone'];

const STATUS_WORDS: Readonly<Record<MissionStatus, string>> = {
  draft: 'Draft',
  running: 'Running',
  waiting: 'Waiting on you',
  paused: 'Paused',
  delivered: 'Delivered',
  stopped: 'Stopped',
};

/** The one move a status allows, or null when none (a delivered or stopped mission is moved by hand). */
const ACTION: Readonly<Record<MissionStatus, MissionAction | null>> = {
  draft: 'start',
  running: 'pause',
  waiting: 'pause',
  paused: 'resume',
  delivered: null,
  stopped: null,
};

/** A mission as the repository read it. */
export interface MissionRow {
  id: string;
  repo: string;
  number: number;
  title: string;
  goal: string;
  status: MissionStatus;
  waitingOn: string | null;
  prds: readonly PrdNumber[];
  /** What it runs at: `with-you` for a mission whose brief names none. */
  level: MissionLevel;
}

/** One of its events, as far as the tab reads: which PRD reached which point. */
export interface EventRow {
  mission: string;
  kind: string;
  prd: PrdNumber | null;
  link: string | null;
  /** What it says: a join names the mission branch it went onto. */
  sentence: string;
}

/** A PRD that waits for a person: what to do, and where. */
export interface Waits {
  prd: PrdNumber;
  on: string;
  href: string;
}

export interface MissionView {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  statusWords: string;
  /** `2 of 4 merged · 1 ready`, or why there is none yet. */
  progress: string;
  waits: Waits[];
  /** Why a stopped mission stopped, and how to carry on. */
  stopped: string | null;
  briefHref: string;
  action: MissionAction | null;
  level: MissionLevel;
  levelWords: string;
  /** A draft's level is changed for this mission alone. */
  canChangeLevel: boolean;
  /** The Branch line (PRD 2896 s8); null for a mission at `with-you`, which has no branch. */
  branch: BranchLine | null;
}

/** The mission branch as the Missions tab says it: the PRDs on it, whether it follows the default branch, the mission pull request. */
export interface BranchLine {
  /** The PRDs on the branch, in the order they joined. */
  prds: PrdNumber[];
  upToDate: boolean;
  /** Why the branch waits on a person (it cannot follow the default branch, or it is red), as the supervisor wrote it. */
  hold: string | null;
  /** The mission pull request: the open pull requests from the branch, null while no join named the branch. */
  pullHref: string | null;
  words: string;
}

/** The tab's view: the workspace the moves are made in (null in the demo) and the fleet's missions, newest first. */
export interface MissionsView {
  workspace: string | null;
  fleet: string;
  missions: MissionView[];
}

const issueHref = (repo: string, number: number) => `https://github.com/${repo}/issues/${String(number)}`;

/** `2 of 4 merged · 1 ready`: the PRDs of the scope and those the mission has met, merged and ready counted once each. */
export function progressOf(status: MissionStatus, prds: readonly PrdNumber[], events: readonly EventRow[], level: MissionLevel = 'with-you'): string {
  if (status === 'draft') return WORDS.notStarted;
  const merged = new Set(events.filter((e) => e.kind === 'prd-merged' && e.prd !== null).map((e) => e.prd));
  const ready = new Set(events.filter((e) => e.kind === 'prd-ready' && e.prd !== null && !merged.has(e.prd)).map((e) => e.prd));
  const known = new Set<PrdNumber>(prds);
  for (const event of events) if (event.prd !== null) known.add(event.prd);
  if (known.size === 0) return WORDS.noPrd;
  // Above `with-you` a PRD is `joined` on the branch before it is `on main` (PRD 2896 s8).
  if (level !== 'with-you') return `${String(merged.size)} of ${String(known.size)} on main · ${String(onBranchOf(events).length)} joined`;
  return `${String(merged.size)} of ${String(known.size)} merged · ${String(ready.size)} ready`;
}

/** The PRDs on the mission branch, in join order: joined, until dropped or on main. `events` are newest first. */
export function onBranchOf(events: readonly EventRow[]): PrdNumber[] {
  const on: PrdNumber[] = [];
  for (const event of events.toReversed()) {
    if (event.prd === null) continue;
    if (event.kind === 'prd-joined' && !on.includes(event.prd)) on.push(event.prd);
    else if (event.kind === 'prd-dropped' || event.kind === 'prd-merged') {
      const at = on.indexOf(event.prd);
      if (at >= 0) on.splice(at, 1);
    }
  }
  return on;
}

const JOINED = /^PRD \d+ joined (\S+):/;
const HOLD = /cannot follow|must follow|is red \(/;

/** The Branch line: the PRDs on the branch, up to date or not, and the pull requests from it; the branch's name is read from the join that named it. */
export function branchOf(row: Pick<MissionRow, 'repo' | 'waitingOn' | 'status'>, events: readonly EventRow[]): BranchLine {
  const prds = onBranchOf(events);
  const named = events.map((event) => (event.kind === 'prd-joined' ? JOINED.exec(event.sentence)?.[1] : undefined)).find((name) => name !== undefined);
  const waiting = row.status === 'running' || row.status === 'waiting';
  const hold = waiting && row.waitingOn !== null && HOLD.test(row.waitingOn) ? row.waitingOn : null;
  const upToDate = hold === null || !/follow/.test(hold);
  const pullHref = named === undefined ? null : `https://github.com/${row.repo}/pulls?q=${encodeURIComponent(`is:pr head:${named}`)}`;
  const on = prds.length === 0 ? WORDS.noneOnBranch : prds.map((prd) => `PRD ${String(prd)}`).join(', ');
  return { prds, upToDate, hold, pullHref, words: `${on} · ${upToDate ? WORDS.upToDate : WORDS.behind}` };
}

const WAIT = /PRD (\d+): ([^·]+)/g;

/** The PRDs a mission waits a person on, read from what the supervisor wrote (`PRD 2803: approve it · PRD 2804: merge it`), each linked to its latest event's link, else to its issue. */
export function waitsOf(waitingOn: string | null, repo: string, events: readonly EventRow[]): Waits[] {
  if (waitingOn === null) return [];
  return [...waitingOn.matchAll(WAIT)].flatMap((match) => {
    const prd = PrdNumberSchema.safeParse(Number(match[1]));
    const on = (match[2] ?? '').trim();
    if (!prd.success || on === '') return [];
    const linked = events.find((e) => e.prd === prd.data && e.link !== null)?.link ?? null;
    return [{ prd: prd.data, on, href: linked ?? issueHref(repo, prd.data) }];
  });
}

/** One mission as the tab shows it; `events` are its own, newest first. */
export function missionOf(row: MissionRow, events: readonly EventRow[]): MissionView {
  const waiting = row.status === 'waiting' || row.status === 'running';
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    statusWords: STATUS_WORDS[row.status],
    progress: progressOf(row.status, row.prds, events, row.level),
    waits: waiting ? waitsOf(row.waitingOn, row.repo, events) : [],
    stopped: row.status === 'stopped' ? row.waitingOn : null,
    briefHref: issueHref(row.repo, row.number),
    action: ACTION[row.status],
    level: row.level,
    levelWords: LEVEL_WORDS[row.level],
    canChangeLevel: row.status === 'draft',
    branch: row.level === 'with-you' || row.status === 'draft' ? null : branchOf(row, events),
  };
}

/** The button's words for an action, and while it is being done. */
export const ACTION_WORDS: Readonly<Record<MissionAction, { idle: string; busy: string }>> = {
  start: { idle: WORDS.start, busy: WORDS.starting },
  pause: { idle: WORDS.pause, busy: WORDS.pausing },
  resume: { idle: WORDS.resume, busy: WORDS.resuming },
};
