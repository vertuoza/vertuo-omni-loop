// PRD #324, slices s1 and s4: `omni statusline` through `main()` — Claude Code's JSON on stdin, the
// session line out, then the PRD of the session's branch with its stage (or the no-PRD line) where the
// loop is installed, exit 0 and nothing on stderr every time.
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { writeMode } from '../lib/ask/local-state.mjs';
import { makeRepo } from '../test/fixture.mjs';
import { COMMAND_TABLE } from './commands/index.mjs';
import { main } from './omni.mjs';

const CLI = fileURLToPath(new URL('./omni.mjs', import.meta.url));
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };
const NOW = Date.parse('2026-09-28T12:00:00Z');
const MINUTE = 60_000;
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const PLAIN = { NO_COLOR: '1' };
const NO_PRD = 'no PRD · /omni:brainstorm to start';
const BAR = '█████░░░░░';

/** Claude Code's JSON for a session in `dir`: 58.9 % of the context, 25.4 % of the 5-hour window, 90 minutes left. */
function payload(dir, more = {}) {
  return JSON.stringify({
    session_id: 'abc',
    cwd: dir,
    model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
    workspace: { current_dir: dir, project_dir: dir },
    context_window: { used_percentage: 58.9 },
    rate_limits: { five_hour: { used_percentage: 25.4, resets_at: (NOW + 90 * MINUTE) / 1000 } },
    ...more,
  });
}

/** `execFileSync`, with every call it runs recorded as `<file> <args…>`. */
function recordingExec() {
  const calls = [];
  const exec = (file, args, options) => {
    calls.push([file, ...args].join(' '));
    return execFileSync(file, args, options);
  };
  return { calls, exec };
}

/** Runs `omni statusline` in `cwd` with `stdin` as its input: `{ code, out, err, calls }`. */
async function statusline(cwd, stdin, options = {}) {
  const out = [];
  const err = [];
  const { calls, exec } = recordingExec();
  const code = await main(['statusline'], {
    cwd,
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    exec,
    env: PLAIN,
    now: () => NOW,
    stdin,
    ...options,
  });
  return { code, out: out.join(''), err: err.join(''), calls };
}

const neverFetches = (calls) => calls.every((call) => !/^git\b.*\bfetch\b/.test(call) && !/^gh\b/.test(call));

