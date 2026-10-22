import { BUG_FIX_OUTCOMES } from 'omni-loop/kit/lib/runner/log.ts';
import { describe, expect, it } from 'vitest';
import { STORED_STAGES } from '../stages/stage';
import { decodeCursor } from './cursor';
import {
  API_OUTCOMES, BugFixSchema, JobSchema, ListQuerySchema, MEGA_DESCRIPTION_MAX, PRD_STAGES, PrdSchema, PUBLIC_API_ERRORS, PublicApiErrorSchema,
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

// PRD 2425 s3: what a bug fix did, read with its job.
describe('a job a key follows, with what it did (PRD 2425 s3)', () => {
  const JOB = {
    id: ID, line: '/omni:bug-fix Issue 548 totals', repo: 'acme/backend', status: 'done', runner: 'mac-mini-office',
    pr_url: 'https://github.com/acme/backend/pull/549', exit_code: 0, reason: null,
    queued_at: '2026-10-15T13:41:50.481+00:00', claimed_at: '2026-10-15T13:42:00.000+00:00', running_at: '2026-10-15T13:42:10.000+00:00', ended_at: '2026-10-15T13:50:00.000+00:00',
    outcome: 'pr_opened', fixed_by: null, prs: [{ url: 'https://github.com/acme/backend/pull/549', repo: 'acme/backend', number: 549 }],
    questions: null, continues: null, continued_by: null, acting_for: null, cancelled_by: null, log_tail: null,
  };

  it('reads a job with every field', () => {
    expect(JobSchema.parse(JOB)).toEqual(JOB);
  });

  it('names the seven words of a bug fix’s log, with an underscore for each hyphen', () => {
    expect([...API_OUTCOMES]).toEqual(BUG_FIX_OUTCOMES.map((word) => word.replaceAll('-', '_')));
    expect(API_OUTCOMES).toEqual(['pr_opened', 'already_fixed', 'need_human', 'needs_brainstorm', 'not_a_bug', 'stuck', 'blocked']);
  });

  it.each(API_OUTCOMES)('reads the outcome %s, and none as null', (outcome) => {
    expect(JobSchema.parse({ ...JOB, outcome }).outcome).toBe(outcome);
    expect(JobSchema.parse({ ...JOB, outcome: null }).outcome).toBeNull();
  });

  it('refuses a word the API does not say: a hyphenated one, a yolo one, a made-up one', () => {
    for (const outcome of ['pr-opened', 'need-human', 'human', 'held', 'success']) {
      expect(JobSchema.safeParse({ ...JOB, outcome }).error?.issues[0]?.path).toEqual(['outcome']);
    }
  });

  it('reads the pull request a bug fix proved had fixed the bug', () => {
    const fixed = { ...JOB, outcome: 'already_fixed', fixed_by: 'https://github.com/acme/backend/pull/512', pr_url: null, prs: [] };
    expect(JobSchema.parse(fixed)).toEqual(fixed);
  });

  it('reads each pull request as its link, its repository and its number', () => {
    const prs = [
      { url: 'https://github.com/acme/backend/pull/549', repo: 'acme/backend', number: 549 },
      { url: 'https://github.com/acme/plan/pull/7', repo: 'acme/plan', number: 7 },
    ];
    expect(JobSchema.parse({ ...JOB, prs }).prs).toEqual(prs);
    for (const number of [0, -1, 1.5, '549']) {
      expect(JobSchema.safeParse({ ...JOB, prs: [{ ...prs[0], number }] }).success).toBe(false);
    }
    expect(JobSchema.safeParse({ ...JOB, prs: [{ url: prs[0]?.url, repo: prs[0]?.repo }] }).success).toBe(false);
  });

  it('reads the state of its questions, and none as null', () => {
    for (const state of ['open', 'answered', 'dismissed']) expect(JobSchema.parse({ ...JOB, questions: { state } }).questions).toEqual({ state });
    expect(JobSchema.safeParse({ ...JOB, questions: { state: 'pending' } }).error?.issues[0]?.path).toEqual(['questions', 'state']);
  });

  it('reads the job it continues, the job that continues it and whom the app acted for', () => {
    const other = '1c4d2e3f-4051-4b6c-9d7e-8f90a1b2c3d4';
    const read = JobSchema.parse({ ...JOB, continues: other, continued_by: other, acting_for: 'Jane D.' });
    expect(read).toMatchObject({ continues: other, continued_by: other, acting_for: 'Jane D.' });
    expect(JobSchema.safeParse({ ...JOB, continues: 'job-1' }).error?.issues[0]?.path).toEqual(['continues']);
  });

  it('reads the key that cancelled it and whom that key acted for', () => {
    const status = { status: 'cancelled', exit_code: null, outcome: null, ended_at: JOB.ended_at };
    for (const cancelled_by of [{ key: 'QA dashboard', acting_for: 'Jane D.' }, { key: 'QA dashboard', acting_for: null }]) {
      expect(JobSchema.parse({ ...JOB, ...status, cancelled_by }).cancelled_by).toEqual(cancelled_by);
    }
    expect(JobSchema.safeParse({ ...JOB, cancelled_by: { key: 'QA dashboard' } }).success).toBe(false);
  });

  it('reads the tail of its log, or null', () => {
    expect(JobSchema.parse({ ...JOB, log_tail: '12:00:01 Outcome: pr-opened' }).log_tail).toBe('12:00:01 Outcome: pr-opened');
    expect(JobSchema.safeParse({ ...JOB, log_tail: 3 }).success).toBe(false);
  });

  it('refuses a job missing any new field, so a client may rely on all of them', () => {
    for (const field of ['outcome', 'fixed_by', 'prs', 'questions', 'continues', 'continued_by', 'acting_for', 'cancelled_by', 'log_tail']) {
      const without = Object.fromEntries(Object.entries(JOB).filter(([name]) => name !== field));
      expect(JobSchema.safeParse(without).error?.issues[0]?.path, field).toEqual([field]);
    }
  });

  it('describes each new field for the reference', () => {
    for (const field of ['outcome', 'fixed_by', 'prs', 'questions', 'continues', 'continued_by', 'acting_for', 'cancelled_by', 'log_tail'] as const) {
      expect(JobSchema.shape[field].meta()?.description, field).toEqual(expect.any(String));
    }
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
