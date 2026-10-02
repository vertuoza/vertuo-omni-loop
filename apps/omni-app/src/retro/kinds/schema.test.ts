import { describe, expect, it } from 'vitest';
import {
  ChangedFileSchema,
  IssueEventSchema,
  IssueSchema,
  JobsPageSchema,
  ReviewThreadsAnswerSchema,
  WorkflowRunsPageSchema,
} from './schema.ts';

describe('the GitHub answers the kinds read', () => {
  it('keeps the fields a kind reads and lets the rest through', () => {
    const page = JobsPageSchema.parse({ total_count: 1, jobs: [{ id: 1, name: 'test', status: 'completed', steps: [] }] });
    expect(page.jobs?.[0]).toMatchObject({ id: 1, name: 'test', steps: [] });
    expect(WorkflowRunsPageSchema.parse({}).workflow_runs).toBeUndefined();
    expect(ChangedFileSchema.parse({ filename: 'a.ts', patch: null }).patch).toBeNull();
  });

  it('refuses a job with no name, naming the field', () => {
    const result = JobsPageSchema.safeParse({ jobs: [{ id: 1 }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['jobs', 0, 'name']);
  });

  it('refuses an issue event whose time is not text, naming the field', () => {
    const result = IssueEventSchema.safeParse({ event: 'labeled', created_at: 7 });
    expect(result.error?.issues[0]?.path).toEqual(['created_at']);
  });

  it('refuses an issue with no number, naming the field', () => {
    const result = IssueSchema.safeParse({ html_url: 'https://github.com/a/b/issues/1', created_at: '2026-01-01T00:00:00Z' });
    expect(result.error?.issues[0]?.path).toEqual(['number']);
  });

  it('reads a GraphQL refusal and a GraphQL answer alike', () => {
    expect(ReviewThreadsAnswerSchema.parse({ data: null, errors: [{ type: 'FORBIDDEN', message: 'no' }] })?.errors).toHaveLength(1);
    const answer = ReviewThreadsAnswerSchema.parse({
      data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } } },
    });
    expect(answer?.data?.repository?.pullRequest?.reviewThreads?.nodes).toEqual([]);
    const refused = ReviewThreadsAnswerSchema.safeParse({ data: { repository: { pullRequest: { reviewThreads: { nodes: [{ isResolved: 'yes' }] } } } } });
    expect(refused.error?.issues[0]?.path).toEqual(['data', 'repository', 'pullRequest', 'reviewThreads', 'nodes', 0, 'isResolved']);
  });
});
