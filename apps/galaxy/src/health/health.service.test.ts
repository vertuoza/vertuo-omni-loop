// The arcade's health (PRD 1723, s3): GET /api/health answers 200 when its environment parses and
// Supabase answers within 3 seconds, 503 otherwise, never with a value or an error's text.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvError } from 'vertuo-omni-plan/kit/lib/env/group.ts';
import { healthResponse, type HealthDeps } from './health.service';

vi.mock('server-only', () => ({}));

const FAKE_SECRET = 'sk-fake-do-not-print-0123456789';
const SHA = '0123456789abcdef0123456789abcdef01234567';

const deps = (over: Partial<HealthDeps> = {}): HealthDeps => ({
  env: () => undefined,
  commit: () => SHA,
  supabase: () => Promise.resolve(),
  ...over,
});

const read = async (response: Response) => ({ status: response.status, body: await response.text() });

afterEach(() => { vi.useRealTimers(); });

describe('healthResponse, the arcade\'s /api/health', () => {
  it('answers 200, ok, the commit and both checks ok, never cached', async () => {
    const response = await healthResponse(deps());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual({ ok: true, app: 'galaxy', commit: SHA, checks: { env: 'ok', supabase: 'ok' } });
  });

  it('gives a null commit when the deployment has none', async () => {
    const response = await healthResponse(deps({ commit: () => null }));
    expect(await response.json()).toMatchObject({ ok: true, commit: null });
  });

  it('answers 503 when the environment does not parse, naming the check and no value', async () => {
    const env = () => { throw new EnvError([{ variables: ['KIT_TOKEN_KEY'], reason: `KIT_TOKEN_KEY is not valid: ${FAKE_SECRET}` }]); };
    const { status, body } = await read(await healthResponse(deps({ env })));
    expect(status).toBe(503);
    expect(JSON.parse(body)).toEqual({ ok: false, app: 'galaxy', commit: SHA, checks: { env: 'failed', supabase: 'ok' } });
    expect(body).not.toContain(FAKE_SECRET);
    expect(body).not.toContain('KIT_TOKEN_KEY');
  });

  it('answers 503 when Supabase refuses, without the error\'s text', async () => {
    const supabase = () => Promise.reject(new Error(`releases: permission denied ${FAKE_SECRET}`));
    const { status, body } = await read(await healthResponse(deps({ supabase })));
    expect(status).toBe(503);
    expect(JSON.parse(body)).toEqual({ ok: false, app: 'galaxy', commit: SHA, checks: { env: 'ok', supabase: 'failed' } });
    expect(body).not.toContain(FAKE_SECRET);
    expect(body).not.toContain('permission');
  });

  it('answers 503 when the Supabase check throws before it starts', async () => {
    const supabase = () => { throw new Error('Supabase is not configured'); };
    const response = await healthResponse(deps({ supabase }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ checks: { supabase: 'failed' } });
  });

  it('answers 503 when Supabase takes longer than 3 seconds', async () => {
    vi.useFakeTimers();
    const pending = healthResponse(deps({ supabase: () => new Promise<void>(() => undefined) }));
    await vi.advanceTimersByTimeAsync(2_999);
    let settled = false;
    void pending.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, checks: { env: 'ok', supabase: 'failed' } });
  });

  it('answers in time when Supabase answers just under 3 seconds', async () => {
    vi.useFakeTimers();
    const pending = healthResponse(deps({ supabase: () => new Promise<void>((resolve) => { setTimeout(resolve, 2_900); }) }));
    await vi.advanceTimersByTimeAsync(2_900);
    expect((await pending).status).toBe(200);
  });
});
