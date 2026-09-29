import { describe, it, expect } from 'vitest';
import type { RoundRow, SessionRow } from './view';
import { historyChoices, historyList, readHistoryFilters, type HistoryRow } from './workspace-history';

// The workspace's history (PRD 144), as a pure function of the rows the caller may read, the
// workspace's members and the filters in the address: newest first, each filter narrowing it.

const at = (minute: number) => new Date(Date.parse('2026-09-26T09:00:00Z') + minute * 60_000).toISOString();

const ADA = 'ada';
const BOB = 'bob';
const MEMBERS = [
  { user_id: ADA, email: 'ada@vertuoza.com', name: 'ADA' },
  { user_id: BOB, email: 'bob@vertuoza.com', name: null },
];

const ONE = { id: 's1', owner: ADA, title: 'vertuo-omni-loop · feat/ask', status: 'open', created_at: at(0), last_seen_at: at(0), repo: 'vertuoza/vertuo-omni-loop', branch: 'feat/ask' } satisfies SessionRow;
const TWO = { id: 's2', owner: BOB, title: 'vertuo-app · feat/pricing', status: 'closed', created_at: at(0), last_seen_at: at(0), repo: 'vertuoza/vertuo-app', branch: 'feat/pricing' } satisfies SessionRow;

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
    answered_via: 'page', answered_at: at(2), answered_by: BOB, prd: 71, skill: '/omni:brainstorm', category: 'architecture', category_by: 'model',
  }),
  row('r2', TWO, 5, {
    questions: q('Should the trial last 30 days?', 'Trial'), status: 'answered', answers: { 'Should the trial last 30 days?': 'Fourteen days, invoiced monthly' },
    answered_via: 'terminal', answered_at: at(6), answered_by: BOB, prd: 94, skill: '/omni:yolo', category: 'business', category_by: ADA,
  }),
  row('r3', ONE, 9, { prd: 71, skill: '/omni:yolo' }),
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
      askedBy: 'bob@vertuoza.com', answeredBy: 'bob@vertuoza.com', via: 'terminal', category: 'Business', at: at(5),
    });
    expect(trial.context).toEqual(['vertuoza/vertuo-app', 'feat/pricing', 'PRD #94', '/omni:yolo', 'answered in 1 min 0 s']);
    expect(storage).toMatchObject({ askedBy: 'ADA', answeredBy: 'bob@vertuoza.com', category: 'Architecture' });
    const open = historyList(ROWS, {}, MEMBERS)[0];
    expect(open).toMatchObject({ answer: null, answeredBy: null, status: 'open', category: 'unsorted' });
  });

  it.each([
    ['category', { category: 'business' }, ['r2']],
    ['unsorted', { category: 'unsorted' }, ['r3']],
    ['repo', { repo: 'vertuoza/vertuo-omni-loop' }, ['r3', 'r1']],
    ['PRD', { prd: 71 }, ['r3', 'r1']],
    ['skill', { skill: '/omni:yolo' }, ['r3', 'r2']],
    ['who asked', { askedBy: BOB }, ['r2']],
    ['who answered', { answeredBy: BOB }, ['r2', 'r1']],
  ] as const)('narrows by %s', (_name, filters, expected) => {
    expect(ids(historyList(ROWS, filters, MEMBERS))).toEqual(expected);
  });

  it('combines filters', () => {
    expect(ids(historyList(ROWS, { prd: 71, skill: '/omni:yolo' }, MEMBERS))).toEqual(['r3']);
    expect(ids(historyList(ROWS, { prd: 94, repo: 'vertuoza/vertuo-omni-loop' }, MEMBERS))).toEqual([]);
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
      category: 'product', repo: 'vertuoza/vertuo-app', prd: '94', skill: '/omni:yolo', asked: BOB, answered: ADA, q: '  trial  ',
    })).toEqual({ category: 'product', repo: 'vertuoza/vertuo-app', prd: 94, skill: '/omni:yolo', askedBy: BOB, answeredBy: ADA, search: 'trial' });
    expect(readHistoryFilters({ category: 'finance', prd: 'x', repo: '', q: ' ', skill: ['/a', '/b'] })).toEqual({ skill: '/a' });
    expect(readHistoryFilters({ category: 'unsorted' })).toEqual({ category: 'unsorted' });
  });
});

describe('the choices each filter offers', () => {
  it('lists the repos, PRDs, skills, askers and answerers the rows hold, once each, sorted', () => {
    expect(historyChoices(ROWS, MEMBERS)).toEqual({
      repos: ['vertuoza/vertuo-app', 'vertuoza/vertuo-omni-loop'],
      prds: [71, 94],
      skills: ['/omni:brainstorm', '/omni:yolo'],
      askedBy: [{ id: ADA, label: 'ADA' }, { id: BOB, label: 'bob@vertuoza.com' }],
      answeredBy: [{ id: BOB, label: 'bob@vertuoza.com' }],
    });
  });
});
