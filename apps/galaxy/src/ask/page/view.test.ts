import { describe, it, expect } from 'vitest';
import { HOOK_WAIT_MS, minutesLeft, pageTitle, sessionView, withPageAnswer, type RoundRow, type SessionState } from './view';

const NOW = Date.parse('2026-09-26T10:00:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000;

const QUESTIONS = [
  { question: 'Which storage?', header: 'Storage', multiSelect: false, options: [{ label: 'Postgres (Recommended)', description: '' }, { label: 'Memory', description: '' }] },
  { question: 'Which checks?', header: 'Checks', multiSelect: true, options: [{ label: 'RLS', description: '' }, { label: 'Handlers', description: '' }] },
];

let n = 0;
function round(patch: Partial<RoundRow> & { ago: number }): RoundRow {
  const { ago, ...rest } = patch;
  n += 1;
  return {
    id: `round-${n}`,
    questions: QUESTIONS,
    answers: null,
    answered_via: null,
    status: 'open',
    created_at: at(ago),
    answered_at: null,
    ...rest,
  };
}
const answered = (ago: number, via: 'page' | 'terminal', answers = { 'Which storage?': 'Memory', 'Which checks?': 'RLS' }) =>
  round({ ago, status: 'answered', answered_via: via, answers, answered_at: at(ago - 1000) });

function state(rounds: RoundRow[], session: Partial<SessionState['session']> = {}): SessionState {
  return { session: { id: 'session-1', owner: 'ada', title: 'vertuo-omni-loop · feat/ask-mode', status: 'open', created_at: at(60 * MIN), last_seen_at: at(1000), ...session }, rounds };
}

describe('an open round', () => {
  it('sits at the top, with the answered rounds below, newest first', () => {
    const first = answered(20 * MIN, 'page');
    const second = answered(10 * MIN, 'terminal');
    const open = round({ ago: 30_000 });
    const view = sessionView(state([open, first, second]), NOW);
    expect(view.kind).toBe('open');
    if (view.kind !== 'open') return;
    expect(view.round.id).toBe(open.id);
    expect(view.questions.map((q) => q.header)).toEqual(['Storage', 'Checks']);
    expect(view.movesAt).toBe(Date.parse(open.created_at) + HOOK_WAIT_MS);
    expect(view.history.map((h) => [h.id, h.outcome, h.via])).toEqual([
      [second.id, 'answered', 'terminal'],
      [first.id, 'answered', 'page'],
    ]);
  });

  it('pairs each question with its answer in the history', () => {
    const view = sessionView(state([answered(MIN, 'page', { 'Which storage?': 'Postgres (Recommended)', 'Which checks?': 'RLS, Handlers' })]), NOW);
    expect(view.history[0].lines).toEqual([
      { header: 'Storage', question: 'Which storage?', answer: 'Postgres (Recommended)' },
      { header: 'Checks', question: 'Which checks?', answer: 'RLS, Handlers' },
    ]);
  });

  it('moves to the terminal once the hook has stopped waiting for it', () => {
    expect(HOOK_WAIT_MS).toBe(540_000);
    expect(sessionView(state([round({ ago: HOOK_WAIT_MS - 1 })]), NOW).kind).toBe('open');
    expect(sessionView(state([round({ ago: HOOK_WAIT_MS })]), NOW).kind).toBe('moved');
  });

  it('says how many minutes are left, rounded up', () => {
    expect(minutesLeft(NOW + 9 * MIN, NOW)).toBe(9);
    expect(minutesLeft(NOW + 8 * MIN + 1, NOW)).toBe(9);
    expect(minutesLeft(NOW + 1, NOW)).toBe(1);
    expect(minutesLeft(NOW - 1, NOW)).toBe(0);
  });
});

describe('the other states', () => {
  it('is working while no round is open, an empty session too', () => {
    expect(sessionView(state([]), NOW)).toEqual({ kind: 'working', history: [] });
    const view = sessionView(state([answered(MIN, 'page')]), NOW);
    expect(view.kind).toBe('working');
    expect(view.history).toHaveLength(1);
  });

  it('shows a round the hook gave up on as moved to the terminal, and never offers to answer it', () => {
    const moved = round({ ago: 10 * MIN, status: 'abandoned' });
    const view = sessionView(state([answered(20 * MIN, 'page'), moved]), NOW);
    expect(view.kind).toBe('moved');
    if (view.kind !== 'moved') return;
    expect(view.round.id).toBe(moved.id);
    expect(view.history).toHaveLength(1);
  });

  it('folds a moved round into the history once the terminal answers it', () => {
    const view = sessionView(state([round({ ago: 10 * MIN, status: 'answered', answered_via: 'terminal', answers: { 'Which storage?': 'Memory', 'Which checks?': 'RLS' } })]), NOW);
    expect(view.kind).toBe('working');
    expect(view.history.map((h) => [h.outcome, h.via])).toEqual([['answered', 'terminal']]);
  });

  it('keeps older rounds that were never answered in the history, as such', () => {
    const view = sessionView(state([round({ ago: 30 * MIN, status: 'abandoned' }), round({ ago: 20 * MIN }), answered(10 * MIN, 'page')]), NOW);
    expect(view.history.map((h) => h.outcome)).toEqual(['answered', 'unanswered', 'moved']);
    expect(view.history[1].lines.every((l) => l.answer === null)).toBe(true);
  });

  it('is closed once the session closes or idles for 12 hours, even with a round open', () => {
    const open = round({ ago: 1000 });
    for (const session of [{ status: 'closed' as const }, { last_seen_at: at(12 * 60 * MIN) }]) {
      const view = sessionView(state([answered(MIN, 'page'), open], session), NOW);
      expect(view.kind).toBe('closed');
      expect(view.history.map((h) => h.outcome)).toEqual(['unanswered', 'answered']);
    }
  });

  it('cannot answer a round whose questions it cannot read: the terminal will', () => {
    expect(sessionView(state([round({ ago: 1000, questions: [{ nope: true }] })]), NOW).kind).toBe('moved');
  });

  it('orders rounds by when they were asked, whatever order they come in', () => {
    const early = answered(20 * MIN, 'page');
    const late = answered(10 * MIN, 'terminal');
    expect(sessionView(state([late, early]), NOW).history.map((h) => h.id)).toEqual([late.id, early.id]);
  });

  it('keeps answers the questions do not name', () => {
    const view = sessionView(state([answered(MIN, 'terminal', { 'Which storage?': 'Memory', 'Something else?': 'Yes' })]), NOW);
    expect(view.history[0].lines).toEqual([
      { header: 'Storage', question: 'Which storage?', answer: 'Memory' },
      { header: 'Checks', question: 'Which checks?', answer: null },
      { header: '', question: 'Something else?', answer: 'Yes' },
    ]);
  });
});

describe('an answer sent from the page', () => {
  it('folds the round into the history at once, tagged page', () => {
    const open = round({ ago: 1000 });
    const next = withPageAnswer(state([open]), open.id, { 'Which storage?': 'Memory', 'Which checks?': 'RLS' }, NOW);
    const view = sessionView(next, NOW);
    expect(view.kind).toBe('working');
    expect(view.history.map((h) => [h.id, h.outcome, h.via])).toEqual([[open.id, 'answered', 'page']]);
  });
});

describe('the tab title', () => {
  it('flags a question waiting, so a tab in the background shows it', () => {
    expect(pageTitle({ kind: 'open' })).toBe('● Claude asks · OMNI LOOP');
    for (const kind of ['working', 'moved', 'closed'] as const) expect(pageTitle({ kind })).toBe('Ask · OMNI LOOP');
  });
});
