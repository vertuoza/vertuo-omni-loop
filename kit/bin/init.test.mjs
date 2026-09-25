import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo } from '../test/fixture.mjs';
import { parseConfig } from '../lib/config.mjs';
import { main } from './omni.mjs';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = join(kitRoot, 'test/fixtures/init');
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8');

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

/**
 * `gh` faked, `git` real. Records every gh call. `labels` is the repository's label set: `label
 * list` returns it and a `label create` adds to it, so a second run sees the first run's labels.
 * `labelsFail` makes every `gh label` call fail, as it does when gh has no permission.
 */
function fakeExec({ slug = 'acme/widgets', defaultBranch = 'trunk', ghFails = false, labels = [], labelsFail = false } = {}) {
  const calls = [];
  const present = labels.map((label) => ({ description: '', ...label }));
  const exec = (cmd, args, options) => {
    if (cmd !== 'gh') return execFileSync(cmd, args, options);
    calls.push(args);
    if (ghFails) throw new Error('gh: not logged in');
    if (args[0] === 'repo' && args[1] === 'view') {
      return JSON.stringify({ nameWithOwner: slug, defaultBranchRef: { name: defaultBranch } });
    }
    if (args[0] === 'label') {
      if (labelsFail) throw new Error('gh: HTTP 403');
      if (args[1] === 'list') return JSON.stringify(present);
      if (args[1] === 'create') {
        present.push({ name: args[2] });
        return '';
      }
    }
    return '';
  };
  return { exec, calls };
}

const LOOP_LABELS = ['prd', 'pr:phase-0', 'pr:feature', 'pr:sub', 'pr:in-progress', 'pr:needs-fix', 'outbox:go'];
const labelCalls = (calls, verb) => calls.filter((args) => args[0] === 'label' && args[1] === verb);
const created = (calls) => labelCalls(calls, 'create').map((args) => args[2]);
const edits = (calls) => calls.filter((args) => args[0] === 'label' && !['list', 'create'].includes(args[1]));

/** A fake bundle file the tests inject as "the running bundle". */
function fakeBundle() {
  const file = join(mkdtempSync(join(tmpdir(), 'omni-bundle-')), 'omni.mjs');
  writeFileSync(file, '#!/usr/bin/env node\n// a bundle\n');
  return file;
}

async function init(root, argv = [], extra = {}) {
  const s = io();
  const { exec, calls } = extra.fake ?? fakeExec();
  const code = await main(['init', ...argv], { cwd: root, ...s, exec, bundle: 'bundle' in extra ? extra.bundle : fakeBundle(), ...extra.options });
  return { code, out: s.out.join(''), err: s.err.join(''), calls };
}

const readConfig = (read) => parseConfig(read('.omni-loop/config.yml'));

describe('omni init — dispatch', () => {
  it('runs without a config, where every other command needs one', async () => {
    const { root } = makeRepo({ git: true });
    const { code } = await init(root);
    expect(code).toBe(0);
    expect(existsSync(join(root, '.omni-loop/config.yml'))).toBe(true);
  });

  it('exits 2 with one line outside a git repository', async () => {
    const s = io();
    const cwd = mkdtempSync(join(tmpdir(), 'x-'));
    expect(await main(['init'], { cwd, ...s, exec: fakeExec().exec, bundle: fakeBundle() })).toBe(2);
    expect(s.err.join('')).toMatch(/^[^\n]*not inside a git repository\.\n$/);
    expect(existsSync(join(cwd, '.omni-loop'))).toBe(false);
  });

  it('exits 2 for a flag it does not take', async () => {
    const { root } = makeRepo({ git: true });
    const { code, err } = await init(root, ['--nope']);
    expect(code).toBe(2);
    expect(err).toMatch(/--nope/);
  });
});

