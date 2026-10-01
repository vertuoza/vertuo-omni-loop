// @ts-nocheck
// PRD #324, slice s6: the cached board — the file the background refresh writes in the main checkout,
// its age, its lock, and the one detached refresh the status line starts when the file is missing or
// a minute old. The clock and the spawn are injected: no test here starts a real process.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOARD_DIR,
  boardFile,
  cachedSlices,
  lockFile,
  lockHeld,
  omniScript,
  readBoard,
  refreshBoard,
  refreshDue,
  shownSlices,
  startRefresh,
  takeLock,
  writeBoard,
} from './board-cache.ts';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const SLICES = [
  { id: 's1', wave: 1, state: 'merged' },
  { id: 's2', wave: 2, state: 'in-flight' },
];
const SESSION = '/work/repo/.claude/worktrees/s2';
const SCRIPT = '/work/repo/.omni-loop/bin/omni.mjs';

const tempRoot = () => mkdtempSync(join(tmpdir(), 'omni-board-cache-'));
const iso = (ms) => new Date(ms).toISOString();

/** A board file written by hand, its `at` `age` milliseconds before `NOW`. */
function plantBoard(root, prd, age, body = { slices: SLICES }) {
  mkdirSync(join(root, BOARD_DIR), { recursive: true });
  writeFileSync(boardFile(root, prd), `${JSON.stringify({ at: iso(NOW - age), ...body })}\n`);
}

/** A lock written by hand, taken `age` milliseconds before `NOW`. */
function plantLock(root, prd, age) {
  mkdirSync(join(root, BOARD_DIR), { recursive: true });
  writeFileSync(lockFile(root, prd), `${JSON.stringify({ at: iso(NOW - age) })}\n`);
}

/** A spawn that starts nothing: it records each call, and whether its child was let go. */
function fakeSpawn() {
  const calls = [];
  const spawn = (command, args, options) => {
    const child = { unrefed: false, unref() { this.unrefed = true; }, on() { return this; } };
    calls.push({ command, args, options, child });
    return child;
  };
  return { calls, spawn };
}

/** What the status line shows for PRD 7 in `root` at `now`, and the refreshes it started. */
function show(root, now = NOW) {
  const { calls, spawn } = fakeSpawn();
  const slices = cachedSlices({ root, prd: 7, now, cwd: SESSION, spawn, script: SCRIPT, env: { PATH: '/bin' } });
  return { slices, calls };
}

describe('the board file', () => {
  it('lives in the local folder of the main checkout, one per PRD, beside its lock', () => {
    expect(BOARD_DIR).toBe(join('.omni-loop', 'local', 'statusline'));
    expect(boardFile('/r', 7)).toBe(join('/r', '.omni-loop', 'local', 'statusline', 'board-7.json'));
    expect(lockFile('/r', 7)).toBe(join('/r', '.omni-loop', 'local', 'statusline', 'board-7.lock'));
  });

  it('reads slices, an error, or nothing', () => {
    const root = tempRoot();
    expect(readBoard(root, 7)).toBeNull();
    plantBoard(root, 7, 5 * SECOND);
    expect(readBoard(root, 7)).toEqual({ at: NOW - 5 * SECOND, slices: SLICES });
    plantBoard(root, 7, 5 * SECOND, { error: 'gh: not found' });
    expect(readBoard(root, 7)).toEqual({ at: NOW - 5 * SECOND, error: 'gh: not found' });
  });

  it('reads only the id, the wave and the state of each slice', () => {
    const root = tempRoot();
    plantBoard(root, 7, 0, { slices: [{ id: 's1', wave: 1, state: 'merged', title: 'extra', pr: { number: 3 } }] });
    expect(readBoard(root, 7).slices).toEqual([{ id: 's1', wave: 1, state: 'merged' }]);
  });

  it('reads a file with no time it can read as missing, and slices it cannot read as an error', () => {
    const root = tempRoot();
    mkdirSync(join(root, BOARD_DIR), { recursive: true });
    for (const text of ['not json', '[]', '{"slices":[]}', '{"at":"yesterday","slices":[]}']) {
      writeFileSync(boardFile(root, 7), text);
      expect(readBoard(root, 7)).toBeNull();
    }
    for (const slices of [[{ id: 's1', wave: '1', state: 'merged' }], [{ id: 's1', wave: null, state: 'merged' }], [{ wave: 1, state: 'merged' }], 'all']) {
      plantBoard(root, 7, 0, { slices });
      expect(readBoard(root, 7)).toMatchObject({ at: NOW, error: expect.any(String) });
    }
  });

  it('is written under a temporary name and renamed into place, leaving no temporary file', () => {
    const root = tempRoot();
    writeBoard(root, 7, { at: iso(NOW), slices: SLICES });
    const before = statSync(boardFile(root, 7)).ino;
    writeBoard(root, 7, { at: iso(NOW + MINUTE), slices: SLICES.slice(0, 1) });
    expect(statSync(boardFile(root, 7)).ino).not.toBe(before);
    expect(readBoard(root, 7)).toEqual({ at: NOW + MINUTE, slices: SLICES.slice(0, 1) });
    expect(readdirSync(join(root, BOARD_DIR))).toEqual(['board-7.json']);
  });

  it('keeps the local folder out of every commit with its own `.gitignore`, written once', () => {
    const root = tempRoot();
    writeBoard(root, 7, { at: iso(NOW), slices: SLICES });
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
    writeFileSync(join(root, '.omni-loop/local/.gitignore'), '*\n# mine\n');
    writeBoard(root, 7, { at: iso(NOW), slices: SLICES });
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n# mine\n');
  });
});

