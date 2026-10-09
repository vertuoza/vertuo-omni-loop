// PRD #324, slices s1, s4, s5 and s6: `omni statusline` through `main()` — Claude Code's JSON on
// stdin, the session line out, then the PRD of the session's branch, else the one the session last
// worked on, with its stage and, in the outbox, the slices of its cached board (or the no-PRD line)
// where the loop is installed, exit 0 and nothing on stderr every time; and `--refresh <n>`, the
// background half that builds the board with `gh` and writes it. PRD #1208, slice s5: line 2 drawn
// from `omni now` for every kind, and the refresh started with `--kind` for the links. The spawn is
// injected: no test here starts a real refresh.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { writeMode } from '../lib/ask/local-state.ts';
import { BOARD_DIR, boardFile, lockFile } from '../lib/statusline/board-cache.ts';
import { writeRecord } from '../lib/statusline/sessions.ts';
import { LOOP_FILE } from '../lib/loop/local.ts';
import { assertDefined } from '../test/assert.ts';
import { makeRepo } from '../test/fixture.ts';
import { COMMAND_TABLE } from './commands/index.ts';
import { main } from './omni.ts';
import type { ExecFileSyncOptions } from 'node:child_process';
import { realExec } from '../test/fixture.ts';
import { parsePrd } from '../lib/ids.ts';

const CLI = fileURLToPath(new URL('./omni.ts', import.meta.url));
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };
const NOW = Date.parse('2026-09-28T12:00:00Z');
const MINUTE = 60_000;
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const PLAIN = { NO_COLOR: '1' };
const NO_PRD = 'no PRD · /omni:brainstorm to start';
const BAR = '█████░░░░░';

/** Claude Code's JSON for a session in `dir`: 58.9 % of the context, 25.4 % of the 5-hour window, 90 minutes left. */
function payload(dir: string, more = {}) {
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
  const calls: string[] = [];
  const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions) => {
    calls.push([file, ...args].join(' '));
    return realExec(file, args, options);
  };
  return { calls, exec };
}

/** A spawn that starts nothing: it records each call as `{ command, args, options }`. */
function recordingSpawn() {
  const spawns: { command: string; args: readonly string[]; options: unknown }[] = [];
  const spawn = (command: string, args: readonly string[], options: unknown) => {
    spawns.push({ command, args, options });
    return { unref() {}, on() { return this; } };
  };
  return { spawns, spawn };
}

/** Runs `omni statusline` in `cwd` with `stdin` as its input: `{ code, out, err, calls, spawns }`. */
async function statusline(cwd: string | undefined, stdin: string, options: Record<string, unknown> = {}, args: string[] = []) {
  const out: string[] = [];
  const err: string[] = [];
  const { calls, exec } = recordingExec();
  const { spawns, spawn } = recordingSpawn();
  const code = await main(['statusline', ...args], {
    cwd: cwd as string,
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    exec,
    env: PLAIN,
    now: () => NOW,
    stdin,
    spawn,
    ...options,
  });
  return { code, out: out.join(''), err: err.join(''), calls, spawns };
}

const neverFetches = (calls: readonly string[]) => calls.every((call) => !/^git\b.*\bfetch\b/.test(call) && !/^gh\b/.test(call));

describe('omni statusline', () => {
  it('is in the command table', () => {
    expect(Object.keys(COMMAND_TABLE)).toContain('statusline');
    expect(COMMAND_TABLE.statusline?.withoutContext).toBe(true);
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
    const err: string[] = [];
    const code = await main(['statusline'], {
      cwd: root,
      stdout: { write: () => { throw new Error('EPIPE'); } },
      stderr: { write: (s) => err.push(s) },
      env: PLAIN,
      stdin: payload(root),
      spawn: recordingSpawn().spawn,
    });
    expect({ code, err: err.join('') }).toEqual({ code: 0, err: '' });
  });

  it.each([40, 80, 200])('fits every line within COLUMNS=%i', async (columns: number) => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeMode(root, { host: 'ask.example.test' });
    for (const env of [{ COLUMNS: String(columns) }, { COLUMNS: String(columns), NO_COLOR: '1' }]) {
      const run = await statusline(root, payload(root), { env });
      const lines = run.out.replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(0, -1);
      expect(lines).toHaveLength(2);
      for (const line of lines) expect(Array.from(line).length).toBeLessThanOrEqual(columns);
      expect(lines[0]?.endsWith('…')).toBe(columns < 70);
    }
  });

  it('reads COLUMNS as 80 when it is unset or not a number', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const long = payload(root, { model: { display_name: 'A model whose display name is long enough to push the line past eighty' } });
    for (const env of [PLAIN, { ...PLAIN, COLUMNS: 'wide' }]) {
      const [line] = (await statusline(root, long, { env })).out.split('\n');
      assertDefined(line, 'the first line');
      expect(Array.from(line).length).toBe(80);
      expect(line.endsWith('…')).toBe(true);
    }
  });

  it('reads its stdin from the process when run as a command', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const run = await new Promise((resolve) => {
      const child = execFile(process.execPath, [CLI, 'statusline'], { cwd: root, env: { ...process.env, NO_COLOR: '1', COLUMNS: '200' }, encoding: 'utf8' }, (error, stdout, stderr) => {
        resolve({ code: error ? error.code : 0, stdout, stderr });
      });
      const { stdin } = child;
      assertDefined(stdin, 'the child process stdin');
      stdin.end(payload(root, { rate_limits: undefined }));
    });
    expect(run).toEqual({ code: 0, stderr: '', stdout: `Opus 5.5 · context ${BAR} 58%\n${NO_PRD}\n` });
  });
});

