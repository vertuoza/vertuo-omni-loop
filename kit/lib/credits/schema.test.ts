// PRD 725, s14: the shapes `omni credits` reads from `gh` (`gh search prs`/`issues`, `gh search
// commits`, `gh pr view`), parsed before use. A valid row passes; an invalid one fails naming its
// field.
import { describe, expect, it } from 'vitest';
import { parseGh, SearchedCommitsSchema, SearchedItemsSchema, ViewedPullRequestSchema } from './schema.ts';

describe('the rows gh prints for omni credits', () => {
  it('a searched pull request or issue: every field but its number and repository may be missing', () => {
    const repository = { nameWithOwner: 'acme/widgets' };
    expect(SearchedItemsSchema.parse([{ number: 1, repository }, { number: 2, title: 'Two', labels: [{ name: 'omni:sub' }], author: null, repository }])).toEqual([
      { number: 1, repository },
      { number: 2, title: 'Two', labels: [{ name: 'omni:sub' }], author: null, repository },
    ]);
  });

  it('a searched commit: its sha, and what it carries when gh gives it', () => {
    const row = { sha: 'c1', commit: { message: 'feat: x', committer: { date: '2026-08-11T09:00:00Z' } }, repository: { fullName: 'acme/widgets' } };
    expect(SearchedCommitsSchema.parse([row])).toEqual([row]);
  });

  it('a viewed pull request', () => {
    expect(ViewedPullRequestSchema.parse({ number: 9, state: 'MERGED' })).toEqual({ number: 9, state: 'MERGED' });
  });

  it('an invalid row fails naming the field and what printed it', () => {
    expect(() => parseGh(SearchedItemsSchema, [{ number: 'one' }], 'gh search prs')).toThrow(/^gh search prs printed an unexpected shape: 0\.number: /);
    expect(() => parseGh(SearchedItemsSchema, [{ number: 1, labels: [{ title: 'x' }], repository: { nameWithOwner: 'a/b' } }], 'gh search prs')).toThrow(/0\.labels\.0\.name/);
    expect(() => parseGh(SearchedItemsSchema, [{ number: 1 }], 'gh search issues')).toThrow(/^gh search issues printed an unexpected shape: 0\.repository: Required$/);
    expect(() => parseGh(SearchedCommitsSchema, [{ commit: {} }], 'gh search commits')).toThrow(/0\.sha/);
    expect(() => parseGh(ViewedPullRequestSchema, { number: 9, author: { login: 4 } }, 'gh pr view')).toThrow(/author\.login/);
  });
});
