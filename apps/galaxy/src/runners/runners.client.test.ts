import { describe, expect, it } from 'vitest';
import { cancelRunnerJob, sendToRunner, setRunnerFleet } from './runners.client';
import type { Job, Runner } from './runners.contract';

// The browser's calls to the runners' routes (PRD 1830 s1): what each sends, and how an answer, a
// refusal and an unreachable app come back.

const JOB: Job = {
  id: '00000000-0000-4000-8000-000001830201', line: '/omni:yolo 1717', repo: 'vertuoza/app', toRunner: null, toFleet: 'cia',
  sentBy: '00000000-0000-4000-8000-0000018300b1', sentByLogin: 'mo', status: 'queued', runner: null, cancelRequested: false,
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
});
