import { describe, expect, it } from 'vitest';
import { chooseFlow, DeviceError, deviceLink, startDevice } from './device.ts';

const ASK_URL = 'https://ask.example.com';
const DEVICE_CODE = 'd'.repeat(43);

/** A device page in memory: it answers the issue with `issued` (or `issueStatus`), then each poll with
 * the next of `polls`, and keeps every call. */
function fakePage({ issued = {}, issueStatus = 200, polls = [] }: {
  issued?: Record<string, unknown>;
  issueStatus?: number;
  polls?: ({ status: number; body: unknown } | 'unreachable')[];
} = {}) {
  const calls: { path: string; body: unknown }[] = [];
  const queue = [...polls];
  const fetch = (url: string, init: RequestInit): Promise<Response> => {
    const path = new URL(url).pathname;
    calls.push({ path, body: JSON.parse(typeof init.body === 'string' ? init.body : 'null') });
    if (path === '/api/ask/device') {
      return Promise.resolve(Response.json({ device_code: DEVICE_CODE, user_code: 'WXYZ-4821', url: 'https://elsewhere.test/ask/device?user_code=WXYZ-4821', interval: 0.01, expires_in: 600, ...issued }, { status: issueStatus }));
    }
    const next = queue.shift() ?? { status: 200, body: { status: 'pending' } };
    if (next === 'unreachable') return Promise.reject(new TypeError('fetch failed'));
    return Promise.resolve(Response.json(next.body, { status: next.status }));
  };
  return { fetch, calls, polls: () => calls.filter((call) => call.path === '/api/ask/device/poll') };
}

const reasonOf = async (promise: Promise<unknown>): Promise<string | null> => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof DeviceError ? error.reason : `not a DeviceError: ${String(error)}`;
  }
};

describe('chooseFlow', () => {
  const local = { remote: false, display: false };
  const remote = { remote: true, display: false };

  it('takes the device flow in a remote session, on any platform, display or not', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      expect(chooseFlow(remote, platform), platform).toBe('device');
      expect(chooseFlow({ remote: true, display: true }, platform), platform).toBe('device');
    }
  });

  it('takes the device flow on Linux with no display, the loopback with one', () => {
    expect(chooseFlow(local, 'linux')).toBe('device');
    expect(chooseFlow({ remote: false, display: true }, 'linux')).toBe('loopback');
  });

  it('takes the loopback on a laptop that is not Linux, display variables or not', () => {
    for (const platform of ['darwin', 'win32'] as const) expect(chooseFlow(local, platform), platform).toBe('loopback');
  });

  it('takes the flow a flag forces, whatever the session', () => {
    expect(chooseFlow({ remote: false, display: true }, 'darwin', 'device')).toBe('device');
    expect(chooseFlow(remote, 'linux', 'loopback')).toBe('loopback');
    expect(chooseFlow(remote, 'darwin', null)).toBe('device');
  });
});

describe('deviceLink', () => {
  it('is <ask.url>/ask/device with the user code, under a path ask.url may carry', () => {
    expect(deviceLink(ASK_URL, 'WXYZ-4821')).toBe('https://ask.example.com/ask/device?user_code=WXYZ-4821');
    expect(deviceLink('https://host.test/omni/', 'WXYZ-4821')).toBe('https://host.test/omni/ask/device?user_code=WXYZ-4821');
  });
});

