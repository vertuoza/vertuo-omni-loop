// The runner's health call (PRD 2102, s1): `runnerApi().health()` on a fake fetch. It posts the report
// to the runner's own route with the sign-in, and names each failure the runner then prints. Then a
// job's questions (PRD 2255, s2): `jobQuestionsApi()` posts them, reads them back with their answers, and
// carries the app's own words when it refuses. And the job `next` hands over, with the skills of its
// repository's own it may run (PRD 2313, s2).
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../ask/schema.ts';
import { parseIssue, parsePrd } from '../ids.ts';
import { jobQuestionsApi, RunnerRefused, RunnerUnreachable, runnerApi } from './api.ts';
import type { HealthReport, JobQuestions } from './api.ts';

const REPORT: HealthReport = { cpu: 63.5, load1: 7.9, cores: 8, memUsed: 13_958_643_712, memTotal: 17_179_869_184, diskFree: 41_875_931_136, diskTotal: 249_821_655_040 };

function api(answer: (init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const held: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const client = runnerApi({
    askUrl: 'https://omni.test/',
    tokens: { read: (host) => held[host] ?? null, write: (host, tokens) => { held[host] = tokens; } },
    fetch: (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return answer(init);
    },
  });
  return { client, calls };
}

const status = (code: number) => () => Promise.resolve(new Response(code === 204 ? null : '{}', { status: code }));

describe('runnerApi().health()', () => {
  it('posts the report to the runner\'s health route with the sign-in, within 5 s', async () => {
    const { client, calls } = api(status(200));
    await client.health('r 1', REPORT);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://omni.test/api/runners/r%201/health');
    expect(calls[0]?.init).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer access-1', 'content-type': 'application/json' } });
    const body = calls[0]?.init.body;
    expect(typeof body === 'string' ? JSON.parse(body) : null).toEqual(REPORT);
  });

  it('names a route that is not there, another owner\'s runner and a malformed report as refusals', async () => {
    for (const [code, message] of [[404, 'refused (404)'], [403, 'refused (403)'], [400, 'refused (400)']] as const) {
      await expect(api(status(code)).client.health('r1', REPORT)).rejects.toThrow(new RunnerRefused(message));
    }
  });

  it('names a server error and a timeout as the app unreachable', async () => {
    await expect(api(status(503)).client.health('r1', REPORT)).rejects.toThrow(RunnerUnreachable);
    const timedOut = api(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
    await expect(timedOut.client.health('r1', REPORT)).rejects.toThrow(new RunnerUnreachable('POST /api/runners/r1/health: timed out'));
  });
});

// A fresh token of the job's GitHub App (PRD 2433, s3): the runner's sign-in asks, nothing else goes with it,
// and the token never appears in what a refusal says.
describe('runnerApi().githubToken()', () => {
  const TOKEN = ['ghs', 'fakeFreshTokenOfTheJob0123456789ABCDEF'].join('_');
  const FRESH = { token: TOKEN, expiresAt: '2026-10-22T14:00:00Z' };

  it('posts to the job’s github-token route with the sign-in and no body, and answers the token and its expiry alone', async () => {
    const { client, calls } = api(reply(200, { ...FRESH, login: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' }));
    expect(await client.githubToken('job 7')).toEqual(FRESH);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://omni.test/api/runners/jobs/job%207/github-token');
    expect(calls[0]?.init).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer access-1' } });
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it('carries the app’s own words when it refuses (a job that ended, another runner’s job), and `refused (<status>)` when it has none', async () => {
    for (const [code, words] of [[403, 'This job runs on another runner.'], [404, 'No such job.'], [409, 'This job ended more than 10 minutes ago.'], [400, 'The job runs as no app.']] as const) {
      await expect(api(reply(code, { error: words })).client.githubToken('job-7')).rejects.toThrow(new RunnerRefused(words));
    }
    await expect(api(reply(404)).client.githubToken('job-7')).rejects.toThrow(new RunnerRefused('refused (404)'));
    await expect(api(reply(409, { error: '  ' })).client.githubToken('job-7')).rejects.toThrow(new RunnerRefused('refused (409)'));
  });

  it('refuses an answer that holds no token, or no date it can read, without echoing it', async () => {
    for (const body of [{}, { token: TOKEN }, { token: '', expiresAt: FRESH.expiresAt }, { token: TOKEN, expiresAt: 'tomorrow-ish' }, { token: 7, expiresAt: FRESH.expiresAt }]) {
      const refused = api(reply(200, body)).client.githubToken('job-7');
      await expect(refused).rejects.toThrow(new RunnerRefused('refused (the app answered no token)'));
    }
    await expect(api(() => Promise.resolve(new Response('not json', { status: 200 }))).client.githubToken('job-7')).rejects.toThrow(new RunnerRefused('refused (the app answered no token)'));
  });

  it('names a server error and a timeout as the app unreachable', async () => {
    await expect(api(reply(503, { error: 'down' })).client.githubToken('job-7')).rejects.toThrow(RunnerUnreachable);
    const timedOut = api(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
    await expect(timedOut.client.githubToken('job-7')).rejects.toThrow(new RunnerUnreachable('POST /api/runners/jobs/job-7/github-token: timed out'));
  });
});

// A repository's own skills (PRD 2313, s2): the job `next` hands over carries the skills its repository
// allowed, read when it was claimed; an older app's job carries none and reads as none, so it runs as before.
describe('runnerApi().next()', () => {
  const job = (value: unknown) => () => Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));

  it('reads the job with the repository skills it carries', async () => {
    const { client, calls } = api(job({ id: 7, line: '/validate-prd 347', repo: 'acme/widgets', sentBy: 'ada', allowedSkills: ['audit', 'validate-prd'] }));
    expect(await client.next('r 1')).toEqual({ id: '7', line: '/validate-prd 347', repo: 'acme/widgets', sentBy: 'ada', allowedSkills: ['audit', 'validate-prd'], github: null, sentByKey: null });
    expect(calls[0]?.url).toBe('https://omni.test/api/runners/next?runner=r+1');
  });

  it('reads a job with no allowed skills, or with none listed, as allowing none', async () => {
    expect(await api(job({ id: 'j1', line: '/omni:yolo 7', repo: 'acme/widgets', sentBy: null })).client.next('r1'))
      .toEqual({ id: 'j1', line: '/omni:yolo 7', repo: 'acme/widgets', sentBy: null, allowedSkills: [], github: null, sentByKey: null });
    expect(await api(job({ id: 'j1', line: '/omni:yolo 7', repo: 'acme/widgets', allowedSkills: null })).client.next('r1'))
      .toMatchObject({ allowedSkills: [] });
  });

  it('answers none when the hold ended with no job', async () => {
    expect(await api(status(204)).client.next('r1')).toBeNull();
  });
});

// A key's GitHub App (PRD 2433, s2): the claim carries the app's token and its bot, and the key's name. An
// older app sends neither, and the job reads as a person's: no app, no key.
describe("runnerApi().next(): a key's job and its GitHub App (PRD 2433)", () => {
  const job = (value: unknown) => () => Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  const BASE = { id: 7, line: '/omni:bug-fix https://github.com/acme/widgets/issues/9', repo: 'acme/widgets', sentBy: null, allowedSkills: [] };
  const GITHUB = { token: 'ghs_fake-installation-token', expiresAt: '2026-10-22T17:33:17Z', login: 'acme-fixer[bot]', email: '4242+acme-fixer[bot]@users.noreply.github.com' };

  it("reads the app's token, its expiry, its bot login and its email, and the key's name", async () => {
    const claimed = await api(job({ ...BASE, github: GITHUB, sentByKey: 'deploy bot' })).client.next('r1');
    expect(claimed).toEqual({ ...BASE, id: '7', github: GITHUB, sentByKey: 'deploy bot' });
  });

  it('reads a payload without github and sentByKey, or with both null, as a job with neither', async () => {
    expect(await api(job(BASE)).client.next('r1')).toMatchObject({ github: null, sentByKey: null });
    expect(await api(job({ ...BASE, github: null, sentByKey: null })).client.next('r1')).toMatchObject({ github: null, sentByKey: null });
  });

  it('reads a key with no app: its name, and no github', async () => {
    expect(await api(job({ ...BASE, github: null, sentByKey: 'deploy bot' })).client.next('r1')).toMatchObject({ github: null, sentByKey: 'deploy bot' });
  });

  it('never reads a github that does not hold all four fields as none: the job is not handed over, so no machine account runs it', async () => {
    for (const github of [{ ...GITHUB, token: '' }, { ...GITHUB, token: undefined }, { ...GITHUB, login: undefined }, { ...GITHUB, email: '' }, { ...GITHUB, expiresAt: 'later' }, { ...GITHUB, expiresAt: undefined }, 'ghs_fake', []]) {
      expect(await api(job({ ...BASE, github, sentByKey: 'deploy bot' })).client.next('r1'), JSON.stringify(github)).toBeNull();
    }
  });
});

describe('runnerApi().register()', () => {
  it("sends what the runner says about itself, whether it can run a job as a key's GitHub App too (PRD 2433)", async () => {
    const { client, calls } = api(() => Promise.resolve(new Response(JSON.stringify({ id: 'r1' }), { status: 200 })));
    expect(await client.register({ name: 'box-1', slots: 2, repos: ['acme/widgets'], version: '0.0.527', githubApp: true })).toEqual({ id: 'r1' });
    expect(calls[0]?.url).toBe('https://omni.test/api/runners/register');
    const body = calls[0]?.init.body;
    expect(typeof body === 'string' ? JSON.parse(body) : null).toEqual({ name: 'box-1', slots: 2, repos: ['acme/widgets'], version: '0.0.527', githubApp: true });
  });
});

describe('runnerApi() terminal reads (PRD 2251)', () => {
  const body = (value: unknown) => () => Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  const RUNNER = { id: 'r1', name: 'box-1', fleet: null, state: 'online', used: 1, slots: 4, repos: ['acme/widgets'] };

  it("reads the workspace's runners by repository, with the sign-in", async () => {
    const { client, calls } = api(body({ runners: [RUNNER] }));
    expect(await client.runners('acme/widgets')).toEqual([RUNNER]);
    expect(calls[0]?.url).toBe('https://omni.test/api/runners?repo=acme%2Fwidgets');
    expect(calls[0]?.init).toMatchObject({ method: 'GET', headers: { authorization: 'Bearer access-1' } });
  });

  it("reads a PRD's jobs and a job's lines after a number, an outcome missing reading as none", async () => {
    const job = { id: 'j1', line: '/omni:yolo 7', status: 'done', runner: 'box-1', prUrl: null, exitCode: 0, reason: null, queuedAt: 't' };
    const jobs = api(body({ jobs: [job] }));
    expect(await jobs.client.prdJobs('acme/widgets', parsePrd(7))).toEqual([{ ...job, outcome: null }]);
    expect(jobs.calls[0]?.url).toBe('https://omni.test/api/runners/jobs?repo=acme%2Fwidgets&prd=7');
    const lines = api(body({ status: 'running', lines: [{ seq: 4, text: 'x' }], more: false, first: 1, logTail: null }));
    expect(await lines.client.lines('j 1', 3)).toMatchObject({ status: 'running', lines: [{ seq: 4, text: 'x' }], more: false });
    expect(lines.calls[0]?.url).toBe('https://omni.test/api/runners/jobs/j%201/lines?after=3');
  });

  it("reads a stopped job's outcome (PRD 2375)", async () => {
    const job = { id: 'j1', line: '/omni:yolo 7', status: 'done', runner: 'box-1', prUrl: null, exitCode: 0, reason: null, outcome: 'stopped', queuedAt: 't' };
    expect(await api(body({ jobs: [job] })).client.prdJobs('acme/widgets', parsePrd(7))).toEqual([job]);
  });

  it('names a repository outside the workspace, an answer it cannot read and an unreachable app', async () => {
    await expect(api(status(403)).client.runners('a/b')).rejects.toThrow(new RunnerRefused('refused (403: this repository is not in your workspace)'));
    await expect(api(body({ nope: 1 })).client.prdJobs('a/b', parsePrd(1))).rejects.toThrow(RunnerRefused);
    await expect(api(status(503)).client.lines('j', 0)).rejects.toThrow(RunnerUnreachable);
  });

  it("sends a line to the jobs route and answers the job's id, or the app's refusal in its words", async () => {
    const sent = api(body({ job: { id: 'j9' } }));
    expect(await sent.client.send({ line: '/omni:yolo 7', repo: 'a/b', target: { kind: 'any' } })).toEqual({ id: 'j9' });
    expect(sent.calls[0]?.url).toBe('https://omni.test/api/runners/jobs');
    expect(sent.calls[0]?.init).toMatchObject({ method: 'POST' });
    const refused = api(() => Promise.resolve(new Response(JSON.stringify({ error: 'No runner takes that.' }), { status: 400 })));
    await expect(refused.client.send({ line: '/omni:yolo 7', repo: 'a/b', target: { kind: 'any' } })).rejects.toThrow(new RunnerRefused('No runner takes that.'));
  });
});

const ASKED: JobQuestions = {
  issue: parseIssue(314),
  lead: 'The planning query fails for 31 tenants and the fix is a choice.',
  questions: [
    {
      question: 'How should the planning query treat an assignment the user may not see?',
      header: 'Planning',
      options: [
        { label: 'Filter it out', description: 'The query skips the assignments the user may not see.' },
        { label: 'Design it first', description: 'Stop here and brainstorm the behaviour' },
      ],
      multiSelect: false,
    },
  ],
};

/** A fake app for a job's questions: the sign-in is held, so `answer` sees only the call. */
function questionsApi(answer: (init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const held: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const client = jobQuestionsApi({
    askUrl: 'https://omni.test/',
    tokens: { read: (host) => held[host] ?? null, write: (host, tokens) => { held[host] = tokens; } },
    fetch: (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return answer(init);
    },
  });
  return { client, calls };
}

const reply = (code: number, body?: unknown) => () => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status: code }));

describe('jobQuestionsApi().ask()', () => {
  it("posts the issue, the lead and the questions to the job's questions route with the sign-in", async () => {
    const { client, calls } = questionsApi(reply(200, { ok: true }));
    await client.ask('job 7', ASKED);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://omni.test/api/runners/jobs/job%207/questions');
    expect(calls[0]?.init).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer access-1', 'content-type': 'application/json' } });
    const body = calls[0]?.init.body;
    expect(typeof body === 'string' ? JSON.parse(body) : null).toEqual(ASKED);
  });

  it("carries the app's own words when it refuses, and `refused (<status>)` when it has none", async () => {
    for (const [code, words] of [[400, 'A question needs a header.'], [403, 'This job runs on another runner.'], [404, 'No such job.'], [409, 'This job already asked.']] as const) {
      await expect(questionsApi(reply(code, { error: words })).client.ask('job-7', ASKED)).rejects.toThrow(new RunnerRefused(words));
    }
    await expect(questionsApi(reply(404)).client.ask('job-7', ASKED)).rejects.toThrow(new RunnerRefused('refused (404)'));
    await expect(questionsApi(reply(409, { error: '' })).client.ask('job-7', ASKED)).rejects.toThrow(new RunnerRefused('refused (409)'));
  });

  it('names a server error and a timeout as the app unreachable', async () => {
    await expect(questionsApi(reply(503, { error: 'down' })).client.ask('job-7', ASKED)).rejects.toThrow(RunnerUnreachable);
    const timedOut = questionsApi(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
    await expect(timedOut.client.ask('job-7', ASKED)).rejects.toThrow(new RunnerUnreachable('POST /api/runners/jobs/job-7/questions: timed out'));
  });
});

describe('jobQuestionsApi().answers()', () => {
  it("reads the job's questions route as the app answers it, with the sign-in", async () => {
    // The app's row (apps/galaxy/src/runners/runners.contract.ts, JobQuestionsSchema): each question's text to its answer.
    const answers = { 'How should the planning query treat an assignment the user may not see?': 'Filter it out' };
    const row = { job: 'job-7', issue: 314, lead: ASKED.lead, questions: ASKED.questions, state: 'answered', answers, byLogin: 'ada' };
    const { client, calls } = questionsApi(reply(200, row));
    await expect(client.answers('job 7')).resolves.toEqual(row);
    expect(calls[0]?.url).toBe('https://omni.test/api/runners/jobs/job%207/questions');
    expect(calls[0]?.init).toMatchObject({ method: 'GET', headers: { authorization: 'Bearer access-1' } });
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it('refuses a reply that holds no questions, and carries the not-found words', async () => {
    await expect(questionsApi(reply(200, {})).client.answers('job-7')).rejects.toThrow(new RunnerRefused('refused (the app answered no questions)'));
    await expect(questionsApi(reply(200, [])).client.answers('job-7')).rejects.toThrow(new RunnerRefused('refused (the app answered no questions)'));
    await expect(questionsApi(reply(404, { error: 'No questions on this job.' })).client.answers('job-7')).rejects.toThrow(new RunnerRefused('No questions on this job.'));
  });
});
