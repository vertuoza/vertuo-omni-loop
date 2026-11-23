import 'server-only';
import type { MemberSession } from '../data/member-session';
import { DEMO_TEAMMATE } from '../ask/page/demo';
import type { QuestionSource } from '../ask/page/AskQuestion';
import { readHistoryLive, type HistoryRead } from '../ask/page/history-live';
import { historyChoices, historyList, readHistoryFilters, type HistoryChoices, type HistoryFilters, type HistoryItem } from '../ask/page/workspace-history';

// The Inbox's controller (PRD omni-loop-22, s5; ADR-0095): who reads /app/inbox decides what it draws,
// checked first. The demo in development (or OMNI_LOOP_DEMO=1) answers as the demo's teammate; with no
// database, closed; signed out, the sign-in card; signed in, the Open tab answers as that person, through
// the routes the round page uses, with their sign-in cookie. The list itself is the app shell's waiting
// list, already read for every page: the controller adds no read. The Done tab is today's Questions
// history (/ask/history), read as the person through its own read (src/ask/page/history-live.ts).

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

/** What the Done tab draws: the history under the query's filters, or why it could not be read. */
export type DoneView =
  | { kind: 'history'; items: HistoryItem[]; choices: HistoryChoices; filters: HistoryFilters }
  | Exclude<HistoryRead, { kind: 'rows' }>
  | { kind: 'unreachable' };

export async function doneViewOf(query: Query, now: number, read: (now: number) => Promise<HistoryRead> = readHistoryLive): Promise<DoneView> {
  const history = await read(now).catch((error: unknown) => {
    console.error(error);
    return null;
  });
  if (history === null) return { kind: 'unreachable' };
  if (history.kind !== 'rows') return history;
  const filters = readHistoryFilters(query);
  return { kind: 'history', items: historyList(history.rows, filters, history.members), choices: historyChoices(history.rows, history.members), filters };
}
