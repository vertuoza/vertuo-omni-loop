// The hourly health check (PRD 1723 s4): two probes 30 seconds apart before an app is down, one
// `Health: <app> is down` issue found by its title, a comment while it stays down, a comment and a
// close once it is back, no label, and exit 0 whatever it found. Everything runs on an injected
// fetch, `gh` runner and clock; nothing here calls GitHub or an app.
import { describe, expect, it } from 'vitest';
import { type Deps, parseArgs, probe, run } from './health-check.ts';

const URL_GALAXY = 'https://galaxy.example.test';
const HEALTH = `${URL_GALAXY}/api/health`;
const NOW = new Date('2026-10-12T14:23:00.000Z');

type Answer = { status: number; body: unknown } | 'hang' | 'throw';

const up: Answer = { status: 200, body: { ok: true, app: 'galaxy', commit: 'abc1234', checks: { env: 'ok', supabase: 'ok' } } };
const down503: Answer = { status: 503, body: { ok: false, app: 'galaxy', commit: 'abc1234', checks: { env: 'ok', supabase: 'failed' } } };
const notOk200: Answer = { status: 200, body: { ok: false, app: 'galaxy', commit: null, checks: { env: 'failed' } } };

/** A world of probes answered in order, open issues, and every `gh` call and wait recorded. */
function world(answers: Answer[], openIssues: { number: number; title: string }[] = []) {
  const probed: string[] = [];
  const ghCalls: string[][] = [];
  const waits: number[] = [];
  const deps: Deps = {
    fetch: (url) => {
      probed.push(url);
      const answer = answers.shift() ?? up;
      if (answer === 'hang') return new Promise<Response>(() => undefined);
      if (answer === 'throw') return Promise.reject(new Error('getaddrinfo ENOTFOUND'));
      return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'content-type': 'application/json' } }));
    },
    gh: (args) => {
      ghCalls.push(args);
      if (args.includes('--paginate')) return Promise.resolve(openIssues.map((open) => `${String(open.number)}\t${open.title}\n`).join(''));
      return Promise.resolve('');
    },
    now: () => NOW,
    // The 30 seconds between probes pass at once; the 10-second limit passes only after the stubbed
    // answer has had every chance to arrive.
    wait: (ms) => {
      waits.push(ms);
      return ms === 30_000 ? Promise.resolve() : new Promise((done) => setTimeout(done, 20));
    },
  };
  const writes = () => ghCalls.filter((args) => args.includes('-X'));
  return { deps, probed, ghCalls, waits, writes };
}

const options = { repo: 'acme/widgets', apps: [{ app: 'galaxy', url: URL_GALAXY }] };

/** The value of `-f <name>=` in one gh call. */
function field(args: string[], name: string): string | undefined {
  const at = args.findIndex((arg, k) => args[k - 1] === '-f' && arg.startsWith(`${name}=`));
  return at === -1 ? undefined : args[at]?.slice(name.length + 1);
}

describe('the arguments', () => {
  it('reads the repository and each app as <name>=<base URL>, trimming a trailing slash', () => {
    expect(parseArgs(['--repo', 'acme/widgets', '--app', 'galaxy=https://g.test/', '--app', 'omni-app=https://o.test'])).toEqual({
      repo: 'acme/widgets',
      apps: [
        { app: 'galaxy', url: 'https://g.test' },
        { app: 'omni-app', url: 'https://o.test' },
      ],
    });
  });

  it('refuses a missing repository, a repository not shaped <owner>/<repo>, an app without a URL, and no app', () => {
    expect(parseArgs(['--app', 'galaxy=https://g.test'])).toBeNull();
    expect(parseArgs(['--repo', 'widgets', '--app', 'galaxy=https://g.test'])).toBeNull();
    expect(parseArgs(['--repo', 'acme/widgets', '--app', 'galaxy'])).toBeNull();
    expect(parseArgs(['--repo', 'acme/widgets', '--app', 'galaxy=ftp://g.test'])).toBeNull();
    expect(parseArgs(['--repo', 'acme/widgets'])).toBeNull();
  });
});

describe('one probe', () => {
  it('is up on a 200 whose body says ok: true', async () => {
    const { deps } = world([up]);
    expect(await probe(HEALTH, deps)).toEqual({ up: true, status: 200, failedChecks: [], commit: 'abc1234' });
  });

  it('is down on a 503, naming the failed checks and the commit the body gave', async () => {
    const { deps } = world([down503]);
    expect(await probe(HEALTH, deps)).toEqual({ up: false, status: 503, failedChecks: ['supabase'], commit: 'abc1234' });
  });

  it('is down on a 200 whose ok is not true', async () => {
    const { deps } = world([notOk200]);
    expect(await probe(HEALTH, deps)).toEqual({ up: false, status: 200, failedChecks: ['env'], commit: null });
  });

  it('is down with no status when nothing answers within 10 seconds, or the request fails', async () => {
    const hung = world(['hang']);
    expect(await probe(HEALTH, hung.deps)).toEqual({ up: false, status: null, failedChecks: [], commit: null });
    expect(hung.waits).toEqual([10_000]);
    expect(await probe(HEALTH, world(['throw']).deps)).toEqual({ up: false, status: null, failedChecks: [], commit: null });
  });

  it('is down on a body that is not JSON', async () => {
    const { deps } = world([]);
    deps.fetch = () => Promise.resolve(new Response('<html>', { status: 200 }));
    expect(await probe(HEALTH, deps)).toMatchObject({ up: false, status: 200 });
  });
});

