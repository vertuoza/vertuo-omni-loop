import { readQuestions } from '../ask/answer-model';
import { forMeList, type ForMeRow, type Member } from '../ask/page/question';
import { tabsOf, type TabRow } from '../ask/page/tabs';
import type { SessionRow } from '../ask/page/view';
import { faceOf, type Face } from '../people/face';
import type { People } from '../people/load';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The waiting list (PRD 499): what waits for the person looking, on every app-shell page, as pure
// functions. Two parts: Questions, the open rounds of their own sessions and the ones shared with
// them, and Outbox, a PRD's red-gate items (read by a later slice; empty until then). A question
// counts exactly as the page it links to shows it (the dashboard's rule, PRD 328): while the page can
// still answer it, so not once the terminal has taken it over nor in a closed session. One entry per
// round id, oldest first. The browser tab's title carries the count as a `(N) ` prefix.

/** How often the Questions part is read again while the tab is visible. */
export const WAITING_MS = 5000;

/** How often it is read while the tab is hidden (PRD 657, s10). */
export const HIDDEN_WAITING_MS = 15_000;

/** One question waiting: a round, by its id. */
export type WaitingQuestion = {
  kind: 'question';
  /** The round's id. */
  id: string;
  /** Its session's title, or its repository when it has none. */
  sessionTitle: string;
  /** Its first question's text. */
  question: string;
  /** When it was asked, in ms. */
  askedAt: number;
  /** Who shared it with the person, or null for one of their own sessions. */
  sharedBy: string | null;
  /** The sharer's face (PRD 652), read from their workspace's people directory: the bell's chip. */
  sharedByFace?: Face;
};

/** One outbox item waiting on a PRD's opener: the outbox route's item. */
export type WaitingOutbox = {
  kind: 'outbox';
  id: string;
  prd: PrdNumber;
  dossierId: string;
  title: string;
  rank: 'human-action' | 'high';
  question: string;
};

/** One approval request waiting on the person asked (PRD 1322): a ◆ PRD to approve, by the request's id. */
export type WaitingApproval = {
  kind: 'approval';
  /** The request's id. */
  id: string;
  prd: PrdNumber;
  dossierId: string;
  title: string;
  /** The PRD's repository, as owner/name. */
  repo: string;
  /** When it was asked, in ms. */
  askedAt: number;
};

export type WaitingItem = WaitingQuestion | WaitingOutbox | WaitingApproval;

export type WaitingList = { questions: WaitingQuestion[]; outbox: WaitingOutbox[] };

export const EMPTY_WAITING: WaitingList = { questions: [], outbox: [] };

export type WaitingCounts = { questions: number; shared: number; outbox: number; approvals: number; total: number };

/** A session's text, trimmed; none when it has none (its row is read unparsed, so a title may be missing). */
const trimmedOf = (text: string | null | undefined): string => text?.trim() ?? '';
const sessionTitle = (session: SessionRow) => trimmedOf(session.title) || trimmedOf(session.repo) || 'A terminal';

/** The person's own sessions whose newest round waits on the page. `texts` holds each round's first
 * question, by round id, once read; until then the header stands in. */
export function ownQuestions(rows: readonly TabRow[], texts: ReadonlyMap<string, string>, now: number): WaitingQuestion[] {
  const needing = new Set(tabsOf([...rows], now).filter((t) => t.state === 'needs-you').map((t) => t.id));
  return rows.flatMap(({ session, newest }) => {
    if (!newest || !needing.has(session.id)) return [];
    return [{
      kind: 'question' as const,
      id: newest.id,
      sessionTitle: sessionTitle(session),
      question: texts.get(newest.id) ?? newest.header ?? 'A question',
      askedAt: Date.parse(newest.created_at),
      sharedBy: null,
    }];
  });
}

/** The rounds shared with the person that the page can still answer, named by who shared them, with
 * the sharer's face from the people directory of the round's workspace (`people`, by workspace id);
 * with none, the name's initial. */
export function sharedQuestions(rows: readonly ForMeRow[], members: Member[], now: number, people: ReadonlyMap<string, People> = new Map()): WaitingQuestion[] {
  const byId = new Map(rows.map((r) => [r.round.id, r]));
  return forMeList([...rows], members, now).flatMap((entry) => {
    const row = byId.get(entry.roundId);
    if (!row) return [];
    return [{
      kind: 'question' as const,
      id: entry.roundId,
      sessionTitle: sessionTitle(row.session),
      question: readQuestions(row.round.questions)[0]?.question ?? entry.question,
      askedAt: Date.parse(row.round.created_at),
      sharedBy: entry.sharedBy,
      sharedByFace: (row.session.workspace_id && people.get(row.session.workspace_id)?.byId(row.sharedBy, entry.sharedBy).face) || faceOf({ name: entry.sharedBy }),
    }];
  });
}

/** The Questions part: own and shared, one entry per round id (a shared one keeps who shared it),
 * oldest first. */
export function mergeQuestions(own: readonly WaitingQuestion[], shared: readonly WaitingQuestion[]): WaitingQuestion[] {
  const byId = new Map<string, WaitingQuestion>();
  for (const q of own) byId.set(q.id, q);
  for (const q of shared) byId.set(q.id, q);
  return [...byId.values()].sort((a, b) => a.askedAt - b.askedAt || a.id.localeCompare(b.id));
}

/** The list's counts: the Questions part, the shared ones among them, the Outbox part, the approval
 * requests waiting on the person (PRD 1322, read beside the list), and all three. */
export function waitingCounts(list: WaitingList, approvals = 0): WaitingCounts {
  const questions = list.questions.length;
  const outbox = list.outbox.length;
  return { questions, shared: list.questions.filter((q) => q.sharedBy !== null).length, outbox, approvals, total: questions + outbox + approvals };
}

const PREFIX = /^\(\d+\) /;

/** The page's title with the count: `(N) ` before it above 0, replaced when N changes, gone at 0. */
export function titled(title: string, count: number): string {
  const base = title.replace(PREFIX, '');
  return count > 0 ? `(${count}) ${base}` : base;
}