describe('omni statusline', () => {
  it('is in the command table', () => {
    expect(Object.keys(COMMAND_TABLE)).toContain('statusline');
    expect(COMMAND_TABLE.statusline.withoutContext).toBe(true);
  });

  it('prints the session line, then the no-PRD line, where the loop is installed', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeMode(root, { host: 'ask.example.test' });
    const run = await statusline(root, payload(root));
    expect(run).toMatchObject({
      code: 0,
      err: '',
      out: `Opus 5.5 · context ${BAR} 58% · usage 25%, resets in 1h30 · ask on\n${NO_PRD}\n`,
    });
    expect(neverFetches(run.calls)).toBe(true);
  });

  it('colours the context bar and its percentage unless NO_COLOR is set', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const coloured = await statusline(root, payload(root), { env: {} });
    expect(coloured.out).toBe(`Opus 5.5 · context ${YELLOW}${BAR} 58%${RESET} · usage 25%, resets in 1h30\n${NO_PRD}\n`);
    const plain = await statusline(root, payload(root), { env: { NO_COLOR: '1' } });
    expect(plain.out).not.toContain('\x1b');
  });

  it('reads the session folder from the JSON, not from where it runs', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const elsewhere = mkdtempSync(join(tmpdir(), 'omni-elsewhere-'));
    expect((await statusline(elsewhere, payload(root))).out).toContain(`\n${NO_PRD}\n`);
    expect((await statusline(root, payload(elsewhere))).out).not.toContain(NO_PRD);
  });

  it('leaves out the usage once its reset has passed, and `ask on` while ask mode is off', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const run = await statusline(root, payload(root), { now: () => NOW + 91 * MINUTE });
    expect(run.out).toBe(`Opus 5.5 · context ${BAR} 58%\n${NO_PRD}\n`);
  });

  it('prints only line 1 in a repository with no config, and outside any repository', async () => {
    const bare = makeRepo({ git: true });
    const inBare = await statusline(bare.root, payload(bare.root));
    expect(inBare).toMatchObject({ code: 0, err: '', out: `Opus 5.5 · context ${BAR} 58% · usage 25%, resets in 1h30\n` });
    const outside = mkdtempSync(join(tmpdir(), 'omni-outside-'));
    const nowhere = await statusline(outside, payload(outside));
    expect(nowhere).toMatchObject({ code: 0, err: '', out: `Opus 5.5 · context ${BAR} 58% · usage 25%, resets in 1h30\n` });
  });

  it('prints `omni` for text that is not JSON, and for no text at all', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    for (const stdin of ['not json at all', '', '[1, 2]']) {
      expect(await statusline(root, stdin)).toMatchObject({ code: 0, err: '', out: 'omni\n' });
    }
  });

  it('prints `context —` early in a session, when Claude Code sends no percentage', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const run = await statusline(root, payload(root, { context_window: { used_percentage: null }, rate_limits: undefined }));
    expect(run.out).toBe(`Opus 5.5 · context —\n${NO_PRD}\n`);
  });

  it('prints line 1 from the JSON alone when its reader throws', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeMode(root, { host: 'ask.example.test' });
    const readFacts = () => {
      throw new Error('the disk is gone');
    };
    const run = await statusline(root, payload(root), { readFacts });
    expect(run).toMatchObject({ code: 0, err: '', out: `Opus 5.5 · context ${BAR} 58% · usage 25%, resets in 1h30\n` });
  });

  it('exits 0 with nothing on stderr when its output cannot be written', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const err = [];
    const code = await main(['statusline'], {
      cwd: root,
      stdout: { write: () => { throw new Error('EPIPE'); } },
      stderr: { write: (s) => err.push(s) },
      env: PLAIN,
      stdin: payload(root),
    });
    expect({ code, err: err.join('') }).toEqual({ code: 0, err: '' });
  });

  it.each([40, 80, 200])('fits every line within COLUMNS=%i', async (columns) => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeMode(root, { host: 'ask.example.test' });
    for (const env of [{ COLUMNS: String(columns) }, { COLUMNS: String(columns), NO_COLOR: '1' }]) {
      const run = await statusline(root, payload(root), { env });
      const lines = run.out.replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(0, -1);
      expect(lines).toHaveLength(2);
      for (const line of lines) expect([...line].length).toBeLessThanOrEqual(columns);
      expect(lines[0].endsWith('…')).toBe(columns < 70);
    }
  });

  it('reads COLUMNS as 80 when it is unset or not a number', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const long = payload(root, { model: { display_name: 'A model whose display name is long enough to push the line past eighty' } });
    for (const env of [PLAIN, { ...PLAIN, COLUMNS: 'wide' }]) {
      const [line] = (await statusline(root, long, { env })).out.split('\n');
      expect([...line].length).toBe(80);
      expect(line.endsWith('…')).toBe(true);
    }
  });

  it('reads its stdin from the process when run as a command', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const run = await new Promise((resolve) => {
      const child = execFile(process.execPath, [CLI, 'statusline'], { cwd: root, env: { ...process.env, NO_COLOR: '1', COLUMNS: '200' }, encoding: 'utf8' }, (error, stdout, stderr) => {
        resolve({ code: error ? error.code : 0, stdout, stderr });
      });
      child.stdin.end(payload(root, { rate_limits: undefined }));
    });
    expect(run).toEqual({ code: 0, stderr: '', stdout: `Opus 5.5 · context ${BAR} 58%\n${NO_PRD}\n` });
  });
});

const DELIVERY = '.omni-loop/delivery';
const LONG_TOPIC = 'statusline-for-claude-code';

/** Runs git in `cwd` as a fixture author. */
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe', encoding: 'utf8' });

/** Writes `files` under `root` and commits them. */
function commit(root, files, message = 'change') {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', message);
}

/**
 * A checkout cloned from a local bare repository whose default branch holds the shipped folder
 * `0003-alpha` and the inbox folders `0007-bravo`, `0009-charlie` and `0013-<LONG_TOPIC>`, with the
 * remote branches `feat/bravo` (a source file and two open items), `feat/charlie` (only its phase-0
 * copy), `feat/<LONG_TOPIC>` (one open item and nothing else) and `docs/phase-0-delta` (the folder
 * `0011-delta`, not on the default branch). `on(branch, start)` checks `branch` out in a worktree of
 * its own and returns its folder.
 */
