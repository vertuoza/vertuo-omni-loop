import { describe, expect, it } from 'vitest';
import { parseIssue, PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { answerable, answeredBy, answerAs, answersAs, cardsOf, openCount, railHeading, sourceLine, type JobQuestionsRow, type RailRecord } from './rail';

// The rail's rules (PRD 3107 s2), pure: a card per question of this fleet waiting on a person, built from its record,
// the ones answered in the last 24 hours kept and read `Answered by`, which cards answer from the rail, and the words.

const NOW = new Date('2026-11-21T09:30:00Z');
const MISSION = 'aaaaaaaa-0000-4000-8000-000000003110';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000009001';
const PAUL_ID = '0000bbbb-0000-4000-8000-00000000000b';
const prd = (n: number) => PrdNumberSchema.parse(n);

const job = (over: Partial<JobQuestionsRow> = {}): JobQuestionsRow => ({
  job: '4f2a1b2c-0000-4000-8000-000000000001', mission: MISSION, issue: parseIssue(2817), answers: null, closedBy: null, closedAt: null, askedAt: '2026-11-21T08:40:00Z',
  questions: [{ question: 'Old quotes API or v2?', options: [{ label: 'Keep old API' }, { label: 'Use v2' }], multiSelect: false }], ...over,
});
const record = (over: Partial<RailRecord> = {}): RailRecord => ({
  fleet: 'blue-fleet',
  missions: [{ id: MISSION, number: 3110, repo: 'northwind/quotes', status: 'running', prds: [prd(2817), prd(2820)] }],
  jobs: [], items: [], outbox: [], approvals: [], logins: new Map([[PAUL_ID, 'paul-n']]), ...over,
});

describe('the cards', () => {
  it('AC-13: a job\'s card shows the choices its record holds, its question and where it comes from', () => {
    const [card] = cardsOf(record({ jobs: [job()] }), NOW);
    expect(card).toEqual({
      source: 'job', id: '4f2a1b2c-0000-4000-8000-000000000001', ref: 'job 4f2a1b2c', prd: 2817, question: 'Old quotes API or v2?',
      choices: ['Keep old API', 'Use v2'], href: '/app/runners#job-4f2a1b2c-0000-4000-8000-000000000001', at: '2026-11-21T08:40:00Z', answered: null,
    });
    expect(card && sourceLine(card)).toBe('Question · job 4f2a1b2c · PRD 2817');
    expect(card && answerable(card)).toBe(true);
  });

  it('a job asking several questions, or several picks, is answered on its own page', () => {
    const two = job({ questions: [...job().questions, { question: 'Which tests?', options: [{ label: 'Unit' }], multiSelect: false }] });
    const many = job({ questions: [{ question: 'Which suites?', options: [{ label: 'A' }, { label: 'B' }], multiSelect: true }] });
    for (const row of [two, many]) {
      const [card] = cardsOf(record({ jobs: [row] }), NOW);
      expect(card?.choices).toEqual([]);
      expect(card && answerable(card)).toBe(false);
    }
  });

  it('AC-12: a card answered in the last 24 hours stays, read as its record says, after the ones that wait', () => {
    const answered = job({ job: '3e90aaaa-0000-4000-8000-000000000002', answers: { 'Keep the retry?': 'Keep' }, closedBy: PAUL_ID, closedAt: '2026-11-21T08:58:00Z' });
    const cards = cardsOf(record({ jobs: [answered, job()] }), NOW);
    expect(cards.map((c) => c.id.slice(0, 4))).toEqual(['4f2a', '3e90']);
    expect(cards[1]?.answered).toEqual({ login: 'paul-n', at: '2026-11-21T08:58:00Z', choice: 'Keep' });
    expect(cards[1] && answerable(cards[1])).toBe(false);
    expect(openCount(cards)).toBe(1);
  });

  it('drops a card answered more than 24 hours ago, a dismissed one, and one of another fleet\'s mission', () => {
    const old = job({ answers: { q: 'a' }, closedBy: PAUL_ID, closedAt: '2026-11-20T08:00:00Z' });
    const dismissed = job({ closedAt: '2026-11-21T09:00:00Z' });
    const foreign = job({ mission: OTHER });
    expect(cardsOf(record({ jobs: [old, dismissed, foreign] }), NOW)).toEqual([]);
  });

  it('a mission item is answered Adopt or Decline; an outbox item and an approval link their PRD\'s page, for this fleet\'s PRDs alone', () => {
    const cards = cardsOf(record({
      items: [{ id: 'dddddddd-0000-4000-8000-000000000001', mission: MISSION, target: 'testing › Timeouts', wording: 'Take the long timeout.', answer: null, answeredBy: null, answeredAt: null, createdAt: '2026-11-21T08:50:00Z' }],
      outbox: [
        { repository: 'northwind/quotes', prd: prd(2817), waiting: [{ id: 's2-01-keep', question: 'Keep the CSV export?' }], syncedAt: '2026-11-21T08:45:00Z' },
        { repository: 'northwind/quotes', prd: prd(9999), waiting: [{ id: 's1-01-other', question: 'Not ours?' }], syncedAt: '2026-11-21T08:45:00Z' },
      ],
      approvals: [
        { id: 'eeeeeeee-0000-4000-8000-000000002820', repo: 'northwind/quotes', prd: prd(2820), title: 'Quotes export v2', askedAt: '2026-11-21T08:30:00Z' },
        { id: 'eeeeeeee-0000-4000-8000-000000000001', repo: 'northwind/crm', prd: prd(2820), title: 'Another repository', askedAt: '2026-11-21T08:30:00Z' },
      ],
    }), NOW);
    expect(cards.map((c) => [c.source, sourceLine(c), c.choices, c.href])).toEqual([
      ['approval', 'Approval · PRD 2820', [], '/prd/at/northwind/quotes/2820?to=page'],
      ['outbox', 'Outbox · PRD 2817', [], '/prd/at/northwind/quotes/2817?to=page'],
      ['item', 'Mission item · mission 3110', ['Adopt', 'Decline'], '/app/fleet?fleet=blue-fleet&tab=missions'],
    ]);
    expect(cards[2]?.question).toBe('testing › Timeouts: Take the long timeout.');
    expect(cards.map((c) => answerable(c))).toEqual([false, false, true]);
  });

  it('reads no outbox nor approval of a mission that ended', () => {
    const ended = record({
      missions: [{ id: MISSION, number: 3110, repo: 'northwind/quotes', status: 'delivered', prds: [prd(2817)] }],
      outbox: [{ repository: 'northwind/quotes', prd: prd(2817), waiting: [{ id: 's2-01-keep', question: 'Keep?' }], syncedAt: '2026-11-21T08:45:00Z' }],
    });
    expect(cardsOf(ended, NOW)).toEqual([]);
  });
});

describe('the rail\'s words', () => {
  it('names the count, who answers and who answered', () => {
    expect(railHeading(2)).toBe('Waiting on you · 2');
    expect(answersAs('mira-k')).toBe('Answers as mira-k');
    expect(answerAs('mira-k')).toBe('Answer as mira-k?');
    expect(answerAs(null)).toBe('Answer as you?');
    expect(answeredBy({ login: 'paul-n', at: '2026-11-21T08:58:00Z', choice: 'Keep' })).toBe('Answered by paul-n · 08:58 · ');
  });
});
