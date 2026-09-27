import { describe, it, expect } from 'vitest';
import { answeredTitle, forMeList, questionView, type ForMeRow, type QuestionState } from './question';
import { HOOK_WAIT_MS, type RoundRow, type SessionRow } from './view';

const NOW = Date.parse('2026-09-26T10:00:00Z');
const MIN = 60_000;
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const ADA = 'ada';
const BOB = 'bob';
const DAN = 'dan';
const MEMBERS = [
  { user_id: ADA, email: 'ada@vertuoza.com', name: null },
  { user_id: BOB, email: 'bob@vertuoza.com', name: 'BOB' },
  { user_id: DAN, email: 'dan@vertuoza.com', name: null },
];
const QUESTIONS = [{ question: 'Which storage?', header: 'Storage', multiSelect: false, options: [{ label: 'Postgres', description: '' }, { label: 'Memory', description: '' }] }];

const session = (patch: Partial<SessionRow> = {}): SessionRow => ({
  id: 'session-1', owner: ADA, title: 'vertuo-omni-loop · feat/sharing', status: 'open', created_at: at(60 * MIN), last_seen_at: at(1000), ...patch,
});
const round = (id: string, ago: number, patch: Partial<RoundRow> = {}): RoundRow => ({
  id, questions: QUESTIONS, answers: null, answered_via: null, status: 'open', created_at: at(ago), answered_at: null, ...patch,
});
const answered = (id: string, ago: number, by: string, via: 'page' | 'terminal' = 'page') =>
  round(id, ago, { status: 'answered', answers: { 'Which storage?': 'Memory' }, answered_via: via, answered_at: at(ago - 5000), answered_by: by });

function state(target: RoundRow, patch: Partial<QuestionState> = {}): QuestionState {
  return {
    session: session(),
    round: target,
    earlier: [answered('r1', 20 * MIN, ADA, 'terminal'), answered('r2', 10 * MIN, BOB)],
    sharedWith: [BOB],
    ...patch,
  };
}

describe('one question, at /ask/q/<round>', () => {
  it('lets the owner and the member it is shared with answer it while it is open, with the time left', () => {
    for (const me of [ADA, BOB]) {
      const view = questionView(state(round('r3', 2 * MIN)), me, MEMBERS, NOW);
      expect(view.kind, me).toBe('open');
      if (view.kind !== 'open') continue;
      expect(view.canAnswer).toBe(true);
      expect(view.movesAt).toBe(NOW - 2 * MIN + HOOK_WAIT_MS);
      expect(view.questions.map((q) => q.question)).toEqual(['Which storage?']);
    }
  });

  it('shows it read-only to any other member', () => {
    const view = questionView(state(round('r3', 2 * MIN)), DAN, MEMBERS, NOW);
    expect(view).toMatchObject({ kind: 'open', canAnswer: false });
  });

  it('shows the session\'s earlier rounds, newest first, and nothing asked after it', () => {
    const later = answered('r9', MIN, ADA);
    const view = questionView(state(round('r3', 2 * MIN), { earlier: [answered('r1', 20 * MIN, ADA, 'terminal'), later, answered('r2', 10 * MIN, BOB)] }), BOB, MEMBERS, NOW);
    expect(view.earlier.map((e) => e.id)).toEqual(['r2', 'r1']);
  });

  it('says who answered it, with the answer, once answered', () => {
    const view = questionView(state(answered('r3', 2 * MIN, ADA, 'terminal')), BOB, MEMBERS, NOW);
    expect(view).toMatchObject({ kind: 'answered', by: 'ada@vertuoza.com', byMe: false, via: 'terminal' });
    if (view.kind !== 'answered') return;
    expect(view.lines).toEqual([{ header: 'Storage', question: 'Which storage?', answer: 'Memory' }]);
    expect(answeredTitle(view)).toBe('Already answered by ada@vertuoza.com');
  });

  it('names a member by their arcade name, and says so when it was the one looking', () => {
    const byBob = questionView(state(answered('r3', 2 * MIN, BOB)), ADA, MEMBERS, NOW);
    expect(byBob).toMatchObject({ kind: 'answered', by: 'BOB', byMe: false });
    const mine = questionView(state(answered('r3', 2 * MIN, BOB)), BOB, MEMBERS, NOW);
    expect(mine.kind === 'answered' && answeredTitle(mine)).toBe('Answered by you');
    const unknown = questionView(state(answered('r3', 2 * MIN, 'gone')), ADA, MEMBERS, NOW);
    expect(unknown.kind === 'answered' && answeredTitle(unknown)).toBe('Already answered by someone who left the workspace');
  });

  it('reads as moved once the hook has given up on it, or its time is up, and closed with its session', () => {
    expect(questionView(state(round('r3', MIN, { status: 'abandoned' })), BOB, MEMBERS, NOW).kind).toBe('moved');
    expect(questionView(state(round('r3', HOOK_WAIT_MS)), BOB, MEMBERS, NOW).kind).toBe('moved');
    expect(questionView(state(round('r3', MIN), { session: session({ status: 'closed' }) }), BOB, MEMBERS, NOW).kind).toBe('closed');
  });
});

describe('For me', () => {
  const row = (r: RoundRow, patch: Partial<ForMeRow> = {}): ForMeRow => ({ round: r, session: session(), sharedBy: ADA, ...patch });

  it('lists the open rounds shared with the caller, the soonest to move first, with their time left and who shared them', () => {
    const list = forMeList([row(round('late', MIN)), row(round('soon', 6 * MIN))], MEMBERS, NOW);
    expect(list.map((e) => [e.roundId, e.minutesLeft])).toEqual([['soon', 3], ['late', 8]]);
    expect(list[0]).toMatchObject({ question: 'Which storage?', sessionTitle: 'vertuo-omni-loop · feat/sharing', sharedBy: 'ada@vertuoza.com' });
  });

  it('leaves out a round answered, moved to the terminal, out of time, or in a closed session', () => {
    const list = forMeList([
      row(answered('answered', MIN, ADA)),
      row(round('moved', MIN, { status: 'abandoned' })),
      row(round('late', HOOK_WAIT_MS + 1000)),
      row(round('closed', MIN), { session: session({ status: 'closed' }) }),
      row(round('open', MIN)),
    ], MEMBERS, NOW);
    expect(list.map((e) => e.roundId)).toEqual(['open']);
  });
});