describe('omni init — the config it writes (AC 1, 2)', () => {
  it('a pnpm repository: pnpm test, quality:preflight, the slug and branch gh reports, laws none', async () => {
    const { root, read } = makeRepo({ git: true, files: { 'package.json': fixture('pnpm/package.json'), 'pnpm-lock.yaml': '' } });
    const bundle = fakeBundle();
    const { code } = await init(root, [], { bundle });
    expect(code).toBe(0);
    const config = readConfig(read);
    expect(config.commands.test).toBe('pnpm test');
    expect(config.commands.preflight).toBe('pnpm run quality:preflight');
    expect(config.commands.preflightFull).toBe('pnpm run quality:preflight');
    expect(config.repo.slug).toBe('acme/widgets');
    expect(config.repo.defaultBranch).toBe('trunk');
    expect(config.laws.source).toBe('none');
    expect(config.labels.autoCreate).toBe(false);
    expect(readFileSync(join(root, '.omni-loop/bin/omni.mjs'))).toEqual(readFileSync(bundle));
  });

  it('writes only the minimal keys, commented', async () => {
    const { root, read } = makeRepo({ git: true });
    await init(root);
    const text = read('.omni-loop/config.yml');
    expect(text.startsWith('#')).toBe(true);
    const keys = text.split('\n').filter((line) => /^[a-zA-Z]/.test(line)).map((line) => line.split(':')[0]);
    expect(keys).toEqual(['kit', 'repo', 'labels', 'commands', 'laws']);
  });

  it('picks the package manager from the lockfile, and preflight / preflight:full scripts', async () => {
    const scripts = JSON.stringify({ scripts: { test: 'x', preflight: 'x', 'preflight:full': 'x' } });
    for (const [lock, pm] of [['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['bun.lock', 'bun'], [null, 'npm']]) {
      const files = { 'package.json': scripts, ...(lock ? { [lock]: '' } : {}) };
      const { root, read } = makeRepo({ git: true, files });
      await init(root);
      expect(readConfig(read).commands).toMatchObject({ test: `${pm} test`, preflight: `${pm} run preflight`, preflightFull: `${pm} run preflight:full` });
    }
  });

  it('a composer.json repository gives composer test', async () => {
    const { root, read } = makeRepo({ git: true, files: { 'composer.json': fixture('composer/composer.json') } });
    await init(root);
    expect(readConfig(read).commands).toMatchObject({ test: 'composer test', preflight: 'composer test', preflightFull: 'composer test' });
  });

  it('a Makefile-only repository gives make test, and make preflight when it exists', async () => {
    const { root, read } = makeRepo({ git: true, files: { Makefile: fixture('make/Makefile') } });
    await init(root);
    expect(readConfig(read).commands).toMatchObject({ test: 'make test', preflight: 'make preflight', preflightFull: 'make preflight' });
  });

  it('a bare repository with no terminal: null for all three, never asks, exits 0', async () => {
    const { root, read } = makeRepo({ git: true });
    let asked = 0;
    const { code } = await init(root, [], { options: { ask: async () => { asked += 1; return 'x'; } } });
    expect(code).toBe(0);
    expect(asked).toBe(0);
    expect(readConfig(read).commands).toMatchObject({ test: null, preflight: null, preflightFull: null });
  });

  it('on a terminal it asks once per unknown command, and an empty answer means none', async () => {
    const { root, read } = makeRepo({ git: true });
    const questions = [];
    const answers = ['make check', '', 'make all'];
    const s = io();
    const tty = { isTTY: true, write: s.stdout.write };
    const code = await main(['init'], {
      cwd: root, stdout: tty, stderr: s.stderr, stdin: { isTTY: true }, exec: fakeExec().exec, bundle: fakeBundle(),
      ask: async (question) => { questions.push(question); return answers.shift(); },
    });
    expect(code).toBe(0);
    expect(questions).toHaveLength(3);
    expect(readConfig(read).commands).toMatchObject({ test: 'make check', preflight: null, preflightFull: 'make all' });
  });

  it('--test, --preflight and --preflight-full override detection (AC 3)', async () => {
    const { root, read } = makeRepo({ git: true, files: { 'package.json': fixture('pnpm/package.json'), 'pnpm-lock.yaml': '' } });
    await init(root, ['--test', 'vendor/bin/phpunit', '--preflight', 'make ci', '--preflight-full', 'make ci-full']);
    expect(readConfig(read).commands).toMatchObject({ test: 'vendor/bin/phpunit', preflight: 'make ci', preflightFull: 'make ci-full' });
  });

  it('laws.source is knowledge with a knowledge folder, claudeMdInvariants with the CLAUDE.md heading', async () => {
    const withKnowledge = makeRepo({ git: true, files: { '.omni-loop/knowledge/README.md': 'x\n' } });
    await init(withKnowledge.root);
    expect(readConfig(withKnowledge.read).laws.source).toBe('knowledge');
    const withInvariants = makeRepo({ git: true, files: { 'CLAUDE.md': '# Rules\n\n## Invariants\n\n- one\n' } });
    await init(withInvariants.root);
    expect(readConfig(withInvariants.read).laws.source).toBe('claudeMdInvariants');
  });

  it('falls back to the origin remote and origin/HEAD when gh cannot answer', async () => {
    const { root, read } = makeRepo({ git: true });
    const run = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    run('remote', 'add', 'origin', 'git@github.com:acme/gadgets.git');
    run('update-ref', 'refs/remotes/origin/develop', 'HEAD');
    run('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/develop');
    await init(root, [], { fake: fakeExec({ ghFails: true }) });
    expect(readConfig(read).repo).toMatchObject({ slug: 'acme/gadgets', defaultBranch: 'develop' });
  });
});

describe('omni init — idempotence and --force (AC 4)', () => {
  const VALID = 'kit: 1\nrepo:\n  slug: acme/kept\n';

  it('keeps a valid config and bin byte-identical without --force, and says so', async () => {
    const { root, read } = makeRepo({ git: true, files: { '.omni-loop/config.yml': VALID, '.omni-loop/bin/omni.mjs': 'old bin\n' } });
    const { code, out } = await init(root);
    expect(code).toBe(0);
    expect(read('.omni-loop/config.yml')).toBe(VALID);
    expect(read('.omni-loop/bin/omni.mjs')).toBe('old bin\n');
    expect(out).toMatch(/kept\s+\.omni-loop\/config\.yml/);
    expect(out).toMatch(/kept\s+\.omni-loop\/bin\/omni\.mjs/);
  });

  it('rewrites both with --force', async () => {
    const { root, read } = makeRepo({ git: true, files: { '.omni-loop/config.yml': VALID, '.omni-loop/bin/omni.mjs': 'old bin\n' } });
    const bundle = fakeBundle();
    const { code, out } = await init(root, ['--force'], { bundle });
    expect(code).toBe(0);
    expect(readConfig(read).repo.slug).toBe('acme/widgets');
    expect(readFileSync(join(root, '.omni-loop/bin/omni.mjs'))).toEqual(readFileSync(bundle));
    expect(out).toMatch(/wrote\s+\.omni-loop\/config\.yml/);
  });

  it('an invalid config without --force: exit 2, the parser first line, nothing written', async () => {
    const { root, read } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nnope: true\n' } });
    const { code, err } = await init(root);
    expect(code).toBe(2);
    expect(err).toMatch(/^[^\n]*not a valid Omni Loop config[^\n]*nope[^\n]*\n$/);
    expect(read('.omni-loop/config.yml')).toBe('kit: 1\nnope: true\n');
    expect(existsSync(join(root, '.omni-loop/bin/omni.mjs'))).toBe(false);
  });

  it('an invalid config with --force is overwritten', async () => {
    const { root, read } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nnope: true\n' } });
    expect((await init(root, ['--force'])).code).toBe(0);
    expect(readConfig(read).kit).toBe(1);
  });
});

describe('omni init — the loop labels (AC 5, 6)', () => {
  it('creates exactly the missing labels, each with a colour and a description, and edits none', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labels: [{ name: 'prd', color: 'ffffff' }, { name: 'pr:sub', color: '000000' }, { name: 'bug' }] });
    const { code, out, calls } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(created(calls)).toEqual(['pr:phase-0', 'pr:feature', 'pr:in-progress', 'pr:needs-fix', 'outbox:go']);
    expect(edits(calls)).toEqual([]);
    for (const args of labelCalls(calls, 'create')) {
      expect(args).not.toContain('--force');
      expect(args[args.indexOf('--color') + 1]).toMatch(/^[0-9a-f]{6}$/);
      expect(args[args.indexOf('--description') + 1]).toMatch(/\S/);
    }
    expect(out).toMatch(/labels\s+created pr:phase-0, pr:feature, pr:in-progress, pr:needs-fix, outbox:go\s+\(already there: prd, pr:sub\)\n/);
  });

  it('lists the labels once, past gh\'s default page of 30', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec();
    await init(root, [], { fake });
    const lists = labelCalls(fake.calls, 'list');
    expect(lists).toHaveLength(1);
    expect(Number(lists[0][lists[0].indexOf('--limit') + 1])).toBeGreaterThan(30);
  });

  it('a second run creates none, edits none and exits 0', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec();
    expect((await init(root, [], { fake })).code).toBe(0);
    expect(created(fake.calls)).toEqual(LOOP_LABELS);
    fake.calls.length = 0;
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(created(fake.calls)).toEqual([]);
    expect(edits(fake.calls)).toEqual([]);
    expect(out).toMatch(new RegExp(`labels\\s+already there: ${LOOP_LABELS.join(', ')}\\n`));
  });

  it('matches an existing label whatever its case, as GitHub does', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labels: [{ name: 'PRD' }] });
    await init(root, [], { fake });
    expect(created(fake.calls)).not.toContain('prd');
  });

  it('takes the names from a kept config', async () => {
    const config = 'kit: 1\nlabels:\n  prd: epic\n  outboxGo: ship-it\n';
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/bin/omni.mjs': 'bin\n' } });
    const fake = fakeExec();
    await init(root, [], { fake });
    expect(created(fake.calls)).toEqual(['epic', 'pr:phase-0', 'pr:feature', 'pr:sub', 'pr:in-progress', 'pr:needs-fix', 'ship-it']);
  });

  it('with an invalid config and no --force, creates no label', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nnope: true\n' } });
    const fake = fakeExec();
    expect((await init(root, [], { fake })).code).toBe(2);
    expect(fake.calls.filter((args) => args[0] === 'label')).toEqual([]);
  });

  it('when gh cannot list labels: the files are written, every name is a human step, exit 0', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labelsFail: true });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(existsSync(join(root, '.omni-loop/config.yml'))).toBe(true);
    expect(existsSync(join(root, '.omni-loop/bin/omni.mjs'))).toBe(true);
    expect(created(fake.calls)).toEqual([]);
    expect(out).toContain(`create by hand: ${LOOP_LABELS.join(', ')}\n`);
  });

  it('when one creation fails, the rest are still tried and the failed one is a human step, exit 0', async () => {
    const { root } = makeRepo({ git: true });
    const base = fakeExec({ labels: [{ name: 'prd' }] });
    const exec = (cmd, args, options) => {
      if (cmd === 'gh' && args[0] === 'label' && args[1] === 'create' && args[2] === 'pr:sub') {
        base.calls.push(args);
        throw new Error('gh: HTTP 403');
      }
      return base.exec(cmd, args, options);
    };
    const { code, out } = await init(root, [], { fake: { exec, calls: base.calls } });
    expect(code).toBe(0);
    expect(created(base.calls)).toEqual(['pr:phase-0', 'pr:feature', 'pr:sub', 'pr:in-progress', 'pr:needs-fix', 'outbox:go']);
    expect(out).toMatch(/labels\s+created pr:phase-0, pr:feature, pr:in-progress, pr:needs-fix, outbox:go\s+\(already there: prd\)\n/);
    expect(out).toContain('create by hand: pr:sub\n');
  });
});

