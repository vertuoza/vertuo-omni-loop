// PRD #324, slices s1, s4, s5 and s6: what the status line reads besides its stdin — whether the loop
// is installed in the session's folder, whether ask mode is on in the launch folder's checkout, and
// the PRD the session's branch names (else the one its record names), with its stage read from git as
// of the last fetch and the slices of its cached board, whose refresh it starts through the injected
// spawn.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptionsWithStringEncoding, SpawnOptions } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { writeMode } from '../ask/local-state.ts';
import { BOARD_DIR, boardFile, lockFile } from './board-cache.ts';
import { readFacts } from './facts.ts';
import type { SessionInput } from './input.ts';
import { writeRecord } from './sessions.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };
const DELIVERY = '.omni-loop/delivery';

/** `execFileSync`, with every call it runs recorded as `<file> <args…>`. */
function recordingExec() {
  const calls: string[] = [];
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding) => {
    calls.push([file, ...args].join(' '));
    return execFileSync(file, args, options);
  };
  return { calls, exec };
}

const input = (fields: Partial<SessionInput> = {}): SessionInput => ({ model: null, contextPercent: null, fiveHour: null, currentDir: null, projectDir: null, sessionId: null, ...fields });

describe('readFacts', () => {
  it('reads the loop installed in the session folder, and ask mode on in the launch folder', () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeMode(root, { host: 'ask.example.test' });
    const { calls, exec } = recordingExec();
    expect(readFacts(input({ currentDir: join(root, '.omni-loop'), projectDir: root }), { cwd: tmpdir(), exec })).toEqual({ installed: true, askOn: true, prd: null });
    expect(calls.some((call) => /\bfetch\b/.test(call) || call.startsWith('gh '))).toBe(false);
  });

  it('reads ask mode off without its file, and without a launch folder', () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect(readFacts(input({ currentDir: root, projectDir: root }), { cwd: root, exec: execFileSync }).askOn).toBe(false);
    writeMode(root, { host: 'ask.example.test' });
    expect(readFacts(input({ currentDir: root }), { cwd: root, exec: execFileSync }).askOn).toBe(false);
  });

  it('reads ask mode in the launch folder only, calling nothing to know it', () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const launch = makeRepo({ git: true });
    writeMode(launch.root, { host: 'ask.example.test' });
    const { calls, exec } = recordingExec();
    expect(readFacts(input({ currentDir: root, projectDir: launch.root }), { cwd: root, exec })).toEqual({ installed: true, askOn: true, prd: null });
    expect(calls.every((call) => !call.includes(launch.root))).toBe(true);
  });

  it('falls back to its own folder when the JSON names none', () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect(readFacts(input(), { cwd: root, exec: execFileSync }).installed).toBe(true);
  });

  it('reads the loop as not installed with no config, a config that does not load, or no repository', () => {
    const bare = makeRepo({ git: true });
    expect(readFacts(input({ currentDir: bare.root }), { cwd: bare.root, exec: execFileSync }).installed).toBe(false);
    const broken = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nnot_a_key: true\n' } });
    expect(readFacts(input({ currentDir: broken.root }), { cwd: broken.root, exec: execFileSync }).installed).toBe(false);
    const outside = mkdtempSync(join(tmpdir(), 'omni-outside-'));
    expect(readFacts(input({ currentDir: outside }), { cwd: outside, exec: execFileSync }).installed).toBe(false);
    expect(readFacts(input({ currentDir: join(outside, 'gone') }), { cwd: outside, exec: execFileSync }).installed).toBe(false);
  });
});

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

/** A repository with no remote: `main` holds PRD 7 in its inbox, and the session is on `branch`. */
function localRepo({ config = 'kit: 1\n', branch = 'feat/bravo' } = {}) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  commit(repo.root, { [`${DELIVERY}/inbox/0007-bravo/spec.md`]: '# bravo\n' });
  if (branch !== 'main') git(repo.root, 'checkout', '-q', '-b', branch);
  return repo;
}

