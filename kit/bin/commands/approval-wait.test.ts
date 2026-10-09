// `omni wait approval <n>` (PRD 1322, s4), through `main()` on a fixture repository with the request
// route and the event stream stubbed: each line and exit code of the spec's §5 table, a cut stream
// resumed with `Last-Event-ID` and no event printed twice, held after three failed tries, an approval
// already in force asking nobody, and the waiting file the HUD reads.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';
import type { Tokens } from '../../lib/ask/schema.ts';

const HOST = 'omni.test';
const LINK = 'https://omni.test/prd/acme/widgets/1322';
const IN = '.omni-loop/delivery/inbox/1322-approval-handshake';
const SPEC = '---\nprd: 1322\ntitle: A\nblocked-by: none\nspec: file\nphase0: server\n---\n\n# A\n';
const ASKING = { asked: [{ login: 'irisa', name: 'Irisa' }, { login: 'paul', name: 'Paul' }], nobodyElse: false, author: 'ada', product: 'Mobile' };
const APPROVED = { approver: 'irisa', approvedAt: '2026-10-09T10:00:00Z', pinned: 3 };
const SHA_OLD = 'a'.repeat(64);
const SHA_NEW = 'b'.repeat(64);

const sse = (...events: string[]) => events.join('');
const event = (name: string, data: unknown, id?: number) => `event: ${name}\n${id === undefined ? '' : `id: ${id}\n`}data: ${JSON.stringify(data)}\n\n`;

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out: () => out.join(''), err: () => err.join(''), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const memoryTokens = (entries: Record<string, Tokens>) =>
  ({ read: (host: string) => entries[host] ?? null, write: (host: string, tokens: Tokens) => { entries[host] = tokens; } });

