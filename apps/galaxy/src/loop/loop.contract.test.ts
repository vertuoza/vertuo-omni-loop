import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ChangeDetailSchema,
  ChangesSchema,
  CommentsQuerySchema,
  CommentsSchema,
  IssueDetailSchema,
  IssuesQuerySchema,
  IssuesSchema,
  LoopRefusalSchema,
  ReviewSchema,
} from './loop.contract';

// The loop's contract (PRD 1665, s2): one example of every answer, in ./fixtures/contract.json, which
// the kit's adapter test reads from the same path. Each parses here as it is, so the two sides hold to
// one truth: a change to a shape that the examples do not follow fails on this side first.

const FIXTURES = new URL('./fixtures/contract.json', import.meta.url);
const fixtures = JSON.parse(readFileSync(FIXTURES, 'utf8')) as Record<string, unknown>;

describe('the loop contract\'s shared examples', () => {
  it.each([
    ['changes', ChangesSchema],
    ['change', ChangeDetailSchema],
    ['comments', CommentsSchema],
    ['issues', IssuesSchema],
    ['issue', IssueDetailSchema],
    ['refusal', LoopRefusalSchema],
  ] as const)('%s parses as the contract says, unchanged', (name, schema) => {
    expect(schema.parse(fixtures[name])).toEqual(fixtures[name]);
  });

  it('names every answer, and nothing else', () => {
    expect(Object.keys(fixtures).sort()).toEqual(['change', 'changes', 'comments', 'issue', 'issues', 'refusal']);
  });

  it('shows every check state', () => {
    const { checks } = ReviewSchema.parse((fixtures.change as { review: unknown }).review);
    expect(new Set(checks.map((check) => check.state))).toEqual(new Set(['pending', 'success', 'failure', 'neutral', 'skipped']));
  });
});

describe('the loop contract\'s queries', () => {
  it('reads comments on an issue or a change by its number', () => {
    expect(CommentsQuerySchema.parse({ repo: 'acme/widgets', on: '12' })).toEqual({ repo: 'acme/widgets', on: 12 });
    for (const on of ['0', '-1', '1.5', 'x', '']) expect(CommentsQuerySchema.safeParse({ repo: 'acme/widgets', on }).success).toBe(false);
    expect(CommentsQuerySchema.safeParse({ repo: 'acme/widgets' }).success).toBe(false);
  });

  it('lists open issues unless asked for all or closed', () => {
    expect(IssuesQuerySchema.parse({ repo: 'acme/widgets' })).toEqual({ repo: 'acme/widgets', state: 'open' });
    expect(IssuesQuerySchema.parse({ repo: 'acme/widgets', label: 'omni:bug', state: 'all' }).state).toBe('all');
    expect(IssuesQuerySchema.safeParse({ repo: 'acme/widgets', state: 'merged' }).success).toBe(false);
    expect(IssuesQuerySchema.safeParse({ repo: 'acme/widgets', base: 'main' }).success).toBe(false);
  });

  it('refuses a review with an unknown check state', () => {
    expect(ReviewSchema.safeParse({ checks: [{ name: 'ci', state: 'cancelled' }], mergeable: null, threads: [] }).success).toBe(false);
  });
});
