// The CLI's `gh` schemas: each keeps what GitHub sends, and refuses a value of another shape with an
// error that names the field.
import { describe, expect, it } from 'vitest';
import { assertDefined } from '../test/assert.ts';
import {
  GhCommentsSchema,
  GhGraphqlSchema,
  GhPrCommitsSchema,
  GhPrListSchema,
  GhPrStatesSchema,
  GhPullRequestSchema,
  GhReplyMutationSchema,
  GhWrittenCommentSchema,
} from './schema.ts';

/** The path of the first issue a schema raises on `value`, joined with dots. */
const refusedAt = (schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } }, value: unknown) => {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  const issue = result.error?.issues[0];
  assertDefined(issue, 'the first issue');
  return issue.path.join('.');
};

describe('the gh schemas', () => {
  it('keep a comment list, and name the field of a comment with no number id', () => {
    const comments = [{ id: 1, body: 'hi', html_url: 'https://x', user: { login: 'a' } }];
    expect(GhCommentsSchema.parse(comments)).toEqual(comments);
    expect(refusedAt(GhCommentsSchema, [{ id: '1' }])).toBe('0.id');
  });

  it('keep a written comment, or none, and name a non-number id', () => {
    expect(GhWrittenCommentSchema.parse({ id: 3, html_url: 'https://x' })).toEqual({ id: 3, html_url: 'https://x' });
    expect(GhWrittenCommentSchema.parse(null)).toBeNull();
    expect(refusedAt(GhWrittenCommentSchema, { id: 'three' })).toBe('id');
  });

  it('keep a pull request, and name a missing html_url', () => {
    const pr = { number: 43, html_url: 'https://x', merged_at: null, merged_by: null, merge_commit_sha: null, base: { ref: 'main' }, head: { ref: 'f' } };
    expect(GhPullRequestSchema.parse(pr)).toEqual(pr);
    expect(refusedAt(GhPullRequestSchema, { number: 43 })).toBe('html_url');
  });

  it('keep a pull request list, and name a label of another shape', () => {
    const list = [{ number: 1, headRefName: 'feat/x--s1', labels: [{ name: 'omni:sub' }, 'bug'] }];
    expect(GhPrListSchema.parse(list)).toEqual(list);
    expect(refusedAt(GhPrListSchema, [{ isDraft: 'yes' }])).toBe('0.isDraft');
  });

  it('keep a pull request\'s commits and states, and name what is not one', () => {
    expect(GhPrCommitsSchema.parse({ commits: [{ committedDate: '2026-01-01' }] })).toEqual({ commits: [{ committedDate: '2026-01-01' }] });
    expect(refusedAt(GhPrCommitsSchema, { commits: 'none' })).toBe('commits');
    expect(GhPrStatesSchema.parse([{ number: 9, state: 'OPEN' }])).toEqual([{ number: 9, state: 'OPEN' }]);
    expect(refusedAt(GhPrStatesSchema, [{ state: 'OPEN' }])).toBe('0.number');
  });

  it('keep a GraphQL answer and its reply, and name an error with no message', () => {
    expect(GhGraphqlSchema.parse({ data: { x: 1 } })).toEqual({ data: { x: 1 } });
    expect(refusedAt(GhGraphqlSchema, { errors: [{ type: 'NOT_FOUND' }] })).toBe('errors.0.message');
    const reply = { data: { addPullRequestReviewThreadReply: { comment: { url: 'https://x' } } } };
    expect(GhReplyMutationSchema.parse(reply)).toEqual(reply);
    expect(refusedAt(GhReplyMutationSchema, { data: { addPullRequestReviewThreadReply: { comment: { url: 7 } } } })).toBe('data.addPullRequestReviewThreadReply.comment.url');
  });
});
