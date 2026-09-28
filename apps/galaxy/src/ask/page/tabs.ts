// The person's ask page as tabs, one per terminal (PRD 142), as pure functions of the sessions,
// each one's newest round, and the time. A tab needs the person while its newest round is open and
// the hook still waits for the page; the ones that do come first, oldest question first, then the
// others, most recently active first. The page opens on the first tab, or on the one its link names,
// and never changes the selection by itself: a question arriving elsewhere only badges that tab. The
// browser title's count is the waiting list's, prefixed on every app page alike (PRD 499).
import { readQuestions } from '../answer-model';
import { sessionClosed, type AskRoundStatus } from '../store';
import { HOOK_WAIT_MS, type SessionRow, type SessionState } from './view';

/** A session's newest round, as the tab list needs it: its state, and its first question's header. */
export type TabRound = { id: string; status: AskRoundStatus; created_at: string; header: string | null };
/** One open session, as the list reader reads it. */
export type TabRow = { session: SessionRow; newest: TabRound | null };

export type TabState = 'needs-you' | 'working' | 'closed';
export type Tab = {
  id: string;
  title: string;
  header: string | null;
  state: TabState;
  /** How long the question has waited, while the tab needs the person. */
  age: string | null;
  askedAt: number | null;
  activeAt: number;
};

const time = (iso: string) => Date.parse(iso);

/** The header of a round's first question, or null when it has none the page can read. */
export function headerOf(questions: unknown): string | null {
  return readQuestions(questions).find((q) => q.header !== '')?.header ?? null;
}

/** A whole session, as the tab list reads it. */
export function rowOf(state: SessionState): TabRow {
  const newest = [...state.rounds].sort((a, b) => time(b.created_at) - time(a.created_at) || b.id.localeCompare(a.id))[0];
  return {
    session: state.session,
    newest: newest ? { id: newest.id, status: newest.status, created_at: newest.created_at, header: headerOf(newest.questions) } : null,
  };
}

/** A wait, as a tab says it. The hook waits 9 minutes at most, so minutes are enough. */
export const ageLabel = (ms: number) => (ms < 60_000 ? 'just now' : `${Math.floor(ms / 60_000)} min`);

function tab({ session, newest }: TabRow, now: number): Tab {
  const closed = sessionClosed(session, now);
  const asked = newest ? time(newest.created_at) : null;
  const waiting = !closed && newest?.status === 'open' && asked !== null && now - asked < HOOK_WAIT_MS;
  return {
    id: session.id,
    title: session.title,
    header: newest?.header ?? null,
    state: closed ? 'closed' : waiting ? 'needs-you' : 'working',
    age: waiting ? ageLabel(Math.max(0, now - asked!)) : null,
    askedAt: waiting ? asked : null,
    activeAt: Math.max(time(session.last_seen_at), asked ?? 0),
  };
}

function order(a: Tab, b: Tab): number {
  const need = Number(b.state === 'needs-you') - Number(a.state === 'needs-you');
  if (need) return need;
  if (a.state === 'needs-you') return a.askedAt! - b.askedAt! || a.id.localeCompare(b.id);
  return b.activeAt - a.activeAt || a.id.localeCompare(b.id);
}

/** The tabs of these sessions, in the page's order. */
export const tabsOf = (rows: TabRow[], now: number): Tab[] => rows.map((r) => tab(r, now)).sort(order);

/** How many tabs need the person. */
export const needsYou = (tabs: Tab[]) => tabs.filter((t) => t.state === 'needs-you').length;

/** A question page's title: Claude asks while the person may answer it. The waiting list prefixes
 * the count (PRD 499). */
export const askTitle = (asking: boolean) => (asking ? 'Claude asks · OMNI LOOP' : 'Ask · OMNI LOOP');

/** /ask's title, whatever waits: the waiting list prefixes the count (PRD 499). */
export const tabsTitle = () => askTitle(true);

/** The tab /ask selects: the first in the order. */
export const firstTab = (tabs: Tab[]) => tabs[0]?.id ?? null;

/** The page: the open sessions as last read, the selected tab, and the selected session when it is
 * not among them (a closed one the link named, or one that closed while selected), shown last.
 * `listOpen` is the folded tab list on a phone, below 720 px: opened from its row, closed again once
 * a tab is picked. From 720 px the list always shows and it is not read. */
export type Page = { rows: TabRow[]; selected: string | null; kept: TabRow | null; listOpen: boolean };

/** The page as the server opens it: on the tab the link names (`linked`, its row when the list does
 * not hold it), or on the first tab. */
export function startPage(rows: TabRow[], selectedId: string | null, linked: TabRow | null, now: number): Page {
  const selected = selectedId ?? firstTab(tabsOf(rows, now));
  const listed = rows.some((r) => r.session.id === selected);
  return { rows, selected, kept: !listed && linked?.session.id === selected ? linked : null, listOpen: false };
}

/** The folded tab list's row, pressed: the list opens, or closes again. The selection stays. */
export const toggleList = (page: Page): Page => ({ ...page, listOpen: !page.listOpen });

/** A tab picked from the list: the list closes. The tab's own address selects it, so picking the
 * one already selected only closes the list. */
export const pickTab = (page: Page): Page => ({ ...page, listOpen: false });

/** A new read of the list. The selection never moves; a selected session that left the list stays,
 * closed, as the last tab. */
export function pageWithList(page: Page, rows: TabRow[]): Page {
  const { selected } = page;
  if (selected === null || rows.some((r) => r.session.id === selected)) return { ...page, rows, kept: null };
  const was = page.rows.find((r) => r.session.id === selected) ?? page.kept;
  const kept = was && { ...was, session: { ...was.session, status: 'closed' as const } };
  return { ...page, rows, kept };
}

/** The selected session as its pane last read it, which is fresher than the list's row for it. */
export function pageWithPane(page: Page, pane: SessionState): Page {
  if (pane.session.id !== page.selected) return page;
  const row = rowOf(pane);
  const listed = page.rows.some((r) => r.session.id === row.session.id);
  return listed
    ? { ...page, rows: page.rows.map((r) => (r.session.id === row.session.id ? row : r)) }
    : { ...page, kept: row };
}

/** The tabs the page shows: the listed sessions in order, then the kept one. */
export function pageTabs(page: Page, now: number): Tab[] {
  const tabs = tabsOf(page.rows, now);
  return page.kept ? [...tabs, tab(page.kept, now)] : tabs;
}
