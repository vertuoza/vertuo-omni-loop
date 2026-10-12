import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DeviceCard, DevicePage } from './device-card';
import { denyDevice, deviceView, readDeviceQuery, type DeviceQuery } from './device-card.controller';
import { fakeStore } from './device.fake';
import { deviceService } from './device.service';

vi.mock('server-only', () => ({}));

const START = Date.parse('2026-10-12T09:00:00Z');
// The spec's own example, WXYZ-4821, holds a Y and a 1, which the alphabet leaves out.
const CODE = 'WXTZ-4825';

/** A device sign-in on a fake store with one pending request of `purpose`. */
async function world(purpose: 'signin' | 'token' = 'signin') {
  const clock = { now: START };
  const { store, rows, state } = fakeStore();
  const devices = deviceService(store, { now: () => clock.now, userCode: () => CODE.replace('-', '') });
  const issued = await devices.issue(purpose === 'signin' ? { purpose } : { purpose, name: 'laptop', days: 90, workspace: null });
  return { clock, devices, rows, state, issued };
}

const view = (query: DeviceQuery, devices: ReturnType<typeof deviceService> | null) => deviceView(query, devices);
const html = (card: Parameters<typeof DeviceCard>[0]['view']) => renderToStaticMarkup(createElement(DeviceCard, { view: card }));

describe('/ask/device: which state the page shows (PRD 1660)', () => {
  it('asks whether the terminal shows the code, for a pending request, the code read without case or dash', async () => {
    const { devices } = await world();
    for (const given of [CODE, 'wxtz4825', ' wxtz-4825 ']) {
      expect(await view({ user_code: given }, devices)).toEqual({ kind: 'confirm', userCode: CODE });
    }
  });

  it('opens the sign-in card once Yes is pressed, its way back the callback with device= in place of port and state', async () => {
    const { devices } = await world();
    expect(await view({ user_code: CODE, yes: '1' }, devices)).toEqual({
      kind: 'signin', returnPath: `/auth/callback?next=ask-cli&device=${CODE}`, purpose: { kind: 'signin' }, error: null,
    });
    expect(await view({ user_code: CODE, yes: '1', signin_error: 'Not today' }, devices)).toMatchObject({ kind: 'signin', error: 'Not today' });
  });

  it('names the token and its lifetime on the card for a token request, going back to the terminal', async () => {
    const { devices } = await world('token');
    expect(await view({ user_code: CODE, yes: '1' }, devices)).toEqual({
      kind: 'signin', returnPath: `/auth/callback?next=ask-cli&device=${CODE}&purpose=token`,
      purpose: { kind: 'token', name: 'laptop', days: 90, toTerminal: true }, error: null,
    });
  });

  it('shows the expired state for an expired, unknown, used, denied or malformed code', async () => {
    const w = await world();
    expect(await view({ user_code: 'BCDF-2345' }, w.devices)).toEqual({ kind: 'expired' });
    expect(await view({ user_code: 'not-a-code' }, w.devices)).toEqual({ kind: 'expired' });
    expect(await view({ user_code: CODE, yes: '1' }, w.devices)).toMatchObject({ kind: 'signin' });
    w.clock.now += 11 * 60_000;
    expect(await view({ user_code: CODE }, w.devices)).toEqual({ kind: 'expired' });
    expect(await view({ user_code: CODE, yes: '1' }, w.devices)).toEqual({ kind: 'expired' });

    const used = await world();
    expect(await used.devices.approve(CODE, 'signin', 'one-time')).toBe(true);
    expect(await view({ user_code: CODE }, used.devices)).toEqual({ kind: 'expired' });
    const denied = await world();
    expect(await denied.devices.deny(CODE)).toBe(true);
    expect(await view({ user_code: CODE }, denied.devices)).toEqual({ kind: 'expired' });
  });

  it('shows the box to type the code when the link carries none', async () => {
    const { devices } = await world();
    expect(await view({}, devices)).toEqual({ kind: 'enter' });
    expect(await view({ user_code: '  ' }, devices)).toEqual({ kind: 'enter' });
  });

  it('shows done and denied as they are, whatever else the link says', async () => {
    const { devices } = await world();
    expect(await view({ done: '1' }, devices)).toEqual({ kind: 'done' });
    expect(await view({ done: '1' }, null)).toEqual({ kind: 'done' });
    expect(await view({ denied: '1', user_code: CODE }, devices)).toEqual({ kind: 'denied' });
  });

  it('says ask mode is not open without a device sign-in here, and that the database did not answer when it fails', async () => {
    expect(await view({ user_code: CODE }, null)).toEqual({ kind: 'closed' });
    const w = await world();
    w.state.fails = true;
    expect(await view({ user_code: CODE }, w.devices)).toEqual({ kind: 'unreachable' });
  });
});