function originFixture() {
  const seed = makeRepo({ git: true, files: CONFIG });
  const withConfigOnly = git(seed.root, 'rev-parse', 'HEAD').trim();
  const charlie = {
    [`${DELIVERY}/inbox/0009-charlie/spec.md`]: '# charlie\n',
    'acceptance/charlie.feature.pending': 'Feature: charlie\n',
  };
  commit(seed.root, {
    [`${DELIVERY}/shipped/0003-alpha/spec.md`]: '# alpha\n',
    [`${DELIVERY}/inbox/0007-bravo/spec.md`]: '# bravo\n',
    [`${DELIVERY}/inbox/0013-${LONG_TOPIC}/spec.md`]: '# long\n',
    ...charlie,
  }, 'the PRDs');
  git(seed.root, 'checkout', '-q', '-b', 'feat/bravo');
  commit(seed.root, {
    'src/app.mjs': 'export const app = 1;\n',
    [`${DELIVERY}/outbox/0007-bravo/s1-01-first.md`]: '# first\n',
    [`${DELIVERY}/outbox/0007-bravo/s1-02-second.md`]: '# second\n',
    [`${DELIVERY}/outbox/0007-bravo/settled.md`]: '# settled\n',
    [`${DELIVERY}/outbox/0007-bravo/accounts/s1.md`]: '# account\n',
  });
  git(seed.root, 'checkout', '-q', '-b', `feat/${LONG_TOPIC}`, 'main');
  commit(seed.root, { [`${DELIVERY}/outbox/0013-${LONG_TOPIC}/s1-01-only.md`]: '# only\n' });
  git(seed.root, 'checkout', '-q', '-b', 'feat/charlie', withConfigOnly);
  commit(seed.root, charlie, 'phase-0 copy');
  git(seed.root, 'checkout', '-q', '-b', 'docs/phase-0-delta', 'main');
  commit(seed.root, { [`${DELIVERY}/inbox/0011-delta/spec.md`]: '# delta\n' });
  git(seed.root, 'checkout', '-q', 'main');

  const bare = mkdtempSync(join(tmpdir(), 'omni-origin-'));
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  git(seed.root, 'remote', 'add', 'origin', bare);
  git(seed.root, 'push', '-q', 'origin', 'main', 'feat/bravo', 'feat/charlie', `feat/${LONG_TOPIC}`, 'docs/phase-0-delta');
  const root = join(mkdtempSync(join(tmpdir(), 'omni-clone-')), 'work');
  git(tmpdir(), 'clone', '-q', bare, root);
  const on = (branch, start = 'origin/main') => {
    const dir = join(mkdtempSync(join(tmpdir(), 'omni-worktree-')), 'wt');
    git(root, 'worktree', 'add', '-q', '-b', branch, dir, start);
    return dir;
  };
  return { root, on };
}

describe('omni statusline: line 2 names the PRD of the session branch', () => {
  const fixture = originFixture();
  const line2 = async (dir, options = {}) => {
    const run = await statusline(dir, payload(dir), options);
    expect({ code: run.code, err: run.err }).toEqual({ code: 0, err: '' });
    expect(neverFetches(run.calls)).toBe(true);
    return run.out.split('\n')[1];
  };

  it('names the slice, the stage and the open items on a slice branch', async () => {
    expect(await line2(fixture.on('feat/bravo--s2', 'origin/feat/bravo'))).toBe('PRD 7 bravo · s2 · outbox · 2 open items');
  });

  it('names the stage and the open items on the feature branch', async () => {
    expect(await line2(fixture.on('feat/bravo', 'origin/feat/bravo'))).toBe('PRD 7 bravo · outbox · 2 open items');
  });

  it('reads inbox for a feature branch that is only its phase-0 copy', async () => {
    expect(await line2(fixture.on('feat/charlie', 'origin/feat/charlie'))).toBe('PRD 9 charlie · inbox');
  });

  it('reads in review on a phase-0 branch whose folder is not on the default branch', async () => {
    expect(await line2(fixture.on('docs/phase-0-delta', 'origin/docs/phase-0-delta'))).toBe('PRD 11 delta · in review');
  });

  it('reads shipped, and nothing after, on a branch naming a shipped PRD', async () => {
    expect(await line2(fixture.on('feat/alpha'))).toBe('PRD 3 alpha · shipped');
    expect(await line2(fixture.on('feat/alpha--s9'))).toBe('PRD 3 alpha · shipped');
  });

  it('reads outbox for open items alone, and says `1 open item`', async () => {
    const dir = fixture.on(`feat/${LONG_TOPIC}--s4`, `origin/feat/${LONG_TOPIC}`);
    expect(await line2(dir, { env: { ...PLAIN, COLUMNS: '200' } })).toBe(`PRD 13 ${LONG_TOPIC} · s4 · outbox · 1 open item`);
  });

  it('cuts the topic to 8 characters ending in `…` before anything else when the line is too wide', async () => {
    const dir = fixture.on(`feat/${LONG_TOPIC}--s5`, `origin/feat/${LONG_TOPIC}`);
    expect(await line2(dir, { env: { ...PLAIN, COLUMNS: '43' } })).toBe('PRD 13 statusl… · s5 · outbox · 1 open item');
    expect(await line2(dir, { env: { ...PLAIN, COLUMNS: '40' } })).toBe('PRD 13 statusl… · s5 · outbox · 1 open …');
  });

  it('reads no PRD on the default branch, and on a branch whose topic has no folder', async () => {
    expect(await line2(fixture.root)).toBe(NO_PRD);
    expect(await line2(fixture.on('feat/zulu'))).toBe(NO_PRD);
  });

  it('reads the PRD from the session folder the JSON names, from anywhere in its checkout', async () => {
    const dir = fixture.on('feat/bravo--s3', 'origin/feat/bravo');
    const run = await statusline(fixture.root, payload(join(dir, 'src')));
    expect(run.out.split('\n')[1]).toBe('PRD 7 bravo · s3 · outbox · 2 open items');
  });
});
