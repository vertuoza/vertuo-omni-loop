import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { peopleOf } from '../people/load';
import {
  ageWords, boardOf, prdKey, staleLine, staleRepositories, tabOf, whatWords, workingDays, workingMs, type BoardInput, type PrdPage, type StoredWait,
} from './board';

// The Waiting board's model (PRD 2377 s3), pure: working days, the order, the words, whose turn, the
// stale line.

// A Monday, noon UTC.
const MON = new Date('2026-10-19T12:00:00Z');
const at = (iso: string) => new Date(iso);

const PEOPLE = peopleOf(
  [{ user_id: 'u-ada', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: null, hero: null }],
  [],
);

const wait = (n: number, over: Partial<StoredWait> = {}): StoredWait => ({
  id: `w-${n}`, repo: 'acme/widgets', prd: parsePrd(7), pr: parsePr(100 + n), kind: 'review', turn: ['ada'], since: '2026-10-19T08:00:00Z', ...over,
});

const input = (waits: StoredWait[], over: Partial<BoardInput> = {}): BoardInput => ({
  waits, dossiers: new Map<string, PrdPage>([[prdKey('acme/widgets', parsePrd(7)), { id: 'd-7', title: 'Seven' }]]), questions: new Map(), synced: new Map(), now: MON, ...over,
});

describe('working days', () => {
  it('counts Friday to Monday as 1, the weekend left out', () => {
    expect(workingDays(at('2026-10-16T12:00:00Z'), at('2026-10-19T12:00:00Z'))).toBe(1);
  });

  it('counts Friday afternoon to Monday morning as less than a day', () => {
    expect(workingDays(at('2026-10-16T15:00:00Z'), at('2026-10-19T10:00:00Z'))).toBe(0);
  });

  it('counts a plain week as 5 and a wait begun on a Saturday from Monday', () => {
    expect(workingDays(at('2026-10-12T12:00:00Z'), at('2026-10-19T12:00:00Z'))).toBe(5);
    expect(workingMs(at('2026-10-17T10:00:00Z'), at('2026-10-19T10:00:00Z'))).toBe(10 * 3_600_000);
  });

  it('counts nothing backwards', () => {
    expect(workingMs(MON, at('2026-10-19T08:00:00Z'))).toBe(0);
  });

  it('says today under a day, then days', () => {
    expect([0, 1, 3].map(ageWords)).toEqual(['today', '1 day', '3 days']);
  });
});