describe('what the status line shows', () => {
  it('shows the slices of a board under 10 minutes old', () => {
    expect(shownSlices({ at: NOW, slices: SLICES }, NOW)).toEqual(SLICES);
    expect(shownSlices({ at: NOW - 10 * MINUTE + 1, slices: SLICES }, NOW)).toEqual(SLICES);
  });

  it('shows no slices from a board 10 minutes old, an error or no board', () => {
    expect(shownSlices({ at: NOW - 10 * MINUTE, slices: SLICES }, NOW)).toBeNull();
    expect(shownSlices({ at: NOW, error: 'offline' }, NOW)).toBeNull();
    expect(shownSlices(null, NOW)).toBeNull();
  });

  it('shows no slices from a board written after now', () => {
    expect(shownSlices({ at: NOW + MINUTE, slices: SLICES }, NOW)).toBeNull();
  });
});

describe('when a refresh is due', () => {
  it('is due for a missing file, and for one 60 seconds old or more', () => {
    expect(refreshDue(null, NOW)).toBe(true);
    expect(refreshDue({ at: NOW - 60 * SECOND, slices: SLICES }, NOW)).toBe(true);
    expect(refreshDue({ at: NOW - 59 * SECOND, slices: SLICES }, NOW)).toBe(false);
  });

  it('is due for an error 60 seconds after it, and not before', () => {
    expect(refreshDue({ at: NOW - 59 * SECOND, error: 'offline' }, NOW)).toBe(false);
    expect(refreshDue({ at: NOW - 60 * SECOND, error: 'offline' }, NOW)).toBe(true);
  });

  it('is due for a board written after now', () => {
    expect(refreshDue({ at: NOW + MINUTE, slices: SLICES }, NOW)).toBe(true);
  });

  it('reads a lock under 2 minutes old as held, and one 2 minutes old as abandoned', () => {
    const root = tempRoot();
    expect(lockHeld(root, 7, NOW)).toBe(false);
    plantLock(root, 7, 2 * MINUTE - 1);
    expect(lockHeld(root, 7, NOW)).toBe(true);
    plantLock(root, 7, 2 * MINUTE);
    expect(lockHeld(root, 7, NOW)).toBe(false);
  });
});

