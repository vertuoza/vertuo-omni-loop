import { BUG_FIX_OUTCOMES } from 'omni-loop/kit/lib/runner/log.ts';
import { describe, expect, it } from 'vitest';
import { STORED_STAGES } from '../stages/stage';
import { decodeCursor } from './cursor';
import {
  ACTING_FOR_MAX, AnswerJobSchema, API_OUTCOMES, BugFixSchema, DismissJobSchema, JobLineListSchema, JobSchema, ListQuerySchema, MEGA_DESCRIPTION_MAX, PRD_STAGES, PrdSchema,
  PUBLIC_API_ERRORS, PublicApiErrorSchema, QuestionsSchema, StartBugFixSchema, StartMegaBugFixSchema,
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

describe('a job’s lines (PRD 2425 s4)', () => {
  it('reads a page of lines, each its sequence number and its text, and a cursor or none', () => {
    const page = { data: [{ seq: 1, text: '12:00:01 /omni:bug-fix 548' }, { seq: 2, text: '' }], next_cursor: 'WyJsaW5lcyIsIjBiNGMxZDJlLTNmNDAtNGE1Yi04YzZkLTdlOGY5MGExYjJjMyIsMl0' };
    expect(JobLineListSchema.parse(page)).toEqual(page);
    expect(JobLineListSchema.parse({ data: [], next_cursor: null })).toEqual({ data: [], next_cursor: null });
  });

  it('refuses a line with no text, a text that is not one, and a sequence number that is not a positive whole number', () => {
    for (const line of [{ seq: 1 }, { seq: 1, text: 3 }, { seq: 0, text: 'x' }, { seq: -1, text: 'x' }, { seq: 1.5, text: 'x' }, { seq: '1', text: 'x' }, { text: 'x' }]) {
      expect(JobLineListSchema.safeParse({ data: [line], next_cursor: null }).success, JSON.stringify(line)).toBe(false);
    }
  });

  it('refuses a page with no next_cursor, so a client may rely on it, null on the last page', () => {
    expect(JobLineListSchema.safeParse({ data: [] }).error?.issues[0]?.path).toEqual(['next_cursor']);
  });

  it('describes the page for the reference', () => {
    expect(JobLineListSchema.meta()?.description).toEqual(expect.any(String));
    expect(JobLineListSchema.shape.next_cursor.meta()?.description).toEqual(expect.any(String));
  });
});

// PRD 2425 s6: a key answers or dismisses the questions of its job, saying whom it acts for.
describe('whom a key acts for (PRD 2425 s6)', () => {
  const ANSWERS = { 'Which fix?': 'Guard the input' };
  const accepted = ['Jane D.', 'José', 'Zoë O\'Neil', '田中 太郎', 'Анна', 'jane@acme.test', 'bot_7-b', 'a·b', '  spaced  ', 'ñ', 'नमस्ते', 'Team 42', 'x'.repeat(ACTING_FOR_MAX)];
  const refused = ['', 'x'.repeat(ACTING_FOR_MAX + 1), 'Jane <b>', 'a/b', 'line\nbreak', 'tab\t', 'emoji 😀', '“quoted”', 'a;b', 'a,b', 'a:b', 'a(b)', '50%', 'zero​width', 'a\\b', 'a"b'];

  it('takes 1 to 80 characters of letters of any alphabet, digits, spaces and . _ \' @ - · only', () => {
    for (const actingFor of accepted) {
      expect(AnswerJobSchema.safeParse({ answers: ANSWERS, acting_for: actingFor }).success, actingFor).toBe(true);
      expect(DismissJobSchema.safeParse({ acting_for: actingFor }).success, actingFor).toBe(true);
    }
    for (const actingFor of refused) {
      expect(AnswerJobSchema.safeParse({ answers: ANSWERS, acting_for: actingFor }).error?.issues[0]?.path, actingFor).toEqual(['acting_for']);
      expect(DismissJobSchema.safeParse({ acting_for: actingFor }).error?.issues[0]?.path, actingFor).toEqual(['acting_for']);
    }
  });

  it('is stored as given: never trimmed, folded or normalised', () => {
    expect(AnswerJobSchema.parse({ answers: ANSWERS, acting_for: '  Jane  D.  ' }).acting_for).toBe('  Jane  D.  ');
    expect(DismissJobSchema.parse({ acting_for: 'ñ' }).acting_for).toBe('ñ');
  });

  it('is optional, and never null or anything but a string', () => {
    expect(AnswerJobSchema.parse({ answers: ANSWERS })).toEqual({ answers: ANSWERS });
    expect(DismissJobSchema.parse({})).toEqual({});
    for (const actingFor of [null, 3, true, ['Jane'], {}]) {
      expect(AnswerJobSchema.safeParse({ answers: ANSWERS, acting_for: actingFor }).error?.issues[0]?.path, JSON.stringify(actingFor)).toEqual(['acting_for']);
      expect(DismissJobSchema.safeParse({ acting_for: actingFor }).success, JSON.stringify(actingFor)).toBe(false);
    }
  });
});

describe('the answers a key sends (PRD 2425 s6)', () => {
  it('takes the answers as the page takes them, one to each question by its text, and whom the key acts for', () => {
    expect(AnswerJobSchema.parse({ answers: { 'Which fix?': 'Guard the input' } })).toEqual({ answers: { 'Which fix?': 'Guard the input' } });
    const both = { answers: { 'Which fix?': 'Design it first', 'And the tests?': 'A free answer, in the key’s own words.' }, acting_for: 'Jane D.' };
    expect(AnswerJobSchema.parse(both)).toEqual(both);
  });

  it('takes the page’s limits: 1 to 4 answers, each of 1 to 2,000 characters, to a question of at least one', () => {
    const many = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`Question ${String(i)}?`, 'Yes']));
    expect(AnswerJobSchema.safeParse({ answers: many(4) }).success).toBe(true);
    expect(AnswerJobSchema.safeParse({ answers: { 'Which fix?': 'x'.repeat(2000) } }).success).toBe(true);
    for (const answers of [{}, many(5), { 'Which fix?': '' }, { 'Which fix?': 'x'.repeat(2001) }, { '': 'Yes' }, { 'Which fix?': 3 }, 'Guard the input', ['Guard the input'], null]) {
      expect(AnswerJobSchema.safeParse({ answers }).error?.issues[0]?.path[0], JSON.stringify(answers)).toBe('answers');
    }
  });

  it('refuses a body with no answers, and a field it does not know, naming it', () => {
    expect(AnswerJobSchema.safeParse({}).error?.issues[0]?.path).toEqual(['answers']);
    const unknown = AnswerJobSchema.safeParse({ answers: { 'Which fix?': 'Guard the input' }, acted_for: 'Jane D.' }).error?.issues[0];
    expect(unknown).toMatchObject({ code: 'unrecognized_keys', keys: ['acted_for'] });
  });

  it('describes each field for the reference', () => {
    expect(AnswerJobSchema.shape.answers.meta()?.description).toEqual(expect.any(String));
    expect(AnswerJobSchema.shape.acting_for.meta()?.description).toEqual(expect.any(String));
  });
});

