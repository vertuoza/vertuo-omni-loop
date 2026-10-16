import { describe, expect, it } from 'vitest';
import { STORED_STAGES } from '../stages/stage';
import { decodeCursor } from './cursor';
import {
  BugFixSchema, ListQuerySchema, PRD_STAGES, PrdSchema, PUBLIC_API_ERRORS, PublicApiErrorSchema,
} from './public-api.contract';

// The public API's contract (PRD 2022 s2): a list's query, valid and refused; the shapes the spec names;
// the one error shape and its statuses.

const ID = '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';
const LINKS = { page: `https://omni.example/prd/${ID}`, issue: 'https://github.com/acme/backend/issues/42' };

describe('a list’s query', () => {
  it('takes 50 rows by default, and 1 to 100', () => {
    expect(ListQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(ListQuerySchema.parse({ limit: '1' })).toEqual({ limit: 1 });
    expect(ListQuerySchema.parse({ limit: '100', cursor: 'abc' })).toEqual({ limit: 100, cursor: 'abc' });
  });

  it('refuses a limit of 0, 101, a word, a fraction or nothing, naming limit', () => {
    for (const limit of ['0', '101', 'abc', '2.5', '']) {
      const read = ListQuerySchema.safeParse({ limit });
      expect(read.success).toBe(false);
      expect(read.error?.issues[0]?.path).toEqual(['limit']);
    }
  });

  it('refuses an empty cursor, naming cursor', () => {
    expect(ListQuerySchema.safeParse({ cursor: '' }).error?.issues[0]?.path).toEqual(['cursor']);
  });

  it('shows a cursor of the PRD list as its example', () => {
    const example = ListQuerySchema.shape.cursor.meta()?.example;
    expect(typeof example === 'string' && decodeCursor(example, 'prds')).toMatchObject({ list: 'prds' });
  });
});

describe('the shapes', () => {
  it('reads a repository PRD and a product PRD', () => {
    const prd = {
      id: ID, ref: '42', number: 42, title: 'Faster invoices', repo: 'acme/backend', product: null, stage: 'building',
      created_at: '2026-10-15T13:41:50.481+00:00', links: LINKS,
    };
    expect(PrdSchema.parse(prd)).toEqual(prd);
    const product = { ...prd, ref: 'mobile-12', number: 12, repo: null, product: { key: 'mobile', name: 'Mobile' }, stage: null, links: { ...LINKS, issue: null } };
    expect(PrdSchema.parse(product)).toEqual(product);
  });

  it('refuses a PRD with no number, or a stage the track does not have', () => {
    const prd = { id: ID, ref: '1', number: 0, title: 't', repo: null, product: null, stage: null, created_at: 'x', links: LINKS };
    expect(PrdSchema.safeParse(prd).success).toBe(false);
    expect(PrdSchema.safeParse({ ...prd, number: 1, stage: 'idea' }).success).toBe(false);
  });

  it('names the stored stages of the track', () => {
    expect([...PRD_STAGES]).toEqual([...STORED_STAGES]);
  });

  it('reads a bug fix, always of a repository', () => {
    const bug = { id: ID, number: 548, title: 'Login loops', repo: 'acme/backend', created_at: '2026-10-15T13:41:50+00:00', links: LINKS };
    expect(BugFixSchema.parse(bug)).toEqual(bug);
    expect(BugFixSchema.safeParse({ ...bug, repo: null }).success).toBe(false);
  });
});

describe('the errors', () => {
  it('answer one shape, with the spec’s statuses', () => {
    expect(PUBLIC_API_ERRORS).toEqual({ unauthorized: 401, forbidden: 403, not_found: 404, invalid_request: 422, internal: 500 });
    for (const code of Object.keys(PUBLIC_API_ERRORS)) expect(PublicApiErrorSchema.safeParse({ error: { code, message: 'm' } }).success).toBe(true);
    expect(PublicApiErrorSchema.safeParse({ error: { code: 'teapot', message: 'm' } }).success).toBe(false);
    expect(PublicApiErrorSchema.safeParse({ error: 'Sign in first.' }).success).toBe(false);
  });
});