describe('readFacts: the PRD of the session branch', () => {
  it('reads the local default branch as the base when there is no remote-tracking one', () => {
    const { root } = localRepo();
    commit(root, { 'src/app.mjs': 'export {};\n' });
    expect(readFacts(input({ currentDir: root }), { cwd: root, exec: execFileSync }).prd).toEqual({
      number: 7,
      topic: 'bravo',
      slice: null,
      stage: 'inbox',
      openItems: 0,
      slices: null,
    });
  });

  it('reads a folder found only in the checkout as in review, once a base is read', () => {
    const { root } = localRepo({ branch: 'docs/phase-0-delta' });
    commit(root, { [`${DELIVERY}/inbox/0011-delta/spec.md`]: '# delta\n' });
    expect(readFacts(input({ currentDir: root }), { cwd: root, exec: execFileSync }).prd).toMatchObject({ number: 11, stage: 'in review' });
  });

  it('reads no stage when neither the remote-tracking nor the local default branch exists', () => {
    const { root } = localRepo({ config: 'kit: 1\nrepo:\n  defaultBranch: trunk\n', branch: 'feat/bravo--s2' });
    expect(readFacts(input({ currentDir: root }), { cwd: root, exec: execFileSync }).prd).toEqual({
      number: 7,
      topic: 'bravo',
      slice: 's2',
      stage: null,
      openItems: 0,
      slices: null,
    });
  });

  it('reads the remote-tracking default branch over the local one, and never fetches', () => {
    const { root } = localRepo({ branch: 'main' });
    const bare = mkdtempSync(join(tmpdir(), 'omni-origin-'));
    git(bare, 'init', '-q', '--bare', '-b', 'main');
    git(root, 'remote', 'add', 'origin', bare);
    git(root, 'push', '-q', 'origin', 'main');
    const other = mkdtempSync(join(tmpdir(), 'omni-other-'));
    git(other, 'clone', '-q', bare, '.');
    mkdirSync(join(other, DELIVERY, 'shipped'), { recursive: true });
    git(other, 'mv', `${DELIVERY}/inbox/0007-bravo`, `${DELIVERY}/shipped/0007-bravo`);
    git(other, 'commit', '-q', '-m', 'ship bravo');
    git(other, 'push', '-q', 'origin', 'main');
    git(root, 'fetch', '-q', 'origin');
    git(root, 'checkout', '-q', '-b', 'feat/bravo');
    const { calls, exec } = recordingExec();
    expect(readFacts(input({ currentDir: root }), { cwd: root, exec }).prd).toMatchObject({ number: 7, stage: 'shipped' });
    expect(calls.some((call) => /\bfetch\b/.test(call) || call.startsWith('gh '))).toBe(false);
  });

  it('reads the branch of the session folder, from any folder of its checkout', () => {
    const { root } = localRepo({ branch: 'feat/bravo--s3' });
    commit(root, { 'src/app.mjs': 'export {};\n' });
    expect(readFacts(input({ currentDir: join(root, 'src') }), { cwd: tmpdir(), exec: execFileSync }).prd).toMatchObject({ number: 7, slice: 's3' });
  });

  it('reads no PRD on a detached head, on a branch no template reads, and for a topic with no folder', () => {
    const detached = localRepo();
    git(detached.root, 'checkout', '-q', '--detach');
    expect(readFacts(input({ currentDir: detached.root }), { cwd: detached.root, exec: execFileSync }).prd).toBeNull();
    for (const branch of ['main-copy', 'feat/zulu', 'feat/zulu--s1']) {
      const { root } = localRepo({ branch });
      expect(readFacts(input({ currentDir: root }), { cwd: root, exec: execFileSync }).prd).toBeNull();
    }
  });

  it('reads no PRD where the loop is not installed', () => {
    const { root } = makeRepo({ git: true, files: { [`${DELIVERY}/inbox/0007-bravo/spec.md`]: '# bravo\n' } });
    git(root, 'checkout', '-q', '-b', 'feat/bravo');
    expect(readFacts(input({ currentDir: root }), { cwd: root, exec: execFileSync })).toMatchObject({ installed: false, prd: null });
  });
});

