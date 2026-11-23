import 'server-only';
import type { MemberSession } from '../data/member-session';
import { DEMO_TEAMMATE } from '../ask/page/demo';
import type { QuestionSource } from '../ask/page/AskQuestion';
import { readHistoryLive, type HistoryRead } from '../ask/page/history-live';
import {
  categoriesOf, historyChoices, historyItemsOf, historyMatched, historyTotal, readHistoryFilters,
  type CategoryCount, type HistoryChoices, type HistoryFilters, type HistoryItem,
} from '../ask/page/workspace-history';

// The Inbox's controller (PRD omni-loop-22, s5; ADR-0095): who reads /app/inbox decides what it draws,
// checked first. The demo in development (or OMNI_LOOP_DEMO=1) answers as the demo's teammate; with no
// database, closed; signed out, the sign-in card; signed in, the Open tab answers as that person, through
// the routes the round page uses, with their sign-in cookie. The list itself is the app shell's waiting
// list, already read for every page: the controller adds no read. The Done tab is today's Questions
// history (/ask/history), read as the person through its own read (src/ask/page/history-live.ts): since
// PRD omni-loop-23 (ADR-0171), one page of 50 and the counts, both read in the database.

/** What the Inbox page is drawn from. */
export type InboxView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'answering'; source: QuestionSource; me: string | null };

export function inboxViewOf(session: MemberSession): InboxView {
  if (session.kind === 'demo') return { kind: 'answering', source: { kind: 'demo' }, me: DEMO_TEAMMATE };
  if (session.kind !== 'signed-in') return { kind: session.kind };
  return { kind: 'answering', source: { kind: 'database', url: session.env.url, key: session.env.key }, me: session.user.id };
}

type Query = Readonly<Record<string, string | string[] | undefined>>;

/** What the Done tab draws: one page of the history under the query's filters, or why it could not be
 * read. `items` is the page (50 at most, newest first); `categories`, every category's count under the
 * other filters, zeros kept; `all`, the rounds the history holds before any filter; `matched`, those
 * every filter lets through; `next`, the cursor of the older page (`?before=`), null on the last.
 * `doneViewOf` always sets `matched` and `next`; a view drawn without them (a render test's) reads as
 * one page, every round matched. */
export type DoneView =
  | {
    kind: 'history'; items: HistoryItem[]; choices: HistoryChoices; filters: HistoryFilters; categories: CategoryCount[];
    all: number; matched?: number; next?: string | null; now: number;
  }
  | Exclude<HistoryRead, { kind: 'page' }>
  | { kind: 'unreachable' };

export async function doneViewOf(
  query: Query,
  now: number,
  read: (filters: HistoryFilters, now: number) => Promise<HistoryRead> = readHistoryLive,
): Promise<DoneView> {
  const filters = readHistoryFilters(query);
  const history = await read(filters, now).catch((error: unknown) => {
    console.error(error);
    return null;
  });
  if (history === null) return { kind: 'unreachable' };
  if (history.kind !== 'page') return history;
  return {
    kind: 'history',
    items: historyItemsOf(history.rows, history.members),
    choices: historyChoices(history.rows, history.members, filters),
    filters,
    categories: categoriesOf(history.facets),
    all: historyTotal(history.facets),
    matched: historyMatched(history.facets, filters),
    next: history.next,
    now,
  };
}
