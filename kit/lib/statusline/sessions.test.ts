// @ts-nocheck
// PRD #324, slice s5: the per-session record — the PRD a Claude session last worked on, written in
// the repository's main checkout by the commands that name one, read back by the status line.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { readRecord, recordedPrd, recordSession, SESSIONS_DIR, writeRecord } from './sessions.ts';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const tempRoot = () => mkdtempSync(join(tmpdir(), 'omni-sessions-'));
const recordFile = (root, id) => join(root, SESSIONS_DIR, `${id}.json`);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** A record file written by hand, `at` the given instant. */
function plant(root, id, at, prd = 3) {
  mkdirSync(join(root, SESSIONS_DIR), { recursive: true });
  writeFileSync(recordFile(root, id), `${JSON.stringify({ prd, at: new Date(at).toISOString() })}\n`);
}

describe('writeRecord and readRecord', () => {
  it('writes `{ prd, at }` under the local folder, and reads it back', () => {
    const root = tempRoot();
    expect(writeRecord(root, 'abc', 7, NOW)).toBe(true);
    expect(SESSIONS_DIR).toBe(join('.omni-loop', 'local', 'sessions'));
    expect(readJson(recordFile(root, 'abc'))).toEqual({ prd: 7, at: '2026-09-28T12:00:00.000Z' });
    expect(readRecord(root, 'abc')).toEqual({ prd: 7, at: '2026-09-28T12:00:00.000Z' });
  });

  it('keeps the local folder out of every commit with its own `.gitignore`, written once', () => {
    const root = tempRoot();
    writeRecord(root, 'abc', 7, NOW);
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
    writeFileSync(join(root, '.omni-loop/local/.gitignore'), '*\n# mine\n');
    writeRecord(root, 'abc', 8, NOW);
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n# mine\n');
  });

  it('lets the latest record win', () => {
    const root = tempRoot();
    writeRecord(root, 'abc', 7, NOW);
    writeRecord(root, 'abc', 9, NOW + 1000);
    expect(readRecord(root, 'abc')).toEqual({ prd: 9, at: '2026-09-28T12:00:01.000Z' });
  });

  it('writes and reads nothing for an id that is not a safe file name', () => {
    const root = tempRoot();
    for (const id of ['../escape', 'a/b', 'a b', '', 'x'.repeat(129), undefined, null, 42]) {
      expect(writeRecord(root, id, 7, NOW)).toBe(false);
      expect(readRecord(root, id)).toBeNull();
    }
    expect(existsSync(join(root, '.omni-loop'))).toBe(false);
  });

  it('writes nothing for a PRD that is not a positive integer', () => {
    const root = tempRoot();
    for (const prd of [0, -3, 1.5, Number.NaN, '7', null]) expect(writeRecord(root, 'abc', prd, NOW)).toBe(false);
    expect(existsSync(join(root, '.omni-loop'))).toBe(false);
  });

  it('reads a missing, half-written or wrongly shaped record as none', () => {
    const root = tempRoot();
    expect(readRecord(root, 'abc')).toBeNull();
    mkdirSync(join(root, SESSIONS_DIR), { recursive: true });
    for (const text of ['{"prd": 7', '[7]', '{"prd": "7", "at": "2026-09-28T12:00:00.000Z"}', '{"prd": 0}', '{"prd": 2.5}', 'null']) {
      writeFileSync(recordFile(root, 'abc'), text);
      expect(readRecord(root, 'abc')).toBeNull();
    }
  });

  it('deletes the records older than 7 days when it writes one, and keeps the younger ones', () => {
    const root = tempRoot();
    plant(root, 'old', NOW - 8 * DAY);
    plant(root, 'older', NOW - 30 * DAY);
    plant(root, 'young', NOW - 6 * DAY);
    plant(root, 'week', NOW - 7 * DAY);
    writeRecord(root, 'abc', 7, NOW);
    expect(readdirSync(join(root, SESSIONS_DIR)).sort()).toEqual(['abc.json', 'week.json', 'young.json']);
  });

  it('ages a record it cannot read by its file, and leaves other files alone', () => {
    const root = tempRoot();
    mkdirSync(join(root, SESSIONS_DIR), { recursive: true });
    writeFileSync(recordFile(root, 'broken'), '{"prd": 7');
    writeFileSync(recordFile(root, 'fresh-broken'), 'not json');
    writeFileSync(join(root, SESSIONS_DIR, 'notes.txt'), 'mine\n');
    const eightDaysAgo = (NOW - 8 * DAY) / 1000;
    utimesSync(recordFile(root, 'broken'), eightDaysAgo, eightDaysAgo);
    utimesSync(join(root, SESSIONS_DIR, 'notes.txt'), eightDaysAgo, eightDaysAgo);
    utimesSync(recordFile(root, 'fresh-broken'), NOW / 1000, NOW / 1000);
    writeRecord(root, 'abc', 7, NOW);
    expect(readdirSync(join(root, SESSIONS_DIR)).sort()).toEqual(['abc.json', 'fresh-broken.json', 'notes.txt']);
  });
});

