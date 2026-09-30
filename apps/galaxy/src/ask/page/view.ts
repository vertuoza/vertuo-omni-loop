// What the ask page shows for a session, as a pure function of its rows and the time: the open
// round at the top, or "Claude is working…", "moved to the terminal" or "session closed", and the
// earlier rounds folded into a history below, newest first, each with its answers and where they
// were given (page or terminal). Each round carries its context line (PRD 144): repo · branch ·
// PRD #n · skill · model · tokens · $cost · time to answer, each part left out when unknown — and its
// category chip: one of six or unsorted, and who set it. An answer given with screenshots (PRD 620)
// says how many: "📎 N screenshots"; the pictures themselves are not shown here.
import { readQuestions, type AskQuestion } from '../answer-model';
import { CATEGORY_LABELS, isCategory, type Category } from '../classify';
import { sessionClosed, type AskRound, type AskSession } from '../store';
import { workingState, type WorkingPing, type WorkingState } from '../../working/state';

/** How long the hook waits for the page before the question goes to the terminal (the spec's
 * 540 s, within the hook's 600 s timeout). A round still open after that is no longer the page's. */
export const HOOK_WAIT_MS = 540_000;

/** Where a session came from; missing on a row read before PRD 144's columns, or left out by a demo. */
export type SessionPlace = Partial<Pick<AskSession, 'repo' | 'branch'>>;
/** What a round records besides its questions (PRD 144), missing or null when unknown. */
export type RoundFacts = Partial<Pick<AskRound, 'prd' | 'skill' | 'model' | 'tokens' | 'cost_usd' | 'answered_by' | 'category' | 'category_by' | 'attachments'>>;

export type SessionRow = Pick<AskSession, 'id' | 'owner' | 'title' | 'status' | 'created_at' | 'last_seen_at'> & SessionPlace
  & Partial<Pick<AskSession, 'workspace_id' | 'claude_session_id'>>;
export type RoundRow = Pick<AskRound, 'id' | 'questions' | 'answers' | 'answered_via' | 'status' | 'created_at' | 'answered_at'> & RoundFacts;
/** `ping`: the latest heartbeat of the session's Claude session (PRD 757), null when there is none or
 * it could not be read; left out by a read that does not ask for it. */
export type SessionState = { session: SessionRow; rounds: RoundRow[]; ping?: WorkingPing | null };

export type HistoryLine = {
  header: string; question: string; answer: string | null;
  /** How many screenshots the answer carries (PRD 620); left out when it carries none. */
  screenshots?: number;
};
export type HistoryEntry = {
  id: string;
  lines: HistoryLine[];
  /** answered (page or terminal), moved to the terminal with no answer recorded, or never answered. */
  outcome: 'answered' | 'moved' | 'unanswered';
  via: 'page' | 'terminal' | null;
  at: string;
  /** The round's context line, part by part (see contextParts). */
  context?: string[];
  /** The round's category and who set it (see categoryChip). */
  category?: Category | null;
  category_by?: string | null;
};

export type SessionView =
  | { kind: 'open'; round: RoundRow; questions: AskQuestion[]; movesAt: number; history: HistoryEntry[] }
  | { kind: 'moved'; round: RoundRow; questions: AskQuestion[]; history: HistoryEntry[] }
  | { kind: 'working'; history: HistoryEntry[] }
  | { kind: 'closed'; history: HistoryEntry[] };

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);

function dollars(cost: number) {
  return cost > 0 && cost < 0.005 ? '<$0.01' : `$${cost.toFixed(2)}`;
}

/** A duration as a person reads it: "42 s", "1 min 35 s", "2 h 0 min". */
export function duration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
}

/** The round's context line: repo · branch · PRD #n · skill · model · tokens · $cost · time to answer,
 * each part left out when it is unknown. The time to answer is read, never stored. */
