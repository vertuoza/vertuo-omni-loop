// One question, shared (PRD 144): what /ask/q/<round> and /ask/for-me show, as pure functions of the
// rows, the workspace's members and the time. The session's owner and a member the round is shared
// with answer it while it is open; any other member reads it. Once answered, it says who answered
// first, with the answer: the first answer wins, and whoever comes second reads it here.
import { readQuestions, type AskQuestion } from '../answer-model';
import { memberLabel, sessionClosed, type AskMember } from '../store';
import { asked, entry, HOOK_WAIT_MS, minutesLeft, type HistoryEntry, type HistoryLine, type RoundRow, type SessionRow } from './view';

/** A workspace's member, as the page names them. */
export type Member = Pick<AskMember, 'user_id' | 'email' | 'name'>;

/** A round, its session, the session's other rounds, and who the round is shared with. */
export type QuestionState = { session: SessionRow; round: RoundRow; earlier: RoundRow[]; sharedWith: string[] };

export type QuestionView = { earlier: HistoryEntry[] } & (
  | { kind: 'open'; canAnswer: boolean; questions: AskQuestion[]; movesAt: number }
  | { kind: 'answered'; by: string; byMe: boolean; via: 'page' | 'terminal' | null; lines: HistoryLine[] }
  | { kind: 'moved'; questions: AskQuestion[] }
  | { kind: 'closed'; questions: AskQuestion[] }
);

/** A member's name, or who they were when they are no longer in the workspace. */
export function nameOf(id: string | null | undefined, members: Member[]): string {
  const member = id ? members.find((m) => m.user_id === id) : undefined;
  return member ? memberLabel(member) : 'someone who left the workspace';
}

export function questionView(state: QuestionState, me: string | null, members: Member[], now: number): QuestionView {
  const { session, round } = state;
  const before = state.earlier.filter((r) => r.id !== round.id && asked(r, round) < 0).sort(asked);
  const earlier = before.map((r) => entry(r, session)).reverse();
  const questions = readQuestions(round.questions);

  if (round.status === 'answered') {
    const { lines } = entry(round, session);
    const by = round.answered_by ?? null;
    return { kind: 'answered', by: nameOf(by, members), byMe: by !== null && by === me, via: round.answered_via, lines, earlier };
  }
  const movesAt = Date.parse(round.created_at) + HOOK_WAIT_MS;
  if (round.status === 'abandoned' || now >= movesAt) return { kind: 'moved', questions, earlier };
  if (sessionClosed(session, now)) return { kind: 'closed', questions, earlier };
  const canAnswer = me !== null && (me === session.owner || state.sharedWith.includes(me));
  return { kind: 'open', canAnswer, questions, movesAt, earlier };
}

/** The heading of an answered question: whoever comes second reads who came first. */
export function answeredTitle(view: Extract<QuestionView, { kind: 'answered' }>) {
  return view.byMe ? 'Answered by you' : `Already answered by ${view.by}`;
}

/** A round shared with the caller, with its session and who shared it. */
export type ForMeRow = { round: RoundRow; session: SessionRow; sharedBy: string };

export type ForMeEntry = { roundId: string; question: string; sessionTitle: string; sharedBy: string; minutesLeft: number };

/** The rounds shared with the caller that they may still answer, the soonest to move to the terminal first. */
export function forMeList(rows: ForMeRow[], members: Member[], now: number): ForMeEntry[] {
  return rows
    .map((row) => ({ row, movesAt: Date.parse(row.round.created_at) + HOOK_WAIT_MS }))
    .filter(({ row, movesAt }) => row.round.status === 'open' && now < movesAt && !sessionClosed(row.session, now))
    .sort((a, b) => a.movesAt - b.movesAt)
    .map(({ row, movesAt }) => {
      const [first] = readQuestions(row.round.questions);
      return {
        roundId: row.round.id,
        question: first?.question ?? 'A question',
        sessionTitle: row.session.title,
        sharedBy: nameOf(row.sharedBy, members),
        minutesLeft: minutesLeft(movesAt, now),
      };
    });
}
