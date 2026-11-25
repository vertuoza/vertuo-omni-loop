import type { Finding, Message, Seat } from '../api/supervisor.contract';

// The Supervisor page's words and shapes (PRD omni-loop-34 s5), pure, as the before/after page draws them (2.A to
// 2.G): the header's state and its meta line, the Open and Done tabs, the kind chips, the list in two sections by
// severity, the finding pane (the check that fired and its figures first, then the evidence, then the thread), the
// general chat, and the phone's two-way switch. Every answer is read from the Supervisor API's service
// (../api/supervisor.service.ts) by ./load.ts; nothing here reads a database or a clock of its own.

/** How often the open page reads itself again. */
export const SUPERVISOR_REFRESH_MS = 10_000;
/** How often the seat takes a routine look (the spec: every 2 minutes). */
const LOOK_EVERY_MS = 120_000;
/** The looks missed in a row past which the seat reads as offline (the watcher of the watcher, s2). */
const OFFLINE_AFTER_LOOKS = 3;
/** Where the page lives. */
const SUPERVISOR_PATH = '/app/supervisor';
/** Where an owner places or moves the seat (s8 draws Place and Move there). */
export const RUNNERS_PATH = '/app/runners';

export type FindingKind = Finding['kind'];
export type KindFilter = 'all' | FindingKind;
export type Tab = 'open' | 'done';

/** The runner that holds the seat, as the header names it. */
export interface SeatRunner { name: string; slots: number }

/** What the page shows once it is read. */
export interface SupervisorData {
  workspace: string;
  /** Whether the viewer is a workspace owner: only owners act (AC-11). */
  owner: boolean;
  seat: Seat | null;
  runner: SeatRunner | null;
  open: readonly Finding[];
  done: readonly Finding[];
  /** The general thread, oldest first. */
  chat: readonly Message[];
  /** The open finding's thread, oldest first; empty with no finding open. */
  thread: readonly Message[];
  /** How many notes the Supervisor keeps, for `Memory · <n>`. */
  notes: number;
  now: string;
}

export type SupervisorPageView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | ({ kind: 'page' } & SupervisorData);

/** What the address asks for: the tab, the kind chip, the open finding, and the phone's side. */
export interface Query { tab: Tab; kind: KindFilter; finding: string | null; view: 'list' | 'chat' }

const KINDS: readonly FindingKind[] = ['stuck', 'bug', 'health'];
export const KIND_LABEL: Readonly<Record<FindingKind, string>> = { stuck: 'Stuck work', bug: 'Omni Loop bug', health: 'Runner health' };
/** The 16 px sprite before a row, by kind. */
const KIND_SPRITE: Readonly<Record<FindingKind, string>> = { stuck: 'menu-waiting', bug: 'menu-bugs', health: 'item-box' };
const DONE_WORDS: Readonly<Record<Finding['state'], string>> = { open: 'Open', acted: 'Acted', dismissed: 'Not a problem', resolved: 'Resolved' };
export const NO_CHECK = 'Raised by the Supervisor, no check fired';

const isKind = (value: string | null): value is FindingKind => value !== null && (KINDS as readonly string[]).includes(value);

/** The query of `?tab=&kind=&finding=&view=`, each unknown value read as its default. */
export function queryOf(params: Readonly<Record<string, string | null>>): Query {
  const kind = params.kind ?? null;
  return {
    tab: params.tab === 'done' ? 'done' : 'open',
    kind: isKind(kind) ? kind : 'all',
    finding: params.finding ?? null,
    view: params.view === 'chat' ? 'chat' : 'list',
  };
}

/** The page's address for `query` with `change`, defaults left out. */
export function hrefOf(query: Query, change: Partial<Query> = {}): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.tab !== 'open') params.set('tab', next.tab);
  if (next.kind !== 'all') params.set('kind', next.kind);
  if (next.finding !== null) params.set('finding', next.finding);
  if (next.view !== 'list') params.set('view', next.view);
  const search = params.toString();
  return search ? `${SUPERVISOR_PATH}?${search}` : SUPERVISOR_PATH;
}

