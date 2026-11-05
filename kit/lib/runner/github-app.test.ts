// What a job that runs as a GitHub App starts with (PRD 2433, s2): its variables, and the `gh` on its PATH,
// run for real against a fake `gh` and a fake token command in a temporary home. No test holds a real token.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyJobGhConfig, findGh, forgetJobGhConfig, ghShim, ghShimDir, githubJobEnv, installGhShim, jobGhConfigDir, shellQuote } from './github-app.ts';

const FAKE_TOKEN = ['ghs', 'fakeInstallationTokenForTheShim0123456789'].join('_');

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
    const env = githubJobEnv({ bot, tokenCommand, shimDir: '/h/.config/omni/runner/bin', path: '/usr/bin:/bin', ghConfigDir: '/h/.config/omni/runner/gh/job-7' });
    expect(env).toMatchObject({
      OMNI_GITHUB_APP: 'omni-acme[bot]',
      GIT_AUTHOR_NAME: 'omni-acme[bot]',
      GIT_AUTHOR_EMAIL: '123+omni-acme[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'omni-acme[bot]',
      GIT_COMMITTER_EMAIL: '123+omni-acme[bot]@users.noreply.github.com',
      PATH: '/h/.config/omni/runner/bin:/usr/bin:/bin',
      GH_CONFIG_DIR: '/h/.config/omni/runner/gh/job-7',
    });
  });

  it('sends GitHub over HTTPS with the token: an emptied, then the app’s credential helper, and two insteadOf', () => {
    const env = githubJobEnv({ bot, tokenCommand, shimDir: '/s', path: '/bin', ghConfigDir: '/g' });
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
    const env = githubJobEnv({ bot, tokenCommand, shimDir: '/s', path: '/bin', ghConfigDir: '/g' });
    expect(Object.values(env).join('\n')).not.toMatch(/ghs_|ghp_/);
    expect(Object.keys(env)).not.toContain('GH_TOKEN');
    expect(Object.keys(env)).not.toContain('GITHUB_TOKEN');
  });

  it('puts the shim alone on PATH when the runner has none', () => {
    expect(githubJobEnv({ bot, tokenCommand, shimDir: '/s', path: undefined, ghConfigDir: '/g' }).PATH).toBe('/s');
    expect(githubJobEnv({ bot, tokenCommand, shimDir: '/s', path: '', ghConfigDir: '/g' }).PATH).toBe('/s');
  });
});

describe('a gh the job reaches ahead of the shim (bug 2665)', () => {
  const bot = { login: 'omni-acme[bot]', email: '123+omni-acme[bot]@users.noreply.github.com' };

  /**
   * A machine whose own `gh` is signed in as a person, the way `gh auth login` leaves it: `hosts.yml` under
   * `$GH_CONFIG_DIR`, else `$XDG_CONFIG_HOME/gh`, else `~/.config/gh`. The fake `gh` reads it as the real one
   * does, and acts as the token it is handed before any login.
   */
  function signedInMachine() {
    const m = machine();
    writeFileSync(
      join(m.bin, 'gh'),
      [
        '#!/bin/sh',
        'if [ -n "$GH_TOKEN" ]; then printf "as the token %s\\n" "$GH_TOKEN"; exit 0; fi',
        'dir="${GH_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/gh}"',
        'if [ -f "$dir/hosts.yml" ]; then',
        '  while read -r key value; do [ "$key" = user: ] && printf "as %s\\n" "$value"; done < "$dir/hosts.yml"',
        '  exit 0',
        'fi',
        'echo "You are not logged into any GitHub hosts. To log in, run: gh auth login" >&2',
        'exit 4',
        '',
      ].join('\n'),
    );
    chmodSync(join(m.bin, 'gh'), 0o755);
    mkdirSync(join(m.home, '.config', 'gh'), { recursive: true });
    writeFileSync(join(m.home, '.config', 'gh', 'hosts.yml'), 'github.com:\n    git_protocol: https\n    user: ada-personal\n');
    const shimDir = installGhShim({ home: m.home, tokenCommand: m.tokenCommand, path: m.bin });
    // The empty folder the runner makes for the job's gh, as it makes it before the session starts.
    const ghConfigDir = join(m.home, 'job gh');
    mkdirSync(ghConfigDir);
    const env = { HOME: m.home, PATH: m.bin, ...githubJobEnv({ bot, tokenCommand: m.tokenCommand, shimDir, path: m.bin, ghConfigDir }) };
    return { ...m, env };
  }

  /** `script` in a shell started with `env`, as a job's agent runs a command. */
  const shell = (env: Record<string, string>, script: string) => spawnSync('/bin/sh', ['-c', script], { env, encoding: 'utf8' });

  it('is signed in as nobody when a profile puts the machine’s gh back first on PATH: it fails, never acting as the person', () => {
    const { env, bin } = signedInMachine();
    const result = shell(env, `PATH=${shellQuote(bin)}:"$PATH"; gh pr create --fill`);
    expect(result.stdout).not.toContain('ada-personal');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('not logged into any GitHub hosts');
  });

  it('is signed in as nobody when the job runs the machine’s gh by its full path', () => {
    const { env, bin } = signedInMachine();
    const result = shell(env, `${shellQuote(join(bin, 'gh'))} pr ready 42`);
    expect(result.stdout).not.toContain('ada-personal');
    expect(result.status).not.toBe(0);
  });

  it('still acts as the app through the shim, the PATH the runner gave', () => {
    const { env } = signedInMachine();
    const result = shell(env, 'gh pr create --fill');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`as the token ${FAKE_TOKEN}\n`);
  });
});

describe('the job’s own gh folder (bug 2665)', () => {
  it('lives beside the shim, one per job, and names none for an id that is no job’s', () => {
    expect(jobGhConfigDir('/h', '7')).toBe('/h/.config/omni/runner/gh/job-7');
    expect(jobGhConfigDir('/h', 'a_b-9')).toBe('/h/.config/omni/runner/gh/job-a_b-9');
    expect(jobGhConfigDir('/h', '../x')).toBeNull();
    expect(jobGhConfigDir('/h', '')).toBeNull();
    expect(() => emptyJobGhConfig('/h', '../x')).toThrow('no gh folder for job ../x');
  });

  it('is made empty, for the runner’s user alone, whatever a former job of that id left in it', () => {
    const { home } = machine();
    const dir = emptyJobGhConfig(home, '7');
    writeFileSync(join(dir, 'hosts.yml'), 'github.com:\n    user: ada-personal\n');
    expect(emptyJobGhConfig(home, '7')).toBe(dir);
    expect(readdirSync(dir)).toEqual([]);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  it('is removed once the job has ended, and forgetting a job that has none, or no job, does nothing', () => {
    const { home } = machine();
    const dir = emptyJobGhConfig(home, '7');
    forgetJobGhConfig(home, '7');
    expect(existsSync(dir)).toBe(false);
    expect(() => {
      forgetJobGhConfig(home, '7');
      forgetJobGhConfig(home, '../x');
    }).not.toThrow();
  });
});
