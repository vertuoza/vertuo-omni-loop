import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthOf, healthRoute } from './health.ts';

const SHA = '0123456789abcdef0123456789abcdef01234567';
/** A recognisable fake value: no body may ever hold it. */
const FAKE = 'sk-fake-health-value-7f3a';

/** An environment that parses, as a preview runs with nothing set but its platform variables. */
const GOOD = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: SHA };
/** An environment that does not parse: a half-set Supabase pair whose URL is the fake value. */
const BROKEN = { VERCEL_GIT_COMMIT_SHA: SHA, SUPABASE_URL: FAKE, GITHUB_APP_ID: FAKE, GITHUB_APP_PRIVATE_KEY: FAKE };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('healthOf — omni-app', () => {
  it('is 200 and ok, with the commit and env ok, when the environment parses', () => {
    expect(healthOf(GOOD)).toEqual({ status: 200, body: { ok: true, app: 'omni-app', commit: SHA, checks: { env: 'ok' } } });
  });

  it('is 503 and not ok, env failed, when the environment does not parse', () => {
    expect(healthOf(BROKEN)).toEqual({ status: 503, body: { ok: false, app: 'omni-app', commit: SHA, checks: { env: 'failed' } } });
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
    const response = healthRoute(() => GOOD).GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ ok: true, app: 'omni-app', commit: SHA, checks: { env: 'ok' } });
  });

  it('answers 503, no-store, and holds no value nor error text when the environment is broken', async () => {
    const response = healthRoute(() => BROKEN).GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    expect(text).not.toContain(FAKE);
    expect(text).not.toMatch(/SUPABASE|GITHUB_APP|environment|not valid|not set/);
    expect(JSON.parse(text)).toEqual({ ok: false, app: 'omni-app', commit: SHA, checks: { env: 'failed' } });
  });

  it('reads the environment on each request, never once at load', () => {
    let source: Record<string, string> = GOOD;
    const route = healthRoute(() => source);
    expect(route.GET().status).toBe(200);
    source = BROKEN;
    expect(route.GET().status).toBe(503);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('answers %s with 405, allowing GET', (method) => {
    const response = healthRoute(() => GOOD)[method]();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('calls no fetch', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const route = healthRoute(() => GOOD);
    route.GET();
    healthRoute(() => BROKEN).GET();
    route.POST();
    expect(fetch).not.toHaveBeenCalled();
  });
});
