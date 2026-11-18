import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { MissionStatus } from './missions.contract';

// What a mission's PRD repairs, as the Operation room and the Missions tab say it (PRD 2980 s6, the `fleet-room` screen's Repairing,
// Stopped and Waits on Omni Loop states), pure so each line is tested without a page. The rows are the repairs the database kept
// (`mission_repairs`) and the events the App wrote (`repair-started`, `retro`, `repair-ended`, `bug-reported`, `stopped`); the
// Omni Loop bug a PRD waits on is read from its `bug-reported` event's link, since the bug table is the App's alone.

/** A cause is repaired 3 times in a round, a mission 9 times in all (the database holds both). */
export const CAUSE_REPAIRS = 3;
export const MISSION_REPAIRS = 9;

export const REPAIR_WORDS = {
  repairing: 'Repairing',
  stopped: 'Stopped',
  waitsOn: 'Waits on Omni Loop',
  resume: 'Resume',
  byHand: 'Take it by hand',
  cause: 'Cause',
  tried: 'Repairs tried',
  fix: 'Proposed fix',
  left: 'Left',
} as const;

/** A repair the database kept, as far as the lines read it. */
export interface RepairRow {
  mission: string;
  /** The PRD whose step failed; for a stuck repair the PRD its cause sits in, or null when the cause is the mission's own (PRD 3065). */
  prd: PrdNumber | null;
  /** What sent it: a failed step, or a mission stuck for 5 jobs (PRD 3065). Both spend from the same 3 and 9. */
  trigger: 'failure' | 'stuck';
  fingerprint: string;
  round: number;
  number: number;
  job: string | null;
  fixPr: string | null;
  outcome: 'fixed' | 'not fixed' | 'stopped' | 'lost' | null;
  startedAt: string;
  retro: { cause: string; class: string; proposedFix: string } | null;
}

/** One of the mission's events the lines read. */
export interface RepairEvent {
  mission: string;
  kind: string;
  prd: PrdNumber | null;
  job: string | null;
  link: string | null;
  at: string;
}

/** What the repository read. */
export interface RepairFacts {
  rows: readonly RepairRow[];
  /** Newest first. */
  events: readonly RepairEvent[];
  statuses: ReadonlyMap<string, MissionStatus>;
}

/** A link and its words. */
export interface Linked {
  href: string;
  label: string;
}

/** One repair of a stopped PRD's cause: its fix and how it ended. */
export interface TriedRepair {
  fix: Linked | null;
  words: string;
}

/** One PRD's repair state, in the words a line shows. */
export interface RepairLine {
  mission: string;
  prd: PrdNumber;
  kind: 'repairing' | 'stopped' | 'waits';
  /** `Repairing (2 of 3) · 7 left in this mission`, `PRD 2801 stopped`, or `Waits on Omni Loop bug #3012`. */
  headline: string;
  /** The state chip. */
  chip: string;
  /** The cause in one sentence, with its first 8 characters' name; null when no retro was read yet. */
  cause: string | null;
  fingerprint: string | null;
  /** The fix PR (Repairing), or the Omni Loop issue (Waits). */
  link: Linked | null;
  tried: TriedRepair[];
  proposedFix: string | null;
  /** `6 of 9 left in this mission`. */
  left: string;
  /** `Resume: 3 more for this cause`, on a stopped PRD. */
  resume: string | null;
  /** Where to take a stopped PRD by hand: the link its stop carried; null when none. */
  byHand: string | null;
}

const short = (fingerprint: string): string => fingerprint.slice(0, 8);
export const pullOf = (url: string | null): Linked | null => {
  const n = /\/pull\/(\d+)$/.exec(url ?? '')?.[1];
  return url === null || n === undefined ? null : { href: url, label: `PR ${n}` };
};
const issueOf = (url: string | null): Linked | null => {
  const n = /\/issues\/(\d+)$/.exec(url ?? '')?.[1];
  return url === null || n === undefined ? null : { href: url, label: `Omni Loop bug #${n}` };
};

/** What a repair of a stopped PRD did, as a word. */
export const OUTCOME_WORDS: Readonly<Record<NonNullable<RepairRow['outcome']>, string>> = { fixed: 'Fixed', 'not fixed': 'Not fixed', stopped: 'Stopped', lost: 'Lost' };

const newest = (events: readonly RepairEvent[], prd: PrdNumber, ...kinds: string[]): RepairEvent | undefined => events.find((e) => e.prd === prd && kinds.includes(e.kind));

/** The repairs the mission has left: its 9, less each repair that spent one (a lost one spends nothing). */
export const leftOf = (rows: readonly RepairRow[]): number => Math.max(0, MISSION_REPAIRS - rows.filter((row) => row.outcome !== 'lost').length);

const leftWords = (left: number): string => `${String(left)} of ${String(MISSION_REPAIRS)} left in this mission`;

/** The number a repair at work counts as for its cause: its row's, else one more than the PRD's last that ended not fixed, else 1. */
function numberOf(rows: readonly RepairRow[], prd: PrdNumber, job: string | null): number {
  const own = rows.find((row) => row.job !== null && row.job === job);
  if (own !== undefined) return own.number;
  const last = rows.filter((row) => row.prd === prd).toSorted((a, b) => a.startedAt.localeCompare(b.startedAt)).at(-1);
  return last?.outcome === 'not fixed' ? Math.min(CAUSE_REPAIRS, last.number + 1) : 1;
}