describe('startDevice', () => {
  it('issues a signin request and gives its user code, its link under ask.url and its wait', async () => {
    const page = fakePage();
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch });
    expect(device.userCode).toBe('WXYZ-4821');
    expect(device.url).toBe('https://ask.example.com/ask/device?user_code=WXYZ-4821');
    expect(device.waitMs).toBe(600_000);
    expect(page.calls).toEqual([{ path: '/api/ask/device', body: { purpose: 'signin' } }]);
    await device.close();
  });

  it('sends a token request with its name, days and workspace', async () => {
    const page = fakePage();
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'token', name: 'cloud', days: 90, workspace: 'acme', fetch: page.fetch });
    expect(page.calls[0]?.body).toEqual({ purpose: 'token', name: 'cloud', days: 90, workspace: 'acme' });
    await device.close();
  });

  for (const status of [404, 503]) {
    it(`reads a ${status} as a page with no device sign-in`, async () => {
      expect(await reasonOf(startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: fakePage({ issueStatus: status }).fetch }))).toBe('unavailable');
    });
  }

  it('reads a page it cannot reach, another failure or a malformed answer as unreachable', async () => {
    const failing = () => Promise.reject(new TypeError('fetch failed'));
    expect(await reasonOf(startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: failing }))).toBe('unreachable');
    expect(await reasonOf(startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: fakePage({ issueStatus: 500 }).fetch }))).toBe('unreachable');
    for (const issued of [{ user_code: 7 }, { device_code: '' }, { interval: 0 }, { expires_in: -1 }, { interval: 'soon' }]) {
      expect(await reasonOf(startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: fakePage({ issued }).fetch })), JSON.stringify(issued)).toBe('unreachable');
    }
  });

  it('polls with the device code until approved, and gives the one-time code', async () => {
    const page = fakePage({ polls: [{ status: 200, body: { status: 'pending' } }, { status: 200, body: { status: 'approved', code: 'code-1' } }] });
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch });
    expect(await device.poll()).toEqual({ code: 'code-1' });
    expect(page.polls()).toEqual([
      { path: '/api/ask/device/poll', body: { device_code: DEVICE_CODE } },
      { path: '/api/ask/device/poll', body: { device_code: DEVICE_CODE } },
    ]);
  });

  it('gives a token request its token and expiry', async () => {
    const page = fakePage({ polls: [{ status: 200, body: { status: 'approved', token: 'omk_t', expires_at: '2027-01-01T00:00:00.000Z' } }] });
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'token', name: 'cloud', days: 30, workspace: null, fetch: page.fetch });
    expect(await device.poll()).toEqual({ token: 'omk_t', expiresAt: '2027-01-01T00:00:00.000Z' });
  });

  it('gives the same answer to a second poll() without polling again', async () => {
    const page = fakePage({ polls: [{ status: 200, body: { status: 'approved', code: 'code-1' } }] });
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch });
    const first = device.poll();
    expect(device.poll()).toBe(first);
    await first;
    expect(page.polls()).toHaveLength(1);
  });

  it('waits the interval the page gives, and the longer one a slow_down gives', async () => {
    const waits: number[] = [];
    const sleep = (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    };
    const page = fakePage({
      issued: { interval: 3 },
      polls: [{ status: 200, body: { status: 'pending' } }, { status: 429, body: { status: 'slow_down', interval: 5 } }, { status: 200, body: { status: 'pending' } }, { status: 200, body: { status: 'approved', code: 'c' } }],
    });
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch, sleep });
    await device.poll();
    expect(waits).toEqual([3000, 3000, 5000, 5000]);
  });

  it('adds 2 seconds on a slow_down that names no interval', async () => {
    const waits: number[] = [];
    const sleep = (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    };
    const page = fakePage({ issued: { interval: 3 }, polls: [{ status: 429, body: { status: 'slow_down' } }, { status: 200, body: { status: 'approved', code: 'c' } }] });
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch, sleep });
    await device.poll();
    expect(waits).toEqual([3000, 5000]);
  });

  it('ends denied, expired or unreachable as the page answers, reading the body and not the HTTP status', async () => {
    const cases: [({ status: number; body: unknown } | 'unreachable')[], string][] = [
      [[{ status: 403, body: { status: 'denied' } }], 'denied'],
      [[{ status: 200, body: { status: 'denied' } }], 'denied'],
      [[{ status: 410, body: { status: 'expired' } }], 'expired'],
      [[{ status: 200, body: { status: 'expired' } }], 'expired'],
      [['unreachable'], 'unreachable'],
      [[{ status: 500, body: { error: 'the store failed' } }], 'unreachable'],
      [[{ status: 200, body: { status: 'approved' } }], 'unreachable'],
      [[{ status: 200, body: { status: 'later' } }], 'unreachable'],
      [[{ status: 200, body: 'pending' }], 'unreachable'],
    ];
    for (const [polls, reason] of cases) {
      const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: fakePage({ polls }).fetch });
      expect(await reasonOf(device.poll()), JSON.stringify(polls)).toBe(reason);
    }
  });

  it('ends expired once the request\'s own wait has passed', async () => {
    let now = 0;
    const sleep = (ms: number) => {
      now += ms;
      return Promise.resolve();
    };
    const page = fakePage({ issued: { interval: 3, expires_in: 10 } });
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch, sleep, now: () => now });
    expect(await reasonOf(device.poll())).toBe('expired');
    expect(page.polls()).toHaveLength(3);
  });

  it('stops polling once closed, and ends closed', async () => {
    const page = fakePage();
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch });
    const waiting = device.poll();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await device.close();
    expect(await reasonOf(waiting)).toBe('closed');
    const polled = page.polls().length;
    expect(polled).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(page.polls()).toHaveLength(polled);
  });

  it('wakes from its wait when closed, without waiting the interval out', async () => {
    const page = fakePage({ issued: { interval: 60 } });
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch });
    const waiting = device.poll();
    const started = Date.now();
    await device.close();
    expect(await reasonOf(waiting)).toBe('closed');
    expect(Date.now() - started).toBeLessThan(1000);
    expect(page.polls()).toEqual([]);
  });

  it('ends closed when closed before it polled', async () => {
    const page = fakePage();
    const device = await startDevice({ askUrl: ASK_URL, purpose: 'signin', fetch: page.fetch });
    await device.close();
    expect(await reasonOf(device.poll())).toBe('closed');
    expect(page.polls()).toEqual([]);
  });
});
