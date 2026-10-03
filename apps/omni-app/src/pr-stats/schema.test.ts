// The answers the collector reads (PRD 725, s20): each schema takes a GitHub- or database-shaped
// answer, extra fields and all, and refuses one missing what the collector uses, naming the field.
import { describe, expect, it } from 'vitest';
import { asSaved } from '../saved-step.ts';
import {
  BatchOutSchema,
  FailureSchema,
  parseAnswer,
  PullDetailSchema,
  PullsUpdatedSchema,
  RateLimited,
  StoreEnvSchema,
  TrackedRepositoriesSchema,
  TrackedRowSchema,
} from './schema.ts';

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  return 'no refusal';
};

describe('the collector answer schemas', () => {
  it('read a budget, and refuse one without its remaining points', () => {
    const answer = { rateLimit: { limit: 5000, remaining: 4000, resetAt: '2026-09-29T13:00:00Z', cost: 1 } };
    expect(parseAnswer(RateLimited, answer, 'Budget')).toEqual(answer);
    expect(parseAnswer(RateLimited, {}, 'Budget')).toEqual({});
    expect(refusal(() => parseAnswer(RateLimited, { rateLimit: { limit: 5000 } }, 'Budget'))).toMatch(
      /^GitHub answered Budget unexpectedly: rateLimit\.remaining: /,
    );
  });

  it('read a page of pull requests, and refuse a node without its number', () => {
    const page = { repository: { pullRequests: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ number: 1, updatedAt: '2026-09-28T10:00:00Z' }] } } };
    expect(parseAnswer(PullsUpdatedSchema, page, 'PullsUpdated')).toEqual(page);
    const broken = { repository: { pullRequests: { pageInfo: { hasNextPage: false }, nodes: [{ updatedAt: '2026-09-28T10:00:00Z' }] } } };
    expect(refusal(() => parseAnswer(PullsUpdatedSchema, broken, 'PullsUpdated'))).toMatch(
      /^GitHub answered PullsUpdated unexpectedly: repository\.pullRequests\.nodes\.0\.number: /,
    );
  });

  it('read a pull request with no author, and refuse one without its creation date', () => {
    const detail = { number: 3, author: null, createdAt: '2026-09-20T10:00:00Z', labels: { nodes: [null, { name: 'omni:sub' }] }, extra: true };
    expect(PullDetailSchema.parse(detail)).toEqual(detail);
    expect(refusal(() => parseAnswer(PullDetailSchema, { number: 3 }, 'PullDetails'))).toMatch(/: createdAt: /);
  });

  it('read a tracked repository row, and refuse one without its workspace', () => {
    const row = { workspace_id: 'ws', full_name: 'vertuoza/apps', collected_until: null, workspaces: { github_installation_id: 7 } };
    expect(TrackedRowSchema.parse(row)).toEqual(row);
    expect(TrackedRowSchema.safeParse({ ...row, workspace_id: undefined }).error?.issues[0]?.path).toEqual(['workspace_id']);
  });

  it('read what a failed call says, whatever else it carries', () => {
    const failure = Object.assign(new Error('Not Found'), { status: 404 });
    expect(FailureSchema.parse(failure)).toMatchObject({ message: 'Not Found', status: 404 });
    expect(FailureSchema.parse({ errors: 'not a list' })).toEqual({ errors: undefined });
    expect(FailureSchema.safeParse('a string').success).toBe(false);
  });

  it('read the store environment, and refuse a key that is not text', () => {
    expect(StoreEnvSchema.parse({ SUPABASE_URL: 'https://db.example', HOME: '/root' })).toMatchObject({ SUPABASE_URL: 'https://db.example' });
    expect(StoreEnvSchema.safeParse({ SUPABASE_SERVICE_ROLE_KEY: 7 }).error?.issues[0]?.path).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
  });

  it('read back a step "list-repositories" as Inngest saved it, and refuse a repository missing its installation, of another type or null', () => {
    const repositories = [{ workspaceId: 'ws', installationId: 7, fullName: 'acme/widgets', collectedUntil: null }];
    expect(TrackedRepositoriesSchema.parse(asSaved(repositories))).toEqual(repositories);
    expect(TrackedRepositoriesSchema.safeParse([{ ...repositories[0], installationId: undefined }]).error?.issues[0]?.path).toEqual([0, 'installationId']);
    expect(TrackedRepositoriesSchema.safeParse([{ ...repositories[0], installationId: '7' }]).success).toBe(false);
    expect(TrackedRepositoriesSchema.safeParse([{ ...repositories[0], fullName: null }]).success).toBe(false);
  });

  it('read back a step "collect" as Inngest saved it, and refuse a batch missing its cursor, of another type or null', () => {
    const out = { saved: 2, cursor: '2026-09-28T10:00:00Z', more: false, error: undefined, budget: { limit: 5000, remaining: 4000, resetAt: null } };
    expect(BatchOutSchema.parse(asSaved(out))).toEqual({ saved: 2, cursor: '2026-09-28T10:00:00Z', more: false, budget: out.budget });
    expect(BatchOutSchema.parse(asSaved({ ...out, paused: true, budget: {} }))).toMatchObject({ paused: true, budget: {} });
    expect(BatchOutSchema.safeParse({ ...out, cursor: undefined }).error?.issues[0]?.path).toEqual(['cursor']);
    expect(BatchOutSchema.safeParse({ ...out, saved: '2' }).success).toBe(false);
    expect(BatchOutSchema.safeParse({ ...out, budget: null }).success).toBe(false);
  });
});