describe('the dismissal a key sends (PRD 2425 s6)', () => {
  it('takes nothing, or whom the key acts for, and no other field', () => {
    expect(DismissJobSchema.parse({})).toEqual({});
    expect(DismissJobSchema.parse({ acting_for: 'Jane D.' })).toEqual({ acting_for: 'Jane D.' });
    expect(DismissJobSchema.safeParse({ answers: { 'Which fix?': 'Guard the input' } }).error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['answers'] });
    expect(DismissJobSchema.safeParse(null).success).toBe(false);
    expect(DismissJobSchema.safeParse([]).success).toBe(false);
  });

  it('describes its field for the reference', () => {
    expect(DismissJobSchema.shape.acting_for.meta()?.description).toEqual(expect.any(String));
  });
});

describe('a job’s questions, as a key reads them (PRD 2425 s6)', () => {
  const OPTIONS = [{ label: 'Guard the input', description: 'Check the tenant before the query' }, { label: 'Design it first', description: 'Stop here and brainstorm the behaviour' }];
  const OPEN = {
    lead: 'The planning query fails for 31 tenants.',
    questions: [{ question: 'Which fix?', header: 'Fix', multi_select: false, options: OPTIONS }],
    state: 'open', answers: null, closed_by: null,
  };

  it('reads an open round: the lead, the questions, no answers and nobody who closed it', () => {
    expect(QuestionsSchema.parse(OPEN)).toEqual(OPEN);
  });

  it('reads who closed it: a key by its name and whom it acted for, or a person by their login', () => {
    const answered = { ...OPEN, state: 'answered', answers: { 'Which fix?': 'Guard the input' } };
    for (const closedBy of [{ key: 'Support bot', acting_for: 'Jane D.' }, { key: 'Support bot', acting_for: null }, { login: 'mo' }, { login: null }]) {
      expect(QuestionsSchema.parse({ ...answered, closed_by: closedBy }).closed_by, JSON.stringify(closedBy)).toEqual(closedBy);
    }
    expect(QuestionsSchema.parse({ ...OPEN, state: 'dismissed', closed_by: { key: 'QA dashboard', acting_for: null } }).answers).toBeNull();
  });

  it('refuses a state it does not name, and a closer that is a key and a person at once, or a key with no acting_for', () => {
    expect(QuestionsSchema.safeParse({ ...OPEN, state: 'closed' }).error?.issues[0]?.path).toEqual(['state']);
    for (const closedBy of [{ key: 'Support bot', login: 'mo' }, { key: 'Support bot' }, { login: 'mo', acting_for: 'Jane D.' }, 'mo', {}]) {
      expect(QuestionsSchema.safeParse({ ...OPEN, state: 'answered', closed_by: closedBy }).success, JSON.stringify(closedBy)).toBe(false);
    }
  });

  it('refuses a read missing any field, so a client may rely on all of them', () => {
    for (const field of ['lead', 'questions', 'state', 'answers', 'closed_by']) {
      const without = Object.fromEntries(Object.entries(OPEN).filter(([name]) => name !== field));
      expect(QuestionsSchema.safeParse(without).error?.issues[0]?.path, field).toEqual([field]);
    }
  });

  it('describes each field for the reference', () => {
    for (const field of ['lead', 'questions', 'state', 'answers', 'closed_by'] as const) {
      expect(QuestionsSchema.shape[field].meta()?.description, field).toEqual(expect.any(String));
    }
  });
});

describe('the errors', () => {
  it('answer one shape, with the spec’s statuses, a 409 for a round already closed included (PRD 2425 s6)', () => {
    expect(PUBLIC_API_ERRORS).toEqual({ unauthorized: 401, forbidden: 403, not_found: 404, conflict: 409, invalid_request: 422, internal: 500 });
    for (const code of Object.keys(PUBLIC_API_ERRORS)) expect(PublicApiErrorSchema.safeParse({ error: { code, message: 'm' } }).success).toBe(true);
    expect(PublicApiErrorSchema.safeParse({ error: { code: 'teapot', message: 'm' } }).success).toBe(false);
    expect(PublicApiErrorSchema.safeParse({ error: 'Sign in first.' }).success).toBe(false);
  });
});