describe('readFacts: what the session last worked on', () => {
  const NOW = Date.now();

  /** `localRepo` on `main`, holding PRD 9 in its inbox beside PRD 7. */
  function twoPrds(options = {}) {
    const repo = localRepo({ branch: 'main', ...options });
    commit(repo.root, { [`${DELIVERY}/inbox/0009-charlie/spec.md`]: '# charlie\n' });
    return repo;
  }

  it('reads the PRD the record names on a branch that names none, with its stage and no slice', () => {
    const { root } = twoPrds();
    writeRecord(root, 'abc', 7, NOW);
    expect(readFacts(input({ currentDir: root, sessionId: 'abc' }), { cwd: root, exec: execFileSync }).prd).toEqual({
      number: 7,
      topic: 'bravo',
      slice: null,
      stage: 'inbox',
      openItems: 0,
      slices: null,
    });
  });

  it('reads the record in the main checkout from a worktree, and never fetches', () => {
    const { root } = twoPrds();
    writeRecord(root, 'abc', 9, NOW);
    const worktree = join(mkdtempSync(join(tmpdir(), 'omni-worktree-')), 'wt');
    git(root, 'worktree', 'add', '-q', '-b', 'scratch', worktree);
    const { calls, exec } = recordingExec();
    expect(readFacts(input({ currentDir: worktree, sessionId: 'abc' }), { cwd: tmpdir(), exec }).prd).toMatchObject({ number: 9, topic: 'charlie', slice: null });
    expect(calls.some((call) => /\bfetch\b/.test(call) || call.startsWith('gh '))).toBe(false);
  });

  it('lets a branch that names a PRD win over the record', () => {
    const { root } = twoPrds();
    writeRecord(root, 'abc', 7, NOW);
    git(root, 'checkout', '-q', '-b', 'feat/charlie--s1');
    expect(readFacts(input({ currentDir: root, sessionId: 'abc' }), { cwd: root, exec: execFileSync }).prd).toMatchObject({ number: 9, slice: 's1' });
  });

  it('reads the record when the branch names a topic with no folder', () => {
    const { root } = twoPrds();
    writeRecord(root, 'abc', 7, NOW);
    git(root, 'checkout', '-q', '-b', 'feat/zulu');
    expect(readFacts(input({ currentDir: root, sessionId: 'abc' }), { cwd: root, exec: execFileSync }).prd).toMatchObject({ number: 7, slice: null });
  });

  it('reads no PRD for a record whose PRD has no folder, for another session, without a session id or with an unsafe one', () => {
    const { root } = twoPrds();
    writeRecord(root, 'abc', 42, NOW);
    writeRecord(root, 'def', 7, NOW);
    for (const sessionId of ['abc', 'ghi', null, '../def']) {
      expect(readFacts(input({ currentDir: root, sessionId }), { cwd: root, exec: execFileSync }).prd).toBeNull();
    }
  });

  it('reads no PRD from a record where the loop is not installed', () => {
    const { root } = makeRepo({ git: true, files: { [`${DELIVERY}/inbox/0007-bravo/spec.md`]: '# bravo\n' } });
    writeRecord(root, 'abc', 7, NOW);
    expect(readFacts(input({ currentDir: root, sessionId: 'abc' }), { cwd: root, exec: execFileSync })).toMatchObject({ installed: false, prd: null });
  });
});

