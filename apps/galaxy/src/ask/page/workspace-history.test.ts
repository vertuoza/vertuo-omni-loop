import { describe, it, expect } from 'vitest';
import type { RoundRow, SessionRow } from './view';
import {
  categoriesOf, filtered, historyChoices, historyFacetsOf, historyHref, historyItemsOf, historyList, historyMatched, historyPageOf, historyTotal,
  readFacets, readHistoryFilters, type HistoryRow,
} from './workspace-history';
import { present } from '../test/test-item';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';

// The workspace's history (PRD 144), as a pure function of the rows the caller may read, the
// workspace's members and the filters in the address: newest first, each filter narrowing it.

const at = (minute: number) => new Date(Date.parse('2026-09-26T09:00:00Z') + minute * 60_000).toISOString();

const ADA = 'ada';
const BOB = 'bob';
const MEMBERS = [
  { user_id: ADA, email: 'ada@example.com', name: 'ADA' },
  { user_id: BOB, email: 'bob@example.com', name: null },
];

const ONE = { id: 's1', owner: ADA, title: 'vertuo-omni-loop · feat/ask', status: 'open', created_at: at(0), last_seen_at: at(0), repo: 'vertuoza/vertuo-omni-loop', branch: 'feat/ask' } satisfies SessionRow;
const TWO = { id: 's2', owner: BOB, title: 'nimbus-app · feat/pricing', status: 'closed', created_at: at(0), last_seen_at: at(0), repo: 'demo-org/nimbus-app', branch: 'feat/pricing' } satisfies SessionRow;

const q = (question: string, header = '') => [{ question, header, multiSelect: false, options: [{ label: 'Yes' }, { label: 'No' }] }];

function row(id: string, session: SessionRow, minute: number, patch: Partial<RoundRow> = {}): HistoryRow {
  return {
    session,
    round: { id, questions: q(`Question ${id}?`), answers: null, answered_via: null, status: 'open', created_at: at(minute), answered_at: null, ...patch },
  };
}

const ROWS: HistoryRow[] = [
  row('r1', ONE, 1, {
    questions: q('Which storage should the ledger use?', 'Storage'), status: 'answered', answers: { 'Which storage should the ledger use?': 'Postgres' },
    answered_via: 'page', answered_at: at(2), answered_by: BOB, prd: parsePrd(71), skill: '/omni:brainstorm', category: 'architecture', category_by: 'model',
  }),
  row('r2', TWO, 5, {
    questions: q('Should the trial last 30 days?', 'Trial'), status: 'answered', answers: { 'Should the trial last 30 days?': 'Fourteen days, invoiced monthly' },
    answered_via: 'terminal', answered_at: at(6), answered_by: BOB, prd: parsePrd(94), skill: '/omni:yolo', category: 'business', category_by: ADA,
  }),
  row('r3', ONE, 9, { prd: parsePrd(71), skill: '/omni:yolo' }),
];

const ids = (list: ReturnType<typeof historyList>) => list.map((item) => item.roundId);

describe('the workspace history', () => {
  it('lists every round, newest first, each opening its own page', () => {
    const list = historyList(ROWS, {}, MEMBERS);
    expect(ids(list)).toEqual(['r3', 'r2', 'r1']);
    expect(list.map((item) => item.href)).toEqual(['/ask/q/r3', '/ask/q/r2', '/ask/q/r1']);
  });

  it('counts every screenshot a round\'s answers carry, and none for a round without (PRD 620)', () => {
    const shots = [row('r4', ONE, 12, {
      status: 'answered', answers: { 'Question r4?': '(see screenshots)' }, answered_via: 'page', answered_at: at(13),
      attachments: { 'Question r4?': ['r4/1.png', 'r4/2.png', 'r4/3.webp'] },
    }), ...ROWS];
    const list = historyList(shots, {}, MEMBERS);
    expect(list.map((item) => item.screenshots)).toEqual([3, 0, 0, 0]);
  });

  it('says what each round asked, what was answered, who asked, who answered and how it is sorted', () => {
    const [, trial, storage] = historyList(ROWS, {}, MEMBERS);
    expect(trial).toMatchObject({
      question: 'Should the trial last 30 days?', answer: 'Fourteen days, invoiced monthly', status: 'answered',
      askedBy: 'bob@example.com', answeredBy: 'bob@example.com', via: 'terminal', category: 'Business', at: at(5),
    });
    expect(present(trial, 'trial').context).toEqual(['demo-org/nimbus-app', 'feat/pricing', 'PRD #94', '/omni:yolo', 'answered in 1 min 0 s']);
    expect(storage).toMatchObject({ askedBy: 'ADA', answeredBy: 'bob@example.com', category: 'Architecture' });
    expect(storage).toMatchObject({ askedByFace: { kind: 'initial', letter: 'A' }, answeredByFace: { kind: 'initial', letter: 'B' } });
    const open = historyList(ROWS, {}, MEMBERS)[0];
    expect(open).toMatchObject({ answer: null, answeredBy: null, answeredByFace: null, status: 'open', category: 'unsorted' });
  });

  it.each([
    ['category', { category: 'business' }, ['r2']],
    ['unsorted', { category: 'unsorted' }, ['r3']],
    ['repo', { repo: 'vertuoza/vertuo-omni-loop' }, ['r3', 'r1']],
    ['PRD', { prd: parsePrd(71) }, ['r3', 'r1']],
    ['skill', { skill: '/omni:yolo' }, ['r3', 'r2']],
    ['who asked', { askedBy: BOB }, ['r2']],
    ['who answered', { answeredBy: BOB }, ['r2', 'r1']],
  ] as const)('narrows by %s', (_name, filters, expected) => {
    expect(ids(historyList(ROWS, filters, MEMBERS))).toEqual(expected);
  });

  it('combines filters', () => {
    expect(ids(historyList(ROWS, { prd: parsePrd(71), skill: '/omni:yolo' }, MEMBERS))).toEqual(['r3']);
    expect(ids(historyList(ROWS, { prd: parsePrd(94), repo: 'vertuoza/vertuo-omni-loop' }, MEMBERS))).toEqual([]);
  });

  it('finds a round by a word of its answer, or of its question, whatever the case', () => {
    expect(ids(historyList(ROWS, { search: 'invoiced' }, MEMBERS))).toEqual(['r2']);
    expect(ids(historyList(ROWS, { search: 'LEDGER' }, MEMBERS))).toEqual(['r1']);
    expect(ids(historyList(ROWS, { search: 'storage postgres' }, MEMBERS))).toEqual(['r1']);
    expect(ids(historyList(ROWS, { search: 'postgres trial' }, MEMBERS))).toEqual([]);
  });
});

