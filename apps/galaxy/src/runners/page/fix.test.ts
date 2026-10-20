import { describe, expect, it, vi } from 'vitest';
import type { OutboxStand } from '../../dossier/page/stage';
import type { Job } from '../runners.contract';
import { fixWithAnswers, type FixDeps } from './fix';
import { postFixWithAnswers as fixFromBrowser } from './fix.client';

// Fix with answers (PRD 2270 s2): the route's rules on fakes (the session, the job, the stored stand, the
// continuation's rules), and the browser's call.

const JOB = '11111111-aaaa-4000-8000-000000000001';
const ANSWERED: OutboxStand = { asked: 1, answered: 1, answers: [] };
const FIX = { id: '22222222-bbbb-4000-8000-000000000002', line: '/omni:yolo-fix 2270', continues: JOB } as Job;

function deps(over: Partial<FixDeps> = {}): FixDeps {
  return {
    caller: () => Promise.resolve('u1'),
    job: () => Promise.resolve({ workspaceId: 'w1', repo: 'acme/widgets', line: '/omni:yolo 2270' }),
    stand: () => Promise.resolve(ANSWERED),
    continueAnswered: () => Promise.resolve({ queued: FIX, why: null }),
    log: () => undefined,
    ...over,
  };
}

const body = async (response: Response) => (await response.json()) as unknown;

describe('POST /api/runners/jobs/<id>/fix', () => {
  it('queues the fix in the name of the person pressing, from the stand read for the job\'s PRD, and answers the job', async () => {
    const continueAnswered = vi.fn(() => Promise.resolve({ queued: FIX, why: null }));
    const stand = vi.fn(() => Promise.resolve(ANSWERED));
    const response = await fixWithAnswers(JOB, deps({ continueAnswered, stand }));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ job: FIX });
    expect(stand).toHaveBeenCalledWith('w1', 'acme/widgets', 2270);
    expect(continueAnswered).toHaveBeenCalledWith({ workspaceId: 'w1', repo: 'acme/widgets', prd: 2270, stand: ANSWERED, by: 'u1' });
  });

  it('is 401 signed out and queues nothing', async () => {
    const continueAnswered = vi.fn();
    const response = await fixWithAnswers(JOB, deps({ caller: () => Promise.resolve(null), continueAnswered }));
    expect(response.status).toBe(401);
    expect(continueAnswered).not.toHaveBeenCalled();
  });

  it('is 404 for an id that is none, a job that is not found, or a line that names no PRD', async () => {
    expect((await fixWithAnswers('nope', deps())).status).toBe(404);
    expect((await fixWithAnswers(JOB, deps({ job: () => Promise.resolve(null) }))).status).toBe(404);
    expect((await fixWithAnswers(JOB, deps({ job: () => Promise.resolve({ workspaceId: 'w1', repo: 'acme/widgets', line: '/omni:bug-fix Issue 548 totals' }) }))).status).toBe(404);
  });

  it('is 409 with the rules\' words when they queue nothing: an asked item waits, or it was continued already', async () => {
    const response = await fixWithAnswers(JOB, deps({ continueAnswered: () => Promise.resolve({ queued: null, why: 'job x was continued already' }) }));
    expect(response.status).toBe(409);
    expect(await body(response)).toEqual({ error: 'Nothing was queued: job x was continued already.' });
  });

  it('is 500, logged, when a read fails', async () => {
    const log = vi.fn();
    const response = await fixWithAnswers(JOB, deps({ stand: () => Promise.reject(new Error('down')), log }));
    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith('runners: down');
  });
});

describe('the browser\'s Fix with answers', () => {
  const answer = (status: number, json: unknown) => vi.fn(() => Promise.resolve(Response.json(json, { status })));

  it('posts to the job\'s fix route with the page\'s session and reads the job back', async () => {
    const fetcher = answer(200, { job: { ...FIX, id: FIX.id, line: FIX.line, repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: JOB, sentByLogin: 'ada', sentByKey: null, status: 'queued', runner: null, cancelRequested: false, logTail: '', prUrl: null, exitCode: null, reason: null, queuedAt: 'x', claimedAt: null, runningAt: null, endedAt: null } });
    const called = await fixFromBrowser(JOB, fetcher);
    expect(called).toMatchObject({ ok: true, value: { id: FIX.id, continues: JOB } });
    expect(fetcher).toHaveBeenCalledWith(`/api/runners/jobs/${JOB}/fix`, { method: 'POST', credentials: 'same-origin' });
  });

  it('shows the route\'s words for a refusal, and says the app could not be reached otherwise', async () => {
    expect(await fixFromBrowser(JOB, answer(409, { error: 'Nothing was queued: x.' }) as unknown as typeof fetch)).toEqual({ ok: false, error: 'Nothing was queued: x.' });
    expect(await fixFromBrowser(JOB, answer(500, null) as unknown as typeof fetch)).toEqual({ ok: false, error: 'The Omni app could not be reached. Try again.' });
    expect(await fixFromBrowser(JOB, answer(200, { job: 1 }) as unknown as typeof fetch)).toEqual({ ok: false, error: 'The Omni app could not be reached. Try again.' });
    expect(await fixFromBrowser(JOB, () => Promise.reject(new Error('offline')))).toEqual({ ok: false, error: 'The Omni app could not be reached. Try again.' });
  });
});
