// PRD #324, slices s1 and s4: what the status line reads besides its stdin — whether the loop is
// installed in the session's folder, whether ask mode is on in the launch folder's checkout, and the
// PRD the session's branch names, with its stage read from git as of the last fetch.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { writeMode } from '../ask/local-state.mjs';
import { readFacts } from './facts.mjs';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };
const DELIVERY = '.omni-loop/delivery';

/** `execFileSync`, with every call it runs recorded as `<file> <args…>`. */
function recordingExec() {
  const calls = [];
  const exec = (file, args, options) => {
    calls.push([file, ...args].join(' '));
    return execFileSync(file, args, options);
  };
  return { calls, exec };
}

const input = (fields = {}) => ({ model: null, contextPercent: null, fiveHour: null, currentDir: null, projectDir: null, ...fields });

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
