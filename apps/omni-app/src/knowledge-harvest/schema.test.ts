// What the knowledge harvest reads (PRD 725, s20): its event and GitHub's answers, extra fields and
// all; one missing what the harvest uses fails, naming the field.
import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { asSaved } from '../saved-step.ts';
import {
  ClassificationOutSchema,
  CommitSchema,
  FailedHarvestEventSchema,
  HarvestEventSchema,
  OpenPullSchema,
  parsedOr,
  PublishedSchema,
  PullMergeSchema,
  QualifiedSchema,
  RefSchema,
} from './schema.ts';

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

  it('read back a step "qualify" as Inngest saved it, the config included, and refuse a merge missing its time, of another type or null', () => {
    const qualified = {
      skip: null,
      config: parseConfig('kit: 1\nrepo:\n  defaultBranch: main\n'),
      prd: { number: 42, topic: 'widgets', title: 'Widgets' },
      merge: { by: 'octocat', at: '2026-09-27T10:00:00Z', pr: 43 },
    };
    expect(QualifiedSchema.parse(asSaved(qualified))).toEqual(qualified);
    expect(QualifiedSchema.parse({ skip: '#43 was closed, not merged.' })).toEqual({ skip: '#43 was closed, not merged.' });
    expect(QualifiedSchema.safeParse({ ...qualified, merge: { ...qualified.merge, at: undefined } }).success).toBe(false);
    expect(QualifiedSchema.safeParse({ ...qualified, merge: { ...qualified.merge, pr: '43' } }).success).toBe(false);
    expect(QualifiedSchema.safeParse({ ...qualified, prd: null }).success).toBe(false);
  });

  it('read back a step "classify" and "publish", and refuse them missing a field, of another type or null', () => {
    const classified = { id: 's1-01', reply: { kind: 'stays-here', statement: 'A local choice.', reason: 'local' }, reason: null, error: null };
    expect(ClassificationOutSchema.parse(asSaved(classified))).toEqual(classified);
    expect(ClassificationOutSchema.safeParse({ ...classified, id: undefined }).success).toBe(false);
    expect(ClassificationOutSchema.safeParse({ ...classified, reply: { kind: 'stays-here', statement: 7, reason: 'local' } }).success).toBe(false);
    expect(ClassificationOutSchema.safeParse({ ...classified, id: null }).success).toBe(false);
    const published = { branch: 'docs/knowledge-widgets', commit: 'c1', committed: true, pr: { number: 9, url: 'u', created: true } };
    expect(PublishedSchema.parse(asSaved(published))).toEqual(published);
    expect(PublishedSchema.parse(null)).toBeNull();
    expect(PublishedSchema.safeParse({ ...published, commit: undefined }).success).toBe(false);
    expect(PublishedSchema.safeParse({ ...published, committed: 'yes' }).success).toBe(false);
    expect(PublishedSchema.safeParse({ ...published, pr: null }).success).toBe(false);
  });
});
