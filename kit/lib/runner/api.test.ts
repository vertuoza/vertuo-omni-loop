// The runner's health call (PRD 2102, s1): `runnerApi().health()` on a fake fetch. It posts the report
// to the runner's own route with the sign-in, and names each failure the runner then prints. Then a
// job's questions (PRD 2255, s2): `jobQuestionsApi()` posts them, reads them back with their answers, and
// carries the app's own words when it refuses.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../ask/schema.ts';
import { parseIssue } from '../ids.ts';
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