const DELIVERY = '.omni-loop/delivery';
const LONG_TOPIC = 'statusline-for-claude-code';

/** Runs git in `cwd` as a fixture author. */
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe', encoding: 'utf8' });

/** Writes `files` under `root` and commits them. */
function commit(root: string, files: Record<string, string>, message = 'change') {
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
  const on = (branch: string, start = 'origin/main') => {
    const dir = join(mkdtempSync(join(tmpdir(), 'omni-worktree-')), 'wt');
    git(root, 'worktree', 'add', '-q', '-b', branch, dir, start);
    return dir;
  };
  return { root, on };
}

describe('omni statusline: line 2 names the PRD of the session branch', () => {
  const fixture = originFixture();
  const line2 = async (dir: string, options = {}) => {
    const run = await statusline(dir, payload(dir), options);
    expect({ code: run.code, err: run.err }).toEqual({ code: 0, err: '' });
    expect(neverFetches(run.calls)).toBe(true);
    return run.out.split('\n')[1];
  };

  it('names the stage and the open items on a slice branch, and no longer the slice it names (PRD 1208)', async () => {
    expect(await line2(fixture.on('feat/bravo--s2', 'origin/feat/bravo'))).toBe('PRD 7 bravo · outbox · 2 open items');
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
    expect(await line2(dir, { env: { ...PLAIN, COLUMNS: '200' } })).toBe(`PRD 13 ${LONG_TOPIC} · outbox · 1 open item`);
  });

  it('cuts the topic to 8 characters ending in `…` before anything else when the line is too wide', async () => {
    const dir = fixture.on(`feat/${LONG_TOPIC}--s5`, `origin/feat/${LONG_TOPIC}`);
    expect(await line2(dir, { env: { ...PLAIN, COLUMNS: '38' } })).toBe('PRD 13 statusl… · outbox · 1 open item');
    expect(await line2(dir, { env: { ...PLAIN, COLUMNS: '35' } })).toBe('PRD 13 statusl… · outbox · 1 open …');
  });

  it('reads no PRD on the default branch, and on a branch whose topic has no folder', async () => {
    expect(await line2(fixture.root)).toBe(NO_PRD);
    expect(await line2(fixture.on('feat/zulu'))).toBe(NO_PRD);
  });

  it('reads the PRD from the session folder the JSON names, from anywhere in its checkout', async () => {
    const dir = fixture.on('feat/bravo--s3', 'origin/feat/bravo');
    const run = await statusline(fixture.root, payload(join(dir, 'src')));
    expect(run.out.split('\n')[1]).toBe('PRD 7 bravo · outbox · 2 open items');
  });
});

describe('omni statusline: line 2 names the PRD the session last worked on', () => {
  const fixture = originFixture();
  /** `omni <argv>` in `cwd`, run as Claude Code runs a command of the session `abc`: its exit code. */
  const inSession = (argv: readonly string[], cwd: string) => main(argv, { cwd, stdout: { write() {} }, stderr: { write() {} }, env: { CLAUDE_CODE_SESSION_ID: 'abc' } });
  const line2 = async (dir: string, more = {}) => {
    const run = await statusline(dir, payload(dir, more));
    expect({ code: run.code, err: run.err }).toEqual({ code: 0, err: '' });
    expect(neverFetches(run.calls)).toBe(true);
    return run.out.split('\n')[1];
  };

  it('names on the default branch the PRD the latest command of the session named', async () => {
    expect(await line2(fixture.root)).toBe(NO_PRD);
    expect(await inSession(['prd', '7'], fixture.root)).toBe(0);
    expect(await line2(fixture.root)).toBe('PRD 7 bravo · outbox · 2 open items');
    expect(await inSession(['prd', '9'], fixture.root)).toBe(0);
    expect(await line2(fixture.root)).toBe('PRD 9 charlie · inbox');
  });

  it('reads a record written from a worktree, in the main checkout', async () => {
    const worktree = fixture.on('scratch');
    expect(await inSession(['prd', '3'], worktree)).toBe(0);
    expect(await line2(fixture.root)).toBe('PRD 3 alpha · shipped');
    expect(await line2(worktree)).toBe('PRD 3 alpha · shipped');
  });

  it('lets the branch win over the record', async () => {
    expect(await inSession(['prd', '7'], fixture.root)).toBe(0);
    expect(await line2(fixture.on('feat/charlie', 'origin/feat/charlie'))).toBe('PRD 9 charlie · inbox');
    expect(await line2(fixture.on('feat/zulu'))).toBe('PRD 7 bravo · outbox · 2 open items');
  });

  it('reads no PRD for a record whose PRD has no folder, and for a session with no record', async () => {
    expect(await inSession(['prd', '7'], fixture.root)).toBe(0);
    expect(await line2(fixture.root, { session_id: 'someone-else' })).toBe(NO_PRD);
    expect(await line2(fixture.root, { session_id: '../abc' })).toBe(NO_PRD);
    expect(await inSession(['prd', '42'], fixture.root)).toBe(1);
    expect(await line2(fixture.root)).toBe(NO_PRD);
  });
});

const SECOND = 1000;
const iso = (ms: number) => new Date(ms).toISOString();