describe('omni init — running from source (AC 9)', () => {
  it('with a bin to copy and no bundle: exit 2, nothing written, names the npx command', async () => {
    const { root } = makeRepo({ git: true });
    const { code, err } = await init(root, [], { bundle: null });
    expect(code).toBe(2);
    expect(err).toMatch(/^[^\n]*npx github:vertuoza\/vertuo-omni-loop init[^\n]*\n$/);
    expect(existsSync(join(root, '.omni-loop'))).toBe(false);
  });

  it('with a bin already there and no --force, it keeps it and needs no bundle', async () => {
    const { root, read } = makeRepo({ git: true, files: { '.omni-loop/bin/omni.mjs': 'shim\n' } });
    const { code } = await init(root, [], { bundle: null });
    expect(code).toBe(0);
    expect(read('.omni-loop/bin/omni.mjs')).toBe('shim\n');
  });

  it('with --force and no bundle, it refuses to overwrite the bin with a shim', async () => {
    const VALID = 'kit: 1\n';
    const { root, read } = makeRepo({ git: true, files: { '.omni-loop/config.yml': VALID, '.omni-loop/bin/omni.mjs': 'shim\n' } });
    const { code } = await init(root, ['--force'], { bundle: null });
    expect(code).toBe(2);
    expect(read('.omni-loop/config.yml')).toBe(VALID);
  });
});

