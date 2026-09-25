// What the ask page shows for a session, as a pure function of its rows and the time: the open
// round at the top, or "Claude is working…", "moved to the terminal" or "session closed", and the
// earlier rounds folded into a history below, newest first, each with its answers and where they
// were given (page or terminal).
import { readQuestions, type AskQuestion } from '../answer-model';
import { sessionClosed, type AskRound, type AskSession } from '../store';

/** How long the hook waits for the page before the question goes to the terminal (the spec's
 * 540 s, within the hook's 600 s timeout). A round still open after that is no longer the page's. */
export const HOOK_WAIT_MS = 540_000;

export type SessionRow = Pick<AskSession, 'id' | 'owner' | 'title' | 'status' | 'created_at' | 'last_seen_at'>;
export type RoundRow = Pick<AskRound, 'id' | 'questions' | 'answers' | 'answered_via' | 'status' | 'created_at' | 'answered_at'>;
export type SessionState = { session: SessionRow; rounds: RoundRow[] };

export type HistoryLine = { header: string; question: string; answer: string | null };
export type HistoryEntry = {
  id: string;
  lines: HistoryLine[];
  /** answered (page or terminal), moved to the terminal with no answer recorded, or never answered. */
  outcome: 'answered' | 'moved' | 'unanswered';
  via: 'page' | 'terminal' | null;
  at: string;
};

export type SessionView =
  | { kind: 'open'; round: RoundRow; questions: AskQuestion[]; movesAt: number; history: HistoryEntry[] }
  | { kind: 'moved'; round: RoundRow; questions: AskQuestion[]; history: HistoryEntry[] }
  | { kind: 'working'; history: HistoryEntry[] }
  | { kind: 'closed'; history: HistoryEntry[] };

const asked = (a: RoundRow, b: RoundRow) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id);

function entry(round: RoundRow): HistoryEntry {
  const questions = readQuestions(round.questions);
  const answers = round.answers ?? {};
  const named = new Set(questions.map((q) => q.question));
  const lines: HistoryLine[] = [
    ...questions.map((q) => ({ header: q.header, question: q.question, answer: answers[q.question] ?? null })),
    ...Object.entries(answers).filter(([question]) => !named.has(question)).map(([question, answer]) => ({ header: '', question, answer })),
  ];
  const outcome = round.status === 'answered' ? 'answered' : round.status === 'abandoned' ? 'moved' : 'unanswered';
  return { id: round.id, lines, outcome, via: round.answered_via, at: round.answered_at ?? round.created_at };
}

export function sessionView(state: SessionState, now: number): SessionView {
  const rounds = [...state.rounds].sort(asked);
  const history = (of: RoundRow[]) => of.map(entry).reverse();
  if (sessionClosed(state.session, now)) return { kind: 'closed', history: history(rounds) };

  const latest = rounds[rounds.length - 1];
  if (!latest || latest.status === 'answered') return { kind: 'working', history: history(rounds) };
  const earlier = history(rounds.slice(0, -1));
  const questions = readQuestions(latest.questions);
  const movesAt = Date.parse(latest.created_at) + HOOK_WAIT_MS;
  if (latest.status === 'open' && questions.length > 0 && now < movesAt) {
    return { kind: 'open', round: latest, questions, movesAt, history: earlier };
  }
  return { kind: 'moved', round: latest, questions, history: earlier };
}

/** Whole minutes left before `movesAt`, rounded up; 0 once it has passed. */
export const minutesLeft = (movesAt: number, now: number) => Math.max(0, Math.ceil((movesAt - now) / 60_000));

/** The round answered on the page, as the page shows it at once, before the next read. */
export function withPageAnswer(state: SessionState, roundId: string, answers: Record<string, string>, now: number): SessionState {
  const answeredAt = new Date(now).toISOString();
  return {
    ...state,
    rounds: state.rounds.map((r) =>
      r.id === roundId ? { ...r, status: 'answered', answers, answered_via: 'page', answered_at: answeredAt } : r,
    ),
  };
}

/** Answers sent from the page that a read has not shown yet, by round id. */
export type Sent = Map<string, { answers: Record<string, string>; at: number }>;

/** A read that left before an answer was sent still shows the round open: keep it answered until
 * the database shows the answer, then forget it (and forget it too if the round went another way). */
export function keepSent(state: SessionState, sent: Sent): SessionState {
  let next = state;
  for (const [roundId, { answers, at }] of sent) {
    const round = state.rounds.find((r) => r.id === roundId);
    if (round?.status === 'open') next = withPageAnswer(next, roundId, answers, at);
    else sent.delete(roundId);
  }
  return next;
}

/** The tab's title: a question waiting shows even when the tab is in the background. */
export const pageTitle = (view: Pick<SessionView, 'kind'>) => (view.kind === 'open' ? '● Claude asks · OMNI LOOP' : 'Ask · OMNI LOOP');
