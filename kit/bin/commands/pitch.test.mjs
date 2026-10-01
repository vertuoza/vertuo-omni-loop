// `omni pitch push <n> <dir>` (PRD 859 s3), through `main()` on a fixture repository, against a stubbed
// fetch that follows the pitch contract (`POST /api/pitches/uploads`, a PUT per signed link,
// `POST /api/pitches`). The sign-in is an in-memory token store, so nothing real is read or written.
import { existsSync, truncateSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { main } from '../omni.mjs';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const TAB = `${BASE}/prd/0b7c-dossier-7?tab=pitch`;
const RUN_ID = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
const GIF = `${BASE}/api/pitches/${RUN_ID}/pitch.gif`;

const config = ({ enabled = true } = {}) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\ndossier:\n  enabled: ${enabled}\n`;

function memoryTokens(entries = {}) {
  const store = { ...entries };
  return { store, read: (host) => store[host] ?? null, write: (host, tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

const FIVE = ['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif'];
const PITCH = {
  prd: 7, audience: 'customers', look: 'arcade', commit: 'abcdef1234',
  hook: 'Answer from your phone', benefit: 'Every question waits on one page.', kicker: 'NEW IN WIDGETS',
  closing: 'Widgets · https://widgets.example', files: FIVE,
};
const RUN_FILES = { 'pitch.json': JSON.stringify(PITCH), ...Object.fromEntries(FIVE.map((name) => [name, `bytes of ${name}`])) };
const DIR = '.claude/worktrees/pitch-7/customers';

/** A fixture checkout holding a run folder with `files` (pitch.json and the rest). */
function checkout({ enabled, files = RUN_FILES } = {}) {
  return makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': config({ enabled }), ...Object.fromEntries(Object.entries(files).map(([name, text]) => [`${DIR}/${name}`, text])) },
  });
}

const json = (status, body = {}) => new Response(JSON.stringify(body), { status });

/** A fetch that follows the contract, or answers `over(url, init)` when that gives a Response. */
function fakeApp(over = () => null) {
  const calls = [];
  const fetch = async (url, init) => {
    const href = String(url);
    calls.push({ url: href, method: init.method, authorization: init.headers.authorization, type: init.headers['content-type'], body: init.body });
    const replaced = over(href, init);
    if (replaced) return replaced;
    if (href === `${BASE}/api/pitches/uploads`) {
      const { files } = JSON.parse(init.body);
      return json(200, { run: RUN_ID, files: files.map(({ name }) => ({ name, path: `d/${RUN_ID}/${name}`, url: `https://files.example/${name}?token=t` })) });
    }
    if (href.startsWith('https://files.example/')) return json(200, {});
    if (href === `${BASE}/api/pitches`) return json(200, { url: TAB, gif: GIF });
    return json(500);
  };
  return { calls, fetch };
}