describe('the filters, read from the address', () => {
  it('reads each filter, and ignores what is empty or not a filter value', () => {
    expect(readHistoryFilters({
      category: 'product', repo: 'demo-org/nimbus-app', prd: '94', skill: '/omni:yolo', asked: BOB, answered: ADA, q: '  trial  ',
    })).toEqual({ category: 'product', repo: 'demo-org/nimbus-app', prd: parsePrd(94), skill: '/omni:yolo', askedBy: BOB, answeredBy: ADA, search: 'trial' });
    expect(readHistoryFilters({ category: 'finance', prd: 'x', repo: '', q: ' ', skill: ['/a', '/b'] })).toEqual({ skill: '/a' });
    expect(readHistoryFilters({ category: 'unsorted' })).toEqual({ category: 'unsorted' });
  });

  it('reads the page\'s cursor, `before`, only when it is shaped like a round\'s id', () => {
    expect(readHistoryFilters({ before: '00000000-0000-4000-8000-000000000001', q: 'host' }))
      .toEqual({ before: '00000000-0000-4000-8000-000000000001', search: 'host' });
    expect(readHistoryFilters({ before: 'demo-round-trial' })).toEqual({ before: 'demo-round-trial' });
    expect(readHistoryFilters({ before: 'a b' })).toEqual({});
    expect(readHistoryFilters({ before: `x${'y'.repeat(64)}` })).toEqual({});
  });

  it('counts the cursor as no filter, and drops it from every link but the one that names it', () => {
    expect(filtered({ before: 'r2' })).toBe(false);
    expect(filtered({ before: 'r2', repo: 'demo-org/nimbus-app' })).toBe(true);
    expect(historyHref({ repo: 'demo-org/nimbus-app', before: 'r2' }, { category: 'business' })).toBe('/app/inbox/done?category=business&repo=demo-org%2Fnimbus-app');
    expect(historyHref({ repo: 'demo-org/nimbus-app', before: 'r2' }, { before: 'r1' })).toBe('/app/inbox/done?repo=demo-org%2Fnimbus-app&before=r1');
  });
});