function checkout(url: string | null = 'https://omni.test') {
  return makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\n`, [`${IN}/spec.md`]: SPEC },
  }).root;
}

/** A stream's answer: its text, `fail` (unreachable), `open` (never ends) or a response. */
type Streamed = string | Response;

/** A request's JSON body, or null with none. */
function bodyOf(body: unknown): unknown {
  if (typeof body !== 'string') return null;
  const value: unknown = JSON.parse(body);
  return value;
}

const asResponse = (value: unknown): Response => (value instanceof Response ? value : Response.json(value));

/** A stream's answer as a response: `open` never ends; any other text is the whole stream. */
const streamed = (next: Streamed): Response =>
  next === 'open' ? new Response(new ReadableStream({ start() {} })) : typeof next === 'string' ? new Response(next) : next;

/** The page, stubbed: the approval in force, the request's replies and the stream's answers in turn. */
function server({ approval = null, requests = [ASKING], streams = [] }: { approval?: unknown; requests?: unknown[]; streams?: Streamed[] }) {
  const calls: { method: string; url: string; body: unknown; lastEventId: string | null }[] = [];
  const queue = [...streams];
  const replies = [...requests];
  const routes: Record<string, () => Response> = {
    '/api/ask/token': () => new Response('{}', { status: 401 }),
    '/api/dossiers/approval': () => Response.json({ url: LINK, approval }),
    '/api/dossiers/approval/request': () => asResponse(replies.length > 1 ? replies.shift() : replies[0]),
    '/api/dossiers/approval/stream': () => streamed(queue.shift() ?? 'open'),
  };
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ method: init.method ?? 'GET', url, body: bodyOf(init.body), lastEventId: new Headers(init.headers).get('last-event-id') });
    const path = new URL(url).pathname;
    if (queue[0] === 'fail' && path.endsWith('/stream')) {
      queue.shift();
      return Promise.reject(new TypeError('fetch failed'));
    }
    return Promise.resolve(routes[path]?.() ?? new Response('{}', { status: 404 }));
  };
  return { calls, fetch, streamCalls: () => calls.filter((call) => call.url.includes('/stream')) };
}

async function waitOf(root: string, fetch: unknown, { args = [], signedIn = true, deadline }: { args?: string[]; signedIn?: boolean; deadline?: (ms: number) => AbortSignal } = {}) {
  const s = io();
  const slept: number[] = [];
  const tokens = memoryTokens(signedIn ? { [HOST]: { access_token: 'a', refresh_token: 'r' } } : {});
  const code = await main(['wait', 'approval', '1322', ...args], {
    cwd: root, ...s, tokens, env: {}, fetch,
    sleep: (ms: number) => {
      slept.push(ms);
      return Promise.resolve();
    },
    now: () => new Date('2026-10-09T10:00:00Z'),
    deadline: deadline ?? (() => new AbortController().signal),
  });
  return { code, out: s.out(), err: s.err(), slept };
}

const waitingFile = (root: string): unknown => JSON.parse(readFileSync(join(root, '.omni-loop/local/approval-wait/1322.json'), 'utf8'));

describe('omni wait approval', () => {
  it('asks, prints the waiting line, then the approved line, and exits 0', async () => {
    const root = checkout();
    const page = server({ streams: [sse(event('asked', ASKING, 1), ': a comment\n\n', 'event: ping\n\n', event('approved', APPROVED, 2))] });
    const run = await waitOf(root, page.fetch);
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(run.out).toBe('◌ PRD 1322 · waiting for Irisa or Paul\n✓ PRD 1322 approved by irisa · 2026-10-09T10:00:00Z · 3 files pinned\n');
    const request = page.calls.find((call) => call.method === 'POST');
    expect(request).toMatchObject({ url: 'https://omni.test/api/dossiers/approval/request', body: { repo: 'acme/widgets', prd: 1322 } });
    expect(page.streamCalls()[0]).toMatchObject({ url: 'https://omni.test/api/dossiers/approval/stream?repo=acme%2Fwidgets&prd=1322', lastEventId: null });
    expect(waitingFile(root)).toEqual({
      prd: 1322, state: 'approved', line: '✓ PRD 1322 approved by irisa · 2026-10-09T10:00:00Z · 3 files pinned',
      waiting: '◌ PRD 1322 · waiting for Irisa or Paul', at: '2026-10-09T10:00:00.000Z',
    });
  });

  it('answers at once with an approval already in force, and asks nobody', async () => {
    const files = [{ kind: 'spec', path: `${IN}/spec.md`, sha256: (await import('node:crypto')).createHash('sha256').update(SPEC, 'utf8').digest('hex'), versionId: 'v1' }];
    const page = server({ approval: { approver: { login: 'paul', member: true }, approvedAt: '2026-10-09T09:00:00Z', files } });
    const run = await waitOf(checkout(), page.fetch);
    expect(run).toMatchObject({ code: 0, out: '✓ PRD 1322 approved by paul · 2026-10-09T09:00:00Z · 1 file pinned\n' });
    expect(page.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('names the author when nobody else approves, and counts past three names', async () => {
    const alone = { asked: [], nobodyElse: true, author: 'ada', product: 'Mobile' };
    const many = { ...ASKING, asked: ['a', 'b', 'c', 'd'].map((login) => ({ login })) };
    const first = await waitOf(checkout(), server({ requests: [alone], streams: [event('approved', APPROVED, 1)] }).fetch);
    expect(first.out.split('\n')[0]).toBe('◌ PRD 1322 · waiting for ada · Mobile has no other approver');
    const second = await waitOf(checkout(), server({ requests: [many], streams: [event('approved', APPROVED, 1)] }).fetch);
    expect(second.out.split('\n')[0]).toBe('◌ PRD 1322 · waiting for 4 members');
    const three = { ...ASKING, asked: ['a', 'b', 'c'].map((login) => ({ login, name: null })) };
    const third = await waitOf(checkout(), server({ requests: [three], streams: [event('approved', APPROVED, 1)] }).fetch);
    expect(third.out.split('\n')[0]).toBe('◌ PRD 1322 · waiting for a, b or c');
  });

  it('prints a void, asks again and keeps waiting', async () => {
    const page = server({
      requests: [ASKING, { ...ASKING, asked: [{ login: 'paul', name: 'Paul' }] }],
      streams: [sse(event('voided', { pusher: 'ada', kind: 'spec', from: SHA_OLD, to: SHA_NEW }, 1), event('re-asked', ASKING, 2), event('approved', APPROVED, 3))],
    });
    const run = await waitOf(checkout(), page.fetch);
    expect(run.code).toBe(0);
    expect(run.out.split('\n')).toEqual([
      '◌ PRD 1322 · waiting for Irisa or Paul',
      "✗ approval voided by ada's push aaaaaaa→bbbbbbb · asked again",
      '◌ PRD 1322 · waiting for Paul',
      '◌ PRD 1322 · waiting for Irisa or Paul',
      '✓ PRD 1322 approved by irisa · 2026-10-09T10:00:00Z · 3 files pinned',
      '',
    ]);
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(2);
  });

  it('resumes a cut stream with Last-Event-ID, printing no event twice', async () => {
    const voided = event('voided', { pusher: 'ada', kind: 'plan', from: SHA_OLD, to: SHA_NEW }, 7);
    const page = server({ streams: [sse(event('asked', ASKING, 6), voided), sse(voided, 'event: reconnect\ndata:\n\n'), sse(event('approved', APPROVED, 8))] });
    const run = await waitOf(checkout(), page.fetch);
    expect(run.code).toBe(0);
    expect(run.out.match(/voided/g)).toHaveLength(1);
    expect(page.streamCalls().map((call) => call.lastEventId)).toEqual([null, '7', '7']);
    expect(run.slept).toEqual([]);
  });

  it('prints the held line after three failed tries in a row, and keeps retrying', async () => {
    const page = server({ streams: ['fail', 'fail', 'fail', 'fail', event('approved', APPROVED, 1)] });
    const run = await waitOf(checkout(), page.fetch);
    expect(run.code).toBe(0);
    expect(run.out.split('\n')).toEqual([
      '◌ PRD 1322 · waiting for Irisa or Paul',
      'server unreachable · held, not failed',
      '◌ PRD 1322 · waiting for Irisa or Paul',
      '✓ PRD 1322 approved by irisa · 2026-10-09T10:00:00Z · 3 files pinned',
      '',
    ]);
    expect(run.slept).toEqual([1000, 2000, 5000, 10_000]);
  });

  it('counts a stream that closes saying nothing, or answers an error, as a failed try', async () => {
    const page = server({ streams: ['', new Response('{}', { status: 503 }), event('approved', APPROVED, 1)] });
    const run = await waitOf(checkout(), page.fetch);
    expect(run).toMatchObject({ code: 0, slept: [1000, 2000] });
  });

  it('holds with no sign-in, exits 1 and calls nothing', async () => {
    const page = server({});
    expect(await waitOf(checkout(), page.fetch, { signedIn: false })).toMatchObject({ code: 1, out: 'no sign-in (omni signin) · held\n' });
    expect(page.calls).toEqual([]);
  });

  it('holds signed out when the page refuses the sign-in', async () => {
    const root = checkout();
    const page = server({ requests: [new Response('{}', { status: 401 })] });
    const run = await waitOf(root, page.fetch);
    expect(run).toMatchObject({ code: 1, out: 'no sign-in (omni signin) · held\n' });
    expect(page.calls.map((call) => new URL(call.url).pathname)).toContain('/api/ask/token');
    expect(waitingFile(root)).toMatchObject({ state: 'signed-out', line: 'no sign-in (omni signin) · held', waiting: null });
  });

  it('says refused when the page answers the request with an error, or with no asking', async () => {
    const missing = await waitOf(checkout(), server({ requests: [new Response('{"error":"no dossier"}', { status: 404 })] }).fetch);
    expect(missing).toMatchObject({ code: 1, out: 'refused (404)\n' });
    const malformed = await waitOf(checkout(), server({ requests: [{ asked: 'nobody' }] }).fetch);
    expect(malformed).toMatchObject({ code: 1, out: 'refused (malformed reply)\n' });
    const stream = await waitOf(checkout(), server({ streams: [new Response('{}', { status: 403 })] }).fetch);
    expect(stream).toMatchObject({ code: 1, out: '◌ PRD 1322 · waiting for Irisa or Paul\nrefused (403)\n' });
  });

  it('holds past --timeout, naming who it waits for, and exits 1', async () => {
    const root = checkout();
    const clock = new AbortController();
    const asked: number[] = [];
    const page = server({});
    const fetch = (url: string, init: RequestInit) => {
      if (url.includes('/stream')) queueMicrotask(() => { clock.abort(); });
      return page.fetch(url, init);
    };
    const run = await waitOf(root, fetch, { args: ['--timeout', '5'], deadline: (ms) => { asked.push(ms); return clock.signal; } });
    expect(run).toMatchObject({ code: 1, out: '◌ PRD 1322 · waiting for Irisa or Paul\nheld: still waiting for Irisa or Paul after 5 min\n' });
    expect(asked).toEqual([300_000]);
    expect(waitingFile(root)).toMatchObject({ state: 'timeout', waiting: '◌ PRD 1322 · waiting for Irisa or Paul' });
  });

  it('holds with no Omni page set, and is a usage error without approval and one number', async () => {
    expect(await waitOf(checkout(null), server({}).fetch)).toMatchObject({ code: 1, out: 'no Omni page is set here (ask.url) · held\n' });
    const s = io();
    expect(await main(['wait', 'approval'], { cwd: checkout(), ...s, env: {} })).toBe(2);
    expect(await main(['wait', 'merge', '7'], { cwd: checkout(), ...s, env: {} })).toBe(2);
    expect(await main(['wait', 'approval', '1322', '--timeout', '0'], { cwd: checkout(), ...s, env: {} })).toBe(2);
  });

  it('says a PRD no folder holds is not there, and exits 1', async () => {
    const s = io();
    const code = await main(['wait', 'approval', '42'], { cwd: checkout(), ...s, env: {}, tokens: memoryTokens({}) });
    expect(code).toBe(1);
    expect(s.err()).toMatch(/PRD 42 is in neither/);
  });
});

describe('omni help', () => {
  it('explains wait, and approval points to it', async () => {
    const s = io();
    expect(await main(['help', 'approval'], { cwd: checkout(), ...s, env: {} })).toBe(0);
    expect(s.out()).toMatch(/omni\swait\sapproval\s<n>/);
    const t = io();
    expect(await main(['help', 'wait'], { cwd: checkout(), ...t, env: {} })).toBe(0);
    expect(t.out()).toMatch(/omni wait approval <n> \[--timeout <minutes>\]/);
  });
});