describe('No, it\'s not mine: POST /ask/device/deny (PRD 1660)', () => {
  const post = (body: Record<string, string>) => new Request('https://ask.example/ask/device/deny', { method: 'POST', body: new URLSearchParams(body) });
  const where = (response: Response) => ({ status: response.status, location: response.headers.get('location') });

  it('marks the pending request denied and shows Nothing was signed in; the terminal then reads denied', async () => {
    const w = await world();
    expect(where(await denyDevice(post({ user_code: 'wxtz4825' }), w.devices))).toEqual({ status: 303, location: '/ask/device?denied=1' });
    expect(await w.devices.poll(w.issued.device_code)).toEqual({ status: 'denied' });
  });

  it('denies nothing that is no longer pending, and shows its expired state', async () => {
    const w = await world();
    w.clock.now += 11 * 60_000;
    expect(where(await denyDevice(post({ user_code: CODE }), w.devices))).toEqual({ status: 303, location: `/ask/device?user_code=${CODE}` });
    expect(where(await denyDevice(post({}), w.devices))).toEqual({ status: 303, location: '/ask/device' });
    expect(where(await denyDevice(post({ user_code: CODE }), null))).toEqual({ status: 303, location: `/ask/device?user_code=${CODE}` });
  });

  it('comes back to the code when the database fails, so No can be pressed again', async () => {
    const w = await world();
    w.state.fails = true;
    expect(where(await denyDevice(post({ user_code: CODE }), w.devices))).toEqual({ status: 303, location: `/ask/device?user_code=${CODE}` });
  });
});

describe('the device page\'s card (PRD 1660)', () => {
  /** The sentences a person reads at rest: every text node, split at its full stops and question marks. */
  const sentences = (markup: string) => markup.replace(/<[^>]+>/g, '\n').split(/\n|(?<=[.?])\s/).map((text) => text.trim()).filter(Boolean);

  it('asks whether the terminal shows the code, with Yes, sign it in and No, it\'s not mine', () => {
    const markup = html({ kind: 'confirm', userCode: CODE });
    expect(markup).toContain('>Sign a terminal in</h1>');
    expect(markup).toContain('Does your terminal show this code?');
    expect(markup).toContain(`>${CODE}</`);
    expect(markup).toContain(`href="/ask/device?user_code=${CODE}&amp;yes=1"`);
    expect(markup).toContain('>Yes, sign it in</a>');
    expect(markup).toMatch(/<form(?=[^>]*method="post")[^>]*action="\/ask\/device\/deny"/);
    expect(markup).toContain(`name="user_code" value="${CODE}"`);
    expect(markup).toContain('No, it’s not mine</button>');
  });

  it('takes a typed code in a box, sending it back to the page', () => {
    const markup = html({ kind: 'enter' });
    expect(markup).toContain('Enter the code your terminal shows.');
    expect(markup).toMatch(/<form(?=[^>]*method="get")[^>]*action="\/ask\/device"/);
    expect(markup).toContain('name="user_code"');
    expect(markup).toContain('>Continue</button>');
  });

  it('draws done, denied and expired in the before/after page\'s words', () => {
    expect(html({ kind: 'done' })).toContain('Back to your terminal');
    expect(html({ kind: 'done' })).toContain('Signed in. Close this tab.');
    expect(html({ kind: 'denied' })).toContain('Nothing was signed in');
    expect(html({ kind: 'denied' })).toContain('Got this link from someone? Ignore it.');
    expect(html({ kind: 'expired' })).toContain('This link has expired');
    expect(html({ kind: 'expired' })).toContain('Run <code>omni signin</code> again.');
  });

  it('keeps every sentence at rest within 7 words, and never shows anything but the user code', () => {
    for (const card of [{ kind: 'confirm', userCode: CODE }, { kind: 'enter' }, { kind: 'done' }, { kind: 'denied' }, { kind: 'expired' }] as const) {
      for (const sentence of sentences(html(card))) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(7);
    }
    expect(html({ kind: 'confirm', userCode: CODE })).not.toMatch(/device_code|omk_/);
  });
});

describe('the device page as a whole (PRD 1660)', () => {
  const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };
  const page = (view: Parameters<typeof DevicePage>[0]['view'], supabase: typeof SUPABASE | null = SUPABASE) =>
    renderToStaticMarkup(createElement(DevicePage, { view, supabase }));

  it('reads the first value of each parameter it knows, and nothing else', () => {
    expect(readDeviceQuery({ user_code: [CODE, 'BCDF-2345'], yes: '1', port: '49152', done: undefined })).toEqual({ user_code: CODE, yes: '1' });
  });

  it('opens the sign-in card after Yes, its sentence the short one, or the token\'s name for a token request', () => {
    const signin = page({ kind: 'signin', returnPath: `/auth/callback?next=ask-cli&device=${CODE}`, purpose: { kind: 'signin' }, error: null });
    expect(signin).toContain('Sign the terminal in');
    expect(signin).toContain('The terminal gets its own sign-in.');
    expect(signin).toContain('>Sign in with GitHub</button>');
    const token = page({ kind: 'signin', returnPath: '/x', purpose: { kind: 'token', name: 'laptop', days: 90, toTerminal: true }, error: 'Not today' });
    expect(token).toContain('<strong>laptop</strong>, for 90 days.');
    expect(token).toContain('Not today');
  });

  it('says ask mode is not open without a database, and that it did not answer when it fails', () => {
    expect(page({ kind: 'closed' })).toContain('Ask mode is not open here');
    expect(page({ kind: 'signin', returnPath: '/x', purpose: { kind: 'signin' }, error: null }, null)).toContain('Ask mode is not open here');
    expect(page({ kind: 'unreachable' })).toContain('The ask database could not answer');
    expect(page({ kind: 'expired' })).toContain('This link has expired');
  });
});
