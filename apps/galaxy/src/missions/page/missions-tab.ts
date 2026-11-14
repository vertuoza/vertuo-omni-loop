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
} as const;

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
  prds: readonly number[];
}

/** One of its events, as far as the tab reads: which PRD reached which point. */
export interface EventRow {
  mission: string;
  kind: string;
  prd: number | null;
  link: string | null;
}

/** A PRD that waits for a person: what to do, and where. */
export interface Waits {
  prd: number;
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
}

/** The tab's view: the workspace the moves are made in (null in the demo) and the fleet's missions, newest first. */
export interface MissionsView {
  workspace: string | null;
  fleet: string;
  missions: MissionView[];
}

const issueHref = (repo: string, number: number) => `https://github.com/${repo}/issues/${String(number)}`;

/** `2 of 4 merged · 1 ready`: the PRDs of the scope and those the mission has met, merged and ready counted once each. */
export function progressOf(status: MissionStatus, prds: readonly number[], events: readonly EventRow[]): string {
  if (status === 'draft') return WORDS.notStarted;
  const merged = new Set(events.filter((e) => e.kind === 'prd-merged' && e.prd !== null).map((e) => e.prd));
  const ready = new Set(events.filter((e) => e.kind === 'prd-ready' && e.prd !== null && !merged.has(e.prd)).map((e) => e.prd));
  const known = new Set<number>(prds);
  for (const event of events) if (event.prd !== null) known.add(event.prd);
  if (known.size === 0) return WORDS.noPrd;
  return `${String(merged.size)} of ${String(known.size)} merged · ${String(ready.size)} ready`;
}

const WAIT = /PRD (\d+): ([^·]+)/g;

/** The PRDs a mission waits a person on, read from what the supervisor wrote (`PRD 2803: approve it · PRD 2804: merge it`), each linked to its latest event's link, else to its issue. */
export function waitsOf(waitingOn: string | null, repo: string, events: readonly EventRow[]): Waits[] {
  if (waitingOn === null) return [];
  return [...waitingOn.matchAll(WAIT)].flatMap((match) => {
    const prd = Number(match[1]);
    const on = (match[2] ?? '').trim();
    if (!Number.isSafeInteger(prd) || on === '') return [];
    const linked = events.find((e) => e.prd === prd && e.link !== null)?.link ?? null;
    return [{ prd, on, href: linked ?? issueHref(repo, prd) }];
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
    progress: progressOf(row.status, row.prds, events),
    waits: waiting ? waitsOf(row.waitingOn, row.repo, events) : [],
    stopped: row.status === 'stopped' ? row.waitingOn : null,
    briefHref: issueHref(row.repo, row.number),
    action: ACTION[row.status],
  };
}

/** The button's words for an action, and while it is being done. */
export const ACTION_WORDS: Readonly<Record<MissionAction, { idle: string; busy: string }>> = {
  start: { idle: WORDS.start, busy: WORDS.starting },
  pause: { idle: WORDS.pause, busy: WORDS.pausing },
  resume: { idle: WORDS.resume, busy: WORDS.resuming },
};
