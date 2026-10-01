// What the knowledge harvest reads (PRD 725, s20): its event and GitHub's answers, extra fields and
// all; one missing what the harvest uses fails, naming the field.
import { describe, expect, it } from 'vitest';
import { CommitSchema, FailedHarvestEventSchema, HarvestEventSchema, OpenPullSchema, parsedOr, PullMergeSchema, RefSchema } from './schema.ts';

const EVENT = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 43 };

describe('the knowledge harvest schemas', () => {
  it('read the harvest event, and refuse one without its pull request', () => {
    expect(HarvestEventSchema.parse(EVENT)).toEqual(EVENT);
    expect(HarvestEventSchema.safeParse({ ...EVENT, prNumber: undefined }).error?.issues[0]?.path).toEqual(['prNumber']);
    expect(FailedHarvestEventSchema.parse({ owner: 'acme' })).toEqual({ owner: 'acme' });
  });

  it('read a merged pull request, and a closed one with nothing merged', () => {
    const pull = { merged: true, merged_at: '2026-09-26T10:00:00Z', merged_by: { login: 'octocat' }, merge_commit_sha: 'abc', html_url: 'https://x', title: 't' };
    expect(PullMergeSchema.parse(pull)).toEqual(pull);
    expect(PullMergeSchema.parse({ merged: false, merged_at: null, merged_by: null })).toMatchObject({ merged: false });
    expect(() => parsedOr(PullMergeSchema, { merged: 'yes' }, 'GitHub answered #43 unexpectedly')).toThrow(/^GitHub answered #43 unexpectedly: merged: /);
  });

  it('read a branch by its commit, and refuse one without it', () => {
    expect(RefSchema.parse({ ref: 'refs/heads/main', object: { sha: 'abc', type: 'commit' } }).object.sha).toBe('abc');
    expect(() => parsedOr(RefSchema, { object: {} }, 'GitHub answered the branch main unexpectedly')).toThrow(/: object\.sha: /);
  });

  it('read the open pull requests by their head branch, and a commit by its message', () => {
    expect(OpenPullSchema.array().parse([{ number: 1, head: { ref: 'docs/knowledge-x' } }, { number: 2, head: null }])).toHaveLength(2);
    expect(() => parsedOr(OpenPullSchema.array(), [{ head: { ref: 4 } }], 'GitHub answered the open pull requests unexpectedly')).toThrow(/: 0\.head\.ref: /);
    expect(CommitSchema.parse({ sha: 'abc', message: 'docs(knowledge): x' })).toMatchObject({ message: 'docs(knowledge): x' });
    expect(CommitSchema.safeParse({ message: 7 }).error?.issues[0]?.path).toEqual(['message']);
  });
});