describe('the hourly run', () => {
  it('up, no issue open: probes /api/health once and writes nothing', async () => {
    const w = world([up]);
    expect(await run(options, w.deps)).toBe(0);
    expect(w.probed).toEqual([HEALTH]);
    expect(w.writes()).toEqual([]);
  });

  it('one failed probe then a good one: up, after waiting 30 seconds, and nothing written', async () => {
    const w = world([down503, up]);
    expect(await run(options, w.deps)).toBe(0);
    expect(w.probed).toEqual([HEALTH, HEALTH]);
    expect(w.waits).toContain(30_000);
    expect(w.writes()).toEqual([]);
  });

  it.each([
    ['a 503', down503],
    ['a body with ok: false', notOk200],
    ['no answer within 10 seconds', 'hang' as const],
  ])('two failed probes (%s), no issue: opens one issue titled Health: galaxy is down', async (_name, answer) => {
    const w = world([answer, answer]);
    expect(await run(options, w.deps)).toBe(0);
    const writes = w.writes();
    expect(writes).toHaveLength(1);
    const [open] = writes;
    expect(open?.slice(0, 4)).toEqual(['api', '-X', 'POST', 'repos/acme/widgets/issues']);
    expect(open && field(open, 'title')).toBe('Health: galaxy is down');
    expect(open && field(open, 'body')).toContain(NOW.toISOString());
  });

  it('writes the status, the failed checks and the commit into the new issue when the body gave them', async () => {
    const w = world([down503, down503]);
    await run(options, w.deps);
    const body = field(w.writes()[0] ?? [], 'body') ?? '';
    expect(body).toContain('503');
    expect(body).toContain('supabase');
    expect(body).toContain('abc1234');
    const hung = world(['hang', 'hang']);
    await run(options, hung.deps);
    expect(field(hung.writes()[0] ?? [], 'body')).toContain('no answer within 10 seconds');
  });

  it('down with the issue open: one comment on it, no new issue', async () => {
    const w = world([down503, down503], [{ number: 41, title: 'Something else' }, { number: 42, title: 'Health: galaxy is down' }]);
    expect(await run(options, w.deps)).toBe(0);
    const writes = w.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.slice(0, 4)).toEqual(['api', '-X', 'POST', 'repos/acme/widgets/issues/42/comments']);
  });

  it('finds its issue by the exact title among open issues only', async () => {
    const w = world([up]);
    await run(options, w.deps);
    const list = w.ghCalls.find((args) => args.includes('--paginate')) ?? [];
    expect(list.join(' ')).toContain('repos/acme/widgets/issues?state=open');
    const near = world([down503, down503], [{ number: 42, title: 'Health: galaxy is down again' }]);
    await run(options, near.deps);
    expect(near.writes()[0]?.[3]).toBe('repos/acme/widgets/issues');
  });

  it('up with the issue open: one comment naming the commit, then the issue closed', async () => {
    const w = world([up], [{ number: 42, title: 'Health: galaxy is down' }]);
    expect(await run(options, w.deps)).toBe(0);
    const writes = w.writes();
    expect(writes.map((args) => args.slice(0, 4))).toEqual([
      ['api', '-X', 'POST', 'repos/acme/widgets/issues/42/comments'],
      ['api', '-X', 'PATCH', 'repos/acme/widgets/issues/42'],
    ]);
    expect(field(writes[0] ?? [], 'body')).toContain('abc1234');
    expect(field(writes[1] ?? [], 'state')).toBe('closed');
  });

  it('passes no label in any call', async () => {
    const w = world([down503, down503]);
    await run(options, w.deps);
    const v = world([up], [{ number: 42, title: 'Health: galaxy is down' }]);
    await run(options, v.deps);
    for (const args of [...w.ghCalls, ...v.ghCalls]) expect(args.join(' ')).not.toMatch(/label/i);
  });

  it('checks each app on its own: one down, one up', async () => {
    const w = world([down503, down503, up]);
    const both = { repo: 'acme/widgets', apps: [{ app: 'galaxy', url: URL_GALAXY }, { app: 'omni-app', url: 'https://app.example.test' }] };
    expect(await run(both, w.deps)).toBe(0);
    expect(w.probed).toEqual([HEALTH, HEALTH, 'https://app.example.test/api/health']);
    expect(w.writes().map((args) => field(args, 'title'))).toEqual(['Health: galaxy is down']);
  });

  it('exits 0 whatever it found, and 1 only when gh could not write what it found', async () => {
    const w = world([down503, down503]);
    w.deps.gh = (args) => (args.includes('-X') ? Promise.reject(new Error('HTTP 403')) : Promise.resolve(''));
    expect(await run(options, w.deps)).toBe(1);
  });
});
