import { describe, it, expect } from 'vitest';
import {
  categoryChip, contextParts, entry, HOOK_WAIT_MS, screenshotsNote, keepSent, minutesLeft, sessionView, tabWorking, withCategory, withPageAnswer, type RoundRow, type SessionState,
} from './view';
import { item } from '../test/test-item';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

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
const answered = (ago: number, via: 'page' | 'terminal', answers: Record<string, string> = { 'Which storage?': 'Memory', 'Which checks?': 'RLS' }) =>
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
    expect(item(view.history, 0).lines).toEqual([
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
    expect(item(view.history, 1).lines.every((l) => l.answer === null)).toBe(true);
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
    expect(item(view.history, 0).lines).toEqual([
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

describe('a read that crosses an answer sent from the page', () => {
  it('keeps the round answered until the database says so too', () => {
    const open = round({ ago: 1000 });
    const answers = { 'Which storage?': 'Memory', 'Which checks?': 'RLS' };
    const sent = new Map([[open.id, { answers, at: NOW }]]);
    const read = keepSent(state([open]), sent);
    expect(read.rounds[0]).toMatchObject({ status: 'answered', answered_via: 'page', answers });
    expect(sent.has(open.id)).toBe(true);
  });

  it('forgets the answer once the database has it, or the round went another way', () => {
    const answers = { 'Which storage?': 'Memory', 'Which checks?': 'RLS' };
    const done = round({ ago: 1000, status: 'answered', answered_via: 'page', answers });
    const moved = round({ ago: 1000, status: 'abandoned' });
    const sent = new Map([[done.id, { answers, at: NOW }], [moved.id, { answers, at: NOW }]]);
    const read = keepSent(state([done, moved]), sent);
    expect(read.rounds.map((r) => r.status)).toEqual(['answered', 'abandoned']);
    expect(sent.size).toBe(0);
  });
});

describe('the context line (PRD 144)', () => {
  const full = state([], { repo: 'vertuoza/vertuo-omni-loop', branch: 'feat/question-history--s1' }).session;
  const facts = {
    prd: parsePrd(144),
    skill: '/omni:brainstorm',
    model: 'claude-sonnet-4-6',
    tokens: { input: 1200, output: 300, cacheRead: 1_000_000, cacheWrite: 200_000 },
    cost_usd: 0.0321,
  };

  it('names the repo, branch, PRD, skill, model, tokens, cost and the time to answer', () => {
    const r = round({ ago: 10 * MIN, ...facts, status: 'answered', answered_via: 'page', answers: {}, answered_at: at(10 * MIN - 95_000) });
    expect(contextParts(full, r)).toEqual([
      'vertuoza/vertuo-omni-loop', 'feat/question-history--s1', 'PRD #144', '/omni:brainstorm', 'claude-sonnet-4-6',
      '1.2M tokens', '$0.03', 'answered in 1 min 35 s',
    ]);
  });

  it('leaves out every field it does not have, an older kit\'s round saying nothing at all', () => {
    const bare = state([]).session;
    expect(contextParts(bare, round({ ago: MIN }))).toEqual([]);
    expect(contextParts(bare, round({ ago: MIN, prd: null, skill: null, model: null, tokens: null, cost_usd: null }))).toEqual([]);
  });

  it('writes small costs, token counts and times in a way that reads', () => {
    const tiny = round({ ago: MIN, tokens: { input: 950, output: 0, cacheRead: 0, cacheWrite: 0 }, cost_usd: 0.0004 });
    expect(contextParts(state([]).session, tiny)).toEqual(['950 tokens', '<$0.01']);
    const k = round({ ago: MIN, tokens: { input: 12_340, output: 0, cacheRead: 0, cacheWrite: 0 }, cost_usd: 0 });
    expect(contextParts(state([]).session, k)).toEqual(['12.3k tokens', '$0.00']);
    const quick = round({ ago: MIN, status: 'answered', answered_via: 'terminal', answers: {}, answered_at: at(MIN - 42_000) });
    expect(contextParts(state([]).session, quick)).toEqual(['answered in 42 s']);
    const slow = round({ ago: 3 * 60 * MIN, status: 'answered', answered_via: 'terminal', answers: {}, answered_at: at(60 * MIN) });
    expect(contextParts(state([]).session, slow)).toEqual(['answered in 2 h 0 min']);
  });

  it('rides along with each round of the history', () => {
    const view = sessionView(state([answered(MIN, 'page')], { repo: 'acme/widgets' }), NOW);
    expect(item(view.history, 0).context).toEqual(['acme/widgets', 'answered in 1 s']);
  });
});

describe('the category chip (PRD 144)', () => {
  const who = { me: 'bob', owner: 'ada' };

  it('shows the category, and who set it', () => {
    expect(categoryChip({ category: 'business', category_by: 'model' }, who)).toEqual({ value: 'business', label: 'Business', setBy: 'sorted by the model' });
    expect(categoryChip({ category: 'ux-ui', category_by: 'bob' }, who)).toEqual({ value: 'ux-ui', label: 'UX/UI', setBy: 'set by you' });
    expect(categoryChip({ category: 'product', category_by: 'ada' }, who)).toEqual({ value: 'product', label: 'Product', setBy: 'set by the session owner' });
    expect(categoryChip({ category: 'harness', category_by: 'carol' }, who)).toEqual({ value: 'harness', label: 'Harness', setBy: 'set by a teammate' });
  });

  it('says unsorted for a round nobody sorted, an older round with no column, or one cleared', () => {
    expect(categoryChip({ category: null, category_by: null }, who)).toEqual({ value: null, label: 'unsorted', setBy: null });
    expect(categoryChip({}, who)).toEqual({ value: null, label: 'unsorted', setBy: null });
    expect(categoryChip({ category: null, category_by: 'bob' }, who)).toEqual({ value: null, label: 'unsorted', setBy: 'cleared by you' });
  });

  it('reads a stored value outside the six as unsorted', () => {
    expect(categoryChip({ category: 'design' as never, category_by: 'model' }, who).value).toBeNull();
  });

  it('rides along with each round of the history', () => {
    const view = sessionView(state([{ ...answered(MIN, 'page'), category: 'other', category_by: 'model' }]), NOW);
    expect(view.history[0]).toMatchObject({ category: 'other', category_by: 'model' });
  });

  it('shows a sort at once, before the next read', () => {
    const open = round({ ago: MIN });
    const next = withCategory(state([open]), open.id, { category: 'architecture', category_by: 'bob' });
    expect(next.rounds[0]).toMatchObject({ category: 'architecture', category_by: 'bob' });
  });
});

describe('screenshots on an answer (PRD 620)', () => {
  it('counts each answer\'s screenshots, and says nothing for one without', () => {
    const r = answered(MIN, 'page', { 'Which storage?': '(see screenshots)', 'Which checks?': 'RLS' });
    const withShots = { ...r, attachments: { 'Which storage?': [`${r.id}/1.png`, `${r.id}/2.jpg`] } };
    expect(entry(withShots).lines).toEqual([
      { header: 'Storage', question: 'Which storage?', answer: '(see screenshots)', screenshots: 2 },
      { header: 'Checks', question: 'Which checks?', answer: 'RLS' },
    ]);
    expect(entry(r).lines.every((line) => line.screenshots === undefined)).toBe(true);
    expect(entry({ ...r, attachments: null }).lines.every((line) => line.screenshots === undefined)).toBe(true);
  });

  it('says how many, in plain words', () => {
    expect(screenshotsNote(undefined)).toBeNull();
    expect(screenshotsNote(0)).toBeNull();
    expect(screenshotsNote(1)).toBe('📎 1 screenshot');
    expect(screenshotsNote(3)).toBe('📎 3 screenshots');
  });
});

describe('whether the tab\'s terminal is working (PRD 757)', () => {
  const ping = (ago: number, ended = false) => ({ seen_at: at(ago), ended_at: ended ? at(0) : null });
  const withPing = (s: SessionState, p: SessionState['ping']): SessionState => ({ ...s, ping: p });

  it('is working while its Claude session sent a heartbeat under 3 minutes ago and nothing is asked', () => {
    expect(tabWorking(withPing(state([]), ping(30_000)), NOW)).toBe('working');
    expect(tabWorking(withPing(state([answered(10 * MIN, 'page')]), ping(2 * MIN)), NOW)).toBe('working');
  });

  it('is asking while a round is open, over working', () => {
    expect(tabWorking(withPing(state([round({ ago: MIN })]), ping(30_000)), NOW)).toBe('asking');
    expect(tabWorking(withPing(state([round({ ago: MIN })]), null), NOW)).toBe('asking');
  });

  it('is idle with no heartbeat, a stale one, or an ended one', () => {
    expect(tabWorking(state([]), NOW)).toBe('idle');
    expect(tabWorking(withPing(state([]), null), NOW)).toBe('idle');
    expect(tabWorking(withPing(state([]), ping(3 * MIN)), NOW)).toBe('idle');
    expect(tabWorking(withPing(state([]), ping(30_000, true)), NOW)).toBe('idle');
  });

  it('is idle once the session is closed, whatever it reads', () => {
    expect(tabWorking(withPing(state([round({ ago: MIN })], { status: 'closed' }), ping(30_000)), NOW)).toBe('idle');
  });
});
