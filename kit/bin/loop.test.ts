// PRD 1139, slice s4: `omni loop push <start|tick|park|stop>` and `omni loop status`, through `main()`
// on a fixture repository, against a stubbed fetch that answers as `POST /api/loops` does. The sign-in
// is an in-memory token store and the clock is passed in, so nothing real is read or written. The
// bodies are checked against the app's own contract by apps/galaxy/src/loop/kit-push.test.ts.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { CALL_TIMEOUT_MS } from '../lib/ask/client.ts';
import { parsePrd, parseWorkSliceId } from '../lib/ids.ts';
import { LOOP_FILE, readLocalLoop, SILENT_AFTER_MS } from '../lib/loop/local.ts';
import type { LoopPlan } from '../lib/next/plan.ts';
import { readLoopPlans, writeLoopPlans } from '../lib/next/store.ts';
import { makeRepo } from '../test/fixture.ts';
import type { FetchInit } from '../test/fixture.ts';
import { main } from './omni.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const LOOP_ID = '00000000-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-10-07T10:00:00Z');

const config = (url: string | null = BASE) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\n`;

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

type Call = { url: string; method: string | undefined; authorization: string | undefined; body: unknown };

/** A fetch that answers every call with `reply(url, init, body)` and keeps each call with its body. */
function stubFetch(reply: (url: string, init: FetchInit, body: unknown) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = (url: string, init: FetchInit) => {
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method, authorization: init.headers.authorization, body });
    return new Promise<Response>((resolve) => {
      resolve(reply(url, init, body));
    });
  };
  return { calls, fetch };
}
const json = (status: number, body = {}) => new Response(JSON.stringify(body), { status });
const down = () => { throw new TypeError('fetch failed'); };

/** The app's answer to a push: 201 for a start, 200 otherwise, the loop running on `version`. */
const answers = (version = 1) => (_url: string, _init: FetchInit, body: unknown) => {
  const event = typeof body === 'object' && body !== null && 'event' in body ? body.event : null;
  if (event === 'stop') return json(200, { loopId: LOOP_ID, state: 'stopped', planVersion: version });
  return json(event === 'start' ? 201 : 200, { loopId: LOOP_ID, state: 'running', planVersion: version });
};

const prd = (n: number) => parsePrd(n);
const slice = (id: string) => parseWorkSliceId(id);

/** The loop plan `omni next --plan` keeps: two PRDs, two steps, side by side. */
function plan(version = 1, reason: string | null = null): LoopPlan {
  return {
    version, reason, prds: [prd(7), prd(9)],
    steps: [
      { step: 1, prd: prd(7), kind: 'wave', wave: 1, slices: [slice('s1')], after: [], waitsFor: [], why: [], beside: [2] },
      { step: 2, prd: prd(9), kind: 'wave', wave: 1, slices: [slice('s1')], after: [], waitsFor: [], why: [], beside: [1] },
    ],
    seen: [{ prd: prd(7), slices: [slice('s1')], stuck: [], ended: null }, { prd: prd(9), slices: [slice('s1')], stuck: [], ended: null }],
  };
}

function checkout({ url = BASE, plans = [plan()] }: { url?: string | null; plans?: LoopPlan[] } = {}) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url) } });
  if (plans.length) writeLoopPlans(repo.root, plans);
  return repo;
}

type Run = { root: string; fetch: unknown; tokens?: ReturnType<typeof memoryTokens> | undefined; now?: number; callMs?: number };

async function omni(args: string[], { root, fetch, tokens = signedIn(), now = NOW, callMs }: Run) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['loop', ...args], {
    cwd: root, tokens, env: {}, fetch, now: () => now, ...(callMs ? { callMs } : {}),
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

const TICK = ['tick', '--step', '1', '--prd', '7', '--action', 'wave', '--result', 'wave 1 merged: s1', '--link', `${BASE}/prd/7`, '--merged', '21,22', '--items', 's1-01-list', '--wake-in', '90'];

describe('omni loop push: each event sends the body the app takes', () => {
  it('start sends the repository, the plan\'s PRDs and the kept plan whole, and keeps the loop\'s id', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    expect(await omni(['push', 'start'], { root, fetch })).toEqual({ code: 0, out: `start: ${LOOP_ID} running · plan v1\n`, err: '' });
    expect(calls).toEqual([{
      url: `${BASE}/api/loops`, method: 'POST', authorization: 'Bearer access-1',
      body: { event: 'start', repo: 'acme/widgets', prds: [7, 9], plan: readLoopPlans(root).at(-1), takeOver: false },
    }]);
    expect(readLocalLoop(root)).toEqual({
      loopId: LOOP_ID, repo: 'acme/widgets', prds: [7, 9], state: 'running', startedAt: new Date(NOW).toISOString(),
      seenAt: new Date(NOW).toISOString(), nextWakeAt: null, planVersion: 1,
    });
  });

  it('tick sends the step, the plan\'s length, the PRD, the action, the result, the links and the next wake', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    expect(await omni(['push', ...TICK], { root, fetch, now: NOW + 1000 })).toEqual({ code: 0, out: `tick: ${LOOP_ID} running · step 1/2 · plan v1\n`, err: '' });
    expect(calls.at(-1)?.body).toEqual({
      event: 'tick', loopId: LOOP_ID, step: 1, steps: 2, prd: 7, action: 'wave', result: 'wave 1 merged: s1',
      link: `${BASE}/prd/7`, merged: [21, 22], items: ['s1-01-list'], nextWakeAt: new Date(NOW + 1000 + 90_000).toISOString(),
    });
    expect(readLocalLoop(root)).toMatchObject({ seenAt: new Date(NOW + 1000).toISOString(), nextWakeAt: new Date(NOW + 91_000).toISOString() });
  });

  it('a tick with nothing optional sends null and empty lists, and a long result on one line, cut to 300', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    await omni(['push', 'tick', '--step', '2', '--steps', '5', '--prd', '9', '--action', 'wait', '--result', `ci\nrunning ${'x'.repeat(400)}`], { root, fetch });
    expect(calls.at(-1)?.body).toEqual({
      event: 'tick', loopId: LOOP_ID, step: 2, steps: 5, prd: 9, action: 'wait', result: `ci running ${'x'.repeat(289)}`,
      link: null, merged: [], items: [], nextWakeAt: null,
    });
  });

  it('a tick after omni next wrote a new plan version sends it as the replan, with its reason, once', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    writeLoopPlans(root, [plan(), plan(2, 'replanned v2: s1 of PRD 7 stuck → 9 moves up')]);
    const replanned = stubFetch(answers(2));
    expect((await omni(['push', ...TICK], { root, fetch: replanned.fetch })).out).toBe(`tick: ${LOOP_ID} running · step 1/2 · plan v2\n`);
    expect(replanned.calls.at(-1)?.body).toMatchObject({ replan: { reason: 'replanned v2: s1 of PRD 7 stuck → 9 moves up', plan: readLoopPlans(root).at(-1) } });
    expect(readLocalLoop(root)?.planVersion).toBe(2);
    await omni(['push', ...TICK], { root, fetch: replanned.fetch });
    expect(replanned.calls.at(-1)?.body).not.toHaveProperty('replan');
    expect(calls).toHaveLength(1);
  });

  it('park sends the PRD, who and what, and the link; stop sends the loop alone and keeps how it ended', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    expect((await omni(['push', 'park', '--prd', '7', '--who', 'the PM', '--what', 'two outbox questions', '--link', 'https://github.com/acme/widgets/pull/9'], { root, fetch })).code).toBe(0);
    expect(calls.at(-1)?.body).toEqual({ event: 'park', loopId: LOOP_ID, prd: 7, who: 'the PM', what: 'two outbox questions', link: 'https://github.com/acme/widgets/pull/9' });
    expect(await omni(['push', 'stop'], { root, fetch })).toEqual({ code: 0, out: `stop: ${LOOP_ID} stopped · plan v1\n`, err: '' });
    expect(calls.at(-1)?.body).toEqual({ event: 'stop', loopId: LOOP_ID });
    expect(readLocalLoop(root)).toMatchObject({ state: 'stopped', nextWakeAt: null });
  });
});

describe('omni loop push never blocks: one line, exit 1', () => {
  it('off when the config names no Omni page, and nothing is sent', async () => {
    const { root } = checkout({ url: null });
    const { calls, fetch } = stubFetch(answers());
    expect(await omni(['push', 'start'], { root, fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
    expect(calls).toEqual([]);
  });

  it('no sign-in (omni signin) when this computer is not signed in', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    expect(await omni(['push', 'start'], { root, fetch, tokens: memoryTokens() })).toEqual({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    expect(calls).toEqual([]);
  });

  it('unreachable when the app cannot be reached, and no loop is kept', async () => {
    const { root } = checkout();
    const { fetch } = stubFetch(down);
    expect(await omni(['push', 'start'], { root, fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    expect(readLocalLoop(root)).toBeNull();
  });

  it('refused (<status>) when the app refuses, with its reason when it gives one', async () => {
    const { root } = checkout();
    expect(await omni(['push', 'start'], { root, fetch: stubFetch(() => json(500)).fetch })).toEqual({ code: 1, out: '', err: 'refused (500)\n' });
    const busy = stubFetch(() => json(409, { error: `A loop already runs on acme/widgets: ${LOOP_ID}. Stop it first.` })).fetch;
    expect(await omni(['push', 'start'], { root, fetch: busy })).toEqual({ code: 1, out: '', err: `refused (409): A loop already runs on acme/widgets: ${LOOP_ID}. Stop it first.\n` });
  });

  it('refreshes the sign-in once on a 401, keeps the new tokens and sends again', async () => {
    const { root } = checkout();
    const tokens = signedIn();
    const { calls, fetch } = stubFetch((url, init, body) => {
      if (url.endsWith('/api/ask/token')) return json(200, { access_token: 'access-2', refresh_token: 'refresh-2' });
      return init.headers.authorization === 'Bearer access-2' ? answers()(url, init, body) : json(401);
    });
    expect((await omni(['push', 'start'], { root, fetch, tokens })).code).toBe(0);
    expect(calls.map((c) => [c.url, c.authorization])).toEqual([
      [`${BASE}/api/loops`, 'Bearer access-1'], [`${BASE}/api/ask/token`, undefined], [`${BASE}/api/loops`, 'Bearer access-2'],
    ]);
    expect(tokens.store[HOST]?.access_token).toBe('access-2');
  });

  it('a second 401 after the refresh is refused (401), not a second refresh', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch((url) => (url.endsWith('/api/ask/token') ? json(200, { access_token: 'access-2', refresh_token: 'refresh-2' }) : json(401)));
    expect(await omni(['push', 'start'], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (401)\n' });
    expect(calls.filter((c) => c.url.endsWith('/api/ask/token'))).toHaveLength(1);
  });

  it('gives up after the 5-second limit: a call that never answers is unreachable', async () => {
    expect(CALL_TIMEOUT_MS).toBe(5000);
    const { root } = checkout();
    const hang = (_url: string, init: FetchInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => { reject(new Error('timed out', { cause: init.signal?.reason })); });
    });
    const began = Date.now();
    expect(await omni(['push', 'start'], { root, fetch: hang })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    const took = Date.now() - began;
    expect(took).toBeGreaterThanOrEqual(4900);
    expect(took).toBeLessThan(60_000);
  });

  it('no loop plan: says how to make one, and sends nothing', async () => {
    const { root } = checkout({ plans: [] });
    const { calls, fetch } = stubFetch(answers());
    expect(await omni(['push', 'start'], { root, fetch })).toEqual({ code: 1, out: '', err: 'no loop plan (omni next --plan)\n' });
    expect(calls).toEqual([]);
  });

  it('a tick, park or stop with no loop started here: no loop (omni loop push start), and nothing is sent', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    for (const args of [TICK, ['stop'], ['park', '--prd', '7', '--who', 'the PM', '--what', 'x']]) {
      expect(await omni(['push', ...args], { root, fetch })).toEqual({ code: 1, out: '', err: 'no loop (omni loop push start)\n' });
    }
    expect(calls).toEqual([]);
  });

  it('a malformed flag is a usage error, exit 2, before anything is sent', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    for (const args of [
      ['tick', '--step', '1', '--prd', '7', '--action', 'Wave!', '--result', 'x'],
      ['tick', '--step', '3', '--steps', '2', '--prd', '7', '--action', 'wave', '--result', 'x'],
      ['tick', '--step', '1', '--prd', '7', '--action', 'wave', '--result', ' '],
      ['tick', '--step', '1', '--prd', '7', '--action', 'wave', '--result', 'x', '--link', 'not a link'],
      ['tick', '--step', '1', '--prd', '7', '--action', 'wave', '--result', 'x', '--items', 'nope'],
      ['tick', '--step', '1', '--prd', '7', '--action', 'wave', '--result', 'x', '--wake-in', '90', '--next-wake', '2026-10-07T10:00:00Z'],
      ['park', '--prd', '7', '--who', 'the PM'],
      ['launch'],
    ]) {
      expect((await omni(['push', ...args], { root, fetch })).code).toBe(2);
    }
    expect(calls).toHaveLength(1);
  });
});

describe('one live loop per checkout', () => {
  it('a second start while the loop is live prints the live loop and exits 1, sending nothing', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    const again = await omni(['push', 'start'], { root, fetch, now: NOW + 60_000 });
    expect(again).toEqual({ code: 1, out: '', err: `live: ${LOOP_ID} on acme/widgets, plan v1 — stop it first (omni loop push stop)\n` });
    expect(calls).toHaveLength(1);
  });

  it('--take-over is refused while the loop is live or sleeping', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    await omni(['push', ...TICK], { root, fetch });
    expect(await omni(['push', 'start', '--take-over'], { root, fetch, now: NOW + 30_000 })).toEqual({
      code: 1, out: '', err: `sleeping: ${LOOP_ID} on acme/widgets, plan v1 — stop it first (omni loop push stop)\n`,
    });
    expect(calls).toHaveLength(2);
  });

  it('a silent loop is named, and taken over only with --take-over', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    await omni(['push', ...TICK], { root, fetch });
    const silent = NOW + 90_000 + SILENT_AFTER_MS;
    expect(await omni(['push', 'start'], { root, fetch, now: silent })).toEqual({
      code: 1, out: '', err: `silent: ${LOOP_ID} on acme/widgets, plan v1 — take it over with --take-over\n`,
    });
    const next = '00000000-0000-4000-8000-000000000002';
    const taken = stubFetch(() => json(201, { loopId: next, state: 'running', planVersion: 1 }));
    expect(await omni(['push', 'start', '--take-over'], { root, fetch: taken.fetch, now: silent })).toEqual({ code: 0, out: `start: ${next} running · plan v1\n`, err: '' });
    expect(taken.calls[0]?.body).toMatchObject({ event: 'start', takeOver: true });
    expect(readLocalLoop(root)?.loopId).toBe(next);
    expect(calls).toHaveLength(2);
  });

  it('a loop that stopped makes way for a new start', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    await omni(['push', 'stop'], { root, fetch });
    expect((await omni(['push', 'start'], { root, fetch })).code).toBe(0);
    expect(calls.map((c) => (c.body as { event: string }).event)).toEqual(['start', 'stop', 'start']);
  });
});

describe('a loop resumed reads the same id and plan from this checkout', () => {
  it('omni loop status prints the loop, its state and its plan, from .omni-loop/local/ alone', async () => {
    const { root, read } = checkout();
    const { fetch } = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch });
    await omni(['push', ...TICK], { root, fetch });
    expect(read(LOOP_FILE)).toContain(LOOP_ID);
    const none = stubFetch(down);
    expect(await omni(['status'], { root, fetch: none.fetch, now: NOW + 30_000 })).toEqual({
      code: 0, out: `sleeping: ${LOOP_ID} on acme/widgets · PRDs 7, 9 · plan v1, 2 steps\n`, err: '',
    });
    const status = await omni(['status', '--json'], { root, fetch: none.fetch, now: NOW + 90_000 + SILENT_AFTER_MS });
    expect(JSON.parse(status.out)).toEqual({
      loop: { ...readLocalLoop(root), state: 'silent' },
      plan: readLoopPlans(root).at(-1),
    });
    expect(none.calls).toEqual([]);
  });

  it('a tick after a restart pushes to the same loop, with the same plan', async () => {
    const { root } = checkout();
    const first = stubFetch(answers());
    await omni(['push', 'start'], { root, fetch: first.fetch });
    const resumed = stubFetch(answers());
    await omni(['push', ...TICK], { root, fetch: resumed.fetch, now: NOW + 3 * 60 * 60 * 1000 });
    expect(resumed.calls[0]?.body).toMatchObject({ event: 'tick', loopId: LOOP_ID, steps: 2 });
    expect(resumed.calls[0]?.body).not.toHaveProperty('replan');
  });

  it('with no loop here, status prints none', async () => {
    const { root } = checkout();
    expect(await omni(['status'], { root, fetch: stubFetch(down).fetch })).toEqual({ code: 0, out: 'none\n', err: '' });
    expect(JSON.parse((await omni(['status', '--json'], { root, fetch: stubFetch(down).fetch })).out)).toEqual({ loop: null, plan: readLoopPlans(root).at(-1) });
  });
});