/** The links file of the `kind` work `n` in the main checkout `root`, written `age` milliseconds before `NOW`. */
function plantLinks(root: string, kind: string, n: number, age: number, links: { label: string; href: string }[] = []) {
  const dir = join(root, '.omni-loop', 'local', 'now');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `links-${kind}-${n}.json`), JSON.stringify({ at: iso(NOW - age), links }));
}

describe('omni statusline: the slices, from a board refreshed in the background', () => {
  const fixture = originFixture();
  const slice = (id: string, wave: number, state: string, name?: string) => ({ id, wave, state, ...(name ? { name } : {}) });
  const FIVE = [slice('s1', 1, 'merged'), slice('s2', 1, 'merged'), slice('s3', 2, 'merged'), slice('s4', 2, 'claimed-stale', 'board'), slice('s5', 4, 'stuck', 'pane')];
  const WIDE = { ...PLAIN, COLUMNS: '200' };
  const REFRESH_7 = [CLI, 'statusline', '--refresh', '7', '--kind', 'prd'];
  // Fresh links for every PRD of the fixture, so that only the board's refresh is started here.
  for (const prd of [3, 7, 9, 11, 13]) plantLinks(fixture.root, 'prd', prd, 0);

  /** PRD `prd`'s board in the fixture's main checkout, written `age` milliseconds before `NOW`. */
  function plantBoard(prd: number, age: number, body: Record<string, unknown>) {
    mkdirSync(join(fixture.root, BOARD_DIR), { recursive: true });
    writeFileSync(boardFile(fixture.root, parsePrd(prd)), JSON.stringify({ at: iso(NOW - age), ...body }));
  }

  /** Line 2 in `dir`, and the refreshes the run started; exit 0, nothing on stderr, no `gh`, no fetch. */
  async function run(dir: string | undefined, env: Record<string, string> = WIDE) {
    const result = await statusline(dir, payload(dir as string), { env });
    expect({ code: result.code, err: result.err }).toEqual({ code: 0, err: '' });
    expect(neverFetches(result.calls)).toBe(true);
    return { line: result.out.split('\n')[1], spawns: result.spawns };
  }

  it('reads building, the wave, the slices in flight and stuck by name, and the open items', async () => {
    plantBoard(7, 30 * SECOND, { slices: FIVE });
    const dir = fixture.on('feat/bravo--s6', 'origin/feat/bravo');
    expect(await run(dir)).toEqual({ line: 'PRD 7 bravo · building · wave 2/4 · now s4 board · stuck s5 pane · 2 open items', spawns: [] });
  });

  it('colours the stuck slices red, unless NO_COLOR is set', async () => {
    plantBoard(7, 30 * SECOND, { slices: FIVE });
    const dir = fixture.on('feat/bravo--s7', 'origin/feat/bravo');
    const { line } = await run(dir, { COLUMNS: '200' });
    expect(line).toBe('PRD 7 bravo · building · wave 2/4 · now s4 board · \x1b[31mstuck s5 pane\x1b[0m · 2 open items');
  });

  it('cuts the slice names first, then the topic, at 60 columns and below', async () => {
    plantBoard(7, 30 * SECOND, { slices: [slice('s1', 1, 'merged'), slice('s2', 2, 'in-flight', 'the tabs and their panes'), slice('s3', 2, 'in-flight', 'the cached board')] });
    const dir = fixture.on('feat/bravo--s15', 'origin/feat/bravo');
    expect((await run(dir, { ...PLAIN, COLUMNS: '61' })).line).toBe('PRD 7 bravo · building · wave 2/2 · now s2, s3 · 2 open items');
    plantBoard(13, 30 * SECOND, { slices: [slice('s1', 1, 'merged'), slice('s2', 2, 'in-flight', 'the tabs and their panes'), slice('s3', 2, 'in-flight', 'the cached board')] });
    const long = fixture.on(`feat/${LONG_TOPIC}--s9`, `origin/feat/${LONG_TOPIC}`);
    expect((await run(long, { ...PLAIN, COLUMNS: '66' })).line).toBe('PRD 13 statuslin… · building · wave 2/2 · now s2, s3 · 1 open item');
    expect((await run(long, { ...PLAIN, COLUMNS: '60' })).line).toBe('PRD 13 statusl… · building · wave 2/2 · now s2, s3 · 1 open…');
    rmSync(boardFile(fixture.root, parsePrd(13)));
  });

  it('reads `all slices merged` when every slice is merged', async () => {
    plantBoard(7, 30 * SECOND, { slices: [slice('s1', 1, 'merged'), slice('s2', 2, 'merged')] });
    expect((await run(fixture.on('feat/bravo--s8', 'origin/feat/bravo'))).line).toBe('PRD 7 bravo · outbox · all slices merged · 2 open items');
  });

  it('reads building for a PRD git reads as inbox once its board shows a slice in flight', async () => {
    plantBoard(9, 30 * SECOND, { slices: [slice('s1', 1, 'in-flight', 'tabs'), slice('s2', 2, 'blocked')] });
    const dir = fixture.on('feat/charlie--s1', 'origin/feat/charlie');
    expect(await run(dir)).toEqual({ line: 'PRD 9 charlie · building · wave 1/2 · now s1 tabs', spawns: [] });
    plantBoard(9, 30 * SECOND, { slices: [slice('s1', 1, 'runnable'), slice('s2', 2, 'blocked')] });
    expect((await run(dir)).line).toBe('PRD 9 charlie · inbox');
  });

  it('starts one detached refresh in the session folder, for the board and the links, when the board is a minute old, and shows it meanwhile', async () => {
    plantBoard(7, 60 * SECOND, { slices: FIVE });
    const dir = fixture.on('feat/bravo--s9', 'origin/feat/bravo');
    const { line, spawns } = await run(dir);
    expect(line).toBe('PRD 7 bravo · building · wave 2/4 · now s4 board · stuck s5 pane · 2 open items');
    expect(spawns).toHaveLength(1);
    const [{ command, args, options }] = spawns as [(typeof spawns)[number]];
    expect(command).toBe(process.execPath);
    expect(args).toEqual(REFRESH_7);
    expect(options).toMatchObject({ cwd: dir, detached: true, stdio: 'ignore' });
  });

  it('shows the stage alone from a board 10 minutes old, or with no board, and starts one refresh', async () => {
    plantBoard(7, 10 * 60 * SECOND, { slices: FIVE });
    const dir = fixture.on('feat/bravo--s10', 'origin/feat/bravo');
    expect(await run(dir)).toMatchObject({ line: 'PRD 7 bravo · outbox · 2 open items', spawns: [{ args: REFRESH_7 }] });
    const missing = fixture.on(`feat/${LONG_TOPIC}--s1`, `origin/feat/${LONG_TOPIC}`);
    expect(await run(missing)).toMatchObject({ line: `PRD 13 ${LONG_TOPIC} · outbox · 1 open item`, spawns: [{ args: [CLI, 'statusline', '--refresh', '13', '--kind', 'prd'] }] });
  });

  it('starts none while a refresh holds the lock', async () => {
    plantBoard(7, 5 * 60 * SECOND, { slices: FIVE });
    writeFileSync(lockFile(fixture.root, parsePrd(7)), JSON.stringify({ at: iso(NOW - 30 * SECOND) }));
    try {
      expect((await run(fixture.on('feat/bravo--s11', 'origin/feat/bravo'))).spawns).toEqual([]);
    } finally {
      writeFileSync(lockFile(fixture.root, parsePrd(7)), JSON.stringify({ at: iso(NOW - 2 * 60 * SECOND) }));
    }
    expect((await run(fixture.on('feat/bravo--s12', 'origin/feat/bravo'))).spawns).toHaveLength(1);
  });

  it('hides the slices after a failed refresh, and tries again 60 seconds after it', async () => {
    plantBoard(7, 59 * SECOND, { error: 'gh: command not found' });
    const dir = fixture.on('feat/bravo--s13', 'origin/feat/bravo');
    expect(await run(dir)).toEqual({ line: 'PRD 7 bravo · outbox · 2 open items', spawns: [] });
    plantBoard(7, 60 * SECOND, { error: 'gh: command not found' });
    expect((await run(dir)).spawns).toHaveLength(1);
  });

  it('starts no board refresh for a shipped PRD, a PRD in review, or no PRD', async () => {
    for (const [dir, line] of [
      [fixture.on('feat/alpha--s1'), 'PRD 3 alpha · shipped'],
      [fixture.on('docs/phase-0-delta', 'origin/docs/phase-0-delta'), 'PRD 11 delta · in review'],
      [fixture.root, NO_PRD],
    ]) {
      expect(await run(dir)).toEqual({ line, spawns: [] });
    }
  });

  it('prints the plain status line for an argument it does not know', async () => {
    const dir = fixture.on('feat/bravo--s14', 'origin/feat/bravo');
    plantBoard(7, 30 * SECOND, { slices: FIVE });
    for (const args of [['--bogus'], ['7'], ['--json']]) {
      const result = await statusline(dir, payload(dir), { env: WIDE }, args);
      expect(result).toMatchObject({ code: 0, err: '', spawns: [] });
      expect(result.out.split('\n')[1]).toBe('PRD 7 bravo · building · wave 2/4 · now s4 board · stuck s5 pane · 2 open items');
    }
  });
});

