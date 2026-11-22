import { describe, expect, it } from 'vitest';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { DocumentGroup } from '../waiting/documents';
import type { WaitingApproval, WaitingOutbox, WaitingQuestion, WaitingReview } from '../waiting/waiting';
import { inboxOf } from './inbox';
import { countWords, drawnSections, filterOf, hrefOf, inputOf, nextOpen, problemsOf, rowWords, type InboxParts } from './InboxScreen.model';

// The Inbox screen's model (PRD omni-loop-22, s5): what the app shell's waiting list becomes on the Open
// tab, the filter a query asks, each row's words and link, the part that could not be read, and which
// row is open after a read or a send.

const NOW = Date.parse('2026-11-22T10:00:00Z');
const MIN = 60_000;

const question = (id: string, minutesAgo: number, sharedBy: string | null = null): WaitingQuestion => ({ kind: 'question', id, sessionTitle: `Session ${id}`, question: `Question ${id}?`, askedAt: NOW - minutesAgo * MIN, sharedBy });
const approval = (id: string, approvalKind?: 'product' | 'tech'): WaitingApproval => ({ kind: 'approval', id, prd: 41 as PrdNumber, dossierId: `dossier-${id}`, title: 'Reusable widget themes', repo: 'acme/widgets', askedAt: NOW - 120 * MIN, approvalKind });
const outbox = (id: string): WaitingOutbox => ({ kind: 'outbox', id, prd: 42 as PrdNumber, dossierId: 'dossier-o', title: 'Export a widget', rank: 'human-action', question: 'Keep the grid?' });
const review = (id: string, kind: WaitingReview['kind'] = 'review'): WaitingReview => ({ kind, id, prd: 43 as PrdNumber, pr: 310 as PrNumber, repo: 'acme/widgets', since: NOW - 300 * MIN });
const docs = (dossierId: string): DocumentGroup => ({ dossierId, prd: 44 as PrdNumber, title: 'Faster gears', kinds: ['plan'], newestId: 'v1', newestAt: NOW - 5 * MIN });

const NONE = { questions: false, outbox: false, documents: false, business: false, approvals: false, reviews: false, runners: false };

const parts = (part: Partial<InboxParts>): InboxParts => ({
  list: { questions: [], outbox: [] }, approvals: [], reviews: [], documents: [], business: 0, runners: 0, unread: NONE, unreadPrds: 0, ...part,
});

