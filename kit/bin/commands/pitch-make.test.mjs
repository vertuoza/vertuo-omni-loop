// `omni pitch start|slide|music|video` (PRD 859 s4), through `main()` on fixture repositories: each refusal
// prints its line and writes nothing; start opens the run folder with the product's look; slide renders
// its five cards through an injected screenshot; music writes the audience's WAV; video refuses without
// ffmpeg. The sign-in is an in-memory token store and the Omni page a stubbed fetch.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { main } from '../omni.mjs';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const PRODUCTION = 'https://widgets.example';

const config = ({ proofUrl = PRODUCTION } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\n${proofUrl === null ? '' : `proof:\n  url: ${proofUrl}\n`}`;

function memoryTokens(entries = {}) {
  return { read: (host) => entries[host] ?? null, write: (host, tokens) => { entries[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

/** A checkout where PRD 7 is shipped and PRD 8 is in the inbox. */
function checkout(options) {
  return makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': config(options),
      '.omni-loop/delivery/shipped/0007-widgets/spec.md': '# Widgets\n',
      '.omni-loop/delivery/inbox/0008-gadgets/spec.md': '# Gadgets\n',
    },
  }).root;
}

/** An exec where ffmpeg is missing, and everything else runs. */
const withoutFfmpeg = (cmd, args, options) => {
  if (cmd === 'ffmpeg') throw Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' });
  return execFileSync(cmd, args, options);
};
/** An exec where ffmpeg answers, and everything else runs. */
const withFfmpeg = (cmd, args, options) => (cmd === 'ffmpeg' ? '' : execFileSync(cmd, args, options));

const json = (status, body = {}) => new Response(JSON.stringify(body), { status });

async function omni(args, { root, cwd = root, tokens = signedIn(), fetch = async () => json(200, { look: 'keynote' }), exec = withFfmpeg, screenshot } = {}) {
  const out = [];
  const err = [];
  const code = await main(['pitch', ...args], {
    cwd, tokens, env: {}, fetch, exec, screenshot, now: () => new Date(2026, 9, 1, 9, 5, 7),
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

const runs = (root) => join(root, '.claude/worktrees/pitch-7');
const RUN = '.claude/worktrees/pitch-7/customers-20261001-090507';

describe('omni pitch start: the refusals, each one line, exit 1, nothing written', () => {
  it('a PRD not shipped', async () => {
    const root = checkout();
    expect(await omni(['start', '8', '--for', 'customers'], { root })).toEqual({ code: 1, out: '', err: 'PRD 8 is not shipped: a pitch is for shipped PRDs\n' });
    expect(existsSync(join(root, '.claude/worktrees'))).toBe(false);
  });

  it('proof.url not set, or not a fixed URL', async () => {
    const off = checkout({ proofUrl: null });
    expect(await omni(['start', '7', '--for', 'inside'], { root: off })).toEqual({
      code: 1, out: '', err: 'proof is not configured here: run /omni:invade --refresh, or set proof.url in .omni-loop/config.yml\n',
    });
    const preview = checkout({ proofUrl: 'github-deployment' });
    expect(await omni(['start', '7', '--for', 'inside'], { root: preview })).toEqual({
      code: 1, out: '', err: 'proof.url is github-deployment: a merged PRD has no preview to film; set a fixed proof.url\n',
    });
    expect(existsSync(runs(off)) || existsSync(runs(preview))).toBe(false);
  });

  it('no ffmpeg on the PATH', async () => {
    const root = checkout();
    expect(await omni(['start', '7', '--for', 'customers'], { root, exec: withoutFfmpeg })).toEqual({
      code: 1, out: '', err: 'ffmpeg is needed for a pitch: brew install ffmpeg\n',
    });
    expect(existsSync(runs(root))).toBe(false);
  });

  it('no sign-in', async () => {
    const root = checkout();
    const calls = [];
    const fetch = async (url) => { calls.push(url); return json(200, { look: 'arcade' }); };
    expect(await omni(['start', '7', '--for', 'customers'], { root, tokens: memoryTokens(), fetch })).toEqual({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    expect(existsSync(runs(root))).toBe(false);
    expect(calls).toEqual([]);
  });

  it('an audience other than customers or inside is a usage error', async () => {
    const root = checkout();
    const { code, err } = await omni(['start', '7', '--for', 'investors'], { root });
    expect(code).toBe(2);
    expect(err).toMatch(/customers or inside/);
  });
});

describe('omni pitch start', () => {
  it("opens the run folder under worktrees with the product's look and the commit, and prints them", async () => {
    const root = checkout();
    const calls = [];
    const fetch = async (url, init) => { calls.push([init.method, String(url), init.headers.authorization]); return json(200, { look: 'keynote' }); };
    const { code, out, err } = await omni(['start', '7', '--for', 'customers'], { root, fetch });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const printed = JSON.parse(out);
    expect(printed).toEqual({ dir: expect.stringMatching(/\.claude\/worktrees\/pitch-7\/customers-20261001-090507$/), look: 'keynote', url: PRODUCTION, commit });
    expect(JSON.parse(readFileSync(join(printed.dir, 'pitch.json'), 'utf8'))).toEqual({ prd: 7, audience: 'customers', look: 'keynote', commit });
    expect(calls).toEqual([['GET', `${BASE}/api/pitch-look?repo=acme%2Fwidgets`, 'Bearer access-1']]);
    expect(execFileSync('git', ['status', '--porcelain', '--', '.omni-loop'], { cwd: root, encoding: 'utf8' })).toBe('');
  });

  it('a look the Omni page cannot answer is arcade, said in one line', async () => {
    const root = checkout();
    const { code, out, err } = await omni(['start', '7', '--for', 'inside'], { root, fetch: async () => { throw new TypeError('fetch failed'); } });
    expect(code).toBe(0);
    expect(JSON.parse(out).look).toBe('arcade');
    expect(err).toBe("look: arcade (the product's look could not be read: unreachable)\n");
  });
});

/** A run folder holding pitch.json with `words`, and a frame beside it. */
function runFolder(root, words = { kicker: 'NEW IN WIDGETS', hook: 'Answer from your phone', benefit: 'Every question waits on one page.', closing: 'Widgets · https://widgets.example' }) {
  const dir = join(root, RUN);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pitch.json'), JSON.stringify({ prd: 7, audience: 'customers', look: 'arcade', commit: 'abcdef1234', ...words }));
  writeFileSync(join(root, 'frame-in.png'), 'png bytes');
  return dir;
}

describe('omni pitch slide', () => {
  it('copies the frame beside the cards, writes each card page and renders its PNG at its shape', async () => {
    const root = checkout();
    const dir = runFolder(root);
    const shots = [];
    const screenshot = ({ html, png, width, height }) => { shots.push([html.slice(dir.length + 1), png.slice(dir.length + 1), width, height]); writeFileSync(png, 'png'); };
    const { code, out } = await omni(['slide', RUN, '--frame', 'frame-in.png'], { root, screenshot });
    expect(code).toBe(0);
    expect(shots).toEqual([
      ['slide.html', 'slide.png', 1920, 1080],
      ['slide-square.html', 'slide-square.png', 1080, 1080],
      ['close.html', 'close.png', 1920, 1080],
      ['close-square.html', 'close-square.png', 1080, 1080],
      ['backdrop-square.html', 'backdrop-square.png', 1080, 1080],
    ]);
    expect(out.trim().split('\n')).toEqual(shots.map(([, png]) => join(dir, png)));
    expect(readFileSync(join(dir, 'frame.png'), 'utf8')).toBe('png bytes');
    expect(readFileSync(join(dir, 'slide.html'), 'utf8')).toContain('Answer from your phone');
  });

  it('refuses a run whose words are not written yet, and says which', async () => {
    const root = checkout();
    runFolder(root, { kicker: 'NEW IN WIDGETS' });
    const { code, err } = await omni(['slide', RUN, '--frame', 'frame-in.png'], { root, screenshot: () => {} });
    expect(code).toBe(2);
    expect(err).toMatch(/pitch\.json has no hook yet/);
  });

  it('a render that fails is one line, exit 1', async () => {
    const root = checkout();
    runFolder(root);
    const screenshot = () => { throw Object.assign(new Error('x'), { stderr: 'browserType.launch: Executable does not exist\nmore' }); };
    expect(await omni(['slide', RUN, '--frame', 'frame-in.png'], { root, screenshot })).toEqual({
      code: 1, out: '', err: 'slide render failed: browserType.launch: Executable does not exist\n',
    });
  });
});

describe('omni pitch music', () => {
  it("writes the audience's music.wav in the run folder", async () => {
    const root = checkout();
    const dir = runFolder(root);
    const { code, out } = await omni(['music', RUN, '--for', 'inside'], { root });
    expect({ code, out }).toEqual({ code: 0, out: `${join(dir, 'music.wav')}\n` });
    expect(readFileSync(join(dir, 'music.wav')).toString('ascii', 0, 4)).toBe('RIFF');
  });
});

describe('omni pitch video', () => {
  it('refuses without ffmpeg, with its line, and writes nothing', async () => {
    const root = checkout();
    const dir = runFolder(root);
    const before = readdirSync(dir).sort();
    expect(await omni(['video', RUN], { root, exec: withoutFfmpeg })).toEqual({ code: 1, out: '', err: 'ffmpeg is needed for a pitch: brew install ffmpeg\n' });
    expect(readdirSync(dir).sort()).toEqual(before);
  });

  it('names what the folder still lacks', async () => {
    const root = checkout();
    runFolder(root);
    const { code, err } = await omni(['video', RUN], { root });
    expect(code).toBe(2);
    expect(err).toMatch(/has no walk\.webm yet/);
  });
});

describe('omni pitch', () => {
  it('a verb it does not know is a usage error naming its verbs', async () => {
    const root = checkout();
    const { code, err } = await omni(['film', '7'], { root });
    expect(code).toBe(2);
    expect(err).toMatch(/start\|slide\|music\|video\|push/);
  });
});
