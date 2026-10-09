// The launcher's decision (PRD 420): hand over to the checkout's own bin, run itself, or refuse.
import type { SpawnSyncOptions } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { NO_KIT, handOver, launchDecision, planLaunch, runsWithoutKit } from './launch.ts';

const SELF = '/global/lib/omni.mjs';

describe('launchDecision', () => {
  it('hands over to the checkout’s bin when it is a different file', () => {
    expect(launchDecision({ argv: ['status'], self: SELF, bin: '/repo/.omni-loop/bin/omni.mjs', hasConfig: true }))
      .toEqual({ kind: 'handover', bin: '/repo/.omni-loop/bin/omni.mjs' });
  });

  it('hands over even for a command that needs no kit, so the repository’s copy answers', () => {
    expect(launchDecision({ argv: ['--version'], self: SELF, bin: '/repo/b.mjs', hasConfig: false }).kind).toBe('handover');
  });

  it('runs itself for update --apply, the hop where the downloaded bundle installs its own version', () => {
    const bin = '/repo/.omni-loop/bin/omni.mjs';
    expect(launchDecision({ argv: ['update', '--apply'], self: SELF, bin, hasConfig: true })).toEqual({ kind: 'self' });
    expect(launchDecision({ argv: ['update', '--apply', '--from', '0.0.38'], self: SELF, bin, hasConfig: true })).toEqual({ kind: 'self' });
    expect(launchDecision({ argv: ['update', '--from', '0.0.38', '--apply'], self: SELF, bin, hasConfig: true })).toEqual({ kind: 'self' });
    for (const argv of [['update'], ['update', '--to', 'v0.0.84'], ['status', '--apply'], ['--apply', 'update']]) {
      expect(launchDecision({ argv, self: SELF, bin, hasConfig: true }), argv.join(' ')).toEqual({ kind: 'handover', bin });
    }
  });

  it('runs itself when the checkout’s bin is the running file', () => {
    expect(launchDecision({ argv: ['status'], self: SELF, bin: SELF, hasConfig: true })).toEqual({ kind: 'self' });
  });

  it('runs itself in a checkout with the config but no bin', () => {
    expect(launchDecision({ argv: ['status'], self: SELF, bin: null, hasConfig: true })).toEqual({ kind: 'self' });
  });

  it('with no kit, runs init, help and the version, and refuses anything else with one line', () => {
    for (const argv of [[], ['init'], ['help'], ['--help'], ['-h'], ['version'], ['--version'], ['now', '--json'], ['ask', 'hook', 'pre']]) {
      expect(launchDecision({ argv, self: SELF, bin: null, hasConfig: false }), argv.join(' ')).toEqual({ kind: 'self' });
    }
    for (const argv of [['status'], ['config'], ['ask', 'on'], ['update'], ['nope']]) {
      expect(launchDecision({ argv, self: SELF, bin: null, hasConfig: false }), argv.join(' ')).toEqual({ kind: 'refuse', message: NO_KIT });
    }
  });

  it('names the refusal exactly as the guide does', () => {
    expect(NO_KIT).toBe('omni: no Omni Loop kit here — run omni init in your repository');
    expect(runsWithoutKit(['status'])).toBe(false);
  });
});

describe('planLaunch', () => {
  it('finds the checkout’s bin from a folder below its root', () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/bin/omni.mjs': '// bin\n', 'src/a.txt': 'a' } });
    const plan = planLaunch(['status'], { cwd: join(root, 'src'), self: SELF });
    expect(plan.kind).toBe('handover');
    expect(plan.kind === 'handover' && plan.bin.endsWith('/.omni-loop/bin/omni.mjs')).toBe(true);
  });

  it('runs itself when the checkout’s bin is a link to the running file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'omni-self-'));
    const self = join(dir, 'omni.mjs');
    writeFileSync(self, '// me\n');
    const { root } = makeRepo({ git: true });
    mkdirSync(join(root, '.omni-loop/bin'), { recursive: true });
    symlinkSync(self, join(root, '.omni-loop/bin/omni.mjs'));
    expect(planLaunch(['status'], { cwd: root, self })).toEqual({ kind: 'self' });
  });

  it('lets a downloaded release bundle apply its own update in a checkout pinned to an older bin (#643)', () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/bin/omni.mjs': '// omni v0.0.38\n' } });
    const bundle = join(mkdtempSync(join(tmpdir(), 'omni-update-')), 'omni.mjs');
    writeFileSync(bundle, '// omni v0.0.84\n');
    expect(planLaunch(['update', '--apply', '--from', '0.0.38'], { cwd: root, self: bundle })).toEqual({ kind: 'self' });
    expect(planLaunch(['update', '--apply'], { cwd: root, self: bundle })).toEqual({ kind: 'self' });
    expect(planLaunch(['update'], { cwd: root, self: bundle }).kind).toBe('handover');
  });

  it('outside a git checkout, refuses a command that needs the kit', () => {
    const outside = mkdtempSync(join(tmpdir(), 'omni-nogit-'));
    expect(planLaunch(['status'], { cwd: outside, self: SELF })).toEqual({ kind: 'refuse', message: NO_KIT });
    expect(planLaunch(['init'], { cwd: outside, self: SELF })).toEqual({ kind: 'self' });
  });

  it('with no git at all, runs as outside a checkout', () => {
    const exec = () => { throw Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' }); };
    expect(planLaunch(['help'], { cwd: '/', self: SELF, exec })).toEqual({ kind: 'self' });
  });
});

describe('handOver', () => {
  it('runs the bin with node and the same arguments, and returns its exit code', () => {
    const calls: { command: string; args: readonly string[]; options: SpawnSyncOptions }[] = [];
    const spawn = (command: string, args: readonly string[], options: SpawnSyncOptions) => { calls.push({ command, args, options }); return { status: 7 }; };
    expect(handOver('/repo/bin.mjs', ['status', '42', '--x'], { spawn })).toBe(7);
    expect(calls).toEqual([{ command: process.execPath, args: ['/repo/bin.mjs', 'status', '42', '--x'], options: { stdio: 'inherit' } }]);
  });

  it('exits 1 when the bin was stopped by a signal, and throws when it could not start', () => {
    expect(handOver('/b', [], { spawn: () => ({ status: null, signal: 'SIGTERM' }) })).toBe(1);
    expect(() => handOver('/b', [], { spawn: () => ({ error: new Error('boom') }) })).toThrow('boom');
  });
});