async function push(args, { root, tokens = signedIn(), fetch }) {
  const out = [];
  const err = [];
  const code = await main(['pitch', 'push', ...args], {
    cwd: root, tokens, env: {}, fetch,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

/** Every file of the run is still in its folder. */
const kept = (root) => Object.keys(RUN_FILES).every((name) => existsSync(join(root, DIR, name)));

describe('omni pitch push', () => {
  it('uploads the five files to their signed links, registers the run, and prints the Pitch tab\'s link, then the GIF\'s', async () => {
    const { root } = checkout();
    const { calls, fetch } = fakeApp();
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 0, out: `${TAB}\n${GIF}\n`, err: '' });

    expect(calls.map(({ method, url, authorization, type }) => [method, url, authorization ?? null, type ?? null])).toEqual([
      ['POST', `${BASE}/api/pitches/uploads`, 'Bearer access-1', 'application/json'],
      ['PUT', 'https://files.example/slide.png?token=t', null, 'image/png'],
      ['PUT', 'https://files.example/slide-square.png?token=t', null, 'image/png'],
      ['PUT', 'https://files.example/pitch.mp4?token=t', null, 'video/mp4'],
      ['PUT', 'https://files.example/pitch-square.mp4?token=t', null, 'video/mp4'],
      ['PUT', 'https://files.example/pitch.gif?token=t', null, 'image/gif'],
      ['POST', `${BASE}/api/pitches`, 'Bearer access-1', 'application/json'],
    ]);
    expect(JSON.parse(calls[0].body)).toEqual({
      repo: 'acme/widgets', prd: 7,
      files: FIVE.map((name) => ({ name, bytes: `bytes of ${name}`.length, type: { png: 'image/png', mp4: 'video/mp4', gif: 'image/gif' }[name.split('.').pop()] })),
    });
    expect(Buffer.from(calls[3].body).toString()).toBe('bytes of pitch.mp4');
    expect(JSON.parse(calls[6].body)).toEqual({
      repo: 'acme/widgets', prd: 7, run: RUN_ID, audience: 'customers', look: 'arcade', commit: PITCH.commit,
      hook: PITCH.hook, benefit: PITCH.benefit, kicker: PITCH.kicker, closing: PITCH.closing,
    });
  });

  it('takes an absolute folder as well', async () => {
    const { root } = checkout();
    expect((await push(['7', join(root, DIR)], { root, fetch: fakeApp().fetch })).code).toBe(0);
  });

  it('a PRD not shipped: not shipped, exit 1, nothing uploaded and every file kept', async () => {
    const { root } = checkout();
    const { calls, fetch } = fakeApp((url) => (url.endsWith('/uploads') ? json(422, { error: 'This PRD is not shipped.' }) : null));
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'not shipped\n' });
    expect(calls).toHaveLength(1);
    expect(kept(root)).toBe(true);
  });

  it('a PRD without a dossier: none, exit 1, and nothing is uploaded', async () => {
    const { root } = checkout();
    const { calls, fetch } = fakeApp((url) => (url.endsWith('/uploads') ? json(404, { error: 'No dossier for PRD #7.' }) : null));
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'none\n' });
    expect(calls).toHaveLength(1);
    expect(kept(root)).toBe(true);
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

  it('the app out of reach: unreachable, exit 1, every file kept', async () => {
    const { root } = checkout();
    const fetch = async () => { throw new TypeError('fetch failed'); };
    expect(await push(['7', DIR], { root, fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    expect(kept(root)).toBe(true);
  });

  it('any other refusal: refused (<status>), a 403 with its reason, exit 1, never retried', async () => {
    const { root } = checkout();
    const register = fakeApp((url) => (url === `${BASE}/api/pitches` ? json(409, { error: 'registered already' }) : null));
    expect(await push(['7', DIR], { root, fetch: register.fetch })).toEqual({ code: 1, out: '', err: 'refused (409)\n' });
    expect(register.calls.filter(({ url }) => url === `${BASE}/api/pitches`)).toHaveLength(1);
    const upload = fakeApp((url) => (url.startsWith('https://files.example/') ? json(400) : null));
    expect(await push(['7', DIR], { root, fetch: upload.fetch })).toEqual({ code: 1, out: '', err: 'refused (400)\n' });
    expect(upload.calls).toHaveLength(2);
    const member = fakeApp((url) => (url.endsWith('/uploads') ? json(403, { error: 'Join the workspace first.' }) : null));
    expect(await push(['7', DIR], { root, fetch: member.fetch })).toEqual({ code: 1, out: '', err: 'refused (403): Join the workspace first.\n' });
    expect(kept(root)).toBe(true);
  });

  it('refuses a file missing or over 50 MB, and a pitch of another PRD, before uploading anything', async () => {
    const big = checkout();
    truncateSync(join(big.root, DIR, 'pitch.mp4'), 60 * 1024 * 1024);
    const { calls, fetch } = fakeApp();
    expect(await push(['7', DIR], { root: big.root, fetch })).toEqual({ code: 1, out: '', err: 'refused (413): pitch.mp4: over 50 MB\n' });
    const { 'pitch.gif': _gif, ...noGif } = RUN_FILES;
    expect(await push(['7', DIR], { root: checkout({ files: noGif }).root, fetch })).toEqual({ code: 1, out: '', err: 'refused (400): pitch.gif: not in the run folder\n' });
    const other = checkout({ files: { ...RUN_FILES, 'pitch.json': JSON.stringify({ ...PITCH, prd: 8 }) } });
    expect(await push(['7', DIR], { root: other.root, fetch })).toEqual({ code: 1, out: '', err: 'refused (400): pitch.json is for PRD 8, not 7\n' });
    const everyone = checkout({ files: { ...RUN_FILES, 'pitch.json': JSON.stringify({ ...PITCH, audience: 'everyone' }) } });
    expect((await push(['7', DIR], { root: everyone.root, fetch })).err).toBe('refused (400): pitch.json: audience is customers or inside, not everyone\n');
    expect(calls).toEqual([]);
  });

  it('a reply without the tab\'s or the GIF\'s link: refused (…), exit 1', async () => {
    const { root } = checkout();
    const noTab = fakeApp((url) => (url === `${BASE}/api/pitches` ? json(200, { gif: GIF }) : null));
    expect(await push(['7', DIR], { root, fetch: noTab.fetch })).toEqual({ code: 1, out: '', err: 'refused (no link in the reply)\n' });
    const noGif = fakeApp((url) => (url === `${BASE}/api/pitches` ? json(200, { url: TAB }) : null));
    expect(await push(['7', DIR], { root, fetch: noGif.fetch })).toEqual({ code: 1, out: '', err: 'refused (no GIF link in the reply)\n' });
  });

  it('a folder without pitch.json, or arguments it cannot run: exit 2', async () => {
    const { root } = checkout();
    const { calls, fetch } = fakeApp();
    expect((await push(['7', '.claude'], { root, fetch })).code).toBe(2);
    expect((await push(['7'], { root, fetch })).code).toBe(2);
    expect((await push(['x', DIR], { root, fetch })).code).toBe(2);
    expect(await main(['pitch', 'pull', '7', DIR], { cwd: root, env: {}, fetch, stdout: { write() {} }, stderr: { write() {} } })).toBe(2);
    expect(calls).toEqual([]);
  });
});
