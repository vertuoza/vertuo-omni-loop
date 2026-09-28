// `omni dossier link <n>` (PRD 413), through `main()` on a fixture repository, against a stubbed fetch
// that follows the lookup's contract (`GET /api/dossiers?repo=<owner/name>&prd=<n>`). The sign-in is an
// in-memory token store and the environment is passed in, so nothing real is read or written.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOSSIERS_FILE } from '../../lib/dossier/local.mjs';
import { makeRepo } from '../../test/fixture.mjs';
import { main } from '../omni.mjs';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const LINK = `${BASE}/prd/0b7c-dossier-7`;

const config = ({ url = BASE, enabled = true } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\ndossier:\n  enabled: ${enabled}\n`;

function memoryTokens(entries = {}) {
  const store = { ...entries };
  return { store, read: (host) => store[host] ?? null, write: (host, tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

/** A fetch that answers every call with `reply(url, init)` and keeps each call. */
function stubFetch(reply) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, authorization: init.headers.authorization });
    return reply(String(url), init);
  };
  return { calls, fetch };
}
const json = (status, body = {}) => new Response(JSON.stringify(body), { status });
const down = () => { throw new TypeError('fetch failed'); };

/** A local record holding a draft still unnumbered and PRD 7's numbered dossier. */
const RECORD = [
  { id: 'draft-1', url: `${BASE}/prd/draft-1`, claudeSessionId: null, prd: null, openedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'local-7', url: `${BASE}/prd/local-7`, claudeSessionId: 's', prd: 7, openedAt: '2026-09-02T00:00:00.000Z' },
];

function checkout({ enabled, url, record } = {}) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ url, enabled }) } });
  if (record) repo.write(DOSSIERS_FILE, `${JSON.stringify(record, null, 2)}\n`);
  return repo;
}

/** Every file under `.omni-loop/local/`, with its text: what `link` must leave as it found it. */
function localFiles(root) {
  const dir = join(root, '.omni-loop/local');
  if (!existsSync(dir)) return {};
  return Object.fromEntries(readdirSync(dir).map((name) => [name, readFileSync(join(dir, name), 'utf8')]));
}

async function link(args, { root, tokens = signedIn(), fetch }) {
  const out = [];
  const err = [];
  const code = await main(['dossier', 'link', ...args], {
    cwd: root, tokens, env: {}, fetch,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni dossier link', () => {
  it('asks the app for PRD n of this repository and prints its link on one line', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(() => json(200, { id: '0b7c-dossier-7', url: LINK }));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 0, out: `${LINK}\n`, err: '' });
    expect(calls).toEqual([{ url: `${BASE}/api/dossiers?repo=acme%2Fwidgets&prd=7`, method: 'GET', authorization: 'Bearer access-1' }]);
  });

  it('prefers the app to the local record when the app answers', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(() => json(200, { id: '0b7c-dossier-7', url: LINK }));
    expect((await link(['7'], { root, fetch })).out).toBe(`${LINK}\n`);
  });

  it('a PRD with no dossier: none, exit 1, even when the record names one', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(() => json(404));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 1, out: '', err: 'none\n' });
  });

  it('a reply without a link: refused, exit 1', async () => {
    const { root } = checkout();
    const { fetch } = stubFetch(() => json(200, { id: 'x' }));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (no dossier in the reply)\n' });
  });
});

describe('omni dossier link when the app cannot be reached', () => {
  it('prints the numbered entry the local record holds for n, exit 0', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(down);
    expect(await link(['7'], { root, fetch })).toEqual({ code: 0, out: `${BASE}/prd/local-7\n`, err: '' });
  });

  it('takes the last one recorded when the record holds two for n', async () => {
    const later = { id: 'local-7b', url: `${BASE}/prd/local-7b`, claudeSessionId: null, prd: 7, openedAt: '2026-09-03T00:00:00.000Z' };
    const { root } = checkout({ record: [...RECORD, later] });
    const { fetch } = stubFetch(down);
    expect((await link(['7'], { root, fetch })).out).toBe(`${later.url}\n`);
  });

  it('without a numbered entry for n: unreachable, exit 1', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(down);
    expect(await link(['8'], { root, fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    const bare = checkout();
    expect(await link(['7'], { root: bare.root, fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
  });
});

describe('omni dossier link skips as open and push do', () => {
  it('off: prints off and calls nothing', async () => {
    const { calls, fetch } = stubFetch(() => json(200, { id: 'i', url: LINK }));
    expect(await link(['7'], { root: checkout({ enabled: false }).root, fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
    expect(await link(['7'], { root: checkout({ url: null }).root, fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
    expect(calls).toEqual([]);
  });

  it('no sign-in: says omni signin and calls nothing', async () => {
    const { root } = checkout({ record: RECORD });
    const { calls, fetch } = stubFetch(() => json(200, { id: 'i', url: LINK }));
    expect(await link(['7'], { root, fetch, tokens: memoryTokens() })).toEqual({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    expect(calls).toEqual([]);
  });

  it('a refusal carries its status', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(() => json(500));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (500)\n' });
  });

  it('a 401 after one refresh: refused (401)', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch((url) => (url.endsWith('/api/ask/token') ? json(200, { access_token: 'access-2' }) : json(401)));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (401)\n' });
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/api/dossiers', '/api/ask/token', '/api/dossiers']);
  });
});

describe('omni dossier link writes nothing', () => {
  it('leaves .omni-loop/local/ as it found it, whatever the answer', async () => {
    const replies = [() => json(200, { id: 'i', url: LINK }), () => json(404), () => json(500), down];
    const { root } = checkout({ record: RECORD });
    const before = localFiles(root);
    for (const reply of replies) await link(['7'], { root, fetch: stubFetch(reply).fetch });
    expect(localFiles(root)).toEqual(before);

    const bare = checkout();
    for (const reply of replies) await link(['7'], { root: bare.root, fetch: stubFetch(reply).fetch });
    expect(existsSync(join(bare.root, '.omni-loop/local'))).toBe(false);
  });
});

describe('omni dossier link refuses what it cannot run', () => {
  it('exits 2 with the usage line, which names link, for a missing, extra or non-numeric PRD', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(() => json(200, { id: 'i', url: LINK }));
    for (const args of [[], ['x'], ['0'], ['-3'], ['7', '8']]) {
      const run = await link(args, { root, fetch });
      expect(run.code, JSON.stringify(args)).toBe(2);
      expect(run.err.trim().split('\n'), JSON.stringify(args)).toHaveLength(1);
    }
    for (const args of [[], ['x']]) expect((await link(args, { root, fetch })).err).toMatch(/^usage: .*omni dossier link <n>/);
    expect(calls).toEqual([]);
  });
});
