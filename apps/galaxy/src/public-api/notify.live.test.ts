import type { RequestOptions } from 'node:https';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PingRequest } from './notify';
import { addressesOf, liveNotifier, pinnedOptions, pinnedPost, timerOf, type Find, type Send } from './notify.live';

const handedOver = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: handedOver }));

// The real network of the ping (PRD 2425 s8), on a stand-in for node's https.request, a stand-in resolver and fake timers:
// no test reaches the network. What it proves is the part `notify.test.ts` cannot see: the connection goes to the address
// that was checked, the certificate is still the link's own name's, and a failure says a code and never the link.

const PUBLIC = '93.184.216.34';
const BODY = '{"job_id":"0b4c1d2e","event":"status","at":"2026-10-23T09:00:00.000Z"}';
const request = (url: string, address = PUBLIC): PingRequest => ({ url, address, body: BODY, signal: new AbortController().signal });
const LINK = 'https://hooks.example.com/ping/some-path?key=value';

type Reply = { reply: (status: number | undefined) => void; fail: (error: Error) => void };

/** A stand-in for https.request: what it was given, and what it destroyed; `answer` says how the far end behaves. */
function wire(answer: (far: Reply) => void) {
  const seen = { options: [] as RequestOptions[], bodies: [] as string[], destroyed: [] as string[] };
  const send: Send = (options, onResponse) => {
    let onError: (error: Error) => void = () => undefined;
    seen.options.push(options);
    return {
      on: (_event, handler) => { onError = handler; },
      end: (body) => {
        seen.bodies.push(body);
        answer({
          reply: (status) => { onResponse({ statusCode: status, destroy: () => { seen.destroyed.push('response'); } }); },
          fail: (error) => { onError(error); },
        });
      },
      destroy: () => { seen.destroyed.push('request'); },
    };
  };
  return { send, seen };
}

afterEach(() => {
  vi.useRealTimers();
  handedOver.mockReset();
});

describe('the options of a post pinned to a checked address', () => {
  it('connects to the address, and keeps the link’s name for the certificate and the Host header', () => {
    const options = pinnedOptions(request(LINK));
    expect(options).toMatchObject({ method: 'POST', host: PUBLIC, port: 443, servername: 'hooks.example.com' });
    expect(options.headers).toMatchObject({ host: 'hooks.example.com' });
  });

  it('asks for the path and the query of the link, as the caller wrote them', () => {
    expect(pinnedOptions(request(LINK)).path).toBe('/ping/some-path?key=value');
    expect(pinnedOptions(request('https://hooks.example.com')).path).toBe('/');
  });

  it('keeps the port of the link, in the connection and in the Host header', () => {
    const options = pinnedOptions(request('https://hooks.example.com:8443/ping'));
    expect(options.port).toBe(8443);
    expect(options.headers).toMatchObject({ host: 'hooks.example.com:8443' });
  });

  it('sends the body as JSON, its length counted in bytes', () => {
    const options = pinnedOptions({ ...request(LINK), body: '{"é":1}' });
    expect(options.headers).toMatchObject({ 'content-type': 'application/json', 'content-length': 8 });
  });

  it('opens a connection of its own, so no earlier link’s address is reused', () => {
    expect(pinnedOptions(request(LINK)).agent).toBe(false);
  });

  it('is cut by the signal it was given', () => {
    const wanted = request(LINK);
    expect(pinnedOptions(wanted).signal).toBe(wanted.signal);
  });

  it.each([
    ['an address', 'https://93.184.216.34/ping', '93.184.216.34'],
    ['an IPv6 address', 'https://[2606:2800:220:1:248:1893:25c8:1946]/ping', '2606:2800:220:1:248:1893:25c8:1946'],
  ])('gives %s no server name, which an address cannot have', (_what, link, address) => {
    const options = pinnedOptions(request(link, address));
    expect(options).not.toHaveProperty('servername');
    expect(options.host).toBe(address);
  });
});

describe('one post', () => {
  it('answers the status code, after posting the body once', async () => {
    const { send, seen } = wire((far) => { far.reply(204); });
    await expect(pinnedPost(request(LINK), send)).resolves.toBe(204);
    expect(seen.bodies).toEqual([BODY]);
    expect(seen.options).toHaveLength(1);
  });

  it('answers a redirect as it is: it follows none', async () => {
    const { send, seen } = wire((far) => { far.reply(302); });
    await expect(pinnedPost(request(LINK), send)).resolves.toBe(302);
    expect(seen.options).toHaveLength(1);
  });

  it('drops the response and the connection once the status is read, whatever the far end goes on to send', async () => {
    const { send, seen } = wire((far) => { far.reply(200); });
    await pinnedPost(request(LINK), send);
    expect(seen.destroyed.sort()).toEqual(['request', 'response']);
  });

  it('answers 0 for a response that carries no status', async () => {
    const { send } = wire((far) => { far.reply(undefined); });
    await expect(pinnedPost(request(LINK), send)).resolves.toBe(0);
  });

  it('fails with the error’s code, and never with its message, which can carry the link', async () => {
    const refused = Object.assign(new Error(`connect ECONNREFUSED ${PUBLIC}:443 for ${LINK}`), { code: 'ECONNREFUSED' });
    const { send } = wire((far) => { far.fail(refused); });
    await expect(pinnedPost(request(LINK), send)).rejects.toThrow(/^ECONNREFUSED$/);
  });

  it('fails with the error’s name when it has no code (an aborted post)', async () => {
    const aborted = Object.assign(new Error(`The operation was aborted ${LINK}`), { name: 'AbortError' });
    const { send } = wire((far) => { far.fail(aborted); });
    await expect(pinnedPost(request(LINK), send)).rejects.toThrow(/^AbortError$/);
  });
});

describe('the addresses of a name', () => {
  it('asks the resolver for every address, as it answers them, and gives their addresses in that order', async () => {
    const find = vi.fn<Find>(() => Promise.resolve([{ address: '2606:2800:220:1:248:1893:25c8:1946' }, { address: PUBLIC }]));
    await expect(addressesOf('hooks.example.com', find)).resolves.toEqual(['2606:2800:220:1:248:1893:25c8:1946', PUBLIC]);
    expect(find).toHaveBeenCalledWith('hooks.example.com', { all: true, verbatim: true });
  });

  it('lets a failed lookup fail', async () => {
    const find = vi.fn<Find>(() => Promise.reject(new Error('ENOTFOUND')));
    await expect(addressesOf('nowhere.example.com', find)).rejects.toThrow('ENOTFOUND');
  });
});

describe('the timer', () => {
  it('fires once its time has passed', () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    timerOf(5_000, fire);
    vi.advanceTimersByTime(4_999);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('never fires once it is cancelled', () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    const cancel = timerOf(5_000, fire);
    cancel();
    vi.advanceTimersByTime(60_000);
    expect(fire).not.toHaveBeenCalled();
  });
});

describe('the live notifier', () => {
  it('hands a ping over to run after the response, and posts nothing meanwhile', () => {
    liveNotifier().ping({ url: LINK, jobId: '0b4c1d2e', event: 'status', at: '2026-10-23T09:00:00.000Z' });
    expect(handedOver).toHaveBeenCalledTimes(1);
    expect(handedOver).toHaveBeenCalledWith(expect.any(Function));
  });

  it('says why a link may not be pinged, without a lookup for a link that is no good', async () => {
    await expect(liveNotifier().check('http://hooks.example.com/ping')).resolves.toBe('must be an https link');
    await expect(liveNotifier().check('https://127.0.0.1/ping')).resolves.toBe('is a loopback address, not a public one');
  });
});