export function contextParts(session: SessionPlace, round: RoundRow): string[] {
  const parts: Array<string | null | undefined> = [session.repo, session.branch, round.prd ? `PRD #${round.prd}` : null, round.skill, round.model];
  const { tokens } = round;
  if (tokens) parts.push(`${compact(tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite)} tokens`);
  if (typeof round.cost_usd === 'number') parts.push(dollars(round.cost_usd));
  if (round.status === 'answered' && round.answered_at) {
    parts.push(`answered in ${duration(Date.parse(round.answered_at) - Date.parse(round.created_at))}`);
  }
  return parts.filter((part): part is string => typeof part === 'string' && part !== '');
}

/** Rounds in the order they were asked. */
export const asked = (a: RoundRow, b: RoundRow) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id);

/** One round as the history lists it: its questions with their answers, its outcome, its context line. */
export function entry(round: RoundRow, session: SessionPlace = {}): HistoryEntry {
  const questions = readQuestions(round.questions);
  const answers = round.answers ?? {};
  const named = new Set(questions.map((q) => q.question));
  const line = (header: string, question: string, answer: string | null): HistoryLine => {
    const screenshots = round.attachments?.[question]?.length ?? 0;
    return screenshots > 0 ? { header, question, answer, screenshots } : { header, question, answer };
  };
  const lines: HistoryLine[] = [
    ...questions.map((q) => line(q.header, q.question, answers[q.question] ?? null)),
    ...Object.entries(answers).filter(([question]) => !named.has(question)).map(([question, answer]) => line('', question, answer)),
  ];
  const outcome = round.status === 'answered' ? 'answered' : round.status === 'abandoned' ? 'moved' : 'unanswered';
  return {
    id: round.id, lines, outcome, via: round.answered_via, at: round.answered_at ?? round.created_at, context: contextParts(session, round),
    category: round.category ?? null, category_by: round.category_by ?? null,
  };
}

/** What an answer with screenshots says about them (PRD 620): "📎 N screenshots", or null for none. */
export function screenshotsNote(count: number | undefined): string | null {
  if (!count || count < 1) return null;
  return `📎 ${count} screenshot${count === 1 ? '' : 's'}`;
}

export function sessionView(state: SessionState, now: number): SessionView {
  const rounds = [...state.rounds].sort(asked);
  const history = (of: RoundRow[]) => of.map((round) => entry(round, state.session)).reverse();
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

/** Whether the tab's terminal is working, asking or idle (PRD 757), by the app's one rule
 * (`workingState`): asking while a round of the session is open, working while its Claude session's
 * heartbeat is fresh, idle otherwise, and always idle once the session is closed. The play dock reads
 * it; the "Claude is working" card keeps reading `sessionView`. */
export function tabWorking(state: SessionState, now: number): WorkingState {
  if (sessionClosed(state.session, now)) return 'idle';
  const open = state.rounds.filter((r) => r.status === 'open').length;
  return workingState(state.ping ?? null, open, now);
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

/** What the category chip shows: the category (null is unsorted), its label, and who set it. */
export type ChipView = { value: Category | null; label: string; setBy: string | null };

/** Who set a round's category, as the person looking reads it: the model, themselves, the session's
 * owner, or another member. A value outside the six reads as unsorted. */
export function categoryChip(
  round: Partial<Pick<RoundRow, 'category' | 'category_by'>>,
  who: { me: string | null; owner: string },
): ChipView {
  const value = isCategory(round.category) ? round.category : null;
  const by = round.category_by ?? null;
  const verb = value ? 'set' : 'cleared';
  const setBy = by === null ? null
    : by === 'model' ? (value ? 'sorted by the model' : null)
    : by === who.me ? `${verb} by you`
    : by === who.owner ? `${verb} by the session owner`
    : `${verb} by a teammate`;
  return { value, label: value ? CATEGORY_LABELS[value] : 'unsorted', setBy };
}

/** A round sorted from the page, as the page shows it at once, before the next read. */
export function withCategory(state: SessionState, roundId: string, set: Pick<RoundRow, 'category' | 'category_by'>): SessionState {
  return { ...state, rounds: state.rounds.map((r) => (r.id === roundId ? { ...r, category: set.category, category_by: set.category_by } : r)) };
}
