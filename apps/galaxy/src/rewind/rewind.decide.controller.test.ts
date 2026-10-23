import { describe, expect, it, vi } from 'vitest';
import { approveFinding, rejectFinding, type DecisionDeps } from './rewind.controller';
import type { DecisionReply } from './rewind.contract';
import type { DecisionService } from './rewind.service';

// A member's decision at its HTTP edge (PRD 2410, s7): the page's session only, a bearer token refused before
// anything is read; a malformed body is 400; the service's refusals keep their status, a second decision 409;
// a failure is logged and answered 500 without its words.

const ID = '6f1c1b1e-8a0e-4c1f-9d55-2c1f7b0e9a11';
const APPROVED: DecisionReply = { state: 'approved', followUp: { done: true, words: 'Queued /omni:bug-fix on a runner of the workspace, sent by you.', link: '/app/runners' } };

type Decide = DecisionService['decide'];

function deps(decide: Decide = () => Promise.resolve({ ok: true, value: APPROVED }), { signedIn = true }: { signedIn?: boolean } = {}) {
  const spy = vi.fn(decide);
  const session = vi.fn(() => Promise.resolve(signedIn ? { decide: spy } : null));
  const log = vi.fn();
  const live: DecisionDeps = { session, log };
  return { deps: live, decide: spy, session, log };
}

const post = (verdict: 'approve' | 'reject', body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://omni.test/api/rewind/findings/${ID}/${verdict}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });

describe('POST /api/rewind/findings/<id>/approve', () => {
  it('approves as the page\'s member and answers what Approve sent, with an empty body or none', async () => {
    const run = deps();
    const response = await approveFinding(post('approve'), ID, run.deps);
    expect([response.status, await response.json()]).toEqual([200, APPROVED]);
    expect((await approveFinding(post('approve', {}), ID, run.deps)).status).toBe(200);
    expect(run.decide.mock.calls).toEqual([[ID, 'approve', null], [ID, 'approve', null]]);
  });

  it('takes no reason', async () => {
    const run = deps();
    expect((await approveFinding(post('approve', { reason: 'Yes' }), ID, run.deps)).status).toBe(400);
    expect(run.decide).not.toHaveBeenCalled();
  });

  it('refuses a bearer token with 403, whatever session the browser holds, and reads nothing', async () => {
    const run = deps();
    const response = await approveFinding(post('approve', undefined, { authorization: 'Bearer t' }), ID, run.deps);
    expect(response.status).toBe(403);
    expect(run.session).not.toHaveBeenCalled();
  });

  it('answers 401 signed out, and 503 with no database', async () => {
    const out = deps(undefined, { signedIn: false });
    expect((await approveFinding(post('approve'), ID, out.deps)).status).toBe(401);
    expect(out.decide).not.toHaveBeenCalled();
    expect((await approveFinding(post('approve'), ID, { session: null, log: vi.fn() })).status).toBe(503);
  });

  it('answers 404 to an id that names no finding, and decides nothing', async () => {
    const run = deps();
    expect((await approveFinding(post('approve'), 'f1', run.deps)).status).toBe(404);
    expect(run.session).not.toHaveBeenCalled();
  });

  it('keeps the service\'s refusals: 404 no such finding, 409 already decided, 422 a finding that would leak, 403 not a member', async () => {
    for (const [kind, status] of [['missing', 404], ['decided', 409], ['unshareable', 422], ['not-allowed', 403]] as const) {
      const run = deps(() => Promise.resolve({ ok: false, kind, error: `Refused: ${kind}.` }));
      const response = await approveFinding(post('approve'), ID, run.deps);
      expect([response.status, await response.json()]).toEqual([status, { error: `Refused: ${kind}.` }]);
    }
  });

  it('logs a failure and answers 500 without its words', async () => {
    const run = deps(() => Promise.reject(new Error('db down')));
    const response = await approveFinding(post('approve'), ID, run.deps);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('db down');
    expect(run.log).toHaveBeenCalledWith('rewind decide: db down');
  });
});

describe('POST /api/rewind/findings/<id>/reject', () => {
  it('rejects with the reason, trimmed, and with none when it is empty or left out', async () => {
    const run = deps(() => Promise.resolve({ ok: true, value: { state: 'rejected', followUp: null } }));
    const response = await rejectFinding(post('reject', { reason: '  Not our lint ' }), ID, run.deps);
    expect([response.status, await response.json()]).toEqual([200, { state: 'rejected', followUp: null }]);
    await rejectFinding(post('reject', { reason: '  ' }), ID, run.deps);
    await rejectFinding(post('reject', {}), ID, run.deps);
    await rejectFinding(post('reject'), ID, run.deps);
    expect(run.decide.mock.calls).toEqual([[ID, 'reject', 'Not our lint'], [ID, 'reject', null], [ID, 'reject', null], [ID, 'reject', null]]);
  });

  it.each([
    ['no JSON', 'nope'],
    ['a reason of two lines', { reason: 'one\ntwo' }],
    ['a reason too long', { reason: 'x'.repeat(501) }],
    ['a reason that is no text', { reason: 7 }],
    ['a field it does not take', { reason: 'no', line: '/omni:yolo 1' }],
    ['a body too large', { reason: 'x'.repeat(5000) }],
  ])('answers 400 to %s, and decides nothing', async (_what, body) => {
    const run = deps();
    expect((await rejectFinding(post('reject', body), ID, run.deps)).status).toBe(400);
    expect(run.decide).not.toHaveBeenCalled();
  });

  it('refuses a bearer token with 403', async () => {
    const run = deps();
    expect((await rejectFinding(post('reject', {}, { authorization: 'Bearer t' }), ID, run.deps)).status).toBe(403);
    expect(run.decide).not.toHaveBeenCalled();
  });
});