describe('one page of the history, as the database reads it (PRD omni-loop-23)', () => {
  /** `n` answered rounds, one a minute, the newest last; ids sort as their minutes do. */
  const answered = (n: number): HistoryRow[] => Array.from({ length: n }, (_, i) => row(`a${String(i).padStart(4, '0')}`, ONE, i, {
    status: 'answered', answers: {}, answered_via: 'page', answered_at: at(i),
  }));
  const roundIds = (rows: HistoryRow[]) => rows.map((r) => r.round.id);

  it('leaves the waiting rounds out: they are on Open', () => {
    const moved = row('r4', TWO, 12, { status: 'abandoned' });
    expect(roundIds(historyPageOf([...ROWS, moved], {}).rows)).toEqual(['r4', 'r2', 'r1']);
  });

  it('reads 50 a page, newest first, each cursor going on where the page before stopped', () => {
    const rows = answered(120);
    const first = historyPageOf(rows, {});
    const second = historyPageOf(rows, { before: first.next ?? '' });
    const third = historyPageOf(rows, { before: second.next ?? '' });
    expect([first.rows.length, second.rows.length, third.rows.length]).toEqual([50, 50, 20]);
    expect(first.next).toBe('a0070');
    expect(third.next).toBeNull();
    const seen = roundIds([...first.rows, ...second.rows, ...third.rows]);
    expect(seen).toEqual(roundIds(rows).reverse());
  });

  it('orders rounds asked at the same moment by id, and reads a page under the filters', () => {
    const same = [row('b1', ONE, 3, { status: 'answered' }), row('b2', ONE, 3, { status: 'answered' }), row('b3', TWO, 3, { status: 'answered' })];
    expect(roundIds(historyPageOf(same, {}, 2).rows)).toEqual(['b3', 'b2']);
    expect(roundIds(historyPageOf(same, { before: 'b2' }, 2).rows)).toEqual(['b1']);
    expect(roundIds(historyPageOf(same, { repo: 'vertuoza/vertuo-omni-loop' }).rows)).toEqual(['b2', 'b1']);
  });

  it('gives an empty page for a cursor that names no round', () => {
    expect(historyPageOf(answered(3), { before: 'gone' })).toEqual({ rows: [], next: null });
  });

  it('draws a page as it came, in its own order', () => {
    const [r1, r2] = ROWS;
    expect(historyItemsOf([present(r1, 'r1'), present(r2, 'r2')], MEMBERS).map((item) => item.roundId)).toEqual(['r1', 'r2']);
  });
});

describe('the counts, as the database reads them (PRD omni-loop-23)', () => {
  const zero = { matched: 0, total: 0 };

  it('counts every category, unsorted last, zeros kept, over the answered and moved rounds only', () => {
    expect(historyFacetsOf(ROWS, {})).toEqual([
      { id: 'business', matched: 1, total: 1 }, { id: 'product', ...zero }, { id: 'ux-ui', ...zero },
      { id: 'architecture', matched: 1, total: 1 }, { id: 'harness', ...zero }, { id: 'other', ...zero }, { id: 'unsorted', ...zero },
    ]);
  });

  it('counts each category under every filter but its own, and the total under none', () => {
    const facets = historyFacetsOf(ROWS, { category: 'business', repo: 'vertuoza/vertuo-omni-loop', before: 'r2' });
    expect(facets.find((f) => f.id === 'business')).toEqual({ id: 'business', matched: 0, total: 1 });
    expect(facets.find((f) => f.id === 'architecture')).toEqual({ id: 'architecture', matched: 1, total: 1 });
    expect(historyTotal(facets)).toBe(2);
    expect(historyMatched(facets, { category: 'business' })).toBe(0);
    expect(historyMatched(facets, {})).toBe(1);
  });

  it('reads the database\'s counts: text taken as numbers, a category it left out counts none, one it does not know is dropped', () => {
    const facets = readFacets([{ category: 'architecture', matched: '3', total: '187' }, { category: 'finance', matched: 9, total: 9 }, { category: 'unsorted', matched: 0, total: 4 }]);
    expect(facets.map((f) => f.id)).toEqual(['business', 'product', 'ux-ui', 'architecture', 'harness', 'other', 'unsorted']);
    expect(facets.find((f) => f.id === 'architecture')).toEqual({ id: 'architecture', matched: 3, total: 187 });
    expect(historyTotal(facets)).toBe(191);
  });

  it('lists every category in the sidebar, one with no match kept at zero', () => {
    const lines = categoriesOf(historyFacetsOf(ROWS, { search: 'ledger' }));
    expect(lines).toHaveLength(7);
    expect(lines.find((c) => c.id === 'architecture')).toEqual({ id: 'architecture', label: 'Architecture', count: 1 });
    expect(lines.find((c) => c.id === 'business')).toEqual({ id: 'business', label: 'Business', count: 0 });
    expect(lines.at(-1)).toEqual({ id: 'unsorted', label: 'Unsorted', count: 0 });
  });
});

describe('the choices each filter offers', () => {
  it('lists the repos, PRDs, skills, askers and answerers the rows hold, once each, sorted', () => {
    expect(historyChoices(ROWS, MEMBERS)).toEqual({
      repos: ['demo-org/nimbus-app', 'vertuoza/vertuo-omni-loop'],
      prds: [71, 94],
      skills: ['/omni:brainstorm', '/omni:yolo'],
      askedBy: [{ id: ADA, label: 'ADA' }, { id: BOB, label: 'bob@example.com' }],
      answeredBy: [{ id: BOB, label: 'bob@example.com' }],
    });
  });

  it('still offers each value chosen when the page holds none of it', () => {
    const chosen = historyChoices([], MEMBERS, { repo: 'demo-org/nimbus-app', prd: parsePrd(94), skill: '/omni:yolo', askedBy: ADA, answeredBy: BOB });
    expect(chosen).toEqual({
      repos: ['demo-org/nimbus-app'], prds: [94], skills: ['/omni:yolo'],
      askedBy: [{ id: ADA, label: 'ADA' }], answeredBy: [{ id: BOB, label: 'bob@example.com' }],
    });
  });
});
