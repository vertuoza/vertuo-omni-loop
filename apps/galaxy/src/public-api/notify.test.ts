import { describe, expect, it } from 'vitest';
import type { Ping } from '../runners/runners.contract';
import { kindOfAddress, notifier, PING_TIMEOUT_MS, PING_TRIES, PING_WAITS_MS, type NotifyNet, type PingRequest } from './notify';

// The ping (PRD 2425 s8, spec §10), on a stubbed resolver, fetch, clock and timer: no test reaches the network.

const JOB = '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';
const URL_OK = 'https://hooks.example.com/ping/some-path?key=value';
const PUBLIC = '93.184.216.34';
const AT = '2026-10-23T09:00:00.000Z';
const ping = (event: Ping['event'] = 'status', url = URL_OK): Ping => ({ url, jobId: JOB, event, at: AT });

type Answer = number | Error | 'hang';

/** A world: what the resolver answers per host, what each post answers in turn, and everything the notifier did. */
function world({ hosts = { 'hooks.example.com': [PUBLIC] }, answers = [200] }: { hosts?: Record<string, string[] | Error>; answers?: Answer[] } = {}) {
  const resolved: string[] = [];
  const posts: PingRequest[] = [];
  const waits: number[] = [];
  const logs: string[] = [];
  const tasks: (() => Promise<void>)[] = [];
  const timers: { ms: number; fire: () => void; cancelled: boolean }[] = [];
  let hosting = hosts;
  const net: NotifyNet = {
    resolve: (host) => {
      resolved.push(host);
      const answer = hosting[host];
      if (answer === undefined) return Promise.reject(new Error('ENOTFOUND'));
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
    fetch: (request) => {
      posts.push(request);
      const answer = answers[posts.length - 1] ?? answers.at(-1) ?? 200;
      if (answer === 'hang') {
        return new Promise<number>((_, reject) => { request.signal.addEventListener('abort', () => { reject(new Error('aborted')); }); });
      }
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  const service = notifier({
    net,
    sleep: (ms) => { waits.push(ms); return Promise.resolve(); },
    timer: (ms, fire) => { const timer = { ms, fire, cancelled: false }; timers.push(timer); return () => { timer.cancelled = true; }; },
    log: (line) => logs.push(line),
    later: (task) => { tasks.push(task); },
  });
  /** Runs what the notifier left for after the response. */
  const flush = async () => { for (const task of tasks.splice(0)) await task(); };
  return { service, resolved, posts, waits, logs, tasks, timers, flush, rehost: (next: Record<string, string[] | Error>) => { hosting = next; } };
}

describe('the addresses a ping may reach', () => {
  it.each([
    ['93.184.216.34', 'public'], ['8.8.8.8', 'public'], ['2606:4700:4700::1111', 'public'], ['2001:4860:4860::8888', 'public'],
    // The edges of the ranges that are not public: the address on each side of one is.
    ['126.255.255.255', 'public'], ['128.0.0.0', 'public'], ['11.0.0.0', 'public'], ['172.15.255.255', 'public'], ['172.32.0.0', 'public'],
    ['100.63.255.255', 'public'], ['100.128.0.0', 'public'], ['169.253.255.255', 'public'], ['169.255.0.0', 'public'], ['198.17.255.255', 'public'], ['198.20.0.0', 'public'],
    ['223.255.255.255', 'public'], ['1.0.0.0', 'public'],
    ['127.0.0.1', 'loopback'], ['127.255.255.254', 'loopback'], ['::1', 'loopback'], ['::ffff:127.0.0.1', 'loopback'], ['::ffff:7f00:1', 'loopback'],
    ['10.0.0.5', 'private'], ['10.255.255.255', 'private'], ['172.16.0.1', 'private'], ['172.31.255.255', 'private'], ['192.168.1.1', 'private'], ['100.64.0.1', 'private'],
    ['100.127.255.255', 'private'], ['fd00::1', 'private'], ['fc00::', 'private'], ['::ffff:10.0.0.1', 'private'], ['fec0::1', 'private'],
    ['169.254.169.254', 'link-local'], ['169.254.0.0', 'link-local'], ['fe80::1', 'link-local'], ['fe80::1%eth0', 'link-local'], ['febf::1', 'link-local'],
    ['0.0.0.0', 'reserved'], ['0.255.255.255', 'reserved'], ['224.0.0.1', 'reserved'], ['239.255.255.255', 'reserved'], ['240.0.0.1', 'reserved'], ['255.255.255.255', 'reserved'],
    ['192.0.2.1', 'reserved'], ['198.51.100.7', 'reserved'], ['203.0.113.9', 'reserved'], ['198.18.0.1', 'reserved'], ['198.19.255.255', 'reserved'], ['192.0.0.1', 'reserved'],
    ['::', 'reserved'], ['ff02::1', 'reserved'], ['2001:db8::1', 'reserved'], ['2001::1', 'reserved'], ['2001:10::1', 'reserved'], ['3fff::1', 'reserved'], ['1::1', 'reserved'],
    ['::10.0.0.1', 'reserved'], ['100::1', 'reserved'],
    // An address that carries an IPv4 one is the IPv4 one's: NAT64 and 6to4.
    ['64:ff9b::7f00:1', 'loopback'], ['64:ff9b::a00:1', 'private'], ['64:ff9b::808:808', 'public'], ['64:ff9b:1::1', 'reserved'],
    ['2002:7f00:1::1', 'loopback'], ['2002:a9fe:a9fe::1', 'link-local'], ['2002:808:808::1', 'public'],
    // Anything that is no address is none to reach.
    ['not an address', 'reserved'], ['1.2.3', 'reserved'], ['999.1.1.1', 'reserved'], ['1.2.3.4.5', 'reserved'], ['01.2.3.4', 'reserved'], ['1:2:3', 'reserved'],
    ['::1::2', 'reserved'], ['12345::1', 'reserved'], ['1.2.3.4:80', 'reserved'], ['', 'reserved'], ['g::1', 'reserved'], [':1:2:3:4:5:6:7:8', 'reserved'],
  ])('reads %s as %s', (address, kind) => {
    expect(kindOfAddress(address)).toBe(kind);
  });
});

describe('the link a job may be pinged at', () => {
  it('takes an https link on a host that resolves to public addresses only, and resolves it once', async () => {
    const w = world({ hosts: { 'hooks.example.com': [PUBLIC, '2606:4700:4700::1111'] } });
    expect(await w.service.check(URL_OK)).toBeNull();
    expect(w.resolved).toEqual(['hooks.example.com']);
  });

  it.each([
    ['a loopback', '127.0.0.1'], ['a private', '10.1.2.3'], ['a private', '192.168.0.9'], ['a link-local', '169.254.169.254'], ['a loopback', '::1'], ['a link-local', 'fe80::2'],
    ['a private', 'fd12:3456::1'],
  ])('refuses a host that resolves to %s address (%s), naming the host and the kind', async (kind, address) => {
    const w = world({ hosts: { 'hooks.example.com': [address] } });
    const why = await w.service.check(URL_OK);
    expect(why).toContain('hooks.example.com');
    expect(why).toContain(kind);
  });

  it('refuses a host with one address that is not public among public ones: the connection may take any', async () => {
    const w = world({ hosts: { 'hooks.example.com': [PUBLIC, '10.0.0.7'] } });
    expect(await w.service.check(URL_OK)).toContain('private');
  });

  it('refuses a host that does not resolve, that resolves to nothing, and a resolver that fails', async () => {
    const w = world({ hosts: { 'gone.example.com': [], 'down.example.com': new Error('SERVFAIL') } });
    for (const host of ['gone.example.com', 'down.example.com', 'unknown.example.com']) {
      expect(await w.service.check(`https://${host}/ping`), host).toContain(`${host} does not resolve`);
    }
  });

  it.each([
    'https://127.0.0.1/ping', 'https://10.0.0.1/ping', 'https://169.254.169.254/latest/meta-data', 'https://192.168.1.1:8443/ping', 'https://[::1]/ping',
    'https://[fe80::1]/ping', 'https://[fd00::1]/ping', 'https://[::ffff:127.0.0.1]/ping', 'https://0.0.0.0/ping',
    // The URL parser reads these as the loopback address they are.
    'https://2130706433/ping', 'https://0x7f.0.0.1/ping', 'https://127.1/ping', 'https://0177.0.0.1/ping',
  ])('refuses the address %s itself, with no lookup', async (link) => {
    const w = world();
    expect(await w.service.check(link)).toMatch(/not public|loopback|private|link-local|reserved/);
    expect(w.resolved).toEqual([]);
  });

  it('takes a public address itself, with no lookup', async () => {
    const w = world();
    expect(await w.service.check('https://93.184.216.34/ping')).toBeNull();
    expect(await w.service.check('https://[2606:4700:4700::1111]:8443/ping')).toBeNull();
    expect(w.resolved).toEqual([]);
  });

  it('refuses a link that is not https, carries a user name or a password, or is no link', async () => {
    const w = world();
    expect(await w.service.check('http://hooks.example.com/ping')).toContain('https');
    // Built here, so no `user:password@host` stands in the source.
    expect(await w.service.check(`https://${'user'}:${'pw'}@hooks.example.com/ping`)).toContain('user name');
    expect(await w.service.check(`https://${'user'}@hooks.example.com/ping`)).toContain('user name');
    expect(await w.service.check('not a link')).toContain('link');
    expect(w.resolved).toEqual([]);
  });
});

describe('a ping', () => {
  it('is sent after the response, not before: the notifier only hands its work over', () => {
    const w = world();
    w.service.ping(ping());
    expect(w.posts).toEqual([]);
    expect(w.tasks).toHaveLength(1);
  });

  it.each(['status', 'outcome', 'questions'] as const)('posts {job_id, event, at} and nothing else for the event %s, to the address the host resolved to', async (event) => {
    const w = world();
    w.service.ping(ping(event));
    await w.flush();
    expect(w.posts).toHaveLength(1);
    const [post] = w.posts;
    expect(post).toMatchObject({ url: URL_OK, address: PUBLIC });
    expect(post?.body).toBe(JSON.stringify({ job_id: JOB, event, at: AT }));
    expect(Object.keys(JSON.parse(post?.body ?? '{}') as object)).toEqual(['job_id', 'event', 'at']);
    expect(w.waits).toEqual([]);
    expect(w.logs).toEqual([]);
  });

  it('takes any 2xx answer as sent, and none else', async () => {
    for (const [status, sent] of [[200, true], [204, true], [299, true], [199, false], [300, false], [301, false], [404, false], [500, false]] as const) {
      const w = world({ answers: [status, status, status] });
      w.service.ping(ping());
      await w.flush();
      expect(w.posts, String(status)).toHaveLength(sent ? 1 : PING_TRIES);
    }
  });

  it('is tried again after a failure, waiting before each try: a first try that fails and a second that is taken are two posts and one wait', async () => {
    const w = world({ answers: [500, 200] });
    w.service.ping(ping());
    await w.flush();
    expect(w.posts).toHaveLength(2);
    expect(w.waits).toEqual([PING_WAITS_MS[0]]);
    expect(w.logs).toEqual([]);
  });

  it('is tried three times, then logged once and given up: a network error, a refusal or a 5xx each fail a try', async () => {
    const w = world({ answers: [new Error('ECONNRESET'), 503, 502, 200] });
    w.service.ping(ping('outcome'));
    await expect(w.flush()).resolves.toBeUndefined();
    expect(w.posts).toHaveLength(3);
    expect(w.waits).toEqual([...PING_WAITS_MS]);
    expect(w.logs).toHaveLength(1);
    expect(w.logs[0]).toContain(JOB);
    expect(w.logs[0]).toContain('outcome');
    expect(w.logs[0]).toContain('hooks.example.com');
  });

  it('never logs more of the link than its host: its path and query may carry a secret', async () => {
    const w = world({ answers: [500] });
    w.service.ping(ping('status', 'https://hooks.example.com/ping/hidden-segment?key=hidden-value'));
    await w.flush();
    expect(w.logs.join('\n')).not.toMatch(/hidden-segment|hidden-value|ping\//);
  });

  it('stays within about 30 seconds: three tries of at most 5 seconds and the waits between them', () => {
    expect(PING_TRIES).toBe(3);
    expect(PING_TIMEOUT_MS).toBe(5_000);
    expect(PING_TRIES * PING_TIMEOUT_MS + PING_WAITS_MS.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(30_000);
    expect(PING_WAITS_MS).toHaveLength(PING_TRIES - 1);
  });

  it('waits at most 5 seconds for an answer: a post that never answers is aborted when its timer fires, and the try fails', async () => {
    const w = world({ answers: ['hang', 200] });
    w.service.ping(ping());
    const done = w.flush();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(w.timers.map((timer) => timer.ms)).toEqual([PING_TIMEOUT_MS]);
    expect(w.posts[0]?.signal.aborted).toBe(false);
    w.timers[0]?.fire();
    await done;
    expect(w.posts[0]?.signal.aborted).toBe(true);
    expect(w.posts).toHaveLength(2);
    expect(w.waits).toEqual([PING_WAITS_MS[0]]);
  });

  it('cancels the timer of a post that answered, so none is left running', async () => {
    const w = world({ answers: [200] });
    w.service.ping(ping());
    await w.flush();
    expect(w.timers.map((timer) => timer.cancelled)).toEqual([true]);
  });

  it('checks the host again before every try, and gives up on one that is no longer public: nothing is posted to it', async () => {
    const w = world({ answers: [500, 200] });
    w.service.ping(ping());
    const first = w.tasks.splice(0)[0];
    // The host answers a private address from the second try on (a name pointed at the inside after the job was sent).
    const done = first?.();
    await Promise.resolve();
    w.rehost({ 'hooks.example.com': ['10.0.0.9'] });
    await done;
    expect(w.resolved.length).toBeGreaterThanOrEqual(2);
    expect(w.posts).toHaveLength(1);
    expect(w.logs).toHaveLength(1);
    expect(w.logs[0]).toContain('private');
    expect(w.logs[0]).toContain(JOB);
  });

  it('resolves the host before each of its tries, and posts each to the address it just resolved', async () => {
    const w = world({ answers: [500, 500, 200] });
    w.service.ping(ping());
    await w.flush();
    expect(w.resolved).toEqual(['hooks.example.com', 'hooks.example.com', 'hooks.example.com']);
    expect(w.posts.map((post) => post.address)).toEqual([PUBLIC, PUBLIC, PUBLIC]);
  });

  it('refuses a link that is not public before posting a byte, and logs it', async () => {
    const w = world({ hosts: { 'hooks.example.com': ['127.0.0.1'] } });
    w.service.ping(ping());
    await w.flush();
    expect(w.posts).toEqual([]);
    expect(w.waits).toEqual([]);
    expect(w.logs).toHaveLength(1);
    expect(w.logs[0]).toContain('loopback');
    const literal = world();
    literal.service.ping(ping('status', 'https://169.254.169.254/latest'));
    await literal.flush();
    expect(literal.posts).toEqual([]);
    expect(literal.logs).toHaveLength(1);
  });

  it('treats a resolver that fails at ping time as a failed try, to try again, not a refusal', async () => {
    const w = world({ hosts: { 'hooks.example.com': new Error('SERVFAIL') } });
    w.service.ping(ping());
    await w.flush();
    expect(w.posts).toEqual([]);
    expect(w.resolved).toHaveLength(PING_TRIES);
    expect(w.waits).toEqual([...PING_WAITS_MS]);
    expect(w.logs).toHaveLength(1);
  });

  it('never fails the change: a work handed over that throws, and a hand-over that throws, are logged', async () => {
    const logs: string[] = [];
    const net: NotifyNet = { resolve: () => Promise.reject(new Error('boom')), fetch: () => Promise.reject(new Error('boom')) };
    const never = (): void => { throw new Error('later is unavailable'); };
    const broken = notifier({ net, sleep: () => Promise.resolve(), timer: () => () => {}, log: (line) => logs.push(line), later: never });
    expect(() => { broken.ping(ping()); }).not.toThrow();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('later is unavailable');
    expect(logs[0]).toContain(JOB);
    // A link out of shape (which the database's check never lets in) is logged, not thrown.
    const w = world();
    w.service.ping(ping('status', 'not a link'));
    await expect(w.flush()).resolves.toBeUndefined();
    expect(w.posts).toEqual([]);
    expect(w.logs).toHaveLength(1);
  });
});
