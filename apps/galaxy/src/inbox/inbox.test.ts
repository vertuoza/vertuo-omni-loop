import { describe, expect, it } from 'vitest';
import { inboxOf, openAfter, type InboxInput, EMPTY_INBOX_INPUT } from './inbox';
import type { WaitingApproval, WaitingOutbox, WaitingQuestion, WaitingReview } from '../waiting/waiting';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';

const NOW = Date.parse('2026-11-22T10:00:00Z');
const MIN = 60_000;

const question = (id: string, minutesAgo: number, sharedBy: string | null = null): WaitingQuestion => ({ kind: 'question', id, sessionTitle: 's', question: `q ${id}`, askedAt: NOW - minutesAgo * MIN, sharedBy });
const approval = (id: string, minutesAgo: number, approvalKind?: 'product' | 'tech'): WaitingApproval => ({ kind: 'approval', id, prd: 7 as PrdNumber, dossierId: `d${id}`, title: 'A PRD', repo: 'o/r', askedAt: NOW - minutesAgo * MIN, approvalKind });
const outbox = (id: string): WaitingOutbox => ({ kind: 'outbox', id, prd: 7 as PrdNumber, dossierId: 'd', title: 'A PRD', rank: 'high', question: 'q' });
const review = (id: string, minutesAgo: number): WaitingReview => ({ kind: 'review', id, prd: 7 as PrdNumber, pr: 1 as PrNumber, repo: 'o/r', since: NOW - minutesAgo * MIN });
const job = (id: string) => ({ id, title: 'job', since: NOW - MIN });
const update = (id: string) => ({ id, title: 'plan', detail: 'new plan', since: NOW - MIN });

const input = (part: Partial<InboxInput>): InboxInput => ({ ...EMPTY_INBOX_INPUT, ...part });

describe('the Inbox model', () => {
  it('AC-2: Questions come first and the oldest blocking question opens', () => {
    const inbox = inboxOf(input({ questions: [question('b', 3), question('a', 11)], approvals: [approval('x', 60)], blocking: new Set(['a', 'b']) }));
    expect(inbox.sections[0]?.id).toBe('questions');
    expect(inbox.sections[0]?.rows.map((r) => r.key)).toEqual(['question:a', 'question:b']);
    expect(inbox.opening?.key).toBe('question:a');
  });

  it('AC-2: a blocking question precedes an older one that blocks nothing', () => {
    const inbox = inboxOf(input({ questions: [question('old', 30), question('new', 2)], blocking: new Set(['new']) }));
    expect(inbox.sections[0]?.rows.map((r) => r.key)).toEqual(['question:new', 'question:old']);
  });

  it('AC-3: with no question, the first decision opens', () => {
    const inbox = inboxOf(input({ approvals: [approval('x', 5)] }));
    expect(inbox.opening?.key).toBe('approval:x');
    expect(inbox.sections.map((s) => s.id)).toEqual(['decisions']);
  });

  it('AC-3: decisions list product approvals, then tech, then outbox items, each oldest first', () => {
    const inbox = inboxOf(input({ approvals: [approval('t', 50, 'tech'), approval('p2', 5), approval('p1', 20, 'product')], outbox: [outbox('o')] }));
    expect(inbox.sections[0]?.rows.map((r) => r.key)).toEqual(['approval:p1', 'approval:p2', 'approval:t', 'outbox:o']);
  });

  it('AC-3: nothing opens when no question or decision waits', () => {
    expect(inboxOf(input({ reviews: [review('r', 5)], runnerJobs: [job('j')] })).opening).toBeNull();
  });

  it('AC-4: the open row is kept by its key across reads', () => {
    const before = inboxOf(input({ questions: [question('a', 10), question('b', 5)] }));
    const after = inboxOf(input({ questions: [question('c', 20), question('a', 10), question('b', 5)] }));
    expect(openAfter(before.rows.map((r) => r.key), after.rows, 'question:a', after.opening)).toBe('question:a');
  });

  it('AC-4: the next question opens after the open one leaves', () => {
    const before = inboxOf(input({ questions: [question('a', 10), question('b', 5)] }));
    const after = inboxOf(input({ questions: [question('b', 5)] }));
    expect(openAfter(before.rows.map((r) => r.key), after.rows, 'question:a', after.opening)).toBe('question:b');
  });

  it('AC-4: with no row after it, the opening row opens; with nothing open yet, the opening row too', () => {
    const before = inboxOf(input({ questions: [question('a', 10), question('b', 5)] }));
    const after = inboxOf(input({ questions: [question('a', 10)] }));
    expect(openAfter(before.rows.map((r) => r.key), after.rows, 'question:b', after.opening)).toBe('question:a');
    expect(openAfter([], after.rows, null, after.opening)).toBe('question:a');
    expect(openAfter(['gone'], [], 'gone', null)).toBeNull();
  });

  it('AC-5: runner jobs and updates are listed below the counted sections and never counted', () => {
    const inbox = inboxOf(input({ questions: [question('a', 5)], runnerJobs: [job('j')], updates: [update('u')] }));
    expect(inbox.sections.map((s) => s.id)).toEqual(['questions', 'anyone', 'updates']);
    expect(inbox.sections.map((s) => s.counted)).toEqual([true, false, false]);
    expect(inbox.count).toBe(1);
  });

  it('AC-5: the count adds questions, approvals, outbox items and reviews', () => {
    const inbox = inboxOf(input({ questions: [question('a', 1), question('b', 2)], approvals: [approval('x', 1)], outbox: [outbox('o')], reviews: [review('r', 1), review('s', 2)] }));
    expect(inbox.count).toBe(6);
    expect(inbox.sections.map((s) => s.id)).toEqual(['questions', 'decisions', 'reviews']);
  });

  it('shows no section when nothing waits', () => {
    const inbox = inboxOf(EMPTY_INBOX_INPUT);
    expect(inbox.sections).toEqual([]);
    expect(inbox.count).toBe(0);
  });

  it('a kind filter keeps only that kind, and the count does not move', () => {
    const all = input({ questions: [question('a', 1)], approvals: [approval('x', 1)], outbox: [outbox('o')], reviews: [review('r', 1)], runnerJobs: [job('j')], updates: [update('u')] });
    expect(inboxOf(all, { kind: 'approval', shared: false }).rows.map((r) => r.key)).toEqual(['approval:x']);
    expect(inboxOf(all, { kind: 'outbox', shared: false }).rows.map((r) => r.key)).toEqual(['outbox:o']);
    expect(inboxOf(all, { kind: 'review', shared: false }).rows.map((r) => r.key)).toEqual(['review:r']);
    expect(inboxOf(all, { kind: 'question', shared: false }).rows.map((r) => r.key)).toEqual(['question:a']);
    expect(inboxOf(all, { kind: 'review', shared: false }).count).toBe(4);
  });

  it('the shared filter keeps only questions shared with the person', () => {
    const inbox = inboxOf(input({ questions: [question('own', 5), question('sh', 4, 'ana')], approvals: [approval('x', 1)], updates: [update('u')] }), { kind: 'all', shared: true });
    expect(inbox.rows.map((r) => r.key)).toEqual(['question:sh']);
  });
});
