// `omni version` (PRD 347, s1): which kit runs, and whether a newer release exists. Through `main()`
// with a fake `gh` and an injected running kit; and once through a real build, whose bundle carries
// the version of the package.json it was built from. No test here ever calls GitHub.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareVersions, latestRelease, versionLines } from '../lib/version/version.mjs';
import { main } from './omni.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

/** A fake `exec` whose `gh release view` answers `tag`, or throws `error`. It records every call. */
function fakeGh({ tag = null, error = null } = {}) {
  const calls = [];
  const exec = (file, args, options) => {
    calls.push({ file, args, options });
    if (file !== 'gh') throw new Error(`unexpected ${file}`);
    if (error) throw error;
    return `${tag}\n`;
  };
  return { exec, calls };
}

const KIT = { home: 'acme/kit', version: '0.0.13', source: false };

async function version(argv, { kit = KIT, gh = fakeGh() } = {}) {
  const s = io();
  const code = await main(argv, { cwd: mkdtempSync(join(tmpdir(), 'omni-version-')), ...s, exec: gh.exec, kit });
  return { code, out: s.out.join(''), err: s.err.join(''), calls: gh.calls };
}

describe('omni version', () => {
  it('behind the latest release: the running version, then the line that says to update', async () => {
    const { code, out, calls } = await version(['version'], { gh: fakeGh({ tag: 'v0.0.15' }) });
    expect(code).toBe(0);
    expect(out).toBe('omni v0.0.13\nlatest v0.0.15, run: omni update\n');
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual(['release', 'view', '--repo', 'acme/kit', '--json', 'tagName', '--jq', '.tagName']);
    expect(calls[0].options.timeout).toBe(5000);
  });

  it('up to date: (latest) on the one line', async () => {
    const { code, out } = await version(['version'], { kit: { ...KIT, version: '0.0.15' }, gh: fakeGh({ tag: 'v0.0.15' }) });
    expect(code).toBe(0);
    expect(out).toBe('omni v0.0.15 (latest)\n');
  });

  it.each([
    ['gh failing', { error: Object.assign(new Error('gh: not logged in'), { status: 1 }) }],
    ['gh missing', { error: Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' }) }],
    ['gh timing out', { error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }) }],
    ['no release yet', { error: Object.assign(new Error('release not found'), { status: 1 }) }],
    ['an answer that is no version', { tag: 'release-3' }],
  ])('%s: the first line alone, exit 0', async (_, gh) => {
    const { code, out, err } = await version(['version'], { gh: fakeGh(gh) });
    expect(code).toBe(0);
    expect(out).toBe('omni v0.0.13\n');
    expect(err).toBe('');
  });

  it('from the kit source: the package.json version, marked (source)', async () => {
    const { out } = await version(['version'], { kit: { ...KIT, version: '0.0.15', source: true }, gh: fakeGh({ tag: 'v0.0.15' }) });
    expect(out).toBe('omni v0.0.15 (source) (latest)\n');
  });

  it('a bundle with no version: omni (unversioned), and GitHub is not asked', async () => {
    const { code, out, calls } = await version(['version'], { kit: { ...KIT, version: null }, gh: fakeGh({ tag: 'v0.0.15' }) });
    expect(code).toBe(0);
    expect(out).toBe('omni (unversioned)\n');
    expect(calls).toEqual([]);
  });

  it('with no kit home, GitHub is not asked', async () => {
    const { out, calls } = await version(['version'], { kit: { ...KIT, home: null }, gh: fakeGh({ tag: 'v0.0.15' }) });
    expect(out).toBe('omni v0.0.13\n');
    expect(calls).toEqual([]);
  });

  it('omni --version prints what omni version prints', async () => {
    const gh = () => fakeGh({ tag: 'v0.0.15' });
    const a = await version(['version'], { gh: gh() });
    const b = await version(['--version'], { gh: gh() });
    expect(b.code).toBe(0);
    expect(b.out).toBe(a.out);
  });

  it('takes no argument: exit 2', async () => {
    const { code, err } = await version(['version', 'extra']);
    expect(code).toBe(2);
    expect(err).toMatch(/^usage: omni version\n$/);
  });

  it('is listed by omni help', async () => {
    const s = io();
    expect(await main(['help'], { cwd: mkdtempSync(join(tmpdir(), 'omni-help-')), ...s, exec: fakeGh().exec })).toBe(0);
    expect(s.out.join('')).toMatch(/omni version/);
  });
});

describe('the version module', () => {
  it('compares versions number by number', () => {
    expect(compareVersions('0.0.9', '0.0.10')).toBeLessThan(0);
    expect(compareVersions('0.0.15', '0.0.15')).toBe(0);
    expect(compareVersions('0.1.0', '0.0.99')).toBeGreaterThan(0);
  });

  it('a running version newer than the latest release prints the first line alone', () => {
    expect(versionLines({ version: '0.0.16', source: false, latest: '0.0.15' })).toEqual(['omni v0.0.16']);
  });

  it('reads the latest tag without its v, and null for anything else', () => {
    expect(latestRelease({ home: 'acme/kit', exec: () => 'v0.0.4\n' })).toBe('0.0.4');
    expect(latestRelease({ home: 'acme/kit', exec: () => '' })).toBeNull();
    expect(latestRelease({ home: 'acme/kit', exec: () => 'v1.2\n' })).toBeNull();
  });
});

describe('the built bundle carries the version of its package.json', () => {
  /** Builds the kit from a package.json holding `pkg`, and runs its `omni version` with no `gh` on the PATH. */
  function builtVersion(pkg) {
    const dir = mkdtempSync(join(tmpdir(), 'omni-build-'));
    const pkgFile = join(dir, 'package.json');
    writeFileSync(pkgFile, JSON.stringify(pkg));
    const bundle = join(dir, 'omni.mjs');
    execFileSync('node', [join(repoRoot, 'kit/build.mjs'), bundle, pkgFile], { cwd: tmpdir(), stdio: 'ignore' });
    const run = spawnSync(process.execPath, [bundle, 'version'], { cwd: dir, encoding: 'utf8', env: { PATH: dirname(process.execPath) } });
    return { run, text: readFileSync(bundle, 'utf8') };
  }

  it('with "version": "0.0.7", prints omni v0.0.7', () => {
    const { run } = builtVersion({ name: 'kit', version: '0.0.7' });
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('omni v0.0.7\n');
  }, 30000);

  it('with no version, prints omni (unversioned)', () => {
    const { run } = builtVersion({ name: 'kit' });
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('omni (unversioned)\n');
  }, 30000);
});
