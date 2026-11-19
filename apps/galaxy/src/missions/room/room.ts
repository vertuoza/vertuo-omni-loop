import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { HERO_ROLES, roleOf, worksAlone, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import type { WaitLine } from '../limit-wait';
import { prOfLink, qaNowWords, tokensWords, type JobTokens, type QaJob } from './qa';
import { bugMoveOf, repairLinkLabel, repairStateWord, type RepairLine } from '../repair';

// The Operation room's rules (PRD 2842 s8, PRD 2873 s3, the `fleet-room` screen), pure so each is tested without a
// browser: one now line per hero (what a working hero does, else Idle, else, when none of its skills is one a
// runner takes, that a person does it today), the clean-up
// line from the kept saves (PRD 2809), and the ledger of the missions' events, newest first, filtered by role
// and by mission. Every row is a real record: no first name for an agent, no narration.

export const ROOM_WORDS = {
  tab: 'Operation room',
  idle: 'Idle',
  person: 'A person does this today',
  agent: 'agent',
  supervisor: 'Supervisor',
  nothingToClean: 'Nothing to clean up',
  empty: 'No mission has run yet. Start one in Missions.',
  noRows: 'No event matches this filter.',
  now: 'Now',
  cleanUp: 'Clean-up',
  ledger: 'Ledger',
  anyRole: 'Every role',
  anyMission: 'Every mission',
  role: 'Role',
  mission: 'Mission',
  show: 'Show',
} as const;

/** The roles an event is signed by: the six heroes' and the supervisor's own decisions. */
export type EventRole = HeroRole | 'supervisor';
export const EVENT_ROLES: readonly EventRole[] = [...HERO_ROLES, 'supervisor'];

/** A hero as the room reads it. */
export interface HeroLine {
  id: string;
  name: string;
  role: HeroRole;
  skills: readonly string[];
}

/** A mission event as the repository read it. */
export interface EventRow {
  id: string;
  mission: string;
  at: string;
  role: EventRole;
  actor: string;
  kind: string;
  prd: PrdNumber | null;
  job: string | null;
  link: string | null;
  sentence: string;
  /** A job's tokens, on the rows that end or judge it (PRD 3001): null when the agent gave none; undefined on any other row. */
  tokens?: JobTokens | null;
}

/** A kept save, as far as the clean-up line reads it. */
export interface KeptSave {
  bytes: number;
  keepUntil: string;
}

/** The state word each kind of event carries. */
const STATE_WORDS: Readonly<Record<string, string>> = {
  started: 'Started',
  paused: 'Paused',
  resumed: 'Resumed',
  dispatched: 'Sent',
  'job-ended': 'Ended',
  waits: 'Waiting',
  'prd-ready': 'Ready for review',
  'prd-merged': 'Merged',
  held: 'Held',
  stopped: 'Stopped',
  delivered: 'Delivered',
  'prd-joined': 'Joined',
  'prd-dropped': 'Dropped',
  'drop-asked': 'Drop asked',
  'drop-asked-keep': 'Drop asked',
  // The fleet's committee (PRD 2896 s9, s10): what it decided alone, and what it sent to a person.
  decided: 'Decided',
  escalated: 'Sent to you',
  // A mission repairs a failed step (PRD 2980 s6).
  'repair-started': 'Repairing',
  retro: 'Retro',
  'bug-reported': 'Reported',
  // A mission reached a token cap, and a person answered it (PRD 3040).
  'budget-stop': 'Paused',
  'budget-answer': 'Answered',
  // A mission stuck, a milestone retro, a question of its own outbox and the answers to them (PRD 3065).
  stuck: 'Stuck',
  'stuck-answer': 'Answered',
  'milestone-retro': 'Written',
  'item-proposed': 'Proposed',
  'item-answered': 'Answered',
  // The Omni Loop bug team (PRD 3088): a bug taken, set aside on its question, and a bug a PRD waited on that was released fixed.
  'bug-taken': 'Fixing',
  'bug-asked': 'Asked',
  'bug-fixed': 'Fixed',
};

/** A Reviewer's verdict reads `Passed` when it passed and `Changes` when it asked for changes (PRD 2871); QA's (PRD 3001) reads `Passed` on a pass, `Bugs` when it found some; null for any other kind. */
function verdictWord(kind: string, sentence: string): string | null {
  if (kind === 'reviewed') return sentence.startsWith('Passed') ? 'Passed' : 'Changes';
  return kind === 'checked' ? (sentence.startsWith('pass') ? 'Passed' : 'Bugs') : null;
}

/** The Omni Loop bug team's words (PRD 3088): a bug-fixed event reads as what it says (a PRD resumed, a bug that will not be fixed, or fixed), and a bug's open fix pull request waits for a person's merge. Null for any other row. */
function bugWord(kind: string, sentence: string): string | null {
  if (kind === 'bug-fixed') return { 'wont-fix': "Won't fix", resumed: 'Resumed', 'update-kit': 'Fixed', fixed: 'Fixed' }[bugMoveOf(sentence).move];
  return kind === 'job-ended' && sentence.startsWith('Omni Loop bug #') && sentence.includes('is open;') ? 'Waiting for a merge' : null;
}

/** The kinds whose word turns on their sentence: a PRD a mission pull request put on the default branch is a landing (PRD 2896); a retro that was not written and the pause by stuck read as what they are, never as done (PRD 3065, BL-GATE-1). Null for any other row. */
function sentenceWord(kind: string, sentence: string): string | null {
  if (kind === 'prd-merged') return sentence.includes('landed on the default branch') ? 'Landed' : null;
  if (kind === 'milestone-retro') return sentence.startsWith('Retro skipped') ? 'Skipped' : null;
  return kind === 'stuck' && sentence.startsWith('Paused') ? 'Paused' : null;
}

/** The word a ledger row carries: a verdict's, the one its sentence gives, a repair's end, or the kind's fixed word. */
const stateWord = (kind: string, sentence: string): string => verdictWord(kind, sentence) ?? bugWord(kind, sentence) ?? sentenceWord(kind, sentence) ?? repairStateWord(kind, sentence) ?? STATE_WORDS[kind] ?? kind;

/** What a ledger link is called: a Reviewer's verdict links its GitHub review, any other row its PRD or `Open`. */
const linkLabel = (kind: string, prd: PrdNumber | null, link: string | null = null): string => {
  if (kind === 'reviewed') return 'Review';
  if (kind === 'checked') return 'QA comment';
  // A milestone retro's link is its file on the mission branch: its path under `retros/` (PRD 3065).
  if (kind === 'milestone-retro' && link !== null) return link.slice(Math.max(0, link.lastIndexOf('retros/')));
  return repairLinkLabel(kind, link) ?? (prd === null ? 'Open' : `PRD ${String(prd)}`);
};

/** The role's name, as it is signed. */
export const roleName = (role: EventRole): string => (role === 'supervisor' ? ROOM_WORDS.supervisor : roleOf(role).name);

/** `Engineer · agent`, or a member's login when a member acted. */
const signedBy = (row: Pick<EventRow, 'role' | 'actor'>): string =>
  row.actor === 'agent' ? `${roleName(row.role)} · ${ROOM_WORDS.agent}` : row.actor;

/** `2026-11-14 09:12 UTC`: fixed, so the server and the browser write the same words. */
function timeOf(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** One now line. */
export interface NowLine {
  id: string;
  role: HeroRole;
  heading: string;
  words: string;
  state: 'working' | 'checking' | 'idle' | 'person' | 'waiting' | 'repairing' | 'stopped';
  /** A hero whose PRD repairs a failed step or waits on an Omni Loop bug (PRD 2980): the line, its headline and its link. */
  repair?: RepairLine;
  /** A hero whose PRD waits on a provider limit or on room (PRD 2949): the line says so, names the job and links it. */
  wait?: WaitLine;
}

/** The state of a hero whose PRD repairs or waits on an Omni Loop bug: a bug that moved reads as what it did (PRD 3088). */
function repairStateOf(repair: RepairLine): NowLine['state'] {
  if (repair.bug === 'resumed') return 'working';
  if (repair.bug === 'wont-fix') return 'stopped';
  return repair.bug === undefined ? 'repairing' : 'waiting';
}

/** One row of the Omni Loop bug team's room: a bug it holds (PRD 3088, the `fleet-room` screen's 1.A). */
export interface BugLine {
  issue: number;
  role: 'engineer' | 'supervisor';
  words: string;
  chip: 'Fixing' | 'Waiting for a merge' | 'Asked' | 'Waiting for a release';
  link: string | null;
}

const BUG_SENTENCE = /^Omni Loop bug #(\d+) \(reported (\d+)×\)/;

/** The bug a team event is about: its issue and how often it was reported, read from its one sentence; null for any other row. */
function bugOf(event: EventRow): { issue: number; count: number } | null {
  if (event.prd !== null) return null;
  const read = BUG_SENTENCE.exec(event.sentence.replace(/^Took /, ''));
  return read === null ? null : { issue: Number(read[1]), count: Number(read[2]) };
}

/** What an asked event says it was set aside for: the words after `set aside:` up to the first comma, or the tries it spent. */
function askedWhy(sentence: string): string {
  const after = /set aside: (.*)\.$/.exec(sentence)?.[1];
  if (after !== undefined) return after.split(',')[0] ?? after;
  return /set aside after (\d+ tries)/.exec(sentence)?.[1] ?? 'a person decides';
}

/**
 * One row per bug the team holds, from its events, newest first: Fixing while a bug fix runs, `PR #m to merge` once its fix
 * pull request is open, `asked: <why>` once it was set aside. A bug back in line holds no row, and a bug a PRD of this
 * fleet waited on that was fixed drops its merge row.
 */
export function bugLinesOf(events: readonly EventRow[]): BugLine[] {
  const fixed = new Set(events.filter((e) => e.kind === 'bug-fixed').map((e) => Number(/#(\d+)/.exec(e.sentence)?.[1])));
  const seen = new Set<number>();
  const lines: BugLine[] = [];
  for (const event of events.toSorted((a, b) => b.at.localeCompare(a.at))) {
    const bug = bugOf(event);
    if (bug === null || seen.has(bug.issue) || !TEAM_KINDS.includes(event.kind)) continue;
    seen.add(bug.issue);
    const line = bugLineOf(event, bug, fixed.has(bug.issue));
    if (line !== null) lines.push(line);
  }
  return lines;
}

const TEAM_KINDS = ['bug-taken', 'bug-asked', 'job-ended'];

/** The row a bug's newest event gives it, or null when it holds none: back in line, or fixed already. */
function bugLineOf(event: EventRow, bug: { issue: number; count: number }, fixed: boolean): BugLine | null {
  const n = String(bug.issue);
  const times = `${String(bug.count)}×`;
  const row = (role: BugLine['role'], words: string, chip: BugLine['chip']): BugLine => ({ issue: bug.issue, role, words, chip, link: event.link });
  if (event.kind === 'bug-taken') return row('engineer', `Fixing #${n} · reported ${times}`, 'Fixing');
  if (event.kind === 'bug-asked') return row('supervisor', `#${n} · asked: ${askedWhy(event.sentence)}`, 'Asked');
  if (fixed) return null;
  const pr = /fix PR #(\d+) is open/.exec(event.sentence)?.[1];
  if (pr !== undefined) return row('engineer', `#${n} · ${times} · PR #${pr} to merge`, 'Waiting for a merge');
  return event.sentence.includes('waits for its release') ? row('engineer', `#${n} · ${times} · fixed, waits for its release`, 'Waiting for a release') : null;
}

/** The PRD a role is building: its newest `dispatched` event whose job has no `job-ended` yet; events newest first. */
function workingOn(role: EventRole, events: readonly EventRow[]): PrdNumber | null {
  const ended = new Set(events.filter((e) => e.kind === 'job-ended' && e.job !== null).map((e) => e.job));
  const sent = events.find((e) => e.role === role && e.kind === 'dispatched' && e.prd !== null && e.job !== null && !ended.has(e.job));
  return sent?.prd ?? null;
}

/** One line per hero of the fleet: what a working hero does, else Idle; a hero none of whose skills a runner takes reads that a
 * person does it. */
export function nowLines(heroes: readonly HeroLine[], events: readonly EventRow[], waits: readonly WaitLine[] = [], repairs: readonly RepairLine[] = [], qa: readonly QaJob[] = []): NowLine[] {
  return heroes.map((hero) => {
    const heading = `${roleOf(hero.role).name} · ${ROOM_WORDS.agent}`;
    if (!worksAlone(hero.skills)) return { id: hero.id, role: hero.role, heading, words: ROOM_WORDS.person, state: 'person' };
    // A PRD that waits is still the seat's that sent it, though its job ended on the limit: the wait is the line (PRD 2949).
    // A PRD that repairs, or waits on an Omni Loop bug, says so (PRD 2980); a stopped one has its block under the lines.
    const repair = repairs.find((one) => one.kind !== 'stopped' && events.some((e) => e.role === hero.role && e.kind === 'dispatched' && e.prd === one.prd && e.mission === one.mission));
    if (repair !== undefined) return { id: hero.id, role: hero.role, heading, words: repair.headline, state: repairStateOf(repair), repair };
    const wait = waits.find((one) => events.some((e) => e.role === hero.role && e.kind === 'dispatched' && e.prd === one.prd && e.mission === one.mission));
    if (wait !== undefined) return { id: hero.id, role: hero.role, heading, words: wait.headline, state: 'waiting', wait };
    // QA's job that runs (PRD 3001): the pull request it checks, from the newest link a pull request gave the PRD, and its round; or the preview it waits for.
    const checking = hero.role === 'qa' ? qa[0] : undefined;
    if (checking !== undefined) {
      const pr = events.map((e) => (e.mission === checking.mission && e.prd === checking.prd ? prOfLink(e.link) : null)).find((n) => n !== null) ?? null;
      return { id: hero.id, role: hero.role, heading, words: qaNowWords(checking, pr), state: 'checking' };
    }
    const prd = workingOn(hero.role, events);
    if (prd === null) return { id: hero.id, role: hero.role, heading, words: ROOM_WORDS.idle, state: 'idle' };
    return { id: hero.id, role: hero.role, heading, words: `${heading}: building PRD ${String(prd)}`, state: 'working' };
  });
}

const MB = 1024 * 1024;

const sizeOf = (bytes: number): string => (bytes >= MB ? `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)} MB` : `${String(Math.max(1, Math.round(bytes / 1024)))} KB`);

/** The clean-up line: `Nothing to clean up`, or how many saves are kept, how big, until when (the soonest). */
export function cleanUpLine(saves: readonly KeptSave[]): string {
  if (saves.length === 0) return ROOM_WORDS.nothingToClean;
  const soonest = saves.map((s) => s.keepUntil).sort()[0] ?? '';
  const total = saves.reduce((sum, s) => sum + s.bytes, 0);
  return `${String(saves.length)} ${saves.length === 1 ? 'save' : 'saves'} kept · ${sizeOf(total)} · until ${timeOf(soonest).slice(0, 10)}`;
}

/** What the address asks of the ledger: a role and/or a mission, anything else ignored. */
export interface Filter {
  role: EventRole | null;
  mission: string | null;
}

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | null => (Array.isArray(value) ? value[0] : value) || null;

/** The filter `?role=` and `?mission=` name; a role that is none, or a mission of another fleet, filters nothing. */
export function filterOf(query: Query, missions: readonly string[]): Filter {
  const role = one(query.role);
  const mission = one(query.mission);
  return {
    role: EVENT_ROLES.find((r) => r === role) ?? null,
    mission: mission !== null && missions.includes(mission) ? mission : null,
  };
}

/** One ledger row. */
export interface LedgerRow {
  id: string;
  time: string;
  role: EventRole;
  by: string;
  sentence: string;
  prd: PrdNumber | null;
  link: string | null;
  linkLabel: string;
  state: string;
}

/** The ledger: the events the filter keeps, newest first. */
export function ledgerOf(events: readonly EventRow[], filter: Filter): LedgerRow[] {
  return events
    .filter((e) => (filter.role === null || e.role === filter.role) && (filter.mission === null || e.mission === filter.mission))
    .toSorted((a, b) => b.at.localeCompare(a.at))
    .map((e) => ({ id: e.id, time: timeOf(e.at), role: e.role, by: signedBy(e), sentence: e.tokens === undefined ? e.sentence : `${e.sentence} · ${tokensWords(e.tokens)}`, prd: e.prd, link: e.link, linkLabel: linkLabel(e.kind, e.prd, e.link), state: stateWord(e.kind, e.sentence) }));
}

/** The room as the tab shows it. */
export interface RoomView {
  fleet: string;
  /** The fleet's colour, for the role marks. */
  color: string | null;
  now: NowLine[];
  cleanUp: string;
  /** The bugs the Omni Loop bug team holds, one row each (PRD 3088): empty in any other fleet. */
  bugs: BugLine[];
  /** The PRDs that stopped after repairs (PRD 2980): the block under the now lines. */
  stopped: RepairLine[];
  ledger: LedgerRow[];
  missions: { id: string; title: string }[];
  filter: Filter;
  /** True when no mission of the fleet has an event yet. */
  empty: boolean;
}

/** The address of the room with a filter changed, the rest of the query kept. */
export function roomHref(path: string, query: Query, change: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...change })) {
    const v = value === null ? null : one(value);
    if (v !== null) params.set(key, v);
  }
  const text = params.toString();
  return text === '' ? path : `${path}?${text}`;
}
