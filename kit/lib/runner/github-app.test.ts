// What a job that runs as a GitHub App starts with (PRD 2433, s2): its variables, and the `gh` on its PATH,
// run for real against a fake `gh` and a fake token command in a temporary home. No test holds a real token.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findGh, ghShim, ghShimDir, githubJobEnv, installGhShim, shellQuote } from './github-app.ts';

const FAKE_TOKEN = 'ghs_fakeInstallationTokenForTheShim0123456789';

/** A temporary home with a fake `gh` that prints what it got, and a fake token command that prints `FAKE_TOKEN` (or fails). */
function machine(options: { gh?: boolean; tokenFails?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "omni-github-app-with 'quote' "));
  const bin = join(dir, 'system bin');
  mkdirSync(bin);
  if (options.gh !== false) {
    writeFileSync(join(bin, 'gh'), '#!/bin/sh\nprintf "real gh | GH_TOKEN=%s | args=%s\\n" "$GH_TOKEN" "$*"\n');
    chmodSync(join(bin, 'gh'), 0o755);
  }
  const tokenScript = join(dir, 'token.mjs');
  writeFileSync(tokenScript, options.tokenFails === true ? "console.error('omni runner: no token here'); process.exit(1);\n" : `console.log(${JSON.stringify(FAKE_TOKEN)});\n`);
  return { home: dir, bin, tokenCommand: [process.execPath, tokenScript] };
}

describe('shellQuote', () => {
  it('makes one shell word of any text, a single quote included', () => {
    expect(shellQuote('/usr/bin/node')).toBe("'/usr/bin/node'");
    expect(shellQuote("it's here")).toBe("'it'\\''s here'");
    const out = execFileSync('/bin/sh', ['-c', `printf '%s' ${shellQuote("a b 'c' $HOME `x`")}`], { encoding: 'utf8' });
    expect(out).toBe("a b 'c' $HOME `x`");
  });
});

describe('findGh', () => {
  it('finds the first runnable gh on the path, outside the shim’s own folder', () => {
    const { bin, home } = machine();
    const shim = ghShimDir(home);
    mkdirSync(shim, { recursive: true });
    writeFileSync(join(shim, 'gh'), '#!/bin/sh\n');
    chmodSync(join(shim, 'gh'), 0o755);
    expect(findGh([shim, bin].join(delimiter), shim)).toBe(join(bin, 'gh'));
    expect(findGh(['', join(home, 'missing'), bin].join(delimiter), shim)).toBe(join(bin, 'gh'));
  });

  it('finds none when the path has none, only the shim, a gh that cannot run, or no path at all', () => {
    const { bin, home } = machine({ gh: false });
    const shim = ghShimDir(home);
    mkdirSync(shim, { recursive: true });
    writeFileSync(join(shim, 'gh'), '#!/bin/sh\n');
    chmodSync(join(shim, 'gh'), 0o755);
    expect(findGh([shim, bin].join(delimiter), shim)).toBeNull();
    writeFileSync(join(bin, 'gh'), 'not runnable');
    chmodSync(join(bin, 'gh'), 0o644);
    expect(findGh(bin, shim)).toBeNull();
    mkdirSync(join(home, 'dir-bin', 'gh'), { recursive: true });
    expect(findGh(join(home, 'dir-bin'), shim)).toBeNull();
    expect(findGh(undefined, shim)).toBeNull();
    expect(findGh('', shim)).toBeNull();
  });
});

