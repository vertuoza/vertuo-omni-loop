import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DEVICE_TTL_MS, USER_CODE_ALPHABET, type DeviceRequest } from './device.contract';
import { fakeStore } from './device.fake';
import { deviceService, formatUserCode, hashDeviceCode, newDeviceCode, newUserCode, normalizeUserCode, readDeviceRequest } from './device.service';
import { present } from './test/test-item';

vi.mock('server-only', () => ({}));

const START = Date.parse('2026-10-12T09:00:00Z');
const TODAY = new Date(START);

function world(open: ((sealed: string) => string) | null = (sealed) => sealed.replace(/^sealed:/, '')) {
  const clock = { now: START };
  const fake = fakeStore();
  const service = deviceService(fake.store, { now: () => clock.now, open });
  const later = (ms: number) => {
    clock.now += ms;
  };
  return { ...fake, clock, service, later };
}

const SIGNIN: DeviceRequest = { purpose: 'signin' };
const TOKEN: DeviceRequest = { purpose: 'token', name: 'cloud box', days: 30, workspace: 'vertuoza' };

describe('the codes', () => {
  it('a device code is 32 random bytes in base64url, 43 characters, and only its SHA-256 is kept', () => {
    const code = newDeviceCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newDeviceCode()).not.toBe(code);
    expect(hashDeviceCode(code)).toBe(createHash('sha256').update(code).digest('hex'));
    expect(hashDeviceCode(code)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a user code is 8 characters of the alphabet without look-alikes, shown XXXX-XXXX', () => {
    const codes = Array.from({ length: 200 }, () => newUserCode());
    for (const code of codes) expect(code).toMatch(new RegExp(`^[${USER_CODE_ALPHABET}]{8}$`));
    expect(new Set(codes).size).toBeGreaterThan(190);
    expect(newUserCode((n) => n - 1)).toBe('99999999');
    expect(newUserCode(() => 0)).toBe('BBBBBBBB');
    expect(formatUserCode('WXZB4823')).toBe('WXZB-4823');
    for (const ch of 'AEIOUY01') expect(USER_CODE_ALPHABET).not.toContain(ch);
  });

  it('a user code is read without case, dash or spaces, and refused when it cannot be one', () => {
    expect(normalizeUserCode('WXZB-4823')).toBe('WXZB4823');
    expect(normalizeUserCode('wxzb4823')).toBe('WXZB4823');
    expect(normalizeUserCode(' wx-zb 48-23 ')).toBe('WXZB4823');
    for (const bad of [null, undefined, '', 'WXZB-482', 'WXZB-48233', 'WXZB-4820', 'AXZB-4823', 'WXYZ-4823', 'WXZB_4823']) {
      expect(normalizeUserCode(bad)).toBeNull();
    }
  });
});

describe('the request a body asks for', () => {
  const read = (body: unknown) => readDeviceRequest(body, TODAY);

  it('a sign-in takes nothing else', () => {
    expect(read({ purpose: 'signin' })).toEqual(SIGNIN);
    expect(read({ purpose: 'signin', name: 'x' })).toBeNull();
  });

  it('a token is validated as /ask/signin?purpose=token is: name, 30/90/365 days, a workspace slug', () => {
    expect(read({ purpose: 'token', name: 'cloud box', days: 30, workspace: 'vertuoza' })).toEqual(TOKEN);
    expect(read({ purpose: 'token' })).toEqual({ purpose: 'token', name: 'terminal 2026-10-12', days: 90, workspace: null });
    expect(read({ purpose: 'token', days: 365 })).toMatchObject({ days: 365 });
    for (const bad of [
      { purpose: 'token', days: 7 },
      { purpose: 'token', days: '30' },
      { purpose: 'token', name: 'x'.repeat(41) },
      { purpose: 'token', name: 'two\nlines' },
      { purpose: 'token', name: 3 },
      { purpose: 'token', workspace: 'Not A Slug' },
      { purpose: 'token', workspace: 7 },
      { purpose: 'token', port: 49152 },
      { purpose: 'token', back: '/app/me' },
    ]) {
      expect(read(bad)).toBeNull();
    }
  });

  it('anything else is no request', () => {
    for (const bad of [null, 'signin', [], {}, { purpose: 'other' }, { purpose: 'SIGNIN' }]) expect(read(bad)).toBeNull();
  });
});

