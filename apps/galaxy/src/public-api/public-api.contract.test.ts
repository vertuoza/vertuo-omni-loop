import { describe, expect, it } from 'vitest';
import { STORED_STAGES } from '../stages/stage';
import { decodeCursor } from './cursor';
import {
  BugFixSchema, ListQuerySchema, MEGA_DESCRIPTION_MAX, PRD_STAGES, PrdSchema, PUBLIC_API_ERRORS, PublicApiErrorSchema,
  StartBugFixSchema, StartMegaBugFixSchema,
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

describe('a mega bug fix’s body', () => {
  const BODY = { repo: 'acme/plan', description: 'https://github.com/acme/plan/issues/612' };

  it('takes the plan repository and the issue’s URL, number or line, and where it runs', () => {
    expect(StartMegaBugFixSchema.parse(BODY)).toEqual(BODY);
    for (const description of ['#612', '612', 'the total is wrong on the invoice screen', 'a'.repeat(MEGA_DESCRIPTION_MAX)]) {
      expect(StartMegaBugFixSchema.safeParse({ ...BODY, description }).success, description).toBe(true);
    }
    expect(StartMegaBugFixSchema.parse({ ...BODY, runner: 'agent-box' })).toEqual({ ...BODY, runner: 'agent-box' });
    expect(StartMegaBugFixSchema.parse({ ...BODY, fleet: 'comets' })).toEqual({ ...BODY, fleet: 'comets' });
  });

  it('leaves 181 characters to the description, what a 200-character line keeps after /omni:mega-bug-fix', () => {
    expect(MEGA_DESCRIPTION_MAX).toBe(181);
    expect(StartMegaBugFixSchema.safeParse({ ...BODY, description: 'a'.repeat(182) }).error?.issues[0]?.path).toEqual(['description']);
    expect(StartMegaBugFixSchema.safeParse({ ...BODY, description: '' }).error?.issues[0]?.path).toEqual(['description']);
  });

  it('refuses a word that starts a flag, which would make it another run of the skill', () => {
    for (const description of ['--product mobile', '612 --product mobile', '612 --prd 1200', '612\t--prd 1']) {
      expect(StartMegaBugFixSchema.safeParse({ ...BODY, description }).error?.issues[0]?.path, description).toEqual(['description']);
    }
    expect(StartMegaBugFixSchema.safeParse({ ...BODY, description: 'the a-b total is off by 1-2 cents' }).success).toBe(true);
  });

  it('refuses a field it does not know, where a bug fix’s body ignores it', () => {
    const unknown = StartMegaBugFixSchema.safeParse({ ...BODY, skill: 'bug-fix' });
    expect(unknown.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['skill'] });
    expect(StartBugFixSchema.parse({ ...BODY, skill: 'mega-bug-fix' })).toEqual(BODY);
  });

  it('refuses a repository that is not owner/name', () => {
    expect(StartMegaBugFixSchema.safeParse({ ...BODY, repo: 'plan' }).error?.issues[0]?.path).toEqual(['repo']);
  });
});

describe('the errors', () => {
  it('answer one shape, with the spec’s statuses', () => {
    expect(PUBLIC_API_ERRORS).toEqual({
      unauthorized: 401, forbidden: 403, not_found: 404, invalid_request: 422, github_app_not_installed: 422, github_app_permissions: 422, internal: 500,
    });
    for (const code of Object.keys(PUBLIC_API_ERRORS)) expect(PublicApiErrorSchema.safeParse({ error: { code, message: 'm' } }).success).toBe(true);
    expect(PublicApiErrorSchema.safeParse({ error: { code: 'teapot', message: 'm' } }).success).toBe(false);
    expect(PublicApiErrorSchema.safeParse({ error: 'Sign in first.' }).success).toBe(false);
  });

  it('name the two refusals of a key whose GitHub App cannot run the job (PRD 2433 s6), both 422', () => {
    for (const code of ['github_app_not_installed', 'github_app_permissions'] as const) {
      expect(PUBLIC_API_ERRORS[code]).toBe(422);
      expect(PublicApiErrorSchema.parse({ error: { code, message: 'repo: acme/backend' } }).error.code).toBe(code);
    }
  });
});
