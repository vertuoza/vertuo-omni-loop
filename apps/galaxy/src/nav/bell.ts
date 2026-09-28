import type { DesktopState } from '../waiting/alerts';
import type { WaitingList, WaitingOutbox, WaitingQuestion } from '../waiting/waiting';

// The top bar's bell (PRD 499), as pure functions. The bell carries the waiting list's count; its panel
// lists two groups, Questions then Outbox, each only when it has something to show, each oldest first
// as the list holds it. A question links to its round's page, an outbox item to its PRD's Outbox tab.
// A part that could not be read says so in its place, above the items it last had. The panel opens on
// the bell and closes on the bell again, Escape (the focus back on the bell), a click outside it, or
// choosing an item. Its foot holds the two alert switches, Desktop alerts and Chime (s5).

/** What the list's parts could not read: a part whose last read failed, and PRDs whose outbox the
 * last read could not reach. */
export type BellUnread = { questions?: boolean; outbox?: boolean; outboxPrds?: number };

/** The two alert switches at the panel's foot, and what flipping one asks. */
export type BellAlerts = {
  desktop: DesktopState;
  chime: boolean;
  onDesktop?: (on: boolean) => void;
  onChime?: (on: boolean) => void;
};

export type BellLine = { id: string; href: string; head: string; text: string; meta: string };

export type BellGroup = { label: 'Questions' | 'Outbox'; problem: string | null; lines: BellLine[] };

export type BellPanel = { groups: BellGroup[]; empty: boolean };

/** The bell's accessible name. */
export const bellName = (count: number) => (count > 0 ? `Waiting for you: ${count}` : 'Nothing waiting for you');

/** The panel's line when nothing waits. */
export const NOTHING_WAITING = 'Nothing waiting for you.';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** How long a question has waited, as a person reads it: "just now", "3 min", "2 h", "3 d". */
export function waitedFor(ms: number): string {
  if (ms < MIN) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MIN)} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h`;
  return `${Math.floor(ms / DAY)} d`;
}

const questionLine = (q: WaitingQuestion, now: number): BellLine => ({
  id: q.id,
  href: `/ask/q/${encodeURIComponent(q.id)}`,
  head: q.sessionTitle,
  text: q.question,
  meta: [waitedFor(now - q.askedAt), q.sharedBy && `shared by ${q.sharedBy}`].filter(Boolean).join(' · '),
});

const outboxLine = (item: WaitingOutbox): BellLine => ({
  id: item.id,
  href: `/prd/${encodeURIComponent(item.dossierId)}?tab=outbox`,
  head: `PRD ${item.prd} · ${item.title}`,
  text: item.question,
  meta: item.rank,
});

const retrying = (label: BellGroup['label']) => `${label} couldn't be read — retrying.`;

function outboxProblem(unread: BellUnread): string | null {
  if (unread.outbox) return retrying('Outbox');
  const prds = unread.outboxPrds ?? 0;
  return prds > 0 ? `${prds} ${prds === 1 ? 'PRD' : 'PRDs'} couldn't be read` : null;
}

/** The panel: its groups, each only when it has items or a problem to say, and whether nothing waits. */
export function bellPanel(list: WaitingList, unread: BellUnread, now: number): BellPanel {
  // Questions oldest first; the outbox as the route ordered it (by PRD, then as its outbox holds them).
  const questions = [...list.questions].sort((a, b) => a.askedAt - b.askedAt || a.id.localeCompare(b.id));
  const all: BellGroup[] = [
    { label: 'Questions', problem: unread.questions ? retrying('Questions') : null, lines: questions.map((q) => questionLine(q, now)) },
    { label: 'Outbox', problem: outboxProblem(unread), lines: list.outbox.map(outboxLine) },
  ];
  const groups = all.filter((g) => g.lines.length > 0 || g.problem !== null);
  return { groups, empty: groups.length === 0 };
}

/** Where the focus goes once the panel has changed: back on the bell, or left where it is. */
export type BellFocus = 'bell' | 'none';

export type BellState = { open: boolean; focus: BellFocus };

/** The bell pressed; Escape; a click outside the bell and its panel; an item chosen. */
export type BellEvent = 'toggle' | 'escape' | 'outside' | 'choose';

export const CLOSED_BELL: BellState = { open: false, focus: 'none' };

export function bell(state: BellState, event: BellEvent): BellState {
  if (!state.open) return event === 'toggle' ? { open: true, focus: 'none' } : state;
  return { open: false, focus: event === 'escape' ? 'bell' : 'none' };
}
