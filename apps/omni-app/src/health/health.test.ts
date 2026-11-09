import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JobsHealth } from '../jobs/ledger.ts';
import { healthOf, healthRoute, jobsCheck } from './health.ts';

const SHA = '0123456789abcdef0123456789abcdef01234567';
/** A recognisable fake value: no body may ever hold it. */
const FAKE = 'sk-fake-health-value-7f3a';

/** An environment that parses, as a preview runs with nothing set but its platform variables. */
const GOOD = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: SHA };
/** An environment that does not parse: a half-set Supabase pair whose URL is the fake value. */
const WITH_DB = { ...GOOD, SUPABASE_URL: 'https://fake-health.supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key-7f3a' };
const jobs = (state: JobsHealth['state'], late = 0, failed = 0) => (): Promise<JobsHealth> => Promise.resolve({ state, late, failed });
const BROKEN = { VERCEL_GIT_COMMIT_SHA: SHA, SUPABASE_URL: FAKE, GITHUB_APP_ID: FAKE, GITHUB_APP_PRIVATE_KEY: FAKE };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('healthOf — omni-app', () => {
  it('is 200 and ok, with the commit and env ok, when the environment parses', () => {
    expect(healthOf(GOOD)).toEqual({ status: 200, body: { ok: true, app: 'omni-app', commit: SHA, checks: { env: 'ok', jobs: 'off' } } });
  });

  it('is 503 and not ok, env failed, when the environment does not parse', () => {
    expect(healthOf(BROKEN)).toEqual({ status: 503, body: { ok: false, app: 'omni-app', commit: SHA, checks: { env: 'failed', jobs: 'unknown' } } });
  });

  it('is 503 in production when a required group is missing', () => {
    expect(healthOf({ VERCEL_ENV: 'production' }).status).toBe(503);
  });

  it('gives the commit as null when VERCEL_GIT_COMMIT_SHA is unset or empty', () => {
    expect(healthOf({}).body.commit).toBeNull();
    expect(healthOf({ VERCEL_GIT_COMMIT_SHA: '' }).body.commit).toBeNull();
  });
});

describe('healthRoute — GET /api/health', () => {
  it('answers 200 JSON, no-store, when the environment parses', async () => {
    const response = await healthRoute(() => GOOD).GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ ok: true, app: 'omni-app', commit: SHA, checks: { env: 'ok', jobs: 'off' } });
  });

  it('answers 503, no-store, and holds no value nor error text when the environment is broken', async () => {
    const response = await healthRoute(() => BROKEN).GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    expect(text).not.toContain(FAKE);
    expect(text).not.toMatch(/SUPABASE|GITHUB_APP|environment|not valid|not set/);
    expect(JSON.parse(text)).toEqual({ ok: false, app: 'omni-app', commit: SHA, checks: { env: 'failed', jobs: 'unknown' } });
  });

  it('reads the environment on each request, never once at load', async () => {
    let source: Record<string, string> = GOOD;
    const route = healthRoute(() => source);
    expect((await route.GET()).status).toBe(200);
    source = BROKEN;
    expect((await route.GET()).status).toBe(503);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('answers %s with 405, allowing GET', (method) => {
    const response = healthRoute(() => GOOD)[method]();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('calls no fetch where there is no database', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const route = healthRoute(() => GOOD);
    await route.GET();
    await healthRoute(() => BROKEN).GET();
    route.POST();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('jobsCheck — checks.jobs', () => {
  it('is off, reading nothing, where no database is set', async () => {
    const read = vi.fn(jobs('ok'));
    expect(await jobsCheck(GOOD, read)).toBe('off');
    expect(read).not.toHaveBeenCalled();
  });

  it('is ok when the ledger says ok', async () => {
    expect(await jobsCheck(WITH_DB, jobs('ok'))).toBe('ok');
  });

  it('is late when the ledger says late', async () => {
    expect(await jobsCheck(WITH_DB, jobs('late', 1, 0))).toBe('late');
    expect(await jobsCheck(WITH_DB, jobs('late', 0, 2))).toBe('late');
  });

  it('is unknown when the ledger cannot be read', async () => {
    expect(await jobsCheck(WITH_DB, () => Promise.reject(new Error('connection refused')))).toBe('unknown');
  });

  it('is unknown when the ledger does not answer in time', async () => {
    vi.useFakeTimers();
    try {
      const pending = jobsCheck(WITH_DB, () => new Promise<JobsHealth>(() => undefined));
      await vi.advanceTimersByTimeAsync(6000);
      expect(await pending).toBe('unknown');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('healthRoute — checks.jobs', () => {
  const answer = async (state: JobsHealth['state'], late = 0, failed = 0) => {
    const response = await healthRoute(() => WITH_DB, jobs(state, late, failed)).GET();
    return { status: response.status, text: await response.text() };
  };

  it('keeps ok true when the jobs are ok', async () => {
    const { status, text } = await answer('ok');
    expect(status).toBe(200);
    expect(JSON.parse(text)).toEqual({ ok: true, app: 'omni-app', commit: SHA, checks: { env: 'ok', jobs: 'ok' } });
  });

  it('turns ok to false, with 503, when the jobs are late, and the body holds the state only', async () => {
    const { status, text } = await answer('late', 3, 1);
    expect(status).toBe(503);
    expect(JSON.parse(text)).toEqual({ ok: false, app: 'omni-app', commit: SHA, checks: { env: 'ok', jobs: 'late' } });
    expect(text).not.toMatch(/owner|repo|error|"late":|failed":/);
  });

  it('keeps ok true when the jobs are unknown', async () => {
    const response = await healthRoute(() => WITH_DB, () => Promise.reject(new Error(FAKE))).GET();
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain(FAKE);
    expect(JSON.parse(text)).toEqual({ ok: true, app: 'omni-app', commit: SHA, checks: { env: 'ok', jobs: 'unknown' } });
  });
});
