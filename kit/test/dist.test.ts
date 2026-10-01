// @ts-nocheck
// The one-line install runs the committed bundle: `npx <kit repository> init` executes the root
// package.json's `bin.omni`, which is `kit/dist/omni.mjs`. So that file must be committed, and must
// be exactly what a fresh build of today's kit source gives.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const DIST = 'kit/dist/omni.mjs';
const committed = () => readFileSync(join(repoRoot, DIST));

describe('the committed bundle (AC 10)', () => {
  it('equals a fresh build byte for byte — rebuild with `pnpm kit:build` and commit it', () => {
    const fresh = join(mkdtempSync(join(tmpdir(), 'omni-dist-')), 'omni.mjs');
    execFileSync('node', [join(repoRoot, 'kit/build.ts'), fresh], { cwd: tmpdir(), stdio: 'ignore' });
    expect(readFileSync(fresh).equals(committed())).toBe(true);
  });

  it('starts with a node shebang', () => {
    expect(committed().toString('utf8').split('\n')[0]).toBe('#!/usr/bin/env node');
  });

  it('is the root package.json bin.omni, and the only file the package ships', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.bin).toEqual({ omni: DIST });
    expect(pkg.files).toEqual([DIST]);
  });

  it('is tracked, not gitignored', () => {
    const ignored = spawnSync('git', ['check-ignore', '-q', DIST], { cwd: repoRoot });
    expect(ignored.status).toBe(1);
  });

  it('with no command, prints a usage line that lists init', () => {
    const run = spawnSync('node', [join(repoRoot, DIST)], { encoding: 'utf8' });
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/^usage: omni <command>/);
    expect(run.stderr).toMatch(/^commands: .*\binit\b/m);
  });
});
