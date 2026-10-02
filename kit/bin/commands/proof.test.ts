// `omni proof push <n> <dir>` (PRD 798), through `main()` on a fixture repository, against a stubbed fetch
// that follows the proof contract (`POST /api/proofs/uploads`, a PUT per signed link, `POST /api/proofs`).
// The sign-in is an in-memory token store, so nothing real is read or written.
import { existsSync, readFileSync, statSync, truncateSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { dig } from '../dig.ts';
import { main } from '../omni.ts';
import type { Tokens } from '../../lib/ask/schema.ts';
import type { FetchInit } from '../../test/fixture.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const TAB = `${BASE}/prd/0b7c-dossier-7?tab=proof`;
const RUN_ID = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';

const config = ({ enabled = true } = {}) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\ndossier:\n  enabled: ${enabled}\n`;

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

const RUN = {
  commit: 'abcdef1234',
  url: 'https://preview.example',
  criteria: [
    { text: 'The tab shows each clip.', verdict: 'pass', video: '1-tab.webm', script: '1-tab.spec.ts' },
    { text: 'The config key is read.', verdict: 'unfilmable', note: 'a config key' },
  ],
};
const RUN_FILES = { 'run.json': JSON.stringify(RUN), '1-tab.webm': 'webm', '1-tab.spec.ts': 'test()', 'preview.gif': 'GIF89a' };
const DIR = '.claude/worktrees/proof-7/r1';

/** A fixture checkout holding a run folder with `files` (run.json and the rest). */
function checkout({ enabled, files = RUN_FILES }: { enabled?: boolean; files?: Record<string, string> } = {}) {
  return makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': config({ enabled }), ...Object.fromEntries(Object.entries(files).map(([name, text]) => [`${DIR}/${name}`, text])) },
  });
}

const json = (status: number, body = {}) => new Response(JSON.stringify(body), { status });

/** A fetch that follows the contract, or answers `over(url, init)` when that gives a Response. */
function fakeApp(over: (url: string, init: FetchInit) => Response | null = () => null) {
  const calls: { url: string; method?: string; authorization?: string; type?: string; body?: unknown }[] = [];
  const answer = (href: string, init: FetchInit) => {
    calls.push({ url: href, method: init.method, authorization: init.headers.authorization, type: init.headers['content-type'], body: init.body });
    const replaced = over(href, init);
    if (replaced) return replaced;
    if (href === `${BASE}/api/proofs/uploads`) {
      const files = dig(JSON.parse(String(init.body)), 'files') as { name: string }[];
      return json(200, { run: RUN_ID, files: files.map(({ name }) => ({ name, path: `d/${RUN_ID}/${name}`, url: `https://files.example/${name}?token=t` })) });
    }
    if (href.startsWith('https://files.example/')) return json(200, {});
    if (href === `${BASE}/api/proofs`) return json(200, { url: TAB });
    return json(500);
  };
  // A promise of the answer, rejected when answering throws, as the async fetch it fakes.
  const fetch = (url: string, init: FetchInit) =>
    new Promise<Response>((resolve) => {
      resolve(answer(url, init));
    });
  return { calls, fetch };
}