describe('the Open tab’s input, from the waiting list', () => {
  it('takes every question as blocking: the terminal waits on each one the page can still answer', () => {
    const input = inputOf(parts({ list: { questions: [question('a', 3), question('b', 11)], outbox: [] } }), NOW);
    expect([...(input.blocking ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('lists the runner jobs waiting for an answer as one row, opening Runners', () => {
    expect(inputOf(parts({ runners: 2 }), NOW).runnerJobs).toEqual([{ id: 'runners', title: '2 runner jobs wait for an answer', since: NOW, href: '/app/runners' }]);
    expect(inputOf(parts({ runners: 1 }), NOW).runnerJobs[0]?.title).toBe('1 runner job waits for an answer');
    expect(inputOf(parts({ runners: 0 }), NOW).runnerJobs).toEqual([]);
  });

  it('lists the new documents per PRD and the Business checks as updates, less those cleared', () => {
    const input = inputOf(parts({ documents: [docs('d1'), docs('d2')], business: 3 }), NOW, new Set(['update:docs-d2']));
    expect(input.updates.map((u) => u.id)).toEqual(['docs-d1', 'business']);
    expect(input.updates[0]).toMatchObject({ title: 'PRD 44 · Faster gears', detail: 'New plan', href: '/prd/d1' });
    expect(input.updates[1]).toMatchObject({ title: 'Business checks', detail: '3 to check', href: '/app/settings/business' });
  });

  it('AC-5: runner jobs and updates are listed below the counted sections, and not counted', () => {
    const inbox = inboxOf(inputOf(parts({ list: { questions: [question('a', 3)], outbox: [] }, runners: 1, documents: [docs('d1')] }), NOW));
    expect(inbox.sections.map((s) => s.id)).toEqual(['questions', 'anyone', 'updates']);
    expect(inbox.count).toBe(1);
  });
});

describe('the filter a query asks', () => {
  it('reads ?kind= and ?from=shared, anything else as All', () => {
    expect(filterOf({})).toEqual({ kind: 'all', shared: false });
    expect(filterOf({ kind: 'outbox' })).toEqual({ kind: 'outbox', shared: false });
    expect(filterOf({ kind: ['review', 'question'] })).toEqual({ kind: 'review', shared: false });
    expect(filterOf({ from: 'shared' })).toEqual({ kind: 'all', shared: true });
    expect(filterOf({ kind: 'everything' })).toEqual({ kind: 'all', shared: false });
  });
});

describe('what the header says', () => {
  it('counts what waits, or says nothing does', () => {
    expect(countWords(7, false)).toBe('7 wait on you');
    expect(countWords(1, false)).toBe('1 waits on you');
    expect(countWords(0, false)).toBe('Nothing waits on you');
  });

  it('never says nothing waits while a counted part could not be read', () => {
    expect(countWords(0, true)).toBe('Some of what waits on you couldn’t be read');
    expect(countWords(2, true)).toBe('2 wait on you');
  });
});

describe('a row’s words and link', () => {
  const rowsOf = (part: Partial<InboxParts>) => inboxOf(inputOf(parts(part), NOW)).rows;

  it('a question: its session, its text, its age, Blocking, Shared when shared, its round’s page', () => {
    const [row] = rowsOf({ list: { questions: [question('r1', 11, 'Paul')], outbox: [] } });
    if (!row) throw new Error('no row');
    expect(rowWords(row, NOW)).toEqual({ context: 'Session r1 · shared by Paul', text: 'Question r1?', age: '11 min', badges: ['Blocking', 'Shared'] });
    expect(hrefOf(row)).toBe('/ask/q/r1');
  });

  it('an approval: its repository and PRD, what it waits for, its PRD’s review', () => {
    const [product, tech] = rowsOf({ approvals: [approval('p'), approval('t', 'tech')] });
    if (!product || !tech) throw new Error('no row');
    expect(rowWords(product, NOW)).toMatchObject({ context: 'acme/widgets · PRD 41', text: 'Reusable widget themes waits for your approval', badges: ['Approval'] });
    expect(rowWords(tech, NOW)).toMatchObject({ text: 'Tech approval · Reusable widget themes', badges: ['Tech approval'] });
    expect(hrefOf(product)).toBe('/prd/dossier-p');
  });

  it('an outbox item: its PRD, its question, its rank, its PRD’s Outbox tab', () => {
    const [row] = rowsOf({ list: { questions: [], outbox: [outbox('o1')] } });
    if (!row) throw new Error('no row');
    expect(rowWords(row, NOW)).toEqual({ context: 'PRD 42 · Export a widget · outbox item', text: 'Keep the grid?', age: '', badges: ['human-action'] });
    expect(hrefOf(row)).toBe('/prd/dossier-o?tab=outbox');
  });

  it('a review, merge or law: its pull request on GitHub', () => {
    const rows = rowsOf({ reviews: [review('a-review'), review('b-merge', 'merge')] });
    expect(rows.map((r) => rowWords(r, NOW).badges)).toEqual([['Review'], ['Merge']]);
    expect(rows[0] && rowWords(rows[0], NOW).context).toBe('acme/widgets · #310');
    expect(rows[0] && rowWords(rows[0], NOW).text).toBe('PRD 43: your review');
    expect(rows[0] && hrefOf(rows[0])).toBe('https://github.com/acme/widgets/pull/310');
  });
});

describe('a part that could not be read', () => {
  it('says so in its own section', () => {
    expect(problemsOf({ ...NONE, questions: true }, 0)).toEqual({ questions: 'Questions couldn’t be read — retrying.' });
    expect(problemsOf({ ...NONE, approvals: true }, 0).decisions).toBe('Approvals couldn’t be read — retrying.');
    expect(problemsOf(NONE, 2).decisions).toBe('2 PRDs’ outbox couldn’t be read — retrying.');
    expect(problemsOf({ ...NONE, documents: true }, 0).updates).toBe('New documents couldn’t be read — retrying.');
  });

  it('draws the section it failed in even when it holds no row, in its place', () => {
    const inbox = inboxOf(inputOf(parts({ approvals: [approval('p')] }), NOW));
    const drawn = drawnSections(inbox, { questions: 'Questions couldn’t be read — retrying.' });
    expect(drawn.map((s) => [s.id, s.rows.length, s.problem])).toEqual([['questions', 0, 'Questions couldn’t be read — retrying.'], ['decisions', 1, null]]);
  });
});

describe('the row open after a read or a send', () => {
  const two = parts({ list: { questions: [question('a', 11), question('b', 3)], outbox: [] } });

  it('AC-2: opens the oldest question on landing', () => {
    const inbox = inboxOf(inputOf(two, NOW));
    expect(nextOpen([], inbox, null, new Set())).toBe('question:a');
  });

  it('AC-4: the second question opens once the first is answered and leaves the waiting list', () => {
    const before = inboxOf(inputOf(two, NOW));
    const after = inboxOf(inputOf(parts({ list: { questions: [question('b', 3)], outbox: [] } }), NOW));
    expect(nextOpen(before.rows.map((r) => r.key), after, 'question:a', new Set())).toBe('question:b');
  });

  it('AC-4: the next question opens as soon as the open one is sent, before the list is read again', () => {
    const inbox = inboxOf(inputOf(two, NOW));
    expect(nextOpen(inbox.rows.map((r) => r.key), inbox, 'question:a', new Set(['question:a']))).toBe('question:b');
  });

  it('with every question sent, the first decision opens; with nothing left, nothing does', () => {
    const inbox = inboxOf(inputOf(parts({ list: { questions: [question('a', 1)], outbox: [] }, approvals: [approval('p')] }), NOW));
    expect(nextOpen(inbox.rows.map((r) => r.key), inbox, 'question:a', new Set(['question:a']))).toBe('approval:p');
    const alone = inboxOf(inputOf(parts({ list: { questions: [question('a', 1)], outbox: [] } }), NOW));
    expect(nextOpen(['question:a'], alone, 'question:a', new Set(['question:a']))).toBeNull();
  });
});