describe('a device request, issued and polled', () => {
  it('is issued pending for 10 minutes, its device code stored only as its hash', async () => {
    const { service, rows } = world();
    const issued = await service.issue(SIGNIN);
    expect(issued).toMatchObject({ interval: 3, expires_in: 600 });
    expect(issued.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const row = present(rows.get(hashDeviceCode(issued.device_code)), 'the stored request');
    expect(row).toMatchObject({ status: 'pending', purpose: 'signin', user_code: issued.user_code.replace('-', '') });
    expect(row.expires_at).toBe(new Date(START + DEVICE_TTL_MS).toISOString());
    expect(JSON.stringify([...rows.entries()])).not.toContain(issued.device_code);
  });

  it('a token request keeps its name, days and workspace', async () => {
    const { service, rows } = world();
    const issued = await service.issue(TOKEN);
    expect(rows.get(hashDeviceCode(issued.device_code))).toMatchObject({ purpose: 'token', name: 'cloud box', days: 30, workspace: 'vertuoza' });
  });

  it('draws another user code when the first is in use, and gives up after a few', async () => {
    const fake = fakeStore();
    const codes = ['BBBBBBBB', 'BBBBBBBB', 'CCCCCCCC'];
    const service = deviceService(fake.store, { now: () => START, userCode: () => present(codes.shift(), 'a code') });
    expect((await service.issue(SIGNIN)).user_code).toBe('BBBB-BBBB');
    expect((await service.issue(SIGNIN)).user_code).toBe('CCCC-CCCC');
    const stuck = deviceService(fake.store, { now: () => START, userCode: () => 'BBBBBBBB' });
    await expect(stuck.issue(SIGNIN)).rejects.toThrow(/user code/);
  });

  it('clears the requests past their time on each issue', async () => {
    const { service, rows, later } = world();
    const old = await service.issue(SIGNIN);
    later(DEVICE_TTL_MS + 1);
    await service.issue(SIGNIN);
    expect(rows.has(hashDeviceCode(old.device_code))).toBe(false);
    expect(rows.size).toBe(1);
  });

  it('answers pending, then slow_down with 2 more seconds when polled sooner than its interval', async () => {
    const { service, later } = world();
    const { device_code: code } = await service.issue(SIGNIN);
    expect(await service.poll(code)).toEqual({ status: 'pending' });
    later(1_000);
    expect(await service.poll(code)).toEqual({ status: 'slow_down', interval: 5 });
    later(3_000);
    expect(await service.poll(code)).toEqual({ status: 'slow_down', interval: 7 });
    later(7_000);
    expect(await service.poll(code)).toEqual({ status: 'pending' });
    later(7_000);
    expect(await service.poll(code)).toEqual({ status: 'pending' });
  });

  it('answers expired after 10 minutes, and for a code never issued or malformed', async () => {
    const { service, later } = world();
    const { device_code: code } = await service.issue(SIGNIN);
    later(DEVICE_TTL_MS - 1);
    expect(await service.poll(code)).toEqual({ status: 'pending' });
    later(1);
    expect(await service.poll(code)).toEqual({ status: 'expired' });
    expect(await service.poll(newDeviceCode())).toEqual({ status: 'expired' });
    expect(await service.poll('short')).toEqual({ status: 'expired' });
  });

  it('answers denied once No was pressed', async () => {
    const { service } = world();
    const { device_code: code, user_code: user } = await service.issue(SIGNIN);
    expect(await service.deny(user.toLowerCase())).toBe(true);
    expect(await service.poll(code)).toEqual({ status: 'denied' });
    expect(await service.deny(user)).toBe(false);
    expect(await service.approve(user, 'signin', 'one-time')).toBe(false);
  });

  it('hands an approved sign-in\'s code over once, deleting the request in the same call', async () => {
    const { service, rows } = world();
    const { device_code: code, user_code: user } = await service.issue(SIGNIN);
    expect(await service.approve(user.replace('-', '').toLowerCase(), 'signin', 'one-time-code')).toBe(true);
    expect(await service.approve(user, 'signin', 'another')).toBe(false);
    expect(await service.poll(code)).toEqual({ status: 'approved', code: 'one-time-code' });
    expect(rows.size).toBe(0);
    expect(await service.poll(code)).toEqual({ status: 'expired' });
  });

  it('hands an approved token over once, unsealed, with its expiry', async () => {
    const { service, rows } = world();
    const { device_code: code, user_code: user } = await service.issue(TOKEN);
    expect(await service.approve(user, 'signin', 'one-time-code')).toBe(false);
    expect(await service.approve(user, 'token', 'sealed:omk_secret', '2026-11-11T09:00:00.000Z')).toBe(true);
    expect(await service.poll(code)).toEqual({ status: 'approved', token: 'omk_secret', expires_at: '2026-11-11T09:00:00.000Z' });
    expect(rows.size).toBe(0);
  });

  it('cannot hand a token over without the server\'s key', async () => {
    const { service } = world(null);
    const { device_code: code, user_code: user } = await service.issue(TOKEN);
    await service.approve(user, 'token', 'sealed:omk_secret', null);
    await expect(service.poll(code)).rejects.toThrow(/key/);
  });

  it('approves and denies nothing past its time, or under a user code never issued', async () => {
    const { service, later } = world();
    const { user_code: user } = await service.issue(SIGNIN);
    expect(await service.approve('BBBB-BBBB', 'signin', 'x')).toBe(false);
    expect(await service.deny('nonsense')).toBe(false);
    later(DEVICE_TTL_MS);
    expect(await service.approve(user, 'signin', 'x')).toBe(false);
    expect(await service.deny(user)).toBe(false);
  });

  it('finds a pending request by its user code, case- and dash-blind, and nothing else', async () => {
    const { service, later } = world();
    const signin = await service.issue(SIGNIN);
    const token = await service.issue(TOKEN);
    expect(await service.find(signin.user_code.toLowerCase().replace('-', ''))).toEqual({ user_code: signin.user_code, request: SIGNIN });
    expect(await service.find(token.user_code)).toEqual({ user_code: token.user_code, request: TOKEN });
    expect(await service.find('BBBB-BBBB')).toBeNull();
    expect(await service.find('?')).toBeNull();
    await service.deny(signin.user_code);
    expect(await service.find(signin.user_code)).toBeNull();
    later(DEVICE_TTL_MS);
    expect(await service.find(token.user_code)).toBeNull();
  });

  it('lets a failing database throw, for the route to answer 500', async () => {
    const { service, state } = world();
    const { device_code: code } = await service.issue(SIGNIN);
    state.fails = true;
    await expect(service.poll(code)).rejects.toThrow(/database/);
    await expect(service.issue(SIGNIN)).rejects.toThrow(/database/);
  });
});
