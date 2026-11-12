import { describe, expect, it } from 'vitest';
import { jobLedger, REFRESH_DELAY_SECONDS } from './ledger.ts';

type Call = { method: string; path: string; search: string; body: unknown; key: string | null };
type Refusal = { status: number; message: string; code: string };

/** A fetch answering every call with `answer` (status 200), or with the database's refusal. */
function dbFetch(answer: unknown) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    calls.push({ method: request.method, path: url.pathname, search: decodeURIComponent(url.search), body: text ? JSON.parse(text) : null, key: request.headers.get('apikey') });
    const refusal = isRefusal(answer) ? answer : null;
    return refusal
      ? new Response(JSON.stringify({ message: refusal.message, code: refusal.code }), { status: refusal.status, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

function isRefusal(value: unknown): value is Refusal {
  return typeof value === 'object' && value !== null && 'code' in value && 'status' in value;
}

const ledger = (fetch: typeof globalThis.fetch) => jobLedger({ url: 'https://db.example', key: 'service-key', fetch });

const ID = '00000000-0000-4000-8000-000000002676';
const CLAIM = '00000000-0000-4000-8000-0000000026c1';
const KEY = `initech/pack-api@${'a'.repeat(40)}`;
/** A row as background_job_claim() answers it. */
const ROW = {
  id: ID,
  kind: 'knowledge-pack',
  key: KEY,
  subject: 'initech/pack-api',
  payload: { installationId: 7, repository: 'initech/pack-api' },
  state: 'running',
  tries: 2,
  run_after: '2027-01-13T09:00:00+00:00',
  claim: CLAIM,
  claimed_at: '2027-01-13T09:00:00+00:00',
  claimed_until: '2027-01-13T09:05:00+00:00',
  reason: null,
  created_at: '2027-01-13T08:59:00+00:00',
  finished_at: null,
  again: false,
  progress: { look: 2 },
  laters: 2,
  lane: 'initech/pack-api',
  max_tries: 4,
};

describe('jobLedger — the ledger as the service role (PRD 2676 s1)', () => {
  it('add: calls background_job_add with the kind, key, subject and payload; answers whether it added one', async () => {
    const db = dbFetch(true);
    expect(await ledger(db.fetch).add({ kind: 'knowledge-pack', key: KEY, subject: 'Initech/Pack-API', payload: { installationId: 7 } })).toBe(true);
    expect(db.calls).toEqual([{
      method: 'POST',
      path: '/rest/v1/rpc/background_job_add',
      search: '',
      body: { p_kind: 'knowledge-pack', p_key: KEY, p_subject: 'Initech/Pack-API', p_payload: { installationId: 7 } },
      key: 'service-key',
    }]);
    expect(await ledger(dbFetch(false).fetch).add({ kind: 'knowledge-pack', key: KEY, subject: 'initech/pack-api', payload: {} })).toBe(false);
  });

  it('refresh: calls background_job_refresh with the kind, key, subject, payload and delay; answers what it did (PRD 2688 s1)', async () => {
    const pr = { kind: 'pr-outbox', key: 'initech/pr-api#12', subject: 'Initech/PR-API', payload: { installationId: 7, sha: 'b'.repeat(40) } };
    const db = dbFetch('again');
    expect(await ledger(db.fetch).refresh({ ...pr, delaySeconds: REFRESH_DELAY_SECONDS })).toBe('again');
    expect(REFRESH_DELAY_SECONDS).toBe(5);
    expect(db.calls).toEqual([{
      method: 'POST',
      path: '/rest/v1/rpc/background_job_refresh',
      search: '',
      body: { p_kind: 'pr-outbox', p_key: 'initech/pr-api#12', p_subject: 'Initech/PR-API', p_payload: pr.payload, p_delay_seconds: 5 },
      key: 'service-key',
    }]);
    for (const answer of ['added', 'updated', 'requeued'] as const) {
      expect(await ledger(dbFetch(answer).fetch).refresh({ ...pr, delaySeconds: 0 })).toBe(answer);
    }
    await expect(ledger(dbFetch('queued').fetch).refresh({ ...pr, delaySeconds: 5 })).rejects.toThrow();
    await expect(ledger(dbFetch({ status: 400, code: '22023', message: 'Delay: between 0 and 3600 seconds.' }).fetch).refresh({ ...pr, delaySeconds: -1 }))
      .rejects.toThrow('the database refused: Delay: between 0 and 3600 seconds. (22023)');
  });

  it('claim: calls background_job_claim with the limit and lease; answers each job as claimed', async () => {
    const db = dbFetch([ROW]);
    expect(await ledger(db.fetch).claim({ limit: 1, leaseSeconds: 300 })).toEqual([{
      id: ID,
      kind: 'knowledge-pack',
      key: KEY,
      subject: 'initech/pack-api',
      payload: { installationId: 7, repository: 'initech/pack-api' },
      tries: 2,
      claim: CLAIM,
      claimedUntil: '2027-01-13T09:05:00+00:00',
      progress: { look: 2 },
      lane: 'initech/pack-api',
      maxTries: 4,
    }]);
    expect(db.calls).toEqual([expect.objectContaining({ method: 'POST', path: '/rest/v1/rpc/background_job_claim', body: { p_limit: 1, p_lease_seconds: 300 } })]);
    expect(await ledger(dbFetch([]).fetch).claim({ limit: 1, leaseSeconds: 300 })).toEqual([]);
  });

  it('claim: a row from before the later migration reads as no progress, no lane and 5 tries (PRD omni-loop-3 s1)', async () => {
    const old: Record<string, unknown> = { ...ROW };
    for (const column of ['progress', 'laters', 'lane', 'max_tries']) Reflect.deleteProperty(old, column);
    const [job] = await ledger(dbFetch([old]).fetch).claim({ limit: 1, leaseSeconds: 300 });
    expect(job).toMatchObject({ progress: {}, lane: null, maxTries: 5 });
  });

  it('add and refresh: send a lane and tries only when given (PRD omni-loop-3 s1)', async () => {
    const add = dbFetch(true);
    await ledger(add.fetch).add({ kind: 'pr-stats', key: 'pr-stats@2027-01-15T09:00:00.000Z', subject: 'pr-stats', payload: {}, lane: 'pr-stats', maxTries: 3 });
    expect(add.calls[0]?.body).toEqual({ p_kind: 'pr-stats', p_key: 'pr-stats@2027-01-15T09:00:00.000Z', p_subject: 'pr-stats', p_payload: {}, p_lane: 'pr-stats', p_max_tries: 3 });
    const refresh = dbFetch('added');
    await ledger(refresh.fetch).refresh({ kind: 'canon-action', key: 'delivery-1', subject: 'initech/web', payload: {}, delaySeconds: 0, lane: 'initech/web#9' });
    expect(refresh.calls[0]?.body).toEqual({ p_kind: 'canon-action', p_key: 'delivery-1', p_subject: 'initech/web', p_payload: {}, p_delay_seconds: 0, p_lane: 'initech/web#9' });
  });

  it('finish: a later sends its date and its progress; answers queued (PRD omni-loop-3 s1)', async () => {
    const db = dbFetch('queued');
    const retryAt = '2027-01-13T09:01:00.000Z';
    expect(await ledger(db.fetch).finish({ id: ID, claim: CLAIM, outcome: 'later', reason: null, retryAt, progress: { look: 3 } })).toBe('queued');
    expect(db.calls[0]?.body).toEqual({ p_id: ID, p_claim: CLAIM, p_outcome: 'later', p_retry_at: retryAt, p_progress: { look: 3 } });
  });

  it('claim: throws on a row that is not held, or out of shape', async () => {
    for (const row of [{ ...ROW, claim: null }, { ...ROW, tries: 0 }, { ...ROW, payload: [] }, { ...ROW, id: undefined }]) {
      await expect(ledger(dbFetch([row]).fetch).claim({ limit: 1, leaseSeconds: 300 })).rejects.toThrow();
    }
  });

  it('finish: calls background_job_finish with the claim, the outcome, the reason and when to retry; answers the state', async () => {
    const db = dbFetch('queued');
    const retryAt = '2027-01-13T09:01:00.000Z';
    expect(await ledger(db.fetch).finish({ id: ID, claim: CLAIM, outcome: 'retry', reason: 'GitHub answered 502', retryAt })).toBe('queued');
    expect(db.calls).toEqual([expect.objectContaining({
      method: 'POST',
      path: '/rest/v1/rpc/background_job_finish',
      body: { p_id: ID, p_claim: CLAIM, p_outcome: 'retry', p_reason: 'GitHub answered 502', p_retry_at: retryAt },
    })]);
    const done = dbFetch('done');
    expect(await ledger(done.fetch).finish({ id: ID, claim: CLAIM, outcome: 'done', reason: null, retryAt: null })).toBe('done');
    expect(done.calls[0]?.body).toEqual({ p_id: ID, p_claim: CLAIM, p_outcome: 'done' });
  });

  it('finish: a claim that is no longer the job\'s (55000) is stale, not an error', async () => {
    const db = dbFetch({ status: 400, code: '55000', message: `Claim: job ${ID} is no longer held by this claim.` });
    expect(await ledger(db.fetch).finish({ id: ID, claim: CLAIM, outcome: 'done', reason: null, retryAt: null })).toBe('stale');
  });

  it('finish: any other refusal, or a state out of shape, throws', async () => {
    const refused = dbFetch({ status: 400, code: '22023', message: 'Reason: why the job is skipped.' });
    await expect(ledger(refused.fetch).finish({ id: ID, claim: CLAIM, outcome: 'skipped', reason: '', retryAt: null }))
      .rejects.toThrow('the database refused: Reason: why the job is skipped. (22023)');
    await expect(ledger(dbFetch('running').fetch).finish({ id: ID, claim: CLAIM, outcome: 'done', reason: null, retryAt: null })).rejects.toThrow();
  });

  it('replay: calls background_job_replay; answers the job queued again', async () => {
    const db = dbFetch({ ...ROW, state: 'queued', tries: 0, claim: null, claimed_at: null, claimed_until: null });
    expect(await ledger(db.fetch).replay(ID)).toEqual({ replayed: true, id: ID, kind: 'knowledge-pack', key: KEY, state: 'queued', tries: 0 });
    expect(db.calls).toEqual([expect.objectContaining({ method: 'POST', path: '/rest/v1/rpc/background_job_replay', body: { p_id: ID } })]);
  });

  it('replay: no such job (P0002) or a job not failed (55000) is refused in words, not thrown', async () => {
    const none = dbFetch({ status: 404, code: 'P0002', message: `Job: ${ID} does not exist.` });
    expect(await ledger(none.fetch).replay(ID)).toEqual({ replayed: false, reason: `Job: ${ID} does not exist.` });
    const done = dbFetch({ status: 400, code: '55000', message: `Job: ${ID} is done, not failed.` });
    expect(await ledger(done.fetch).replay(ID)).toEqual({ replayed: false, reason: `Job: ${ID} is done, not failed.` });
    await expect(ledger(dbFetch({ status: 403, code: '42501', message: 'permission denied' }).fetch).replay(ID)).rejects.toThrow('permission denied');
  });

  it('health: reads background_jobs_health as a GET; answers its state and counts', async () => {
    const db = dbFetch({ state: 'late', late: 1, failed: 0 });
    expect(await ledger(db.fetch).health()).toEqual({ state: 'late', late: 1, failed: 0 });
    expect(db.calls).toEqual([expect.objectContaining({ method: 'GET', path: '/rest/v1/rpc/background_jobs_health' })]);
    await expect(ledger(dbFetch({ state: 'jammed', late: 0, failed: 0 }).fetch).health()).rejects.toThrow();
  });

  it('health: sends the schedules as their kinds and periods in seconds, and reads the late ones (PRD omni-loop-3 s1)', async () => {
    const db = dbFetch({ state: 'late', late: 0, failed: 0, scheduled: 1 });
    const schedules = [{ kind: 'pr-stats', periodMinutes: 15, maxTries: 3 }, { kind: 'escalation', periodMinutes: 60, maxTries: 3 }];
    expect(await ledger(db.fetch).health(schedules)).toEqual({ state: 'late', late: 0, failed: 0, scheduled: 1 });
    expect(db.calls).toEqual([expect.objectContaining({ method: 'GET', path: '/rest/v1/rpc/background_jobs_health', search: '?p_kinds={pr-stats,escalation}&p_periods={900,3600}' })]);
    const none = dbFetch({ state: 'ok', late: 0, failed: 0, scheduled: 0 });
    await ledger(none.fetch).health([]);
    expect(none.calls[0]?.search).toBe('');
  });

  it('forget: calls background_jobs_forget; answers how many jobs it deleted', async () => {
    const db = dbFetch(3);
    expect(await ledger(db.fetch).forget()).toBe(3);
    expect(db.calls).toEqual([expect.objectContaining({ method: 'POST', path: '/rest/v1/rpc/background_jobs_forget' })]);
    await expect(ledger(dbFetch(-1).fetch).forget()).rejects.toThrow();
  });

  it('every call throws the database\'s refusal with its code', async () => {
    const refused = () => dbFetch({ status: 401, code: '42501', message: 'permission denied for function' }).fetch;
    await expect(ledger(refused()).add({ kind: 'knowledge-pack', key: KEY, subject: 'initech/pack-api', payload: {} })).rejects.toThrow('the database refused: permission denied for function (42501)');
    await expect(ledger(refused()).refresh({ kind: 'pr-outbox', key: 'initech/pr-api#12', subject: 'initech/pr-api', payload: {}, delaySeconds: 5 })).rejects.toThrow('(42501)');
    await expect(ledger(refused()).claim({ limit: 1, leaseSeconds: 300 })).rejects.toThrow('(42501)');
    await expect(ledger(refused()).health()).rejects.toThrow('(42501)');
    await expect(ledger(refused()).forget()).rejects.toThrow('(42501)');
    await expect(ledger(refused()).save({ id: ID, claim: CLAIM, step: 'facts', value: {} })).rejects.toThrow('(42501)');
    await expect(ledger(refused()).stepsOf({ id: ID, claim: CLAIM })).rejects.toThrow('(42501)');
    await expect(ledger(refused()).renew({ id: ID, claim: CLAIM })).rejects.toThrow('(42501)');
    await expect(ledger(refused()).wake({ kind: 'main-watch', key: 'initech/web#7' })).rejects.toThrow('(42501)');
  });
});

describe('jobLedger — saved steps, waking and renewing (PRD omni-loop-4 s1)', () => {
  const STALE = { status: 400, code: '55000', message: `Claim: job ${ID} is no longer held by this claim.` };

  it('save: calls background_job_save with the job, its claim, the step and its value; answers saved', async () => {
    const db = dbFetch(null);
    expect(await ledger(db.fetch).save({ id: ID, claim: CLAIM, step: 'facts', value: { prs: [12, 13], merged: null } })).toBe('saved');
    expect(db.calls).toEqual([{
      method: 'POST',
      path: '/rest/v1/rpc/background_job_save',
      search: '',
      body: { p_id: ID, p_claim: CLAIM, p_step: 'facts', p_value: { prs: [12, 13], merged: null } },
      key: 'service-key',
    }]);
  });

  it('save: a claim no longer the job\'s is stale; a value over 1 MB is thrown naming the step', async () => {
    expect(await ledger(dbFetch(STALE).fetch).save({ id: ID, claim: CLAIM, step: 'facts', value: 1 })).toBe('stale');
    const big = dbFetch({ status: 400, code: '22023', message: 'Step "facts": its value is over 1 MB.' });
    await expect(ledger(big.fetch).save({ id: ID, claim: CLAIM, step: 'facts', value: 'x' })).rejects.toThrow('Step "facts": its value is over 1 MB. (22023)');
  });

  it('stepsOf: calls background_job_steps_of under the claim; answers each step\'s value by its id', async () => {
    const db = dbFetch([
      { step: 'qualify', value: { feature: true }, saved_at: '2027-01-17T09:00:00+00:00' },
      { step: 'facts', value: null, saved_at: '2027-01-17T09:00:01+00:00' },
    ]);
    const steps = await ledger(db.fetch).stepsOf({ id: ID, claim: CLAIM });
    expect(steps).toEqual(new Map<string, unknown>([['qualify', { feature: true }], ['facts', null]]));
    expect(db.calls).toEqual([expect.objectContaining({ method: 'POST', path: '/rest/v1/rpc/background_job_steps_of', body: { p_id: ID, p_claim: CLAIM } })]);
    expect(await ledger(dbFetch([]).fetch).stepsOf({ id: ID, claim: CLAIM })).toEqual(new Map());
  });

  it('stepsOf: a claim no longer the job\'s is stale; a row out of shape throws', async () => {
    expect(await ledger(dbFetch(STALE).fetch).stepsOf({ id: ID, claim: CLAIM })).toBe('stale');
    await expect(ledger(dbFetch([{ step: '', value: 1, saved_at: 'x' }]).fetch).stepsOf({ id: ID, claim: CLAIM })).rejects.toThrow();
    await expect(ledger(dbFetch({ facts: 1 }).fetch).stepsOf({ id: ID, claim: CLAIM })).rejects.toThrow();
  });

  it('renew: calls background_job_renew with the claim, and the lease only when given; answers when the claim runs out', async () => {
    const until = '2027-01-17T09:05:00+00:00';
    const db = dbFetch(until);
    expect(await ledger(db.fetch).renew({ id: ID, claim: CLAIM })).toEqual({ until });
    expect(db.calls[0]).toMatchObject({ path: '/rest/v1/rpc/background_job_renew', body: { p_id: ID, p_claim: CLAIM } });
    const leased = dbFetch(until);
    await ledger(leased.fetch).renew({ id: ID, claim: CLAIM, leaseSeconds: 600 });
    expect(leased.calls[0]?.body).toEqual({ p_id: ID, p_claim: CLAIM, p_lease_seconds: 600 });
    expect(await ledger(dbFetch(STALE).fetch).renew({ id: ID, claim: CLAIM })).toBe('stale');
    await expect(ledger(dbFetch(7).fetch).renew({ id: ID, claim: CLAIM })).rejects.toThrow();
  });

  it('wake: calls background_job_wake with the kind and key; answers whether it woke a job', async () => {
    const db = dbFetch(true);
    expect(await ledger(db.fetch).wake({ kind: 'main-watch', key: 'initech/web#7' })).toBe(true);
    expect(db.calls).toEqual([expect.objectContaining({ method: 'POST', path: '/rest/v1/rpc/background_job_wake', body: { p_kind: 'main-watch', p_key: 'initech/web#7' } })]);
    expect(await ledger(dbFetch(false).fetch).wake({ kind: 'main-watch', key: 'initech/web#7' })).toBe(false);
    await expect(ledger(dbFetch('woken').fetch).wake({ kind: 'main-watch', key: 'initech/web#7' })).rejects.toThrow();
  });
});