describe("the gh a job running as an app finds first", () => {
  function shimOf(options: { gh?: boolean; tokenFails?: boolean } = {}) {
    const m = machine(options);
    const dir = installGhShim({ home: m.home, tokenCommand: m.tokenCommand, path: m.bin });
    return { ...m, gh: join(dir, 'gh'), dir };
  }
  const run = (gh: string, args: string[]) => spawnSync('/bin/sh', [gh, ...args], { encoding: 'utf8' });

  it('lives under the home, runnable by its owner, and is rewritten whole each time a job starts', () => {
    const { gh, dir, home, tokenCommand, bin } = shimOf();
    expect(dir).toBe(ghShimDir(home));
    expect(statSync(gh).mode & 0o777).toBe(0o755);
    const first = readFileSync(gh, 'utf8');
    expect(installGhShim({ home, tokenCommand, path: bin })).toBe(dir);
    expect(readFileSync(gh, 'utf8')).toBe(first);
  });

  it('runs the real gh with the job’s token as GH_TOKEN, every argument kept', () => {
    const { gh } = shimOf();
    const result = run(gh, ['issue', 'list', '--label', 'a b']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`real gh | GH_TOKEN=${FAKE_TOKEN} | args=issue list --label a b\n`);
  });

  it('answers gh auth token with the job’s token, and never asks the real gh', () => {
    const { gh } = shimOf();
    const result = run(gh, ['auth', 'token']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${FAKE_TOKEN}\n`);
  });

  it('fails with the command’s own words, and runs nothing, when the job has no token to give', () => {
    const { gh } = shimOf({ tokenFails: true });
    const result = run(gh, ['issue', 'list']);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('omni runner: no token here');
  });

  it('exits 127, as a missing command does, when the machine has no gh', () => {
    const { gh } = shimOf({ gh: false });
    const result = run(gh, ['issue', 'list']);
    expect(result.status).toBe(127);
    expect(result.stderr).toContain('gh: not found');
  });

  it('never holds a token itself: only the command that reads it', () => {
    const text = ghShim(['/usr/bin/node', '/opt/omni.mjs', 'runner', 'github-token'], '/usr/bin/gh');
    expect(text).toContain("token=$('/usr/bin/node' '/opt/omni.mjs' 'runner' 'github-token') || exit 1");
    expect(text).not.toMatch(/ghs_|ghp_/);
  });
});

describe('githubJobEnv', () => {
  const bot = { login: 'omni-acme[bot]', email: '123+omni-acme[bot]@users.noreply.github.com' };
  const tokenCommand = ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'github-token'];

  it('names the app, makes the bot every commit’s author and committer, and puts the shim first on PATH', () => {
    const env = githubJobEnv({ bot, tokenCommand, shimDir: '/h/.config/omni/runner/bin', path: '/usr/bin:/bin' });
    expect(env).toMatchObject({
      OMNI_GITHUB_APP: 'omni-acme[bot]',
      GIT_AUTHOR_NAME: 'omni-acme[bot]',
      GIT_AUTHOR_EMAIL: '123+omni-acme[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'omni-acme[bot]',
      GIT_COMMITTER_EMAIL: '123+omni-acme[bot]@users.noreply.github.com',
      PATH: '/h/.config/omni/runner/bin:/usr/bin:/bin',
    });
  });

  it('sends GitHub over HTTPS with the token: an emptied, then the app’s credential helper, and two insteadOf', () => {
    const env = githubJobEnv({ bot, tokenCommand, shimDir: '/s', path: '/bin' });
    expect(env).toMatchObject({
      GIT_CONFIG_COUNT: '4',
      GIT_CONFIG_KEY_0: 'credential.https://github.com.helper',
      GIT_CONFIG_VALUE_0: '',
      GIT_CONFIG_KEY_1: 'credential.https://github.com.helper',
      GIT_CONFIG_VALUE_1: "!'/usr/bin/node' '/opt/omni.mjs' 'runner' 'github-token' '--git'",
      GIT_CONFIG_KEY_2: 'url.https://github.com/.insteadOf',
      GIT_CONFIG_VALUE_2: 'git@github.com:',
      GIT_CONFIG_KEY_3: 'url.https://github.com/.insteadOf',
      GIT_CONFIG_VALUE_3: 'ssh://git@github.com/',
    });
  });

  it('carries no token: not in a variable, not in a command line', () => {
    const env = githubJobEnv({ bot, tokenCommand, shimDir: '/s', path: '/bin' });
    expect(Object.values(env).join('\n')).not.toMatch(/ghs_|ghp_/);
    expect(Object.keys(env)).not.toContain('GH_TOKEN');
    expect(Object.keys(env)).not.toContain('GITHUB_TOKEN');
  });

  it('puts the shim alone on PATH when the runner has none', () => {
    expect(githubJobEnv({ bot, tokenCommand, shimDir: '/s', path: undefined }).PATH).toBe('/s');
    expect(githubJobEnv({ bot, tokenCommand, shimDir: '/s', path: '' }).PATH).toBe('/s');
  });
});