async function push(args: string[], { root, tokens = signedIn(), fetch }: { root: string; tokens?: ReturnType<typeof memoryTokens>; fetch: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['proof', 'push', ...args], {
    cwd: root, tokens, env: {}, fetch,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni proof push', () => {
  it('uploads every file to its signed link, then registers the run, and prints the Proof tab\'s link, then the GIF\'s', async () => {
    const { root } = checkout();
    const { calls, fetch } = fakeApp();
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 0, out: `${TAB}\n${BASE}/api/proofs/${RUN_ID}/preview.gif\n`, err: '' });

    expect(calls.map(({ method, url, authorization, type }) => [method, url, authorization ?? null, type ?? null])).toEqual([
      ['POST', `${BASE}/api/proofs/uploads`, 'Bearer access-1', 'application/json'],
      ['PUT', 'https://files.example/1-tab.webm?token=t', null, 'video/webm'],
      ['PUT', 'https://files.example/1-tab.spec.ts?token=t', null, 'text/plain'],
      ['PUT', 'https://files.example/preview.gif?token=t', null, 'image/gif'],
      ['POST', `${BASE}/api/proofs`, 'Bearer access-1', 'application/json'],
    ]);
    expect(JSON.parse(calls[0]?.body as string)).toEqual({
      repo: 'acme/widgets', prd: 7,
      files: [{ name: '1-tab.webm', bytes: 4, type: 'video/webm' }, { name: '1-tab.spec.ts', bytes: 6, type: 'text/plain' }, { name: 'preview.gif', bytes: 6, type: 'image/gif' }],
    });
    expect(Buffer.from(calls[1]?.body as Uint8Array).toString()).toBe('webm');
    expect(JSON.parse(calls[4]?.body as string)).toEqual({ repo: 'acme/widgets', prd: 7, run: RUN_ID, commit: RUN.commit, url: RUN.url, criteria: RUN.criteria });
  });

  it('takes an absolute folder as well', async () => {
    const { root } = checkout();
    const { fetch } = fakeApp();
    expect((await push(['7', join(root, DIR)], { root, fetch })).code).toBe(0);
  });

  it('refuses a 60 MB file before uploading anything: refused (413), exit 1', async () => {
    const { root } = checkout();
    truncateSync(join(root, DIR, '1-tab.webm'), 60 * 1024 * 1024);
    const { calls, fetch } = fakeApp();
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (413): 1-tab.webm: over 50 MB\n' });
    expect(calls).toEqual([]);
  });

  it('refuses a .mp4 before uploading anything: refused (400), exit 1', async () => {
    const run = { ...RUN, criteria: [{ text: 'It plays.', verdict: 'pass', video: '1-tab.mp4' }] };
    const { root } = checkout({ files: { 'run.json': JSON.stringify(run), '1-tab.mp4': 'mp4' } });
    const { calls, fetch } = fakeApp();
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (400): 1-tab.mp4: a proof takes .webm, .gif, .ts or .txt files\n' });
    expect(calls).toEqual([]);
  });

  it('a PRD without a dossier: none, exit 1, and nothing is uploaded', async () => {
    const { root } = checkout();
    const { calls, fetch } = fakeApp((url: string) => (url.endsWith('/uploads') ? json(404, { error: 'No dossier for PRD #7.' }) : null));
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'none\n' });
    expect(calls).toHaveLength(1);
  });

  it('dossiers off here: off, exit 1, and no call', async () => {
    const { root } = checkout({ enabled: false });
    const { calls, fetch } = fakeApp();
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
    expect(calls).toEqual([]);
  });

  it('signed out: no sign-in (omni signin), exit 1, and no call', async () => {
    const { root } = checkout();
    const { calls, fetch } = fakeApp();
    expect(await push(['7', DIR], { root, fetch, tokens: memoryTokens() })).toEqual({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    expect(calls).toEqual([]);
  });

  it('the app out of reach: unreachable, exit 1', async () => {
    const { root } = checkout();
    const fetch = () => Promise.reject(new TypeError('fetch failed'));
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
  });

  it('any other refusal: refused (<status>), a 403 with its reason, exit 1', async () => {
    const { root } = checkout();
    const register = fakeApp((url: string) => (url === `${BASE}/api/proofs` ? json(409, { error: 'registered already' }) : null));
    expect(await push(['7', DIR], { root, fetch: register.fetch })).toEqual({ code: 1, out: '', err: 'refused (409)\n' });
    const upload = fakeApp((url: string) => (url.startsWith('https://files.example/') ? json(400) : null));
    expect(await push(['7', DIR], { root, fetch: upload.fetch })).toEqual({ code: 1, out: '', err: 'refused (400)\n' });
    const member = fakeApp((url: string) => (url.endsWith('/uploads') ? json(403, { error: 'Join the workspace first.' }) : null));
    expect(await push(['7', DIR], { root, fetch: member.fetch })).toEqual({ code: 1, out: '', err: 'refused (403): Join the workspace first.\n' });
  });

  it('a reply without the tab\'s link: refused (no link in the reply), exit 1', async () => {
    const { root } = checkout();
    const { fetch } = fakeApp((url: string) => (url === `${BASE}/api/proofs` ? json(200, {}) : null));
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (no link in the reply)\n' });
  });

  it('a folder without run.json, or arguments it cannot run: exit 2', async () => {
    const { root } = checkout();
    const { calls, fetch } = fakeApp();
    expect((await push(['7', '.claude'], { root, fetch })).code).toBe(2);
    expect((await push(['7'], { root, fetch })).code).toBe(2);
    expect((await push(['x', DIR], { root, fetch })).code).toBe(2);
    expect((await main(['proof', 'pull', '7', DIR], { cwd: root, env: {}, fetch, stdout: { write() {} }, stderr: { write() {} } }))).toBe(2);
    expect(calls).toEqual([]);
  });
});

