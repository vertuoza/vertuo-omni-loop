// @ts-nocheck
// The version a repository's bin carries, read from the marker its build wrote (PRD 347, s4).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bundleVersion } from './installed.ts';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

describe('bundleVersion', () => {
  it('reads the version a real build stamps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'omni-installed-'));
    const pkg = join(dir, 'package.json');
    writeFileSync(pkg, JSON.stringify({ version: '0.0.7' }));
    const bundle = join(dir, 'omni.mjs');
    execFileSync('node', [join(repoRoot, 'kit/build.ts'), bundle, pkg], { cwd: tmpdir(), stdio: 'ignore' });
    expect(bundleVersion(readFileSync(bundle, 'utf8'))).toBe('0.0.7');
  });

  it('is null for a bundle built with no version, and for a file with no marker', () => {
    expect(bundleVersion('define_OMNI_BUNDLE_default = { home: "acme/kit", version: null };')).toBeNull();
    expect(bundleVersion('#!/usr/bin/env node\n')).toBeNull();
  });
});
