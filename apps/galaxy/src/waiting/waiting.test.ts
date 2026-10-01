import { describe, expect, it } from 'vitest';
import { HOOK_WAIT_MS, type SessionRow } from '../ask/page/view';
import type { ForMeRow } from '../ask/page/question';
import type { TabRow } from '../ask/page/tabs';
import { peopleOf } from '../people/load';
import { EMPTY_WAITING, mergeQuestions, ownQuestions, sharedQuestions, titled, WAITING_MS, waitingCounts, type WaitingQuestion } from './waiting';

// The waiting list (PRD 499), as pure functions: the Questions part merged from the person's own
// sessions and the rounds shared with them, its counts, and the tab title's `(N) ` prefix.

const NOW = Date.parse('2026-09-28T10:00:00Z');
const MIN = 60_000;
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const q = (id: string, ago: number, sharedBy: string | null = null): WaitingQuestion => ({
  kind: 'question', id, sessionTitle: `terminal ${id}`, question: `question ${id}`, askedAt: NOW - ago, sharedBy,
});

const session = (id: string, patch: Partial<SessionRow> = {}): SessionRow => ({
  id, owner: 'me', title: `vertuo-omni-loop · ${id}`, status: 'open', created_at: at(60 * MIN), last_seen_at: at(1000), ...patch,
});

describe('the Questions part', () => {
  it('reads every 5 s', () => {
    expect(WAITING_MS).toBe(5000);
  });

  it('merges own and shared rounds, one entry per round id, oldest first', () => {
    const merged = mergeQuestions([q('b', 2 * MIN), q('a', 5 * MIN)], [q('c', 3 * MIN, 'Bob'), q('b', 2 * MIN, 'Bob')]);
    expect(merged.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('keeps who shared a round that is both one of mine and shared with me', () => {
    const [only] = mergeQuestions([q('b', MIN)], [q('b', MIN, 'Bob')]);
    expect(only!.sharedBy).toBe('Bob');
  });

  it('breaks a tie of age by id', () => {
    expect(mergeQuestions([q('z', MIN), q('y', MIN)], []).map((x) => x.id)).toEqual(['y', 'z']);
  });

  it('counts the entries, the shared ones apart, and the outbox, empty for now', () => {
    const list = { ...EMPTY_WAITING, questions: mergeQuestions([q('a', MIN), q('b', MIN)], [q('b', MIN, 'Bob'), q('c', MIN, 'Bob')]) };
    expect(waitingCounts(list)).toEqual({ questions: 3, shared: 2, outbox: 0, total: 3 });
    expect(waitingCounts(EMPTY_WAITING)).toEqual({ questions: 0, shared: 0, outbox: 0, total: 0 });
  });

  it('counts an outbox item in the total', () => {
    const list = { questions: [q('a', MIN)], outbox: [{ kind: 'outbox' as const, id: 'o1', prd: 459, dossierId: 'd1', title: 'Gate', rank: 'high' as const, question: 'Why?' }] };
    expect(waitingCounts(list)).toMatchObject({ outbox: 1, total: 2 });
  });
});

describe('own rounds', () => {
  const row = (id: string, round: { ago: number; status?: 'open' | 'answered' } | null, patch: Partial<SessionRow> = {}): TabRow => ({
    session: session(id, patch),
    newest: round && { id: `r-${id}`, status: round.status ?? 'open', created_at: at(round.ago), header: 'Auth' },
  });

  it('are the newest rounds the page can still answer, with their first question and when they were asked', () => {
    const texts = new Map([['r-a', 'How should we sign in?']]);
    const rows = [row('a', { ago: MIN }), row('done', { ago: MIN, status: 'answered' }), row('late', { ago: HOOK_WAIT_MS + MIN }), row('idle', null)];
    expect(ownQuestions(rows, texts, NOW)).toEqual([
      { kind: 'question', id: 'r-a', sessionTitle: 'vertuo-omni-loop · a', question: 'How should we sign in?', askedAt: NOW - MIN, sharedBy: null },
    ]);
  });

  it('fall back on the header when the text is not read yet, and on the repository when the session has no title', () => {
    const [only] = ownQuestions([row('a', { ago: MIN }, { title: '', repo: 'acme/widgets' })], new Map(), NOW);
    expect(only).toMatchObject({ sessionTitle: 'acme/widgets', question: 'Auth' });
  });
});

describe('shared rounds', () => {
  const shared = (id: string, ago: number, status: 'open' | 'answered' = 'open'): ForMeRow => ({
    round: { id, questions: [{ question: `Shared ${id}?`, header: 'H', options: [], multiSelect: false }], answers: null, answered_via: null, status, created_at: at(ago), answered_at: null },
    session: session(`s-${id}`),
    sharedBy: 'u-bob',
  });

  it('are the open ones the page can still answer, named by who shared them', () => {
    const members = [{ user_id: 'u-bob', email: 'bob@example.com', name: 'Bob' }];
    const list = sharedQuestions([shared('x', 2 * MIN), shared('old', HOOK_WAIT_MS + MIN), shared('done', MIN, 'answered')], members, NOW);
    expect(list).toEqual([
      { kind: 'question', id: 'x', sessionTitle: 'vertuo-omni-loop · s-x', question: 'Shared x?', askedAt: NOW - 2 * MIN, sharedBy: 'Bob', sharedByFace: { kind: 'initial', letter: 'B' } },
    ]);
  });

  it('carry the sharer\'s face from the people directory of the session\'s workspace (PRD 652)', () => {
    const members = [{ user_id: 'u-bob', email: 'bob@example.com', name: 'Bob' }];
    const row = { ...shared('x', 2 * MIN), session: session('s-x', { workspace_id: 'w-1' }) };
    const people = new Map([['w-1', peopleOf([{ user_id: 'u-bob', name: 'BOB', github_login: 'bob-gh', avatar_url: 'https://a.test/bob.png', fleet: null }], [])]]);
    const [only] = sharedQuestions([row], members, NOW, people);
    expect(only).toMatchObject({ sharedBy: 'Bob', sharedByFace: { kind: 'photo', url: 'https://a.test/bob.png' } });
    const [elsewhere] = sharedQuestions([{ ...row, session: session('s-x', { workspace_id: 'w-2' }) }], members, NOW, people);
    expect(elsewhere!.sharedByFace).toEqual({ kind: 'initial', letter: 'B' });
  });
});

describe('the tab title', () => {
  it('is prefixed with (N) above 0', () => {
    expect(titled('PRDs · OMNI LOOP', 5)).toBe('(5) PRDs · OMNI LOOP');
  });

  it('replaces the count when it changes, and never doubles it', () => {
    expect(titled('(5) PRDs · OMNI LOOP', 2)).toBe('(2) PRDs · OMNI LOOP');
    expect(titled(titled('PRDs · OMNI LOOP', 2), 2)).toBe('(2) PRDs · OMNI LOOP');
  });

  it('is the page\'s own title at 0', () => {
    expect(titled('(5) PRDs · OMNI LOOP', 0)).toBe('PRDs · OMNI LOOP');
    expect(titled('PRDs · OMNI LOOP', 0)).toBe('PRDs · OMNI LOOP');
  });
});