function baseLine(mission: string, prd: PrdNumber, rows: readonly RepairRow[]): Pick<RepairLine, 'mission' | 'prd' | 'cause' | 'fingerprint' | 'tried' | 'proposedFix' | 'left' | 'resume' | 'byHand' | 'link'> {
  const own = rows.filter((row) => row.prd === prd).toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
  const withRetro = own.findLast((row) => row.retro !== null);
  return {
    mission,
    prd,
    cause: withRetro?.retro?.cause ?? null,
    fingerprint: withRetro === undefined ? null : short(withRetro.fingerprint),
    tried: [],
    proposedFix: null,
    left: leftWords(leftOf(rows)),
    resume: null,
    byHand: null,
    link: null,
  };
}

/** The state word a repair's end carries, from its sentence; null for any other kind (the other kinds' fixed words are the room's). */
export function repairStateWord(kind: string, sentence: string): string | null {
  if (kind !== 'repair-ended') return null;
  if (sentence.includes('not fixed')) return 'Not fixed';
  if (sentence.includes('ended fixed')) return 'Fixed';
  return sentence.includes('lost') ? 'Lost' : 'Stopped';
}

/** What a repair row's ledger link is called: its fix pull request, or the Omni Loop issue it was reported as; null for any other row. */
export function repairLinkLabel(kind: string, link: string | null): string | null {
  if (kind === 'bug-reported') return issueOf(link)?.label.replace('bug ', '') ?? null;
  return kind === 'retro' || kind === 'repair-ended' ? (pullOf(link)?.label ?? null) : null;
}

/** One PRD's stopped block. */
function stoppedLine(base: ReturnType<typeof baseLine>, rows: readonly RepairRow[], stopped: RepairEvent): RepairLine {
  const own = rows.filter((row) => row.prd === base.prd).toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
  const last = own.findLast((row) => row.retro !== null);
  const tried = own
    .filter((row) => last === undefined || (row.round === last.round && row.fingerprint === last.fingerprint))
    .map((row) => ({ fix: pullOf(row.fixPr), words: row.outcome === null ? 'Running' : OUTCOME_WORDS[row.outcome] }));
  return {
    ...base,
    kind: 'stopped',
    headline: `PRD ${String(base.prd)} stopped`,
    chip: REPAIR_WORDS.stopped,
    tried,
    proposedFix: last?.retro?.proposedFix ?? null,
    byHand: stopped.link,
    resume: `${REPAIR_WORDS.resume}: ${String(CAUSE_REPAIRS)} more for this cause`,
  };
}

/** A PRD that waits on the Omni Loop bug its repair was reported as, since its repair began. */
function waitsLine(base: ReturnType<typeof baseLine>, events: readonly RepairEvent[], started: RepairEvent): RepairLine | null {
  const bug = newest(events, base.prd, 'bug-reported');
  const issue = bug !== undefined && bug.at >= started.at ? issueOf(bug.link) : null;
  return issue === null ? null : { ...base, kind: 'waits', headline: `Waits on ${issue.label}`, chip: REPAIR_WORDS.waitsOn, link: issue };
}

/** A PRD whose repair is at work: its number for the cause and what is left of the mission's. */
function repairingLine(base: ReturnType<typeof baseLine>, rows: readonly RepairRow[], started: RepairEvent): RepairLine {
  const own = rows.find((row) => row.job !== null && row.job === started.job);
  return {
    ...base,
    kind: 'repairing',
    headline: `Repairing (${String(numberOf(rows, base.prd, started.job))} of ${String(CAUSE_REPAIRS)}) · ${String(leftOf(rows))} left in this mission`,
    chip: REPAIR_WORDS.repairing,
    link: pullOf(own?.fixPr ?? null),
  };
}

/** One PRD's line: waiting on an Omni Loop bug, repairing, or stopped; null when it has nothing to say. */
function lineOf(mission: string, prd: PrdNumber, rows: readonly RepairRow[], events: readonly RepairEvent[], status: MissionStatus | undefined): RepairLine | null {
  const started = newest(events, prd, 'repair-started');
  if (started === undefined) return null;
  // A PRD that got to ready or merged after its last repair began has nothing left to say.
  const done = newest(events, prd, 'prd-ready', 'prd-merged');
  if (done !== undefined && done.at > started.at) return null;
  const base = baseLine(mission, prd, rows);
  const waits = waitsLine(base, events, started);
  if (waits !== null) return waits;
  const ended = events.some((e) => e.kind === 'repair-ended' && e.prd === prd && e.job !== null && e.job === started.job);
  if (!ended) return repairingLine(base, rows, started);
  const stopped = newest(events, prd, 'stopped');
  return status === 'stopped' && stopped !== undefined && stopped.at >= started.at ? stoppedLine(base, rows, stopped) : null;
}

/** The repairing, stopped and waiting PRDs of these facts, one line each, in the order their missions and PRDs were met. */
export function repairLinesOf(facts: RepairFacts): RepairLine[] {
  const missions = new Set([...facts.rows.map((row) => row.mission), ...facts.events.map((e) => e.mission)]);
  return [...missions].flatMap((mission) => {
    const rows = facts.rows.filter((row) => row.mission === mission);
    const events = facts.events.filter((e) => e.mission === mission);
    const prds = new Set([...rows.filter((row) => row.trigger === 'failure').flatMap((row) => (row.prd === null ? [] : [row.prd])), ...events.flatMap((e) => (e.prd === null ? [] : [e.prd]))]);
    return [...prds].flatMap((prd) => lineOf(mission, prd, rows, events, facts.statuses.get(mission)) ?? []);
  });
}