// ── Words for numbers and times ───────────────────────────────────────────────

/** Tokens in short: 980, 412k, 5M, 1.3M. */
export function tokenWords(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens < 1_000_000) return `${String(Math.round(tokens / 1000))}k`;
  return `${String(Math.round(tokens / 100_000) / 10)}M`;
}

/** A span in short: 40 s, 12 min, 1 h 20. */
export function spanWords(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${String(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest).padStart(2, '0')}`;
}

/** The wait before the next look: 1 min 20, 40 s, or now once it is due. */
export function nextWords(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds <= 0) return 'now';
  if (seconds < 60) return `${String(seconds)} s`;
  const rest = seconds % 60;
  return rest === 0 ? `${String(seconds / 60)} min` : `${String(Math.floor(seconds / 60))} min ${String(rest).padStart(2, '0')}`;
}

/** A time of day, as the page shows it: 14:02 (UTC, as the Runners page). */
const clockWords = (iso: string): string => iso.slice(11, 16);

// ── The header ────────────────────────────────────────────────────────────────

export type HeaderState = 'watching' | 'paused' | 'offline' | 'limit' | 'none';

/** One part of the meta line: an optional word before, the value in bold, an optional word after. */
export interface Meta { before?: string; value?: string; after?: string }

export interface Header {
  state: HeaderState;
  /** The state's words beside the name: `Watching`, `Offline since 14:02`. */
  label: string;
  meta: readonly Meta[];
  /** The phone's one line under the name: `atlas-01 · last look 40 s`. */
  short: string;
  /** The offline notice's words, with the runner; null unless offline. */
  offline: string | null;
}

/** Whether the seat has missed its looks: 3 in a row, or as long since its last one. */
function isOffline(seat: Seat, now: number): boolean {
  if (seat.lastLookAt === null) return true;
  return seat.missedLooks >= OFFLINE_AFTER_LOOKS || now - Date.parse(seat.lastLookAt) >= OFFLINE_AFTER_LOOKS * LOOK_EVERY_MS;
}

/** The offline header: since its last look, or with none yet. */
function offlineHeader(seat: Seat, name: string, seatMeta: Meta, short: string): Header {
  const at = seat.lastLookAt === null ? null : clockWords(seat.lastLookAt);
  return {
    state: 'offline', label: at === null ? 'Offline: no look yet' : `Offline since ${at}`, short,
    meta: [seatMeta, { before: 'last look', value: at ?? 'none yet' }, { after: 'checks still run every 2 min' }],
    offline: at === null ? `The Supervisor has not looked yet on ${name}.` : `Offline since ${at} on ${name}.`,
  };
}

const NO_SEAT: Header = { state: 'none', label: 'No seat yet', meta: [{ after: 'An owner places the Supervisor on a runner, on the Runners page.' }], short: 'No seat yet', offline: null };

/** The header for the seat: offline first, then paused by an owner, then past its token limit, else watching. */
export function headerOf(seat: Seat | null, runner: SeatRunner | null, nowIso: string): Header {
  if (seat === null) return NO_SEAT;
  const now = Date.parse(nowIso);
  const name = runner?.name ?? 'its runner';
  const seatMeta: Meta = { before: 'seat', value: runner ? `${runner.name} · slot ${String(runner.slots)}` : name };
  const tokens: Meta = { value: tokenWords(seat.tokensToday), after: `tokens today of ${tokenWords(seat.dailyTokens)}` };
  const since = seat.lastLookAt === null ? null : now - Date.parse(seat.lastLookAt);
  const ago = since === null ? 'none yet' : spanWords(since);
  const short = `${name} · last look ${ago}`;
  if (isOffline(seat, now)) return offlineHeader(seat, name, seatMeta, short);
  const lastAgo: Meta = { before: 'last look', value: since === null ? ago : `${ago} ago` };
  const quiet = (state: HeaderState, label: string): Header => ({ state, label, meta: [seatMeta, lastAgo, tokens], short, offline: null });
  if (seat.paused) return quiet('paused', 'Paused by you');
  if (!seat.thinking) return quiet('limit', `Thinking paused until midnight: ${tokenWords(seat.tokensToday)} tokens used`);
  const next: Meta = { before: 'next in', value: nextWords(since === null ? 0 : LOOK_EVERY_MS - since) };
  return { state: 'watching', label: 'Watching', meta: [seatMeta, lastAgo, next, tokens], short, offline: null };
}

// ── The list ──────────────────────────────────────────────────────────────────

export interface Chip { id: KindFilter; label: string; count: number }

/** The kind chips, each counting the tab's findings of its kind. */
export function chipsOf(findings: readonly Finding[]): Chip[] {
  return [
    { id: 'all', label: 'All', count: findings.length },
    ...KINDS.map((kind) => ({ id: kind, label: KIND_LABEL[kind], count: findings.filter((f) => f.kind === kind).length })),
  ];
}

/** The check that fired, split for the pane: its name in bold, then each figure. */
export interface Check { name: string; figures: readonly string[]; fired: boolean }

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** `Silent job: no line for 52 min, 3× the 2.5 min usual` → Silent job, [No line for 52 min, 3× the 2.5 min usual]. */
export function checkOf(line: string | null): Check {
  if (line === null) return { name: NO_CHECK, figures: [], fired: false };
  const colon = line.indexOf(': ');
  if (colon < 0) return { name: line, figures: [], fired: true };
  const figures = line.slice(colon + 2).split(', ').map((part) => part.trim()).filter((part) => part !== '').map(capital);
  return { name: line.slice(0, colon), figures, fired: true };
}

export interface Row {
  id: string;
  kind: FindingKind;
  severity: Finding['severity'];
  sprite: string;
  context: string;
  title: string;
  /** The check and its figures, in one line: `Silent job · No line for 52 min · 3× the 2.5 min usual`. */
  line: string;
  /** How long it has been open (or how long ago it closed, on Done). */
  age: string;
  /** Open and high: the age reads late, in red. */
  late: boolean;
  /** On Done, how it ended; null on Open. */
  ended: string | null;
}

function rowOf(finding: Finding, now: number): Row {
  const check = checkOf(finding.checkLine);
  const open = finding.state === 'open';
  const from = open ? finding.createdAt : finding.closedAt ?? finding.createdAt;
  return {
    id: finding.id, kind: finding.kind, severity: finding.severity, sprite: KIND_SPRITE[finding.kind], context: KIND_LABEL[finding.kind],
    title: finding.title, line: [check.name, ...check.figures].join(' · '), age: spanWords(now - Date.parse(from)),
    late: open && finding.severity === 'high', ended: open ? null : DONE_WORDS[finding.state],
  };
}

export interface Section { id: 'high' | 'medium' | 'done'; title: string; rows: readonly Row[] }

const newest = (key: (f: Finding) => string) => (a: Finding, b: Finding) => key(b).localeCompare(key(a));

/** The tab's list for the chip: Needs you now (high) then When you have a minute (medium) on Open, newest first, each only
 * when it holds a row; Done in one section, the last closed first. */
export function sectionsOf(tab: Tab, findings: readonly Finding[], kind: KindFilter, nowIso: string): Section[] {
  const now = Date.parse(nowIso);
  const shown = findings.filter((f) => kind === 'all' || f.kind === kind);
  if (tab === 'done') {
    const rows = [...shown].sort(newest((f) => f.closedAt ?? f.createdAt)).map((f) => rowOf(f, now));
    return rows.length === 0 ? [] : [{ id: 'done', title: 'Done', rows }];
  }
  const sorted = [...shown].sort(newest((f) => f.createdAt));
  const sections: Section[] = [
    { id: 'high', title: 'Needs you now', rows: sorted.filter((f) => f.severity === 'high').map((f) => rowOf(f, now)) },
    { id: 'medium', title: 'When you have a minute', rows: sorted.filter((f) => f.severity === 'medium').map((f) => rowOf(f, now)) },
  ];
  return sections.filter((section) => section.rows.length > 0);
}

/** The open high findings: the menu's red count. */
export const highCount = (open: readonly Finding[]): number => open.filter((f) => f.state === 'open' && f.severity === 'high').length;

// ── The pane ──────────────────────────────────────────────────────────────────

/** The finding the address opens, on either tab; null when it names none of them. */
export function openFinding(data: Pick<SupervisorData, 'open' | 'done'>, id: string | null): Finding | null {
  if (id === null) return null;
  return [...data.open, ...data.done].find((f) => f.id === id) ?? null;
}

/** One line of the evidence: a string as written, a number as such, an object as `key value · key value`. */
function evidenceLine(item: unknown): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  if (item === null || typeof item !== 'object') return '';
  return Object.entries(item).map(([key, value]) => `${key} ${typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}`).join(' · ');
}

/** The evidence, one line each, empty ones left out, at most 20. */
export const evidenceOf = (evidence: readonly unknown[]): string[] => evidence.map(evidenceLine).filter((line) => line !== '').slice(0, 20);

/** The suggestions a finding carries, at most two, by their labels. */
export const suggestionsOf = (finding: Finding): string[] =>
  finding.proposals.filter((p) => p.kind === 'suggestion' && p.label !== null).slice(0, 2).map((p) => p.label ?? '');

/** One message of a thread, as drawn: who wrote it, when, its paragraphs, and the memory note that shaped it. */
export interface Said { id: string; who: string; agent: boolean; at: string; paragraphs: readonly string[]; remembered: string | null }

const paragraphsOf = (body: string) => body.split(/\n+/).map((p) => p.trim()).filter((p) => p !== '');

function saidOf(message: Message): Said {
  const who = message.kind === 'supervisor' ? 'Supervisor' : message.kind === 'result' ? 'Result' : message.by ?? 'An owner';
  return { id: message.id, who, agent: message.kind === 'supervisor', at: clockWords(message.at), paragraphs: paragraphsOf(message.body), remembered: message.remembered };
}

/** A finding's thread: the Supervisor's explanation first, at its look, then the messages. */
export function threadOf(finding: Finding, messages: readonly Message[]): Said[] {
  const explained: Said[] = finding.explanation !== null && finding.lookedAt !== null
    ? [{ id: `${finding.id}:explanation`, who: 'Supervisor', agent: true, at: clockWords(finding.lookedAt), paragraphs: paragraphsOf(finding.explanation), remembered: null }]
    : [];
  return [...explained, ...messages.map(saidOf)];
}

/** The general thread. */
export const chatOf = (messages: readonly Message[]): Said[] => messages.map(saidOf);

/** The Chat row's last line: `Last: “Fix both: 9 free slots.”` and its time, or none yet. */
export function lastSaid(chat: readonly Message[]): { line: string; at: string | null } {
  const last = chat.at(-1);
  if (!last) return { line: 'No message yet', at: null };
  const first = paragraphsOf(last.body).at(-1) ?? last.body;
  return { line: `Last: “${first}”`, at: clockWords(last.at) };
}

/** Below 900 px only one side shows: the pane once a finding it holds is open or the chat is asked for, else the list. */
export const phoneSide = (query: Query, opened: boolean): 'list' | 'pane' => (opened || query.view === 'chat' ? 'pane' : 'list');

/** The daily token limit an owner typed, in millions (`5`, `2.5`), as tokens; null when it is not a number from 0.001 to
 * 1000 (the route's 1 to 1,000,000,000). */
export function limitOf(typed: string): number | null {
  const millions = Number(typed.trim().replace(',', '.'));
  if (typed.trim() === '' || !Number.isFinite(millions)) return null;
  const tokens = Math.round(millions * 1_000_000);
  return tokens >= 1000 && tokens <= 1_000_000_000 ? tokens : null;
}