describe('omni init — footprint (AC 7)', () => {
  it('on a clean fixture, git status lists only paths under .omni-loop/', async () => {
    const { root } = makeRepo({ git: true, files: { 'package.json': fixture('pnpm/package.json'), 'pnpm-lock.yaml': '' } });
    await init(root);
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
    const paths = status.split('\n').filter(Boolean).map((line) => line.slice(3));
    expect(paths.sort()).toEqual(['.omni-loop/bin/omni.mjs', '.omni-loop/config.yml']);
  });
});

describe('omni init — the real bundle', () => {
  it('the built bundle carries its marker: it installs itself byte for byte', () => {
    execFileSync('node', [join(kitRoot, 'build.mjs')], { stdio: 'ignore' });
    const dist = join(kitRoot, 'dist/omni.mjs');
    const { root } = makeRepo({ git: true, files: { Makefile: fixture('make/Makefile') } });
    // No gh on PATH: the repository has no remote, so the slug is null, and nothing reaches the network.
    // Where a runner does ship gh in /usr/bin, it gets no token, no login and no target repository,
    // so its `label` calls fail and no real label is ever created.
    const env = { ...process.env, PATH: [dirname(process.execPath), '/usr/bin', '/bin'].join(':'), GH_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'no-gh-')) };
    for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_REPO', 'GH_HOST']) delete env[key];
    execFileSync('node', [dist, 'init'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    expect(readFileSync(join(root, '.omni-loop/bin/omni.mjs'))).toEqual(readFileSync(dist));
    const out = execFileSync('node', ['.omni-loop/bin/omni.mjs', 'config', 'commands.test'], { cwd: root, env, encoding: 'utf8' });
    expect(out).toBe('make test\n');
  }, 30000);
});