// `omni proof session [<file>]` (the `proof.setup` of PRD 798): the signed-in Playwright session, from
// the person's own `omni signin`, renewed first so the browser gets a full hour.
describe('omni proof session', () => {
  const REF = 'fzskrlcmmzvvxaeebezc';
  const EXP = Math.floor(Date.now() / 1000) + 3600;
  const jwt = (claims: Record<string, unknown>) => ['h', Buffer.from(JSON.stringify(claims)).toString('base64url'), 's'].join('.');
  const FRESH = jwt({ iss: `https://${REF}.supabase.co/auth/v1`, sub: 'u-1', email: 'pat@acme.test', exp: EXP });
  const renewing = (status = 200) => fakeApp((href: string) => (href === `${BASE}/api/ask/token`
    ? json(status, status === 200 ? { access_token: FRESH, refresh_token: 'refresh-2', expires_at: EXP } : {})
    : null));

  async function session(
    args: string[],
    { root, tokens = signedIn(), fetch, env = {} }: { root: string; tokens?: ReturnType<typeof memoryTokens>; fetch: unknown; env?: Record<string, string> },
  ) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(['proof', 'session', ...args], { cwd: root, tokens, env, fetch, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
    return { code, out: out.join(''), err: err.join('') };
  }

  it('renews the sign-in, then writes the app\'s auth cookie to PROOF_STORAGE_STATE, private to its owner', async () => {
    const { root } = checkout();
    const tokens = signedIn();
    const file = join(root, 'state.json');
    const result = await session([], { root, tokens, fetch: renewing().fetch, env: { PROOF_STORAGE_STATE: file } });
    expect(result).toMatchObject({ code: 0, err: '' });
    expect(result.out).toMatch(/^signed in as pat@acme\.test until \d\d:\d\d\n$/);
    const state: unknown = JSON.parse(readFileSync(file, 'utf8'));
    expect(dig(state, 'cookies', 0)).toMatchObject({ name: `sb-${REF}-auth-token`, domain: HOST });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(tokens.store[HOST]?.refresh_token).toBe('refresh-2');
  });

  it('puts the cookie on the host PROOF_URL names, the address being filmed (a preview), and still signs in through ask.url', async () => {
    const { root } = checkout();
    const file = join(root, 'state.json');
    const { calls, fetch } = renewing();
    const result = await session([file], { root, fetch, env: { PROOF_URL: 'https://app-git-feat-x.vercel.app/some/page' } });
    expect(result.code).toBe(0);
    expect(dig(JSON.parse(readFileSync(file, 'utf8')), 'cookies', 0, 'domain')).toBe('app-git-feat-x.vercel.app');
    expect(calls.map(({ url }) => url)).toEqual([`${BASE}/api/ask/token`]);
  });

  it('takes the file as an argument too', async () => {
    const { root } = checkout();
    const file = join(root, 'given.json');
    expect((await session([file], { root, fetch: renewing().fetch })).code).toBe(0);
    expect(existsSync(file)).toBe(true);
  });

  it('says no sign-in when there is none or the server refuses it, and unreachable when it does not answer: exit 1, no file', async () => {
    const { root } = checkout();
    const file = join(root, 'state.json');
    expect(await session([file], { root, tokens: memoryTokens(), fetch: renewing().fetch })).toEqual({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    expect(await session([file], { root, fetch: renewing(401).fetch })).toEqual({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    expect(await session([file], { root, fetch: () => Promise.reject(new Error('down')) })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    expect(existsSync(file)).toBe(false);
  });

  it('needs a file: an argument or PROOF_STORAGE_STATE', async () => {
    const { root } = checkout();
    expect((await session([], { root, fetch: renewing().fetch })).code).toBe(2);
  });
});
