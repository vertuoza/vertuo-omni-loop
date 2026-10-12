// `omni idea add` and `omni idea list` (PRD 1246, s2), through `main()` on a fixture repository, the
// ideas port faked: a stubbed fetch that follows the contract (`POST /api/ideas`, `GET /api/ideas?repo=`).
// The sign-in is an in-memory token store and the environment is passed in, so nothing real is read or
// written.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { makeRepo, type FetchInit } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const BOARD = `${BASE}/ideas/acme/widgets`;

const config = ({ url = BASE, enabled = true }: { url?: string | null | undefined; enabled?: boolean | undefined } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\ndossier:\n  enabled: ${enabled}\n`;

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

type Call = { url: string; method: string | undefined; body: unknown };

/** The ideas port, faked: every call answered by `reply`, and kept. */
function fakeIdeas(reply: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetch = (url: string, init: FetchInit) => {
    const call: Call = { url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body) as unknown };
    calls.push(call);
    return new Promise<Response>((resolve) => { resolve(reply(call)); });
  };
  return { calls, fetch };
}
const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const down = (): Response => { throw new TypeError('fetch failed'); };

async function omni(args: string[], { fetch, tokens = signedIn(), url, enabled }: {
  fetch: unknown; tokens?: ReturnType<typeof memoryTokens>; url?: string | null; enabled?: boolean;
}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ url, enabled }) } });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['idea', ...args], {
    cwd: root, tokens, env: {}, fetch,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

const IDEAS = [
  { id: '00000000-0000-4000-8000-000000000001', title: 'Improve the HUD', pitch: 'More facts.', lane: 'now', prd: 1210, votes: 4 },
  { id: '00000000-0000-4000-8000-000000000002', title: 'Better GitHub sync', pitch: 'Fewer calls.', lane: 'later', prd: null, votes: 0 },
];

describe('omni idea add', () => {
  it('sends the idea for this repository, in later when no lane is given, and prints its board link', async () => {
    const { calls, fetch } = fakeIdeas(() => json(201, { id: 'idea-1', url: BOARD }));
    expect(await omni(['add', 'Improve the HUD', '--pitch', 'More useful facts.'], { fetch })).toEqual({ code: 0, out: `${BOARD}\n`, err: '' });
    expect(calls).toEqual([{
      url: `${BASE}/api/ideas`, method: 'POST',
      body: { repo: 'acme/widgets', title: 'Improve the HUD', pitch: 'More useful facts.', lane: 'later' },
    }]);
  });

  it('sends the lane given', async () => {
    const { calls, fetch } = fakeIdeas(() => json(201, { id: 'idea-1', url: BOARD }));
    expect((await omni(['add', 'A', '--pitch', 'B', '--lane', 'now'], { fetch })).code).toBe(0);
    expect(calls[0]?.body).toMatchObject({ lane: 'now' });
  });

  it('exits 2 on a bad lane, a title over 120 characters or a pitch over 600, sending nothing', async () => {
    const { calls, fetch } = fakeIdeas(() => json(201, { id: 'idea-1', url: BOARD }));
    const lane = await omni(['add', 'A', '--pitch', 'B', '--lane', 'soon'], { fetch });
    expect(lane).toEqual({ code: 2, out: '', err: 'omni idea add: --lane is now, next or later, not "soon".\n' });
    expect((await omni(['add', 'x'.repeat(121), '--pitch', 'B'], { fetch })).code).toBe(2);
    expect((await omni(['add', 'A', '--pitch', 'y'.repeat(601)], { fetch })).code).toBe(2);
    expect((await omni(['add', 'A'], { fetch })).code).toBe(2);
    expect((await omni(['add', '--pitch', 'B'], { fetch })).code).toBe(2);
    expect(calls).toEqual([]);
  });

  it('no sign-in: one line, exit 0, nothing sent', async () => {
    const { calls, fetch } = fakeIdeas(() => json(201));
    expect(await omni(['add', 'A', '--pitch', 'B'], { fetch, tokens: memoryTokens() })).toEqual({ code: 0, out: '', err: 'no sign-in (omni signin)\n' });
    expect(calls).toEqual([]);
  });

  it('unreachable: one line, exit 0', async () => {
    const { fetch } = fakeIdeas(down);
    expect(await omni(['add', 'A', '--pitch', 'B'], { fetch })).toEqual({ code: 0, out: '', err: 'unreachable\n' });
  });

  it('refused: one line with the app\'s reason, exit 0', async () => {
    const { fetch } = fakeIdeas(() => json(403, { error: 'you are not a member of a workspace that lists acme/widgets' }));
    expect(await omni(['add', 'A', '--pitch', 'B'], { fetch })).toEqual({
      code: 0, out: '', err: 'refused (403): you are not a member of a workspace that lists acme/widgets\n',
    });
    const other = fakeIdeas(() => json(500));
    expect(await omni(['add', 'A', '--pitch', 'B'], { fetch: other.fetch })).toEqual({ code: 0, out: '', err: 'refused (500)\n' });
  });

  it('dossiers off here: one line, exit 0, nothing sent', async () => {
    const { calls, fetch } = fakeIdeas(() => json(201));
    const { code, err } = await omni(['add', 'A', '--pitch', 'B'], { fetch, enabled: false });
    expect(code).toBe(0);
    expect(err).toMatch(/^off \(.+\)\n$/);
    expect(calls).toEqual([]);
  });
});

describe('omni idea list', () => {
  it('asks for this repository\'s board and prints it lane by lane with the votes', async () => {
    const { calls, fetch } = fakeIdeas(() => json(200, { repo: 'acme/widgets', url: BOARD, ideas: IDEAS }));
    const { code, out, err } = await omni(['list'], { fetch });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(out).toBe([
      `acme/widgets — ${BOARD}`, 'Now', '  ▲ 4  Improve the HUD · PRD #1210', 'Next', '  (none)', 'Later', '  ▲ 0  Better GitHub sync', '',
    ].join('\n'));
    expect(calls).toEqual([{ url: `${BASE}/api/ideas?repo=acme%2Fwidgets`, method: 'GET', body: undefined }]);
  });

  it('--json prints the board as JSON, its lanes in order', async () => {
    const { fetch } = fakeIdeas(() => json(200, { repo: 'acme/widgets', url: BOARD, ideas: IDEAS }));
    const { code, out } = await omni(['list', '--json'], { fetch });
    expect(code).toBe(0);
    const board: unknown = JSON.parse(out);
    expect(board).toMatchObject({
      repo: 'acme/widgets', url: BOARD,
      lanes: [{ lane: 'now', ideas: [{ title: 'Improve the HUD', votes: 4 }] }, { lane: 'next', ideas: [] }, { lane: 'later', ideas: [{ title: 'Better GitHub sync' }] }],
    });
  });

  it('no sign-in, unreachable, refused or a reply that is no board: one line, exit 0', async () => {
    expect(await omni(['list'], { fetch: fakeIdeas(() => json(200)).fetch, tokens: memoryTokens() })).toEqual({ code: 0, out: '', err: 'no sign-in (omni signin)\n' });
    expect(await omni(['list'], { fetch: fakeIdeas(down).fetch })).toEqual({ code: 0, out: '', err: 'unreachable\n' });
    expect(await omni(['list'], { fetch: fakeIdeas(() => json(403, { error: 'no board' })).fetch })).toEqual({ code: 0, out: '', err: 'refused (403): no board\n' });
    expect(await omni(['list'], { fetch: fakeIdeas(() => json(200, { nope: 1 })).fetch })).toEqual({ code: 0, out: '', err: 'refused (no board in the reply)\n' });
  });

  it('exits 2 on an argument it does not take', async () => {
    const { fetch } = fakeIdeas(() => json(200));
    expect((await omni(['list', 'extra'], { fetch })).code).toBe(2);
    expect((await omni(['remove'], { fetch })).code).toBe(2);
    expect((await omni([], { fetch })).code).toBe(2);
  });
});