// PRD #1208, slice s5: line 2 drawn from `omni now` for every kind, and the refresh of the links of
// what the session is on started as the board's is.
describe('omni statusline: line 2 for every kind, and the links refresh', () => {
  const fixture = originFixture();
  const WIDE = { ...PLAIN, COLUMNS: '200' };
  let bugDir: string | undefined;
  /** The worktree on the fix branch of bug 1180, made once. */
  const onBug = (): string => (bugDir ??= fixture.on('fix/login-redirect', 'main'));
  commit(fixture.root, {
    [`${DELIVERY}/bugs/1180-login-redirect/record.md`]: '# bug\n',
    [`${DELIVERY}/visual/1150-sidebar/record.md`]: '# visual\n',
  }, 'the fixes');

  /** Line 2 in `dir` with `more` in the JSON, and the refreshes started; exit 0, nothing on stderr, no `gh`, no fetch. */
  async function run(dir: string, more = {}, env: Record<string, string> = WIDE) {
    const result = await statusline(dir, payload(dir, more), { env });
    expect({ code: result.code, err: result.err }).toEqual({ code: 0, err: '' });
    expect(neverFetches(result.calls)).toBe(true);
    return { line: result.out.split('\n')[1], spawns: result.spawns.map((spawn) => spawn.args) };
  }

  it('reads a bug fix and a visual fix from their fix branch, and starts the refresh of their links', async () => {
    expect(await run(onBug())).toEqual({
      line: 'bug #1180 login-redirect · in progress',
      spawns: [[CLI, 'statusline', '--refresh', '1180', '--kind', 'bug']],
    });
    expect(await run(fixture.on('fix/sidebar', 'main'))).toEqual({
      line: 'visual #1150 sidebar · in progress',
      spawns: [[CLI, 'statusline', '--refresh', '1150', '--kind', 'visual']],
    });
  });

  it('reads `fix PR open` once the links hold its pull request, and starts no refresh while they are fresh', async () => {
    plantLinks(fixture.root, 'bug', 1180, 30 * SECOND, [{ label: 'fix PR #1190', href: 'https://github.com/acme/widgets/pull/1190' }]);
    expect(await run(onBug())).toEqual({ line: 'bug #1180 login-redirect · fix PR open', spawns: [] });
  });

  it('reads a fix the session recorded, on the default branch', async () => {
    writeRecord(fixture.root, 'abc', 1150, NOW, 'visual');
    expect((await run(fixture.root)).line).toBe('visual #1150 sidebar · in progress');
  });

  it('starts the links refresh for a PRD in review, and none for a shipped PRD', async () => {
    expect((await run(fixture.on('docs/phase-0-delta', 'origin/docs/phase-0-delta'))).spawns).toEqual([[CLI, 'statusline', '--refresh', '11', '--kind', 'prd']]);
    expect(await run(fixture.on('feat/alpha--s2'))).toEqual({ line: 'PRD 3 alpha · shipped', spawns: [] });
  });

  it('reads a roadmap the session recorded as the headline, with no work under it; under a running loop, the PRD of its last step and its first slice in flight', async () => {
    const roadmap = [
      '---', 'roadmap: 21', 'title: Seven', 'milestone: It ships.', '---', '', '## PRDs', '',
      '| id | PRD | title | blocked by | why | wave |', '|---|---|---|---|---|---|',
      '| P1 | #3 | Alpha | – | – | 1 |', '| P2 | #9 | Charlie | P1 | – | 2 |', '',
    ].join('\n');
    const dir = fixture.on('roadmap-session');
    mkdirSync(join(dir, DELIVERY, 'inbox', 'roadmaps', '0021-seven'), { recursive: true });
    writeFileSync(join(dir, DELIVERY, 'inbox', 'roadmaps', '0021-seven', 'roadmap.md'), roadmap);
    writeRecord(fixture.root, 'road', 21, NOW, 'roadmap');
    expect(await run(dir, { session_id: 'road' })).toEqual({ line: 'roadmap 21 · 1/2 merged', spawns: [] });

    mkdirSync(join(fixture.root, BOARD_DIR), { recursive: true });
    writeFileSync(boardFile(fixture.root, parsePrd(9)), JSON.stringify({ at: iso(NOW), slices: [{ id: 's1', wave: 1, state: 'merged' }, { id: 's2', wave: 2, state: 'in-flight', name: 'tabs' }] }));
    plantLinks(fixture.root, 'prd', 9, 0);
    const loop = { loopId: 'loop-1', repo: 'acme/widgets', prds: [9], state: 'running', startedAt: iso(NOW - MINUTE), seenAt: iso(NOW - MINUTE), nextWakeAt: null, planVersion: 1, roadmap: 21, last: { step: 4, prd: 9, action: 'wave', result: 's1 merged', at: iso(NOW - 30 * SECOND) } };
    mkdirSync(join(dir, LOOP_FILE, '..'), { recursive: true });
    writeFileSync(join(dir, LOOP_FILE), JSON.stringify(loop));
    expect(await run(dir, { session_id: 'road' })).toEqual({ line: 'roadmap 21 · 1/2 merged · now PRD 9 · s2', spawns: [] });
  });

  it('prints no escape code under NO_COLOR, and fits 30 columns', async () => {
    const { line } = await run(onBug(), {}, { NO_COLOR: '1', COLUMNS: '30' });
    expect(line).toBe('bug #1180 login-r… · fix PR o…');
  });
});

