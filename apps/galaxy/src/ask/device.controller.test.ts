import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MAX_TOKEN_BODY_BYTES } from './cli-code';
import { issueDevice, pollDevice, type DeviceRouteDeps } from './device.controller';
import { fakeStore } from './device.fake';
import { deviceService } from './device.service';

vi.mock('server-only', () => ({}));

const START = Date.parse('2026-10-12T09:00:00Z');
const Issued = z.object({ device_code: z.string(), user_code: z.string(), url: z.string(), interval: z.number(), expires_in: z.number() });

function world() {
  const clock = { now: START };
  const fake = fakeStore();
  const service = deviceService(fake.store, { now: () => clock.now, open: (sealed) => sealed.replace(/^sealed:/, '') });
  const deps: DeviceRouteDeps = { service, now: () => clock.now };
  return { ...fake, clock, service, deps };
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const issue = (deps: DeviceRouteDeps, body: unknown, headers?: Record<string, string>) => issueDevice(post('/api/ask/device', body, headers), deps);
const poll = (deps: DeviceRouteDeps, body: unknown) => pollDevice(post('/api/ask/device/poll', body), deps);

describe('POST /api/ask/device', () => {
  it('issues a sign-in request: its device code, its user code, the link on this site, 3 s and 600 s', async () => {
    const { deps } = world();
    const response = await issue(deps, { purpose: 'signin' }, { 'x-forwarded-host': 'ask.example', 'x-forwarded-proto': 'https' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = Issued.parse(await response.json());
    expect(body.device_code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.user_code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXZ2-9]{4}$/);
    expect(body.url).toBe(`https://ask.example/ask/device?user_code=${body.user_code}`);
    expect(body).toMatchObject({ interval: 3, expires_in: 600 });
  });

  it('takes the host header when no proxy names one', async () => {
    const { deps } = world();
    const body = Issued.parse(await (await issue(deps, { purpose: 'token', days: 365 }, { host: 'omni.local:3000' })).json());
    expect(body.url).toMatch(/^http:\/\/omni\.local:3000\/ask\/device\?user_code=/);
  });

  it('refuses a malformed body with 400, and one too large with 413', async () => {
    const { deps, rows } = world();
    for (const bad of ['not json', [], { purpose: 'other' }, { purpose: 'token', days: 7 }, { purpose: 'signin', name: 'x' }]) {
      expect((await issue(deps, bad)).status).toBe(400);
    }
    const huge = { purpose: 'token', name: 'x'.repeat(MAX_TOKEN_BODY_BYTES) };
    expect((await issue(deps, huge)).status).toBe(413);
    expect((await issue(deps, { purpose: 'signin' }, { 'content-length': String(MAX_TOKEN_BODY_BYTES + 1) })).status).toBe(413);
    expect(rows.size).toBe(0);
  });

  it('answers 503 without a database, and 500 when it fails', async () => {
    expect((await issue({ service: null }, { purpose: 'signin' })).status).toBe(503);
    const { deps, state } = world();
    state.fails = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await issue(deps, { purpose: 'signin' })).status).toBe(500);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('POST /api/ask/device/poll', () => {
  async function issued(deps: DeviceRouteDeps, purpose: 'signin' | 'token' = 'signin') {
    return Issued.parse(await (await issue(deps, { purpose })).json());
  }

  it('answers pending (200), then slow_down (429) with the longer interval', async () => {
    const { deps, clock } = world();
    const { device_code } = await issued(deps);
    const first = await poll(deps, { device_code });
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(await first.json()).toEqual({ status: 'pending' });
    clock.now += 1_000;
    const fast = await poll(deps, { device_code });
    expect(fast.status).toBe(429);
    expect(await fast.json()).toEqual({ status: 'slow_down', interval: 5 });
  });

  it('answers expired (410) after 10 minutes and for an unknown code, denied (403) once denied', async () => {
    const { deps, clock, service } = world();
    const old = await issued(deps);
    const refused = await issued(deps);
    await service.deny(refused.user_code);
    const denied = await poll(deps, { device_code: refused.device_code });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ status: 'denied' });
    const unknown = await poll(deps, { device_code: 'A'.repeat(43) });
    expect(unknown.status).toBe(410);
    clock.now += 10 * 60_000;
    const late = await poll(deps, { device_code: old.device_code });
    expect(late.status).toBe(410);
    expect(await late.json()).toEqual({ status: 'expired' });
  });

  it('hands an approved code over once (200), then answers expired', async () => {
    const { deps, service, rows } = world();
    const { device_code, user_code } = await issued(deps);
    await service.approve(user_code, 'signin', 'one-time-code');
    const approved = await poll(deps, { device_code });
    expect(approved.status).toBe(200);
    expect(await approved.json()).toEqual({ status: 'approved', code: 'one-time-code' });
    expect(rows.size).toBe(0);
    expect((await poll(deps, { device_code })).status).toBe(410);
  });

  it('hands an approved token over once, unsealed', async () => {
    const { deps, service } = world();
    const { device_code, user_code } = await issued(deps, 'token');
    await service.approve(user_code, 'token', 'sealed:omk_abc', '2027-01-10T09:00:00.000Z');
    expect(await (await poll(deps, { device_code })).json()).toEqual({ status: 'approved', token: 'omk_abc', expires_at: '2027-01-10T09:00:00.000Z' });
  });

  it('refuses a malformed body with 400, one too large with 413; 503 without a database, 500 when it fails', async () => {
    const { deps, state } = world();
    for (const bad of ['nope', {}, { device_code: '' }, { device_code: 7 }, { device_code: 'x', more: 1 }]) {
      expect((await poll(deps, bad)).status).toBe(400);
    }
    expect((await poll(deps, { device_code: 'x'.repeat(MAX_TOKEN_BODY_BYTES) })).status).toBe(413);
    expect((await poll({ service: null }, { device_code: 'A'.repeat(43) })).status).toBe(503);
    state.fails = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await poll(deps, { device_code: 'A'.repeat(43) })).status).toBe(500);
    errors.mockRestore();
  });
});
