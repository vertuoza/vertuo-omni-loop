// PRD #324, slice s1: what the status line reads besides its stdin — whether the loop is installed in
// the session's folder, and whether ask mode is on in the launch folder's checkout.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { writeMode } from '../ask/local-state.mjs';
import { readFacts } from './facts.mjs';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };

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
    expect(readFacts(input({ currentDir: join(root, '.omni-loop'), projectDir: root }), { cwd: tmpdir(), exec })).toEqual({ installed: true, askOn: true });
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
    expect(readFacts(input({ currentDir: root, projectDir: launch.root }), { cwd: root, exec })).toEqual({ installed: true, askOn: true });
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