describe('omni statusline --refresh <n>', () => {
  const HOUR = 60 * MINUTE;
  const PLAN = [
    '# A plan',
    '',
    '| id | slice | territory | blocked by | wave |',
    '| --- | --- | --- | --- | --- |',
    '| s1 | Alpha | `a/` | — | 1 |',
    '| s2 | Beta | `b/` | s1 | 2 |',
    '| s3 | Gamma | `c/` | s1 | 2 |',
    '| s4 | Delta | `d/` | s2 | 3 |',
    '',
  ].join('\n');
  const FILES = {
    '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n',
    '.omni-loop/delivery/inbox/0007-widgets/plan.md': PLAN,
  };

  /** A pull request of the feature `widgets`, as `gh pr list` returns one. */
  function pr(number: number, slice: string, more = {}) {
    return {
      number,
      title: slice,
      headRefName: `feat/widgets--${slice}`,
      baseRefName: 'feat/widgets',
      state: 'OPEN',
      isDraft: false,
      mergedAt: null,
      body: '',
      labels: [],
      updatedAt: iso(NOW - MINUTE),
      createdAt: iso(NOW - 5 * MINUTE),
      ...more,
    };
  }
  const PRS = [
    pr(1, 's1', { state: 'MERGED', mergedAt: iso(NOW - HOUR) }),
    pr(2, 's2', { isDraft: true }),
    pr(3, 's3', { labels: [{ name: 'omni:needs-fix' }] }),
  ];

  /** `execFileSync` for git, and a stub for `gh`: `pr list` returns `prs`, and any `gh` throws when `ghFails`. */
  function stubbedExec({ prs = PRS, ghFails = false } = {}) {
    const calls: string[] = [];
    const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions) => {
      calls.push([file, ...args].join(' '));
      if (file !== 'gh') return realExec(file, args, options);
      if (ghFails) throw new Error('spawnSync gh ENOENT\n    at stub');
      if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(prs);
      if (args[0] === 'pr' && args[1] === 'view') return JSON.stringify({ commits: [] });
      throw new Error(`unexpected gh ${args.join(' ')}`);
    };
    return { calls, exec };
  }

  /** `omni statusline --refresh <prd>` in `cwd`: `{ code, out, err, calls }`. */
  async function refresh(cwd: string, prd = '7', stub = stubbedExec()) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(['statusline', '--refresh', prd], {
      cwd,
      stdout: { write: (s) => out.push(s) },
      stderr: { write: (s) => err.push(s) },
      exec: stub.exec,
      env: { ...PLAIN, CLAUDE_CODE_SESSION_ID: 'abc' },
      now: () => NOW,
      stdin: '',
      spawn: () => {
        throw new Error('a refresh starts no process');
      },
    });
    return { code, out: out.join(''), err: err.join(''), calls: stub.calls };
  }

  const readBoardJson = (root: string, prd = parsePrd(7)) => JSON.parse(readFileSync(boardFile(root, prd), 'utf8')) as { slices: unknown[] };

  it('writes board-7.json with each slice id, wave, state and name (PRD 1208), built as omni board builds it, and removes the lock', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const run = await refresh(root);
    expect(run).toMatchObject({ code: 0, out: '', err: '' });
    expect(readBoardJson(root)).toEqual({
      at: iso(NOW),
      slices: [
        { id: 's1', wave: 1, state: 'merged', name: 'Alpha' },
        { id: 's2', wave: 2, state: 'in-flight', name: 'Beta' },
        { id: 's3', wave: 2, state: 'stuck', name: 'Gamma' },
        { id: 's4', wave: 3, state: 'blocked', name: 'Delta' },
      ],
    });
    expect(existsSync(lockFile(root, parsePrd(7)))).toBe(false);
    expect(run.calls.filter((call) => call.startsWith('gh '))).toEqual([
      'gh pr list --repo acme/widgets --json number,title,headRefName,baseRefName,state,isDraft,mergedAt,body,labels,updatedAt,createdAt --state all --limit 200 --base feat/widgets',
    ]);
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
    expect(existsSync(join(root, '.omni-loop/local/sessions'))).toBe(false);
  });

  it('writes nothing and exits 0 while another refresh holds the lock', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    mkdirSync(join(root, BOARD_DIR), { recursive: true });
    writeFileSync(lockFile(root, parsePrd(7)), JSON.stringify({ at: iso(NOW - 30 * SECOND) }));
    const run = await refresh(root);
    expect(run).toMatchObject({ code: 0, out: '', err: '' });
    expect(existsSync(boardFile(root, parsePrd(7)))).toBe(false);
    expect(existsSync(lockFile(root, parsePrd(7)))).toBe(true);
    expect(run.calls.some((call) => call.startsWith('gh '))).toBe(false);
  });

  it('takes over a lock 2 minutes old', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    mkdirSync(join(root, BOARD_DIR), { recursive: true });
    writeFileSync(lockFile(root, parsePrd(7)), JSON.stringify({ at: iso(NOW - 2 * MINUTE) }));
    expect((await refresh(root)).code).toBe(0);
    expect(readBoardJson(root).slices).toHaveLength(4);
    expect(existsSync(lockFile(root, parsePrd(7)))).toBe(false);
  });

  it('writes the error entry when gh fails, when there is no plan, or no such PRD', async () => {
    const { root } = makeRepo({ git: true, files: { ...FILES, '.omni-loop/delivery/inbox/0009-nothing/spec.md': '# nothing\n' } });
    expect((await refresh(root, '7', stubbedExec({ ghFails: true }))).code).toBe(0);
    expect(readBoardJson(root)).toEqual({ at: iso(NOW), error: 'spawnSync gh ENOENT' });
    expect((await refresh(root, '9')).code).toBe(0);
    expect(readBoardJson(root, parsePrd(9))).toEqual({ at: iso(NOW), error: 'omni board: no plan at .omni-loop/delivery/inbox/0009-nothing/plan.md.' });
    expect((await refresh(root, '42')).code).toBe(0);
    expect(readBoardJson(root, parsePrd(42))).toEqual({ at: iso(NOW), error: 'omni board: PRD 42 has no inbox or shipped folder.' });
    for (const prd of [7, 9, 42]) expect(existsSync(lockFile(root, parsePrd(prd)))).toBe(false);
  });

  it('writes the board in the main checkout when run from a worktree', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const worktree = join(mkdtempSync(join(tmpdir(), 'omni-worktree-')), 'wt');
    git(root, 'worktree', 'add', '-q', '-b', 'feat/widgets--s2', worktree);
    expect((await refresh(worktree)).code).toBe(0);
    expect(readBoardJson(root).slices).toHaveLength(4);
    expect(existsSync(join(worktree, '.omni-loop/local'))).toBe(false);
  });

  it('writes nothing and exits 0 for a PRD that is not a positive integer, or outside any repository', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    for (const prd of ['seven', '0', '-7', '']) {
      expect(await refresh(root, prd)).toMatchObject({ code: 0, out: '', err: '' });
    }
    expect(existsSync(join(root, '.omni-loop/local'))).toBe(false);
    const outside = mkdtempSync(join(tmpdir(), 'omni-outside-'));
    expect(await refresh(outside)).toMatchObject({ code: 0, out: '', err: '' });
    expect(existsSync(join(outside, '.omni-loop'))).toBe(false);
  });

  it('is what the status line shows next', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const bare = mkdtempSync(join(tmpdir(), 'omni-origin-'));
    git(bare, 'init', '-q', '--bare', '-b', 'main');
    git(root, 'remote', 'add', 'origin', bare);
    git(root, 'push', '-q', 'origin', 'main');
    git(root, 'fetch', '-q', 'origin');
    git(root, 'checkout', '-q', '-b', 'feat/widgets--s4');
    expect((await refresh(root)).code).toBe(0);
    const shown = await statusline(root, payload(root), { env: { ...PLAIN, COLUMNS: '200' } });
    expect(shown.out.split('\n')[1]).toBe('PRD 7 widgets · building · wave 2/3 · now s2 Beta · stuck s3 Gamma');
    expect(shown.spawns.map((spawn) => spawn.args)).toEqual([[CLI, 'statusline', '--refresh', '7', '--kind', 'prd']]);
    expect(neverFetches(shown.calls)).toBe(true);
  });
});

