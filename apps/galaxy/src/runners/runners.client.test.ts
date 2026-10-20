import { describe, expect, it } from 'vitest';
import { parseIssue } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { answerRunnerJob, cancelRunnerJob, dismissRunnerJob, readJobLines, readJobQuestions, sendToRunner, setRunnerFleet } from './runners.client';
import type { Job, JobLines, JobQuestions, Runner } from './runners.contract';

// The browser's calls to the runners' routes (PRD 1830 s1): what each sends, and how an answer, a
// refusal and an unreachable app come back.

const JOB: Job = {
  id: '00000000-0000-4000-8000-000001830201', line: '/omni:yolo 1717', repo: 'vertuoza/app', toRunner: null, toFleet: 'cia',
  sentBy: '00000000-0000-4000-8000-0000018300b1', sentByLogin: 'mo', sentByKey: null, status: 'queued', runner: null, cancelRequested: false,
  logTail: '', prUrl: null, exitCode: null, reason: null, queuedAt: '2026-10-13T12:00:00.000Z', claimedAt: null, runningAt: null, endedAt: null,
};

const RUNNER: Runner = {
  id: '00000000-0000-4000-8000-0000018301a1', name: 'shared', owner: '00000000-0000-4000-8000-0000018300a1', fleet: 'cia', slots: 4, used: 0,
  repos: ['vertuoza/app'], version: '0.0.387', lastSeenAt: '2026-10-13T12:00:00.000Z', state: 'online',
};

function fetcher(status: number, body: unknown) {
  const calls: { url: string; method: string | undefined; body: unknown }[] = [];
  const fake = (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method, body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : null });
    return Promise.resolve(Response.json(body, { status }));
  };
  return { fake: fake as unknown as typeof fetch, calls };
}

describe('the runners\' client', () => {
  it('queues a job and reads it back', async () => {
    const { fake, calls } = fetcher(200, { job: JOB });
    expect(await sendToRunner('/omni:yolo 1717', 'vertuoza/app', { kind: 'fleet', fleet: 'cia' }, fake)).toEqual({ ok: true, value: JOB });
    expect(calls).toEqual([{ url: '/api/runners/jobs', method: 'POST', body: { line: '/omni:yolo 1717', repo: 'vertuoza/app', target: { kind: 'fleet', fleet: 'cia' } } }]);
  });

  it('cancels a job and sets a fleet', async () => {
    const cancelled = fetcher(200, { job: { ...JOB, status: 'cancelled' } });
    expect((await cancelRunnerJob(JOB.id, cancelled.fake)).ok).toBe(true);
    expect(cancelled.calls[0]).toMatchObject({ url: `/api/runners/jobs/${JOB.id}/cancel`, method: 'POST' });
    const set = fetcher(200, { runner: RUNNER });
    expect(await setRunnerFleet(RUNNER.id, 'cia', set.fake)).toEqual({ ok: true, value: RUNNER });
    expect(set.calls[0]).toEqual({ url: `/api/runners/${RUNNER.id}`, method: 'PATCH', body: { fleet: 'cia' } });
  });

  it('gives the route\'s words for a refusal', async () => {
    const { fake } = fetcher(403, { error: 'cia-box serves cia: only its players and the workspace\'s owners send to it.' });
    expect(await sendToRunner('/omni:yolo 1', 'vertuoza/app', { kind: 'any' }, fake))
      .toEqual({ ok: false, error: 'cia-box serves cia: only its players and the workspace\'s owners send to it.' });
  });

  it('says so when the app cannot be reached', async () => {
    const down = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    expect(await cancelRunnerJob(JOB.id, down)).toEqual({ ok: false, error: 'The Omni app could not be reached. Try again.' });
  });

  it('reads a job\'s live lines after a sequence number (PRD 1904)', async () => {
    const lines: JobLines = { status: 'running', lines: [{ seq: 1201, text: '12:04:31 Bash: pnpm test' }], more: false, first: 1, logTail: null };
    const { fake, calls } = fetcher(200, lines);
    expect(await readJobLines(JOB.id, 1200, fake)).toEqual({ ok: true, value: lines });
    expect(calls).toEqual([{ url: `/api/runners/jobs/${JOB.id}/lines?after=1200`, method: 'GET', body: null }]);
    const missing = fetcher(404, { error: 'No such job.' });
    expect(await readJobLines(JOB.id, 0, missing.fake)).toEqual({ ok: false, error: 'No such job.' });
  });

  // A job's questions (PRD 2255): read, answered with the job that resumes the run, dismissed.
  describe('a job\'s questions (PRD 2255)', () => {
    const QUESTIONS: JobQuestions = {
      job: JOB.id, issue: parseIssue(314), lead: 'The planning query fails for 31 tenants.', state: 'open', answers: null, by: null, byLogin: null, at: null, resume: null,
      questions: [{
        question: 'Which fix?', header: 'Fix', multiSelect: false,
        options: [{ label: 'Guard the input', description: 'Check the tenant first' }, { label: 'Design it first', description: 'Stop and brainstorm' }],
      }],
    };

    it('reads them', async () => {
      const { fake, calls } = fetcher(200, QUESTIONS);
      expect(await readJobQuestions(JOB.id, fake)).toEqual({ ok: true, value: QUESTIONS });
      expect(calls).toEqual([{ url: `/api/runners/jobs/${JOB.id}/questions`, method: 'GET', body: null }]);
      expect(await readJobQuestions(JOB.id, fetcher(404, { error: 'No such job.' }).fake)).toEqual({ ok: false, error: 'No such job.' });
    });

    it('sends the answers and reads back the job that resumes the run', async () => {
      const resume = { ...JOB, line: `/omni:bug-fix #314 --answers ${JOB.id}` };
      const { fake, calls } = fetcher(200, { job: resume });
      expect(await answerRunnerJob(JOB.id, { 'Which fix?': 'Guard the input' }, fake)).toEqual({ ok: true, value: resume });
      expect(calls).toEqual([{ url: `/api/runners/jobs/${JOB.id}/answers`, method: 'POST', body: { answers: { 'Which fix?': 'Guard the input' } } }]);
    });

    it('gives the route\'s words when someone answered first', async () => {
      const first = fetcher(409, { error: 'Already answered by @mo' });
      expect(await answerRunnerJob(JOB.id, { 'Which fix?': 'Design it first' }, first.fake)).toEqual({ ok: false, error: 'Already answered by @mo' });
    });

    it('dismisses them and reads them back closed', async () => {
      const closed = { ...QUESTIONS, state: 'dismissed' as const, by: JOB.sentBy, byLogin: 'mo', at: '2026-10-13T12:05:00.000Z' };
      const { fake, calls } = fetcher(200, closed);
      expect(await dismissRunnerJob(JOB.id, fake)).toEqual({ ok: true, value: closed });
      expect(calls).toEqual([{ url: `/api/runners/jobs/${JOB.id}/dismiss`, method: 'POST', body: null }]);
    });
  });
});