describe('the status line starts the refresh', () => {
  it('starts nothing while the file is 59 seconds old, and shows its slices', () => {
    const root = tempRoot();
    plantBoard(root, 7, 59 * SECOND);
    expect(show(root)).toEqual({ slices: SLICES, calls: [] });
  });

  it('starts exactly one detached refresh for a missing file, in the session folder, never waiting', () => {
    const root = tempRoot();
    const { slices, calls } = show(root);
    expect(slices).toBeNull();
    expect(calls).toHaveLength(1);
    const [{ command, args, options, child }] = calls;
    expect(command).toBe(process.execPath);
    expect(args).toEqual([SCRIPT, 'statusline', '--refresh', '7']);
    expect(options).toMatchObject({ cwd: SESSION, detached: true, stdio: 'ignore', env: { PATH: '/bin' } });
    expect(child.unrefed).toBe(true);
  });

  it('starts one refresh for a file 60 seconds old, and still shows its slices meanwhile', () => {
    const root = tempRoot();
    plantBoard(root, 7, 60 * SECOND);
    const { slices, calls } = show(root);
    expect(slices).toEqual(SLICES);
    expect(calls).toHaveLength(1);
  });

  it('starts none while a refresh under 2 minutes old holds the lock', () => {
    const root = tempRoot();
    plantLock(root, 7, 2 * MINUTE - SECOND);
    expect(show(root).calls).toHaveLength(0);
    plantBoard(root, 7, 5 * MINUTE);
    expect(show(root)).toEqual({ slices: SLICES, calls: [] });
  });

  it('starts one when the lock is 2 minutes old: it was abandoned', () => {
    const root = tempRoot();
    plantLock(root, 7, 2 * MINUTE);
    expect(show(root).calls).toHaveLength(1);
  });

  it('hides the slices on an error, and starts the next refresh 60 seconds after it', () => {
    const root = tempRoot();
    plantBoard(root, 7, 59 * SECOND, { error: 'gh: not found' });
    expect(show(root)).toEqual({ slices: null, calls: [] });
    plantBoard(root, 7, 60 * SECOND, { error: 'gh: not found' });
    const { slices, calls } = show(root);
    expect(slices).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('shows no slices 10 minutes on, and starts a refresh', () => {
    const root = tempRoot();
    plantBoard(root, 7, 10 * MINUTE);
    const { slices, calls } = show(root);
    expect(slices).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('starts nothing without a spawn, and writes nothing in either case', () => {
    const root = tempRoot();
    expect(cachedSlices({ root, prd: 7, now: NOW, cwd: SESSION })).toBeNull();
    show(root);
    expect(existsSync(join(root, '.omni-loop'))).toBe(false);
  });

  it('never throws when the spawn does, or when its child reports an error later', () => {
    const root = tempRoot();
    const throwing = () => {
      throw new Error('EAGAIN');
    };
    expect(cachedSlices({ root, prd: 7, now: NOW, cwd: SESSION, spawn: throwing, script: SCRIPT })).toBeNull();
    const listeners = [];
    const child = { unref() {}, on(event, listener) { listeners.push([event, listener]); return this; } };
    startRefresh({ spawn: () => child, script: SCRIPT, cwd: SESSION, prd: 7 });
    expect(listeners.map(([event]) => event)).toEqual(['error']);
    expect(() => listeners[0][1](new Error('ENOENT'))).not.toThrow();
  });

  it('runs this omni.mjs: the kit source entry, when not bundled', () => {
    expect(omniScript()).toMatch(/kit[\\/]bin[\\/]omni\.ts$/);
  });
});

describe('the refresh', () => {
  const build = () => SLICES;

  it('takes the lock, writes the board with its time, and removes the lock', () => {
    const root = tempRoot();
    let lockedWhileBuilding = false;
    const outcome = refreshBoard({ root, prd: 7, now: NOW, build: () => {
      lockedWhileBuilding = existsSync(lockFile(root, 7));
      return build();
    } });
    expect(outcome).toBe('written');
    expect(lockedWhileBuilding).toBe(true);
    expect(JSON.parse(readFileSync(boardFile(root, 7), 'utf8'))).toEqual({ at: iso(NOW), slices: SLICES });
    expect(existsSync(lockFile(root, 7))).toBe(false);
  });

  it('writes nothing while another refresh under 2 minutes old holds the lock', () => {
    const root = tempRoot();
    plantLock(root, 7, 2 * MINUTE - SECOND);
    let built = false;
    expect(refreshBoard({ root, prd: 7, now: NOW, build: () => { built = true; return SLICES; } })).toBe('held');
    expect(built).toBe(false);
    expect(existsSync(boardFile(root, 7))).toBe(false);
    expect(existsSync(lockFile(root, 7))).toBe(true);
  });

  it('takes over a lock 2 minutes old', () => {
    const root = tempRoot();
    plantLock(root, 7, 2 * MINUTE);
    expect(refreshBoard({ root, prd: 7, now: NOW, build })).toBe('written');
    expect(readBoard(root, 7)).toEqual({ at: NOW, slices: SLICES });
    expect(existsSync(lockFile(root, 7))).toBe(false);
  });

  it('writes a failure as the error entry, on one line, and removes the lock', () => {
    const root = tempRoot();
    const failing = () => {
      throw new Error('spawnSync gh ENOENT\n    at somewhere');
    };
    expect(refreshBoard({ root, prd: 7, now: NOW, build: failing })).toBe('written');
    expect(JSON.parse(readFileSync(boardFile(root, 7), 'utf8'))).toEqual({ at: iso(NOW), error: 'spawnSync gh ENOENT' });
    expect(existsSync(lockFile(root, 7))).toBe(false);
  });

  it('keeps a lock another refresh took over meanwhile', () => {
    const root = tempRoot();
    refreshBoard({ root, prd: 7, now: NOW, build: () => {
      plantLock(root, 7, 0);
      return SLICES;
    } });
    expect(existsSync(lockFile(root, 7))).toBe(true);
  });

  it('takes the lock exclusively: a second taker gets nothing until it is released or abandoned', () => {
    const root = tempRoot();
    const first = takeLock(root, 7, NOW);
    expect(first).not.toBeNull();
    expect(takeLock(root, 7, NOW + MINUTE)).toBeNull();
    expect(takeLock(root, 7, NOW + 2 * MINUTE)).not.toBeNull();
  });
});