// PRD #1208, slice s4: `omni statusline --refresh <n> --kind prd|bug|visual` keeps the links of what
// the session is on in `links-<kind>-<n>.json`, with `gh` and the Omni page stubbed; `omni now` lists
// them, and a fix with an open pull request reads `fix PR open`.
describe('omni statusline --refresh <n> --kind', () => {
  const BASE = 'https://omni.example';
  const FILES = {
    '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\ndossier:\n  enabled: true\n`,
    '.omni-loop/delivery/inbox/0007-widgets/plan.md': '| id | slice | territory | blocked by | wave |\n| --- | --- | --- | --- | --- |\n| s1 | Alpha. More | `a/` | — | 1 |\n',
  };
  /** A repository on the fix branch `fix/login-redirect`, whose bug folder is not on `main` yet. */
  const fixRepo = () => {
    const { root } = makeRepo({ git: true, files: FILES });
    git(root, 'checkout', '-q', '-b', 'fix/login-redirect');
    commit(root, { '.omni-loop/delivery/bugs/1180-login-redirect/bug.md': '# login\n' });
    return root;
  };
  const pr = (number: number, state = 'OPEN') => ({ number, url: `https://github.com/acme/widgets/pull/${number}`, state });
  const HEADS: Record<string, unknown[]> = {
    'feat/widgets': [pr(30, 'CLOSED'), pr(21)],
    'docs/phase-0-widgets': [pr(20)],
    'fix/login-redirect': [pr(40)],
  };
  const signedIn = () => {
    const store: Record<string, unknown> = { 'omni.example': { access_token: 'a', refresh_token: 'r' } };
    return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: unknown) => { store[host] = tokens; } };
  };

  /** `execFileSync` for git; `gh pr list` answers by `--head` from `HEADS`, else as the board's empty list. */
  function stubbedExec() {
    const calls: string[] = [];
    const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions) => {
      calls.push([file, ...args].join(' '));
      if (file !== 'gh') return realExec(file, args, options);
      if (args[0] === 'pr' && args[1] === 'list') {
        const head = args.includes('--head') ? args[args.indexOf('--head') + 1] ?? '' : null;
        if (head === null) return '[]';
        const state = args[args.indexOf('--state') + 1];
        return JSON.stringify((HEADS[head] ?? []).filter((listed) => state === 'all' || (listed as { state: string }).state === 'OPEN'));
      }
      throw new Error(`unexpected gh ${args.join(' ')}`);
    };
    return { calls, exec };
  }

  /** A fetch that answers the dossier lookup with a page per kind and number, recording each URL. */
  function stubbedFetch(found = true) {
    const urls: string[] = [];
    const fetch = (url: string) => {
      urls.push(url);
      const query = new URL(url).searchParams;
      const body = found ? { id: 'd', url: `${BASE}/${query.get('kind') ?? 'prd'}/${query.get('prd')}` } : { error: 'none' };
      return Promise.resolve(new Response(JSON.stringify(body), { status: found ? 200 : 404 }));
    };
    return { urls, fetch };
  }

  async function refresh(cwd: string, args: string[], { exec = stubbedExec().exec, fetch = stubbedFetch().fetch, tokens = signedIn() } = {}) {
    const err: string[] = [];
    const code = await main(['statusline', '--refresh', ...args], {
      cwd, stdout: { write: () => true }, stderr: { write: (s) => err.push(s) }, exec, env: PLAIN, now: () => NOW, stdin: '', tokens, fetch,
      spawn: () => {
        throw new Error('a refresh starts no process');
      },
    });
    return { code, err: err.join('') };
  }

  async function nowJson(cwd: string, args: string[] = []) {
    const out: string[] = [];
    const calls: string[] = [];
    const exec = (file: string, argv: readonly string[], options?: ExecFileSyncOptions) => {
      calls.push([file, ...argv].join(' '));
      return realExec(file, argv, options);
    };
    expect(await main(['now', '--json', ...args], { cwd, stdout: { write: (s) => out.push(s) }, stderr: { write: () => true }, exec, env: {}, now: () => NOW + 5 * SECOND })).toBe(0);
    expect(neverFetches(calls)).toBe(true);
    const answer: unknown = JSON.parse(out.join(''));
    return answer;
  }

  const linksJson = (root: string, name: string): unknown => JSON.parse(readFileSync(join(root, '.omni-loop/local/now', name), 'utf8'));

  it("keeps a PRD's page, its open feature PR and its open phase-0 PR, and writes the board too", async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { urls, fetch } = stubbedFetch();
    expect(await refresh(root, ['7', '--kind', 'prd'], { fetch })).toEqual({ code: 0, err: '' });
    const links = [
      { label: 'PRD page', href: `${BASE}/prd/7` },
      { label: 'feature PR #21', href: 'https://github.com/acme/widgets/pull/21' },
      { label: 'phase-0 PR #20', href: 'https://github.com/acme/widgets/pull/20' },
    ];
    expect(linksJson(root, 'links-prd-7.json')).toEqual({ at: iso(NOW), links });
    expect(urls).toEqual([`${BASE}/api/dossiers?repo=acme%2Fwidgets&prd=7`]);
    expect(existsSync(boardFile(root, parsePrd(7)))).toBe(true);
    expect(existsSync(join(root, '.omni-loop/local/now/links-prd-7.lock'))).toBe(false);
    git(root, 'checkout', '-q', '-b', 'feat/widgets');
    expect(await nowJson(root)).toMatchObject({ work: { kind: 'prd', number: 7, links } });
  });

  it("keeps a fix's page and its open PR, which omni now reads as fix PR open", async () => {
    const root = fixRepo();
    expect(await refresh(root, ['1180', '--kind', 'bug'])).toEqual({ code: 0, err: '' });
    const links = [{ label: 'fix page', href: `${BASE}/bug/1180` }, { label: 'fix PR #40', href: 'https://github.com/acme/widgets/pull/40' }];
    expect(linksJson(root, 'links-bug-1180.json')).toEqual({ at: iso(NOW), links });
    expect(existsSync(join(root, BOARD_DIR))).toBe(false);
    expect(await nowJson(root)).toEqual({ headline: null, work: { kind: 'bug', number: 1180, topic: 'login-redirect', stage: 'fix PR open', slices: [], links }, doing: null });
  });

  it('leaves out a link it cannot have: no sign-in, no page, no pull request', async () => {
    const root = fixRepo();
    const store = { read: () => null, write: () => {} };
    expect((await refresh(root, ['1180', '--kind', 'visual'], { tokens: store })).code).toBe(0);
    expect(linksJson(root, 'links-visual-1180.json')).toEqual({ at: iso(NOW), links: [] });
    expect((await refresh(root, ['9', '--kind', 'prd'], { fetch: stubbedFetch(false).fetch })).code).toBe(0);
    expect(linksJson(root, 'links-prd-9.json')).toEqual({ at: iso(NOW), links: [] });
  });

  it('writes nothing and exits 0 while another refresh holds the lock, or for a kind it does not know', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    mkdirSync(join(root, '.omni-loop/local/now'), { recursive: true });
    writeFileSync(join(root, '.omni-loop/local/now/links-bug-1180.lock'), JSON.stringify({ at: iso(NOW - 30 * SECOND) }));
    const { calls, exec } = stubbedExec();
    expect(await refresh(root, ['1180', '--kind', 'bug'], { exec })).toEqual({ code: 0, err: '' });
    expect(existsSync(join(root, '.omni-loop/local/now/links-bug-1180.json'))).toBe(false);
    expect(calls.some((call) => call.startsWith('gh '))).toBe(false);
    expect(await refresh(root, ['1180', '--kind', 'roadmap'])).toEqual({ code: 0, err: '' });
    expect(await refresh(root, ['seven', '--kind', 'bug'])).toEqual({ code: 0, err: '' });
    expect(existsSync(join(root, '.omni-loop/local/now/links-roadmap-1180.json'))).toBe(false);
  });

  it('shows no links from a file missing, holding an error, or 10 minutes old', async () => {
    const root = fixRepo();
    expect(await nowJson(root)).toMatchObject({ work: { stage: 'in progress', links: [] } });
    const dir = join(root, '.omni-loop/local/now');
    mkdirSync(dir, { recursive: true });
    const plant = (body: unknown) => {
      writeFileSync(join(dir, 'links-bug-1180.json'), JSON.stringify(body));
    };
    plant({ at: iso(NOW), error: 'gh: offline' });
    expect(await nowJson(root)).toMatchObject({ work: { stage: 'in progress', links: [] } });
    plant({ at: iso(NOW - 10 * MINUTE), links: [{ label: 'fix PR #40', href: 'x' }] });
    expect(await nowJson(root)).toMatchObject({ work: { stage: 'in progress', links: [] } });
    plant({ at: iso(NOW), links: [{ label: 'fix PR #40', href: 'x' }, { label: 7 }] });
    expect(await nowJson(root)).toMatchObject({ work: { stage: 'fix PR open', links: [{ label: 'fix PR #40', href: 'x' }] } });
  });
});