describe('recordSession and recordedPrd: the main checkout', () => {
  /** A fixture repository with a worktree of its own: `{ root, worktree }`, `root` read through its real path. */
  function withWorktree() {
    const { root } = makeRepo({ git: true, files: { 'README.md': 'x\n' } });
    const worktree = join(mkdtempSync(join(tmpdir(), 'omni-worktree-')), 'wt');
    execFileSync('git', ['worktree', 'add', '-q', '-b', 'feat/x', worktree], { cwd: root, stdio: 'ignore' });
    return { root: realpathSync(root), worktree };
  }

  it('writes in the main checkout, from the checkout itself and from any of its worktrees', () => {
    const { root, worktree } = withWorktree();
    expect(recordSession({ cwd: worktree, exec: execFileSync, sessionId: 'abc', prd: 7, now: NOW })).toBe(true);
    expect(readJson(recordFile(root, 'abc')).prd).toBe(7);
    expect(existsSync(join(worktree, '.omni-loop'))).toBe(false);
    expect(recordSession({ cwd: root, exec: execFileSync, sessionId: 'def', prd: 9, now: NOW })).toBe(true);
    expect(readJson(recordFile(root, 'def')).prd).toBe(9);
  });

  it('reads the record from the main checkout, from the checkout or any of its worktrees', () => {
    const { root, worktree } = withWorktree();
    writeRecord(root, 'abc', 7, NOW);
    expect(recordedPrd({ cwd: worktree, exec: execFileSync, sessionId: 'abc' })).toBe(7);
    expect(recordedPrd({ cwd: root, exec: execFileSync, sessionId: 'abc' })).toBe(7);
    expect(recordedPrd({ cwd: root, exec: execFileSync, sessionId: 'other' })).toBeNull();
  });

  it('writes and reads nothing outside a repository, or for an unsafe id, and calls nothing for one', () => {
    const outside = tempRoot();
    expect(recordSession({ cwd: outside, exec: execFileSync, sessionId: 'abc', prd: 7, now: NOW })).toBe(false);
    expect(recordedPrd({ cwd: outside, exec: execFileSync, sessionId: 'abc' })).toBeNull();
    expect(existsSync(join(outside, '.omni-loop'))).toBe(false);
    const { root } = withWorktree();
    const calls = [];
    const exec = (...args) => {
      calls.push(args);
      return execFileSync(...args);
    };
    expect(recordSession({ cwd: root, exec, sessionId: '../x', prd: 7, now: NOW })).toBe(false);
    expect(recordedPrd({ cwd: root, exec, sessionId: undefined })).toBeNull();
    expect(calls).toEqual([]);
    expect(existsSync(join(root, '.omni-loop'))).toBe(false);
  });

  it('reads none when git fails', () => {
    const exec = () => {
      throw new Error('no git');
    };
    expect(recordedPrd({ cwd: tempRoot(), exec, sessionId: 'abc' })).toBeNull();
    expect(recordSession({ cwd: tempRoot(), exec, sessionId: 'abc', prd: 7, now: NOW })).toBe(false);
  });
});