describe('readFacts: the board (slice s6)', () => {
  const NOW = Date.parse('2026-09-28T12:00:00Z');
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const IN_FLIGHT = [{ id: 's1', wave: 1, state: 'in-flight' }, { id: 's2', wave: 2, state: 'blocked' }];

  /** A board file in the checkout at `root`, written `age` milliseconds before `NOW`. */
  function plantBoard(root: string, prd: number, age: number, body: Record<string, unknown> = { slices: IN_FLIGHT }) {
    mkdirSync(join(root, BOARD_DIR), { recursive: true });
    writeFileSync(boardFile(root, prd), JSON.stringify({ at: new Date(NOW - age).toISOString(), ...body }));
  }

  /** A spawn that starts nothing and records each call. */
  function fakeSpawn() {
    const calls: { command: string; args: readonly string[]; options: SpawnOptions }[] = [];
    const spawn = (command: string, args: readonly string[], options: SpawnOptions) => {
      calls.push({ command, args, options });
      return { unref() {}, on() { return this; } };
    };
    return { calls, spawn };
  }

  /** `readFacts` on the session folder `folder` at `NOW`, with a recording exec and spawn. */
  function read(folder: string, more: Partial<SessionInput> = {}) {
    const { calls, exec } = recordingExec();
    const spawned = fakeSpawn();
    const facts = readFacts(input({ currentDir: folder, ...more }), { cwd: folder, exec, now: NOW, spawn: spawned.spawn });
    expect(calls.some((call) => /\bfetch\b/.test(call) || call.startsWith('gh '))).toBe(false);
    return { prd: facts.prd, spawns: spawned.calls };
  }

  it('reads a PRD git reads as inbox as outbox when its fresh board shows a slice in flight, with its slices', () => {
    const { root } = localRepo();
    plantBoard(root, 7, 30 * SECOND);
    expect(read(root)).toEqual({
      prd: { number: 7, topic: 'bravo', slice: null, stage: 'outbox', openItems: 0, slices: IN_FLIGHT },
      spawns: [],
    });
  });

  it('shows no slices from a board 10 minutes old, reads the stage from git alone, and starts one refresh in the session folder', () => {
    const { root } = localRepo({ branch: 'feat/bravo--s2' });
    plantBoard(root, 7, 10 * MINUTE);
    const { prd, spawns } = read(root);
    expect(prd).toMatchObject({ number: 7, stage: 'inbox', slices: null });
    expect(spawns).toHaveLength(1);
    expect(spawns[0]!.args.slice(1)).toEqual(['statusline', '--refresh', '7']);
    expect(spawns[0]!.options).toMatchObject({ cwd: root, detached: true, stdio: 'ignore' });
  });

  it('starts one refresh without a board, none while a refresh holds the lock, and none without a spawn', () => {
    const { root } = localRepo();
    expect(read(root).spawns).toHaveLength(1);
    mkdirSync(join(root, BOARD_DIR), { recursive: true });
    writeFileSync(lockFile(root, 7), JSON.stringify({ at: new Date(NOW - MINUTE).toISOString() }));
    expect(read(root).spawns).toHaveLength(0);
    const quiet = localRepo();
    expect(readFacts(input({ currentDir: quiet.root }), { cwd: quiet.root, exec: execFileSync, now: NOW }).prd).toMatchObject({ stage: 'inbox', slices: null });
  });

  it('reads the board in the main checkout from a worktree, and starts its refresh in the worktree', () => {
    const { root } = localRepo({ branch: 'main' });
    plantBoard(root, 7, 70 * SECOND, { slices: [{ id: 's1', wave: 1, state: 'merged' }] });
    const worktree = join(mkdtempSync(join(tmpdir(), 'omni-worktree-')), 'wt');
    git(root, 'worktree', 'add', '-q', '-b', 'feat/bravo--s3', worktree);
    const { prd, spawns } = read(worktree);
    expect(prd).toMatchObject({ number: 7, slice: 's3', stage: 'outbox', slices: [{ id: 's1', wave: 1, state: 'merged' }] });
    expect(spawns.map((spawn) => spawn.options.cwd)).toEqual([worktree]);
    expect(existsSync(join(worktree, BOARD_DIR))).toBe(false);
  });

  it('reads no board for a shipped PRD, one in review, or one with no stage, and starts no refresh', () => {
    const shipped = localRepo({ branch: 'main' });
    mkdirSync(join(shipped.root, DELIVERY, 'shipped'), { recursive: true });
    git(shipped.root, 'mv', `${DELIVERY}/inbox/0007-bravo`, `${DELIVERY}/shipped/0007-bravo`);
    git(shipped.root, 'commit', '-q', '-m', 'ship bravo');
    git(shipped.root, 'checkout', '-q', '-b', 'feat/bravo');
    plantBoard(shipped.root, 7, 30 * SECOND);
    expect(read(shipped.root)).toMatchObject({ prd: { stage: 'shipped', slices: null }, spawns: [] });

    const review = localRepo({ branch: 'docs/phase-0-delta' });
    commit(review.root, { [`${DELIVERY}/inbox/0011-delta/spec.md`]: '# delta\n' });
    expect(read(review.root)).toMatchObject({ prd: { number: 11, stage: 'in review', slices: null }, spawns: [] });

    const noBase = localRepo({ config: 'kit: 1\nrepo:\n  defaultBranch: trunk\n' });
    plantBoard(noBase.root, 7, 30 * SECOND);
    expect(read(noBase.root)).toMatchObject({ prd: { stage: null, slices: null }, spawns: [] });
  });

  it('reads the PRD a record names with its board too', () => {
    const { root } = localRepo({ branch: 'main' });
    writeRecord(root, 'abc', 7, NOW);
    plantBoard(root, 7, 0);
    expect(read(root, { sessionId: 'abc' })).toMatchObject({ prd: { number: 7, stage: 'outbox', slices: IN_FLIGHT }, spawns: [] });
  });
});
