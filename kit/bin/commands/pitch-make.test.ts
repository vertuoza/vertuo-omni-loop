// `omni pitch start|check|slide|music|video` (PRD 859 s4, PRD 1108 s3), through `main()` on fixture
// repositories: each refusal prints its line and writes nothing; start opens the run folder with the
// product's look; check names what stops a storyboard and writes its warnings to pitch.json; slide renders
// its five cards through an injected screenshot; music writes the audience's WAV; video refuses without
// ffmpeg. The sign-in is an in-memory token store and the Omni page a stubbed fetch.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../../test/fixture.ts';
import { FIXTURE_MEDIA, changedStoryboard, fixtureStoryboard } from '../../lib/pitch/storyboard.fixture.ts';
import { main } from '../omni.ts';
import type { Tokens } from '../../lib/ask/schema.ts';
import type { Screenshot } from '../../lib/pitch/run.ts';
import type { FakeExec, FetchInit } from '../../test/fixture.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const PRODUCTION = 'https://widgets.example';

const config = ({ proofUrl = PRODUCTION }: { proofUrl?: string | null } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\n${proofUrl === null ? '' : `proof:\n  url: ${proofUrl}\n`}`;

function memoryTokens(entries: Record<string, Tokens> = {}) {
  return { read: (host: string) => entries[host] ?? null, write: (host: string, tokens: Tokens) => { entries[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

/** A checkout where PRD 7 is shipped and PRD 8 is in the inbox. */
function checkout(options?: { proofUrl?: string | null }) {
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
const withoutFfmpeg: FakeExec = (cmd, args, options) => {
  if (cmd === 'ffmpeg') throw Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' });
  return realExec(cmd, args, options);
};
/** An exec where ffmpeg answers, and everything else runs. */
const withFfmpeg: FakeExec = (cmd, args, options) => (cmd === 'ffmpeg' ? '' : realExec(cmd, args, options));

const json = (status: number, body = {}) => new Response(JSON.stringify(body), { status });

type Fetched = (url: string, init: FetchInit) => Promise<Response>;

async function omni(
  args: string[],
  { root, cwd = root, tokens = signedIn(), fetch = () => Promise.resolve(json(200, { look: 'keynote' })), exec = withFfmpeg, screenshot }: {
    root: string;
    cwd?: string;
    tokens?: ReturnType<typeof memoryTokens>;
    fetch?: Fetched;
    exec?: FakeExec;
    screenshot?: Screenshot;
  },
) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['pitch', ...args], {
    cwd, tokens, env: {}, fetch, exec, screenshot, now: () => new Date(2026, 9, 1, 9, 5, 7),
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

const runs = (root: string) => join(root, '.claude/worktrees/pitch-7');
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
    const calls: string[] = [];
    const fetch = (url: string) => { calls.push(url); return Promise.resolve(json(200, { look: 'arcade' })); };
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
    const calls: (string | undefined)[][] = [];
    const fetch = (url: string, init: FetchInit) => { calls.push([init.method, url, init.headers.authorization]); return Promise.resolve(json(200, { look: 'keynote' })); };
    const { code, out, err } = await omni(['start', '7', '--for', 'customers'], { root, fetch });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const printed = JSON.parse(out) as { dir: string };
    const runDir: unknown = expect.stringMatching(/\.claude\/worktrees\/pitch-7\/customers-20261001-090507$/);
    expect(printed).toEqual({ dir: runDir, look: 'keynote', url: PRODUCTION, commit });
    expect(JSON.parse(readFileSync(join(printed.dir, 'pitch.json'), 'utf8'))).toEqual({ prd: 7, audience: 'customers', look: 'keynote', commit });
    expect(calls).toEqual([['GET', `${BASE}/api/pitch-look?repo=acme%2Fwidgets`, 'Bearer access-1']]);
    expect(execFileSync('git', ['status', '--porcelain', '--', '.omni-loop'], { cwd: root, encoding: 'utf8' })).toBe('');
  });

  it('a look the Omni page cannot answer is arcade, said in one line', async () => {
    const root = checkout();
    const { code, out, err } = await omni(['start', '7', '--for', 'inside'], { root, fetch: () => Promise.reject(new TypeError('fetch failed')) });
    expect(code).toBe(0);
    expect((JSON.parse(out) as { look: string }).look).toBe('arcade');
    expect(err).toBe("look: arcade (the product's look could not be read: unreachable)\n");
  });
});

/** A run folder holding pitch.json with `words`, and a frame beside it. */
function runFolder(root: string, words: Record<string, string> = { kicker: 'NEW IN WIDGETS', hook: 'Answer from your phone', benefit: 'Every question waits on one page.', closing: 'Widgets · https://widgets.example' }) {
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
    const shots: [string, string, number, number][] = [];
    const screenshot: Screenshot = ({ html, png, width, height }) => { shots.push([html.slice(dir.length + 1), png.slice(dir.length + 1), width, height]); writeFileSync(png, 'png'); };
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
    const screenshot: Screenshot = () => { throw Object.assign(new Error('x'), { stderr: 'browserType.launch: Executable does not exist\nmore' }); };
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

/** A run folder holding pitch.json, `storyboard` as storyboard.json, and the media named in `media`. */
function storyboardFolder(root: string, storyboard: unknown, media: readonly string[] = FIXTURE_MEDIA) {
  const dir = runFolder(root);
  writeFileSync(join(dir, 'storyboard.json'), typeof storyboard === 'string' ? storyboard : JSON.stringify(storyboard));
  for (const file of media) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), 'media');
  }
  return dir;
}

const pitchJsonOf = (dir: string): unknown => JSON.parse(readFileSync(join(dir, 'pitch.json'), 'utf8'));

describe('omni pitch check (PRD 1108, acceptance 4)', () => {
  it('passes a sound storyboard: exit 0, its length, and no warning written to pitch.json', async () => {
    const root = checkout();
    const dir = storyboardFolder(root, fixtureStoryboard());
    expect(await omni(['check', RUN], { root })).toEqual({ code: 0, out: 'storyboard: 6 scenes, 23.5 s, 0 warnings\n', err: '' });
    expect(pitchJsonOf(dir)).toMatchObject({ prd: 7, look: 'arcade', warnings: [] });
  });

  it('refuses a missing media file and a missing outro, naming each, exit 1, writing nothing', async () => {
    const root = checkout();
    const storyboard = fixtureStoryboard();
    storyboard.scenes.pop();
    const dir = storyboardFolder(root, storyboard, ['clips/walk.webm', 'shots/before.png']);
    const before = readFileSync(join(dir, 'pitch.json'), 'utf8');
    expect(await omni(['check', RUN], { root })).toEqual({
      code: 1,
      out: '',
      err: 'error: scenes.4.after.file: shots/after.png is missing\nerror: scenes: no outro: the last scene is the outro\n',
    });
    expect(readFileSync(join(dir, 'pitch.json'), 'utf8')).toBe(before);
  });

  it('warns on a title over 9 words, exit 0, and writes its warnings to pitch.json', async () => {
    const root = checkout();
    const storyboard = fixtureStoryboard();
    storyboard.scenes[0] = { type: 'intro', duration: 6, title: 'Quotes that send themselves the moment the last line is priced' };
    const dir = storyboardFolder(root, storyboard);
    const { code, out, err } = await omni(['check', RUN], { root });
    expect({ code, out }).toEqual({ code: 0, out: 'storyboard: 6 scenes, 26.5 s, 1 warning\n' });
    expect(err).toBe('warning: scenes.0.title: 11 words; a title holds at most 9\n');
    expect(pitchJsonOf(dir)).toMatchObject({ prd: 7, warnings: ['scenes.0.title: 11 words; a title holds at most 9'] });
  });

  it('names each field the schema refuses, with its path', async () => {
    const root = checkout();
    storyboardFolder(root, changedStoryboard('scenes.2.layout', 'centre'));
    const { code, err } = await omni(['check', RUN], { root });
    expect(code).toBe(1);
    expect(err).toMatch(/^error: scenes\.2\.layout: /);
  });

  it('refuses a storyboard.json that does not read as JSON', async () => {
    const root = checkout();
    storyboardFolder(root, '{ "storyboard": ');
    const { code, err } = await omni(['check', RUN], { root });
    expect(code).toBe(1);
    expect(err).toMatch(/^error: storyboard\.json does not read as JSON: /);
  });

  it('omni help pitch names it', async () => {
    const root = checkout();
    const out: string[] = [];
    const code = await main(['help', 'pitch'], { cwd: root, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } });
    expect(code).toBe(0);
    expect(out.join('')).toContain('omni pitch check <dir>');
  });

  it('a folder with no storyboard.json is a usage error', async () => {
    const root = checkout();
    runFolder(root);
    const { code, err } = await omni(['check', RUN], { root });
    expect(code).toBe(2);
    expect(err).toMatch(/holds no storyboard\.json yet/);
  });
});

describe('omni pitch', () => {
  it('a verb it does not know is a usage error naming its verbs', async () => {
    const root = checkout();
    const { code, err } = await omni(['film', '7'], { root });
    expect(code).toBe(2);
    expect(err).toMatch(/start\|check\|slide\|music\|video\|push/);
  });
});