describe('the Workspace tab', () => {
  it('lists every open wait, oldest first, a tie by repository then pull request', () => {
    const { rows } = boardOf(input([
      wait(1, { since: '2026-10-19T09:00:00Z' }), wait(2, { since: '2026-10-14T09:00:00Z' }),
      wait(4, { since: '2026-10-19T09:00:00Z', repo: 'acme/gears' }), wait(3, { since: '2026-10-19T09:00:00Z' }),
    ]), PEOPLE);
    expect(rows.map((r) => r.id)).toEqual(['w-2', 'w-4', 'w-1', 'w-3']);
  });

  it('reads red past two working days and not at two', () => {
    const { rows } = boardOf(input([
      wait(1, { since: '2026-10-15T12:00:00Z' }), // Thu noon: Thu to Mon is 2 working days exactly
      wait(2, { since: '2026-10-15T11:00:00Z' }),
      wait(3, { since: '2026-10-19T08:00:00Z' }),
    ]), PEOPLE);
    expect(rows.map((r) => [r.id, r.age, r.overdue])).toEqual([['w-2', '2 days', true], ['w-1', '2 days', false], ['w-3', 'today', false]]);
  });

  it('links the PRD to its page and its pull request to GitHub', () => {
    const [row] = boardOf(input([wait(1)]), PEOPLE).rows;
    assertDefined(row, 'the row');
    expect(row.prd).toEqual({ number: 7, title: 'Seven', href: '/prd/d-7' });
    expect(row.pr).toEqual({ number: 101, repo: 'acme/widgets', href: 'https://github.com/acme/widgets/pull/101' });
  });

  it('keeps a PRD with no dossier unlinked, and a bug fix with no PRD', () => {
    const rows = boardOf(input([wait(1, { prd: parsePrd(9) }), wait(2, { prd: null })]), PEOPLE).rows;
    expect(rows.map((r) => r.prd)).toEqual([{ number: 9, title: null, href: null }, null]);
  });

  it('gives an approval no pull request', () => {
    const [row] = boardOf(input([wait(1, { kind: 'approval', pr: null })]), PEOPLE).rows;
    expect(row?.pr).toBeNull();
  });

  it('names whose turn it is: a member by their face, any other login too, a team by its name', () => {
    const [row] = boardOf(input([wait(1, { turn: ['ada', 'bob', 'acme/reviewers'] })]), PEOPLE).rows;
    assertDefined(row, 'the row');
    expect(row.turn.map((t) => (t.kind === 'team' ? ['team', t.name] : ['person', t.person.name, t.person.login ?? null]))).toEqual([
      ['person', 'ada', 'ada'], ['person', 'bob', null], ['team', 'acme/reviewers'],
    ]);
    expect(row.anyone).toBeNull();
  });

  it('says any approver, or anyone who can merge, when nobody is named', () => {
    const rows = boardOf(input([wait(1, { turn: [] }), wait(2, { turn: [], kind: 'merge' })]), PEOPLE).rows;
    expect(rows.map((r) => r.anyone)).toEqual(['any approver', 'anyone who can merge']);
  });

  it('says what it waits on in words, the outbox with its questions', () => {
    expect(whatWords('review', 0)).toBe('review');
    expect(whatWords('merge', 0)).toBe('merge');
    expect(whatWords('law', 0)).toBe('law');
    expect(whatWords('outbox', 1)).toBe('outbox · 1 question');
    expect(whatWords('outbox', 2)).toBe('outbox · 2 questions');
    const [row] = boardOf(input([wait(1, { kind: 'outbox' })], { questions: new Map([[prdKey('acme/widgets', parsePrd(7)), 2]]) }), PEOPLE).rows;
    expect(row?.what).toBe('outbox · 2 questions');
  });

  it('has no row when nothing waits', () => {
    expect(boardOf(input([]), PEOPLE).rows).toEqual([]);
  });
});

describe('the stale line', () => {
  const synced = new Map<string, string | null>([
    ['acme/widgets', '2026-10-19T11:45:00Z'], ['acme/gears', '2026-10-19T11:20:00Z'], ['acme/never', null], ['acme/edge', '2026-10-19T11:30:00Z'],
  ]);

  it('names a tracked repository last synced more than 30 minutes ago, or never', () => {
    expect(staleRepositories(synced, MON)).toEqual(['acme/gears', 'acme/never']);
  });

  it('names none when every repository was read in time', () => {
    expect(staleRepositories(new Map([['acme/widgets', '2026-10-19T11:59:00Z']]), MON)).toEqual([]);
    expect(staleLine([])).toBeNull();
  });

  it('is on the board', () => {
    expect(boardOf(input([], { synced }), PEOPLE).stale).toEqual(['acme/gears', 'acme/never']);
  });

  it('says one repository, then several', () => {
    expect(staleLine(['acme/gears'])).toBe('acme/gears was last synced more than 30 minutes ago, so its waits may be out of date.');
    expect(staleLine(['a/x', 'b/y', 'c/z'])).toBe('a/x, b/y and c/z were last synced more than 30 minutes ago, so their waits may be out of date.');
  });
});

describe('the tab', () => {
  it('is Workspace whatever the query says', () => {
    expect([null, 'workspace', 'mine', 'nonsense'].map(tabOf)).toEqual(['workspace', 'workspace', 'workspace', 'workspace']);
  });
});
