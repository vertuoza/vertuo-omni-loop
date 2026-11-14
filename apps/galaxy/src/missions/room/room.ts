import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { HERO_ROLES, roleLine, roleOf, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';

// The Operation room's rules (PRD 2842 s8, the `fleet-room` screen), pure so each is tested without a browser:
// one now line per hero (what a working hero does, else Idle, else that a person does it today), the clean-up
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

/** The roles an event is signed by: the five heroes' and the supervisor's own decisions. */
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
};

/** A Reviewer's verdict reads `Passed` when it passed and `Changes` when it asked for changes (PRD 2871); any other kind has its fixed word. */
const stateWord = (kind: string, sentence: string): string =>
  kind === 'reviewed' ? (sentence.startsWith('Passed') ? 'Passed' : 'Changes') : (STATE_WORDS[kind] ?? kind);

/** What a ledger link is called: a Reviewer's verdict links its GitHub review, any other row its PRD or `Open`. */
const linkLabel = (kind: string, prd: PrdNumber | null): string => (kind === 'reviewed' ? 'Review' : prd === null ? 'Open' : `PRD ${String(prd)}`);

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
  state: 'working' | 'idle' | 'person';
}

/** The PRD a role is building: its newest `dispatched` event whose job has no `job-ended` yet; events newest first. */
function workingOn(role: EventRole, events: readonly EventRow[]): PrdNumber | null {
  const ended = new Set(events.filter((e) => e.kind === 'job-ended' && e.job !== null).map((e) => e.job));
  const sent = events.find((e) => e.role === role && e.kind === 'dispatched' && e.prd !== null && e.job !== null && !ended.has(e.job));
  return sent?.prd ?? null;
}

/** One line per hero of the fleet: what a working hero does, else Idle; a hero that cannot work alone reads that a person does it. */
export function nowLines(heroes: readonly HeroLine[], events: readonly EventRow[]): NowLine[] {
  return heroes.map((hero) => {
    const heading = `${roleOf(hero.role).name} · ${ROOM_WORDS.agent}`;
    if (!roleLine(hero.role, hero.skills).alone) return { id: hero.id, role: hero.role, heading, words: ROOM_WORDS.person, state: 'person' };
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
    .map((e) => ({ id: e.id, time: timeOf(e.at), role: e.role, by: signedBy(e), sentence: e.sentence, prd: e.prd, link: e.link, linkLabel: linkLabel(e.kind, e.prd), state: stateWord(e.kind, e.sentence) }));
}

/** The room as the tab shows it. */
export interface RoomView {
  fleet: string;
  /** The fleet's colour, for the role marks. */
  color: string | null;
  now: NowLine[];
  cleanUp: string;
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
