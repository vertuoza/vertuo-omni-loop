import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDefined } from '../test/assert.ts';
import { formText, makeRepo } from '../test/fixture.ts';
import { parseConfig } from '../lib/config.ts';
import { credentials } from '../lib/ask/credentials.ts';
import { LABEL_STYLES } from '../lib/init/labels.ts';
import { FORM_IDS, parseForm } from '../lib/playbook/forms.ts';
import { main } from './omni.ts';
import type { ExecFileSyncOptions } from 'node:child_process';
import { realExec } from '../test/fixture.ts';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = join(kitRoot, 'test/fixtures/init');
const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

/**
 * `gh` faked, `git` real. Records every gh call. `labels` is the repository's label set: `label
 * list` returns it and a `label create` adds to it, so a second run sees the first run's labels.
 * `labelsFail` makes every `gh label` call fail, as it does when gh has no permission.
 */
function fakeExec({
  slug = 'acme/widgets', defaultBranch = 'trunk', ghFails = false, labels = [], labelsFail = false,
  realCommit = false, pushFails = false, openPr = null, claude = 'ok',
}: {
  slug?: string; defaultBranch?: string; ghFails?: boolean; labels?: Record<string, string>[]; labelsFail?: boolean;
  realCommit?: boolean; pushFails?: boolean; openPr?: { url: string; number: number } | null; claude?: string;
} = {}) {
  const calls: (readonly string[])[] = [];
  // Every `claude` call, as `claude args…`: never a real one. `claude` is `ok`, `installed` (the plugin
  // is there already), `missing` (no binary) or `fails` (the install is refused).
  const plugin: string[] = [];
  // Every outward step of the install pull request, in the order it ran, as `cmd verb`.
  const install: { cmd: string; args: readonly string[] }[] = [];
  const present: Record<string, string | undefined>[] = labels.map((label) => ({ description: '', ...label }));
  const exec = (cmd: string, args: readonly string[], options?: ExecFileSyncOptions) => {
    if (cmd === 'git' && ['switch', 'add', 'commit', 'push'].includes(String(args[0]))) {
      install.push({ cmd: `git ${args[0]}`, args });
      // The commit and the push are faked unless the test asks for a real commit: the footprint tests
      // read what init left in the working tree.
      if (args[0] === 'push') {
        if (pushFails) throw new Error('! [remote rejected]');
        return '';
      }
      if ((args[0] === 'add' || args[0] === 'commit') && !realCommit) return '';
    }
    if (cmd === 'claude') {
      plugin.push(`claude ${args.join(' ')}`);
      if (claude === 'missing') throw new Error('spawn claude ENOENT');
      if (args.join(' ') === 'plugin list --json') return JSON.stringify(claude === 'installed' ? [{ id: 'omni@omni-loop' }] : []);
      if (args.join(' ') === 'plugin marketplace list --json') return '[]';
      if (claude === 'fails' && args[1] === 'install') throw new Error('plugin not found');
      return '';
    }
    if (cmd !== 'gh') return realExec(cmd, args, options);
    calls.push(args);
    if (ghFails) throw new Error('gh: not logged in');
    if (args[0] === 'pr') {
      install.push({ cmd: `gh pr ${args[1]}`, args });
      if (args[1] === 'list') return JSON.stringify(openPr ? [openPr] : []);
      if (args[1] === 'create') return `https://github.com/${slug}/pull/7\n`;
    }
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
  return { exec, calls, install, plugin };
}

const LOOP_LABELS = ['omni:prd', 'omni:phase-0', 'omni:feature', 'omni:sub', 'omni:in-progress', 'omni:needs-fix', 'omni:outbox-go', 'omni:retro', 'omni:knowledge', 'omni:visual', 'omni:bug', 'omni:regression', 'omni:risk-critical', 'omni:risk-high', 'omni:risk-medium', 'omni:risk-low', 'omni:concept', 'omni:approved', 'omni:law'];
/** The arguments of each `gh` call the fake was asked to run. */
type Calls = readonly (readonly string[])[];
const labelCalls = (calls: Calls, verb: string) => calls.filter((args) => args[0] === 'label' && args[1] === verb);
const created = (calls: Calls) => labelCalls(calls, 'create').map((args) => args[2]);
const edits = (calls: Calls) => calls.filter((args) => args[0] === 'label' && !['list', 'create'].includes(String(args[1])));

/** A fake bundle file the tests inject as "the running bundle". */
function fakeBundle() {
  const file = join(mkdtempSync(join(tmpdir(), 'omni-bundle-')), 'omni.mjs');
  writeFileSync(file, '#!/usr/bin/env node\n// a bundle\n');
  return file;
}

/** A home folder of the test's own: the credentials init reads are never the person's. */
const freshHome = () => mkdtempSync(join(tmpdir(), 'omni-home-'));

/** What a test may hand `init()` beyond its arguments. */
type InitExtra = { fake?: ReturnType<typeof fakeExec>; bundle?: string | null; options?: Record<string, unknown> };

async function init(root: string, argv: string[] = [], extra: InitExtra = {}) {
  const s = io();
  const { exec, calls } = extra.fake ?? fakeExec();
  const code = await main(['init', ...argv], { cwd: root, ...s, exec, bundle: 'bundle' in extra ? extra.bundle : fakeBundle(), home: freshHome(), ...extra.options });
  return { code, out: s.out.join(''), err: s.err.join(''), calls };
}

const readConfig = (read: (path: string) => string) => parseConfig(read('.omni-loop/config.yml'));

const INSTALL_BLOCK = '\nInstall pull request:\n';
const COMPUTER_BLOCK = '\nOn this computer:\n';
const CLOSING_BLOCK = /\n(Heads-up|Then, by hand):\n/;
/** The lines of the block that starts at `heading`, up to the next one, one line per entry. */
const block = (out: string, heading: string, next: RegExp) => {
  const from = out.slice(out.indexOf(heading) + heading.length);
  return from.slice(0, from.search(next)).split('\n').filter(Boolean);
};
/** The install pull request block, one line per entry. */
const installBlock = (out: string) => block(out, INSTALL_BLOCK, /\nOn this computer:\n/);
/** What init did on this computer: the plugin and the sign-in, one line per entry. */
const computerBlock = (out: string) => block(out, COMPUTER_BLOCK, CLOSING_BLOCK);
/** What init prints last: the heads-up and the closing steps. */
const closing = (out: string) => out.slice(out.search(CLOSING_BLOCK));

const KNOWLEDGE = '.omni-loop/knowledge';
const SETTINGS = '.claude/settings.json';

/**
 * What `omni kb init` lays down in a repository with none of it, in the order it writes them: the
 * front door's page, the thirteen playbook forms, the decisions form, the three empty product registers.
 */
const FORM_FILES = [
  `${KNOWLEDGE}/README.md`,
  `${KNOWLEDGE}/playbook/briefing.md`,
  `${KNOWLEDGE}/playbook/setup.md`,
  `${KNOWLEDGE}/playbook/architecture.md`,
  `${KNOWLEDGE}/playbook/testing.md`,
  `${KNOWLEDGE}/playbook/verification.md`,
  `${KNOWLEDGE}/playbook/ci.md`,
  `${KNOWLEDGE}/playbook/pull-requests.md`,
  `${KNOWLEDGE}/playbook/definition-of-done.md`,
  `${KNOWLEDGE}/playbook/conventions.md`,
  `${KNOWLEDGE}/playbook/releasing.md`,
  `${KNOWLEDGE}/playbook/bug-fixing.md`,
  `${KNOWLEDGE}/playbook/review.md`,
  `${KNOWLEDGE}/playbook/design.md`,
  `${KNOWLEDGE}/playbook/glossary.md`,
  `${KNOWLEDGE}/adr/README.md`,
  `${KNOWLEDGE}/product/principles.md`,
  `${KNOWLEDGE}/product/rules.md`,
  `${KNOWLEDGE}/product/invariants.md`,
];

/** One entry of each kind, as the knowledge registers write them. */
const PRINCIPLE = '# Product principles\n\n## P-PRODUCT-1\n\nA person decides what ships.\n\nWhy: x\nDecided: 2026-09-25\nSource: x\n';
const RULE = '# Billing rules\n\n## BR-BILLING-1\n\nAn invoice is never deleted.\n\nServes: P-BILLING-1\nSource: x\nEnforced by: unenforced\nStated: 2026-09-25\n';
const INVARIANT = '# Billing and quotes\n\n## X-BILLING-QUOTES-1\n\nA quote names its invoice.\n\nKind: invariant\nSource: x\nEnforced by: unenforced\nStated: 2026-09-25\n';

/** The paths `git status` lists in `root`, untracked files one by one. */
function gitStatus(root: string) {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  return status.split('\n').filter(Boolean).map((line) => line.slice(3)).sort();
}

/** Every file under `root`, as `{ <path>: text }`, `.git` left out. */
function snapshot(root: string, dir = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.name === '.git') continue;
    if (entry.isDirectory()) Object.assign(out, snapshot(root, path));
    else out[path] = readFileSync(join(root, path), 'utf8');
  }
  return out;
}

/** Runs any other `omni <argv>` in `root`, once init has written a config: `{ code, out, err }`. */
async function omni(root: string, argv: readonly string[]) {
  const s = io();
  const code = await main(argv, { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

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
    expect(keys).toEqual(['kit', 'repo', 'labels', 'commands', 'laws', 'ask', 'dossier', 'answers', 'signature']);
  });

  it('points ask mode and dossiers at the Omni Loop home page, dossiers on (PRD 420)', async () => {
    const { root, read } = makeRepo({ git: true });
    await init(root);
    const config = readConfig(read);
    expect(config.ask.url).toBe('https://www.omni-loop.xyz');
    assertDefined(config.signature, 'the signature');
    expect(config.ask.url).toBe(config.signature.home);
    expect(config.dossier.enabled).toBe(true);
    expect(read('.omni-loop/config.yml')).toContain('ask:\n  url: https://www.omni-loop.xyz\n');
    expect(read('.omni-loop/config.yml')).toContain('dossier:\n  enabled: true\n');
  });

  it('writes the answers switch on, under a comment, and it parses (PRD 251)', async () => {
    const { root, read } = makeRepo({ git: true });
    await init(root);
    const text = read('.omni-loop/config.yml');
    expect(text).toMatch(/\n# [^\n]*\nanswers:\n  enabled: true\n/);
    expect(readConfig(read).answers).toEqual({ enabled: true });
  });

  it('writes the signature section with its default values, home and the footer template included, under a comment, and it parses (PRD #99, AC 4; PRD #215, AC 6)', async () => {
    const { root, read } = makeRepo({ git: true });
    await init(root);
    const text = read('.omni-loop/config.yml');
    expect(text).toContain([
      "# Who co-signs the loop's commits, pull requests and issues. null: nobody.",
      'signature:',
      '  name: Omni-man',
      '  email: 333776611+omni-loop-invader[bot]@users.noreply.github.com',
      '  home: https://www.omni-loop.xyz',
      '  footer: 🦸 {name} by [Omni Loop]({home}) ©',
    ].join('\n'));
    expect(readConfig(read).signature).toEqual({
      name: 'Omni-man',
      email: '333776611+omni-loop-invader[bot]@users.noreply.github.com',
      home: 'https://www.omni-loop.xyz',
      footer: '🦸 {name} by [Omni Loop]({home}) ©',
    });
    expect(await omni(root, ['sign', 'trailer'])).toEqual({
      code: 0,
      out: 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>\n',
      err: '',
    });
    expect(await omni(root, ['sign', 'footer'])).toEqual({
      code: 0,
      out: '🦸 Omni-man by [Omni Loop](https://www.omni-loop.xyz) © <!-- omni-loop:signed -->\n',
      err: '',
    });
  });

  it('writes neither retro key, and omni config still names the retro label and branch', async () => {
    const { root, read } = makeRepo({ git: true });
    await init(root);
    expect(read('.omni-loop/config.yml')).not.toMatch(/retro/);
    for (const [key, value] of [['labels.retro', 'omni:retro'], ['branches.retro', 'docs/retro-{topic}']] as const) {
      const s = io();
      expect(await main(['config', key], { cwd: root, ...s })).toBe(0);
      expect(s.out.join('')).toBe(`${value}\n`);
    }
  });

  it('writes neither knowledge key, and omni config still names the knowledge label and branch', async () => {
    const { root, read } = makeRepo({ git: true });
    await init(root);
    expect(read('.omni-loop/config.yml')).not.toMatch(/knowledge:/);
    for (const [key, value] of [['labels.knowledge', 'omni:knowledge'], ['branches.knowledge', 'docs/knowledge-{topic}']] as const) {
      const s = io();
      expect(await main(['config', key], { cwd: root, ...s })).toBe(0);
      expect(s.out.join('')).toBe(`${value}\n`);
    }
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
    const { code } = await init(root, [], { options: { ask: () => { asked += 1; return 'x'; } } });
    expect(code).toBe(0);
    expect(asked).toBe(0);
    expect(readConfig(read).commands).toMatchObject({ test: null, preflight: null, preflightFull: null });
  });

  it('on a terminal it asks once per unknown command, and an empty answer means none', async () => {
    const { root, read } = makeRepo({ git: true });
    const questions: unknown[] = [];
    const answers = ['make check', '', 'make all'];
    const s = io();
    const tty = { isTTY: true, write: s.stdout.write };
    // A home of its own and a sign-in that does not happen: on a terminal, init would otherwise run the
    // real sign-in flow and wait on the browser whenever this computer is not signed in.
    const code = await main(['init'], {
      cwd: root, stdout: tty, stderr: s.stderr, stdin: { isTTY: true }, exec: fakeExec().exec, bundle: fakeBundle(),
      home: freshHome(), signIn: () => Promise.resolve(1),
      ask: (question: string) => { questions.push(question); return answers.shift(); },
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

  it('laws.source is knowledge with a register entry, claudeMdInvariants with the CLAUDE.md heading', async () => {
    const withKnowledge = makeRepo({ git: true, files: { [`${KNOWLEDGE}/product/principles.md`]: PRINCIPLE } });
    await init(withKnowledge.root);
    expect(readConfig(withKnowledge.read).laws.source).toBe('knowledge');
    const withInvariants = makeRepo({ git: true, files: { 'CLAUDE.md': '# Rules\n\n## Invariants\n\n- one\n' } });
    await init(withInvariants.root);
    expect(readConfig(withInvariants.read).laws.source).toBe('claudeMdInvariants');
  });

  it('falls back to the origin remote and origin/HEAD when gh cannot answer', async () => {
    const { root, read } = makeRepo({ git: true });
    const run = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
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
    const fake = fakeExec({ labels: [{ name: 'omni:prd', color: 'ffffff' }, { name: 'omni:sub', color: '000000' }, { name: 'bug' }] });
    const { code, out, calls } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(created(calls)).toEqual(['omni:phase-0', 'omni:feature', 'omni:in-progress', 'omni:needs-fix', 'omni:outbox-go', 'omni:retro', 'omni:knowledge', 'omni:visual', 'omni:bug', 'omni:regression', 'omni:risk-critical', 'omni:risk-high', 'omni:risk-medium', 'omni:risk-low', 'omni:concept', 'omni:approved', 'omni:law']);
    expect(edits(calls)).toEqual([]);
    for (const args of labelCalls(calls, 'create')) {
      expect(args).not.toContain('--force');
      expect(args[args.indexOf('--color') + 1]).toMatch(/^[0-9a-f]{6}$/);
      expect(args[args.indexOf('--description') + 1]).toMatch(/\S/);
    }
    expect(out).toMatch(/labels\s+created omni:phase-0, omni:feature, omni:in-progress, omni:needs-fix, omni:outbox-go, omni:retro, omni:knowledge, omni:visual, omni:bug, omni:regression, omni:risk-critical, omni:risk-high, omni:risk-medium, omni:risk-low, omni:concept, omni:approved, omni:law\s+\(already there: omni:prd, omni:sub\)\n/);
  });

  it('creates omni:retro with its colour and description when it is missing', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labels: LOOP_LABELS.filter((name) => name !== 'omni:retro').map((name) => ({ name })) });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(labelCalls(fake.calls, 'create')).toEqual([
      ['label', 'create', 'omni:retro', '--color', LABEL_STYLES.retro.color, '--description', LABEL_STYLES.retro.description],
    ]);
    expect(out).toMatch(/labels\s+created omni:retro\s+\(already there: /);
  });

  it('leaves an existing omni:retro alone, whatever its colour and description', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labels: [{ name: 'omni:retro', color: '000000', description: 'ours' }] });
    await init(root, [], { fake });
    expect(created(fake.calls)).not.toContain('omni:retro');
    expect(edits(fake.calls)).toEqual([]);
  });

  it('creates omni:knowledge with its colour and description when it is missing', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labels: LOOP_LABELS.filter((name) => name !== 'omni:knowledge').map((name) => ({ name })) });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(labelCalls(fake.calls, 'create')).toEqual([
      ['label', 'create', 'omni:knowledge', '--color', LABEL_STYLES.knowledge.color, '--description', LABEL_STYLES.knowledge.description],
    ]);
    expect(out).toMatch(/labels\s+created omni:knowledge\s+\(already there: /);
  });

  it('leaves an existing omni:knowledge alone, whatever its colour and description', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labels: [{ name: 'omni:knowledge', color: '000000', description: 'ours' }] });
    await init(root, [], { fake });
    expect(created(fake.calls)).not.toContain('omni:knowledge');
    expect(edits(fake.calls)).toEqual([]);
  });

  it('creates omni:visual with its colour and description when it is missing (PRD 541)', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labels: LOOP_LABELS.filter((name) => name !== 'omni:visual').map((name) => ({ name })) });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(labelCalls(fake.calls, 'create')).toEqual([
      ['label', 'create', 'omni:visual', '--color', LABEL_STYLES.visual.color, '--description', LABEL_STYLES.visual.description],
    ]);
    expect(out).toMatch(/labels\s+created omni:visual\s+\(already there: /);
  });

  it('creates omni:concept with its colour and description when it is missing (PRD 686)', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ labels: LOOP_LABELS.filter((name) => name !== 'omni:concept').map((name) => ({ name })) });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(labelCalls(fake.calls, 'create')).toEqual([
      ['label', 'create', 'omni:concept', '--color', LABEL_STYLES.concept.color, '--description', LABEL_STYLES.concept.description],
    ]);
    expect(out).toMatch(/labels\s+created omni:concept\s+\(already there: /);
  });

  it('lists the labels once, past gh\'s default page of 30', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec();
    await init(root, [], { fake });
    const lists = labelCalls(fake.calls, 'list');
    expect(lists).toHaveLength(1);
    const [list] = lists;
    assertDefined(list, 'the label list call');
    expect(Number(list[list.indexOf('--limit') + 1])).toBeGreaterThan(30);
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
    const fake = fakeExec({ labels: [{ name: 'OMNI:PRD' }] });
    await init(root, [], { fake });
    expect(created(fake.calls)).not.toContain('omni:prd');
  });

  it('takes the names from a kept config', async () => {
    const config = 'kit: 1\nlabels:\n  prd: epic\n  outboxGo: ship-it\n';
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/bin/omni.mjs': 'bin\n' } });
    const fake = fakeExec();
    await init(root, [], { fake });
    expect(created(fake.calls)).toEqual(['epic', 'omni:phase-0', 'omni:feature', 'omni:sub', 'omni:in-progress', 'omni:needs-fix', 'ship-it', 'omni:retro', 'omni:knowledge', 'omni:visual', 'omni:bug', 'omni:regression', 'omni:risk-critical', 'omni:risk-high', 'omni:risk-medium', 'omni:risk-low', 'omni:concept', 'omni:approved', 'omni:law']);
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
    expect(out).toContain(`  labels  gh could not create ${LOOP_LABELS.join(', ')} — see step 3 below\n`);
    expect(out).toContain(`  3. Create the labels gh could not create:\n       https://github.com/acme/widgets/labels\n       ${LOOP_LABELS.join(', ')}\n`);
  });

  it('when one creation fails, the rest are still tried and the failed one is a human step, exit 0', async () => {
    const { root } = makeRepo({ git: true });
    const base = fakeExec({ labels: [{ name: 'omni:prd' }] });
    const exec = (cmd: string, args: readonly string[], options?: ExecFileSyncOptions) => {
      if (cmd === 'gh' && args[0] === 'label' && args[1] === 'create' && args[2] === 'omni:sub') {
        base.calls.push(args);
        throw new Error('gh: HTTP 403');
      }
      return base.exec(cmd, args, options);
    };
    const { code, out } = await init(root, [], { fake: { ...base, exec } });
    expect(code).toBe(0);
    expect(created(base.calls)).toEqual(['omni:phase-0', 'omni:feature', 'omni:sub', 'omni:in-progress', 'omni:needs-fix', 'omni:outbox-go', 'omni:retro', 'omni:knowledge', 'omni:visual', 'omni:bug', 'omni:regression', 'omni:risk-critical', 'omni:risk-high', 'omni:risk-medium', 'omni:risk-low', 'omni:concept', 'omni:approved', 'omni:law']);
    expect(out).toMatch(/labels\s+created omni:phase-0, omni:feature, omni:in-progress, omni:needs-fix, omni:outbox-go, omni:retro, omni:knowledge, omni:visual, omni:bug, omni:regression, omni:risk-critical, omni:risk-high, omni:risk-medium, omni:risk-low, omni:concept, omni:approved, omni:law\s+\(already there: omni:prd\)\n/);
    expect(out).toContain('  labels  gh could not create omni:sub — see step 3 below\n');
    expect(out).toContain('  3. Create the labels gh could not create:\n       https://github.com/acme/widgets/labels\n       omni:sub\n');
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
  it('on a clean fixture, git status lists only paths under .omni-loop/, and .claude/settings.json', async () => {
    const { root } = makeRepo({ git: true, files: { 'package.json': fixture('pnpm/package.json'), 'pnpm-lock.yaml': '' } });
    await init(root);
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
    const paths = status.split('\n').filter(Boolean).map((line) => line.slice(3));
    expect(paths.sort()).toEqual(['.omni-loop/bin/omni.mjs', '.omni-loop/config.yml', ...FORM_FILES, SETTINGS].sort());
  });
});

const RETRO_MD = [
  '---', 'prd: 50', 'feature-pr: 51', 'merge-sha: 4e2dc90', 'runs: [merge]', 'model: none', 'rules: 1', '---',
  '# Retro — PRD 50, A joke around every outbox question', '', 'Facts only: no model key', '',
  '## Findings', '', '## Timeline', '', '- 3 slices in 2 waves', '',
].join('\n');
const RETRO_JSON = `${JSON.stringify({ prd: 50, featurePr: 51, runs: [{ run: 'merge', rules: 1, facts: { slices: 3, waves: 2 }, findings: [] }] }, null, 2)}\n`;

describe('omni init — a retro in a PRD folder', () => {
  it('omni check all, coverage included, stays green with retro.md and retro.json in a shipped and an inbox folder', async () => {
    const { root, write } = makeRepo({ git: true });
    await init(root);
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, stdio: 'ignore' });
    git('add', '-A');
    git('commit', '-q', '-m', 'omni init');
    git('update-ref', 'refs/remotes/origin/trunk', 'HEAD');
    const spec = (prd: string | number | undefined) => `---\nprd: ${prd}\ntitle: A PRD\nblocked-by: none\nspec: file\n---\n\n# A PRD\n`;
    const shipped = '.omni-loop/delivery/shipped/0050-question-intros';
    const inbox = '.omni-loop/delivery/inbox/0051-merged-unshipped';
    for (const [folder, prd] of [[shipped, 50], [inbox, 51]]) {
      write(`${folder}/spec.md`, spec(prd));
      write(`${folder}/plan.md`, '# A PRD — plan\n');
      write(`${folder}/retro.md`, RETRO_MD.replace('prd: 50', `prd: ${prd}`));
      write(`${folder}/retro.json`, RETRO_JSON);
    }
    git('add', '-A');
    git('commit', '-q', '-m', 'docs(retro): PRD 50');
    for (const prd of ['50', '51']) {
      const s = io();
      expect(await main(['check', 'all', '--prd', prd], { cwd: root, ...s })).toBe(0);
      expect(s.out.join('')).not.toMatch(/skipped/);
      expect(s.out.join('')).toMatch(new RegExp(`PRD #${prd}: 0 risky change`));
    }
  });
});

describe('omni init — the real bundle', () => {
  it('the built bundle carries its marker: it installs itself byte for byte', () => {
    // Built to a scratch file: the committed kit/dist/omni.mjs is only ever compared, never rewritten by a test.
    const dist = join(mkdtempSync(join(tmpdir(), 'omni-built-')), 'omni.mjs');
    execFileSync('node', [join(kitRoot, 'build.ts'), dist], { stdio: 'ignore' });
    const { root } = makeRepo({ git: true, files: { Makefile: fixture('make/Makefile') } });
    // No gh on PATH: the repository has no remote, so the slug is null, and nothing reaches the network.
    // Where a runner does ship gh in /usr/bin, it gets no token, no login and no target repository,
    // so its `label` calls fail and no real label is ever created.
    // A `claude` that always fails comes first on the PATH: a real one, beside node, would install the
    // plugin on this computer.
    const stubs = mkdtempSync(join(tmpdir(), 'no-claude-'));
    writeFileSync(join(stubs, 'claude'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const hidden = ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_REPO', 'GH_HOST'];
    const env = Object.fromEntries(
      Object.entries({ ...process.env, PATH: [stubs, dirname(process.execPath), '/usr/bin', '/bin'].join(':'), GH_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'no-gh-')) })
        .filter(([key]) => !hidden.includes(key)),
    );
    execFileSync('node', [dist, 'init'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    expect(readFileSync(join(root, '.omni-loop/bin/omni.mjs'))).toEqual(readFileSync(dist));
    const out = execFileSync('node', ['.omni-loop/bin/omni.mjs', 'config', 'commands.test'], { cwd: root, env, encoding: 'utf8' });
    expect(out).toBe('make test\n');
  });
});

const KIT_HOME = 'vertuoza/vertuo-omni-loop';

/** What the closing steps say of the status line while the kit's own is in place, and how to remove the loop then. */
const STATUS_LINE_STEPS = [
  'The status line is on for everyone who opens Claude Code in this repository. A person who wants',
  'their own sets statusLine in .claude/settings.local.json, which Claude Code reads first.',
];
const REMOVAL = [
  'To remove the loop: delete .omni-loop/ and the statusLine key of .claude/settings.json, and commit.',
  'The labels and the App installation stay.',
];
/** The removal line while the settings file holds no line of the kit's: init added nothing there. */
const REMOVAL_WITHOUT_KEY = 'To remove the loop: delete .omni-loop/ and commit. The labels and the App installation stay.';

/** The host of the ask.url init writes: the Omni Loop home page. */
const ASK_HOST = 'www.omni-loop.xyz';

/** What a first run on a bare repository prints, as `acme/widgets` on `trunk` sees it, with no terminal. */
const FIRST_RUN = [
  'omni init — acme/widgets is set up.',
  '  wrote   .omni-loop/config.yml',
  '  wrote   .omni-loop/bin/omni.mjs',
  ...FORM_FILES.map((path) => `  wrote   ${path}`),
  '  wrote   .claude/settings.json  (statusLine)',
  '  wrote   .claude/settings.json  (enabledPlugins: omni-hud@omni-loop)',
  '  labels  created omni:prd, omni:phase-0, omni:feature, omni:sub, omni:in-progress, omni:needs-fix, omni:outbox-go, omni:retro, omni:knowledge, omni:visual, omni:bug, omni:regression, omni:risk-critical, omni:risk-high, omni:risk-medium, omni:risk-low, omni:concept, omni:approved, omni:law',
  '',
  'Install pull request:',
  '  branch  created chore/install-omni-loop',
  '  commit  chore: install the Omni Loop',
  '  pushed  chore/install-omni-loop to origin',
  '  PR      opened https://github.com/acme/widgets/pull/7',
  '',
  'On this computer:',
  '  plugin  installed omni@omni-loop, run /reload-plugins in an open Claude Code',
  `  signin  not signed in to ${ASK_HOST}: no terminal`,
  '',
  'Type this in a terminal to sign in later:',
  '     omni signin',
  '',
  'Then, by hand:',
  '  1. Install the omni-loop GitHub App on acme/widgets:',
  '       https://github.com/apps/omni-loop-invader/installations/new',
  '  2. Merge PR #7 into trunk:',
  '       https://github.com/acme/widgets/pull/7',
  '  3. (Optional) Require the `outbox` check on trunk:',
  '       https://github.com/acme/widgets/settings/branches',
  '     Warning: a required check that is never posted blocks every pull request in this repository.',
  '     If the app is uninstalled, its deploy is broken or Inngest is down, nothing can merge. The remedy',
  '     is to remove the requirement, never to fake a status.',
  '  4. Fill the forms in .omni-loop/knowledge/ with what the repository can prove, in Claude Code:',
  '       /omni:invade',
  '',
  'Not filled — set them in .omni-loop/config.yml or rerun with the flag:',
  '  commands.test (--test <cmd>)',
  '  commands.preflight (--preflight <cmd>)',
  '  commands.preflightFull (--preflight-full <cmd>)',
  '',
  'To update the loop later: node .omni-loop/bin/omni.mjs update opens the pull request that brings',
  'this repository to the latest kit, then updates the omni plugin on your machine.',
  '',
  ...STATUS_LINE_STEPS,
  '',
  ...REMOVAL,
  '',
];

describe('omni init — the closing steps (AC 8)', () => {
  it('a first run on a bare repository prints them line by line', async () => {
    const { root } = makeRepo({ git: true });
    const { code, out } = await init(root);
    expect(code).toBe(0);
    expect(out.split('\n')).toEqual(FIRST_RUN);
  });

  it('only the slug and the default branch vary between two repositories', async () => {
    const run = async (slug: string, defaultBranch: string) => {
      const { root } = makeRepo({ git: true });
      const { out } = await init(root, [], { fake: fakeExec({ slug, defaultBranch }) });
      return out.split(slug).join('<slug>').split(defaultBranch).join('<branch>');
    };
    const a = await run('acme/widgets', 'trunk');
    const b = await run('globex/billing-api', 'develop');
    expect(a).toBe(b);
    expect(a).toContain('https://github.com/<slug>/settings/branches');
    expect(a).toContain('  2. Merge PR #7 into <branch>:\n       https://github.com/<slug>/pull/7\n');
  });

  it('names only the commands left null, each with its flag', async () => {
    const { root } = makeRepo({ git: true });
    const { out } = await init(root, ['--preflight', 'make ci', '--preflight-full', 'make ci']);
    const tail = out.slice(out.indexOf('Not filled'));
    expect(tail.split('\n').slice(0, 3)).toEqual([
      'Not filled — set them in .omni-loop/config.yml or rerun with the flag:',
      '  commands.test (--test <cmd>)',
      '',
    ]);
  });

  it('has no "Not filled" section when every command is known', async () => {
    const { root } = makeRepo({ git: true, files: { Makefile: fixture('make/Makefile') } });
    const { out } = await init(root);
    expect(out).not.toContain('Not filled');
  });

  it('a second run says what it kept, still lists the steps, and exits 0', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec();
    await init(root, [], { fake });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(out.split('\n').slice(0, 6)).toEqual([
      'omni init — acme/widgets is set up.',
      '  kept    .omni-loop/config.yml    (pass --force to overwrite)',
      '  kept    .omni-loop/bin/omni.mjs  (pass --force to overwrite)',
      '  kept    .claude/settings.json  (statusLine)',
      '  kept    .claude/settings.json  (enabledPlugins: omni-hud@omni-loop)',
      `  labels  already there: ${LOOP_LABELS.join(', ')}`,
    ]);
    // A form is never overwritten, so a kept one is never listed: the steps follow the labels line.
    const secondRun = FIRST_RUN.slice(6 + FORM_FILES.length);
    secondRun[secondRun.indexOf('  branch  created chore/install-omni-loop')] = '  branch  on chore/install-omni-loop already';
    expect(out.split('\n').slice(6)).toEqual(secondRun);
  });

  it('a second run with --force wrote the files and the key again, and commits them on the install branch', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec();
    await init(root, [], { fake });
    const { out } = await init(root, ['--force'], { fake });
    expect(out).toContain('  wrote   .omni-loop/config.yml\n');
    expect(out).toContain('  wrote   .claude/settings.json  (statusLine)\n');
    expect(installBlock(out)).toContain('  commit  chore: install the Omni Loop');
  });

  it('with neither gh nor a remote to name the repository, it says so instead of a link', async () => {
    const { root } = makeRepo({ git: true });
    const { code, out } = await init(root, [], { fake: fakeExec({ ghFails: true }) });
    expect(code).toBe(0);
    expect(out).toContain('omni init — this repository is set up.\n');
    expect(out).toContain('  2. Merge the install pull request into main, once it is open (see above).\n');
    expect(out).toContain('  1. Install the omni-loop GitHub App on this repository:\n');
    expect(out).toContain('       https://github.com/<owner>/<repository>/settings/branches\n');
  });

  it('names the outbox check the config names', async () => {
    const config = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\nci:\n  outboxContext: omni/outbox\n';
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/bin/omni.mjs': 'bin\n' } });
    const { out } = await init(root);
    expect(out).toContain('  3. (Optional) Require the `omni/outbox` check on trunk:\n');
  });
});

describe('omni init — the heads-up', () => {
  const OUTBOX_WORKFLOW = 'name: outbox\non: pull_request\njobs:\n  status:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ci/outbox\n';

  it('names the outbox workflow of an older loop, and writes nothing outside .omni-loop/ but .claude/settings.json', async () => {
    const { root } = makeRepo({ git: true, files: { '.github/workflows/outbox.yml': OUTBOX_WORKFLOW, '.github/workflows/ci.yml': 'name: ci\n' } });
    const { code, out } = await init(root);
    expect(code).toBe(0);
    expect(out).toContain(
      '\nHeads-up:\n'
        + '  - An older copy of the loop already runs here (.github/workflows/outbox.yml). Two loops mean\n'
        + '    two outbox checks and two label sets: decide which one stays before merging .omni-loop/.\n',
    );
    expect(gitStatus(root).filter((path) => !path.startsWith('.omni-loop/'))).toEqual([SETTINGS]);
  });

  it('tells a Prettier repository to ignore the bin, and leaves .prettierignore alone', async () => {
    const { root } = makeRepo({ git: true, files: { '.prettierrc': '{}\n', '.prettierignore': 'dist\n' } });
    const { out } = await init(root);
    expect(out).toContain(
      '  - Prettier checks this repository: add .omni-loop/bin/ to .prettierignore, or its\n'
        + '    format check rejects the bundled bin.\n',
    );
    expect(readFileSync(join(root, '.prettierignore'), 'utf8')).toBe('dist\n');
  });

  it('says nothing once .prettierignore covers the folder, nor on a repository with neither', async () => {
    const covered = makeRepo({ git: true, files: { '.prettierrc': '{}\n', '.prettierignore': '# kit\n/.omni-loop/\n' } });
    expect((await init(covered.root)).out).not.toContain('Heads-up');
    const bare = makeRepo({ git: true });
    expect((await init(bare.root)).out).not.toContain('Heads-up');
  });
});

describe('omni init — the forms (PRD 45, AC 11)', () => {
  const REPOS = {
    pnpm: { 'package.json': fixture('pnpm/package.json'), 'pnpm-lock.yaml': '' },
    composer: { 'composer.json': fixture('composer/composer.json') },
    make: { Makefile: fixture('make/Makefile') },
  };

  for (const [name, files] of Object.entries(REPOS)) {
    it(`a ${name} repository with no .omni-loop/: the config, the bin and the forms of omni kb init, laws none, and a second run writes nothing`, async () => {
      const { root, read } = makeRepo({ git: true, files });
      const fake = fakeExec();
      const first = await init(root, [], { fake });
      expect(first.code).toBe(0);
      expect(gitStatus(root)).toEqual(['.omni-loop/bin/omni.mjs', '.omni-loop/config.yml', ...FORM_FILES, SETTINGS].sort());
      for (const id of FORM_IDS) {
        const file = id === 'decisions' ? `${KNOWLEDGE}/adr/README.md` : `${KNOWLEDGE}/playbook/${id}.md`;
        const parsed = parseForm(read(file), { file });
        expect(parsed.errors ?? [], file).toEqual([]);
        assertDefined(parsed.form, file);
        expect(parsed.form.state, file).toBe('blank');
      }
      expect(readConfig(read).laws.source).toBe('none');
      expect(first.out).toContain('\n       /omni:invade\n');
      // The same writer as `omni kb init`, which then finds nothing left to write; both checks stay green.
      expect((await omni(root, ['kb', 'init'])).out).toBe(`kb init — wrote 0 file(s); ${FORM_FILES.length} already there, left as they were.\n`);
      expect((await omni(root, ['check', 'knowledge'])).code).toBe(0);
      expect((await omni(root, ['check', 'kb'])).code).toBe(0);

      const before = snapshot(root);
      const second = await init(root, [], { fake });
      expect(second.code).toBe(0);
      expect(snapshot(root)).toEqual(before);
      expect(second.out).not.toContain('wrote');
    });
  }

  it('--force keeps laws.source none over the forms and the empty registers, reads knowledge once one holds an entry, and never rewrites a form', async () => {
    const { root, read, write } = makeRepo({ git: true, files: REPOS.make });
    await init(root);
    const testing = `${KNOWLEDGE}/playbook/testing.md`;
    write(testing, read(testing).replace('<!-- slot: commands · required -->', '<!-- slot: commands · required -->\n`make test`'));
    const ours = read(testing);

    expect((await init(root, ['--force'])).code).toBe(0);
    expect(readConfig(read).laws.source).toBe('none');
    expect(read(testing)).toBe(ours);

    write(`${KNOWLEDGE}/product/principles.md`, PRINCIPLE);
    const { code, out } = await init(root, ['--force']);
    expect(code).toBe(0);
    expect(readConfig(read).laws.source).toBe('knowledge');
    expect(out).toContain('  wrote   .omni-loop/config.yml\n');
    expect(out).not.toContain(`  wrote   ${KNOWLEDGE}/`);
    expect(read(testing)).toBe(ours);
  });

  it('reads knowledge from an entry in any register: a domain rule, a cross-domain invariant', async () => {
    for (const [path, text] of [[`${KNOWLEDGE}/domains/billing/rules.md`, RULE], [`${KNOWLEDGE}/cross-domain/billing--quotes.md`, INVARIANT]] as const) {
      const { root, read } = makeRepo({ git: true, files: { [path]: text } });
      await init(root);
      expect(readConfig(read).laws.source, path).toBe('knowledge');
    }
  });

  it('a knowledge folder with no entry is no laws: CLAUDE.md invariants then count, else none', async () => {
    const empty = { [`${KNOWLEDGE}/README.md`]: 'x\n', [`${KNOWLEDGE}/product/principles.md`]: '# Product principles\n\nNone yet.\n' };
    const bare = makeRepo({ git: true, files: empty });
    await init(bare.root);
    expect(readConfig(bare.read).laws.source).toBe('none');
    const withInvariants = makeRepo({ git: true, files: { ...empty, 'CLAUDE.md': '# Rules\n\n## Invariants\n\n- one\n' } });
    await init(withInvariants.root);
    expect(readConfig(withInvariants.read).laws.source).toBe('claudeMdInvariants');
  });

  it('a repository installed before the forms: keeps the config and the bin, writes the forms and lists each one', async () => {
    const config = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\n';
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/bin/omni.mjs': 'bin\n' } });
    const { code, out } = await init(root);
    expect(code).toBe(0);
    expect(gitStatus(root)).toEqual([...FORM_FILES, SETTINGS].sort());
    expect(out.split('\n').slice(1, 5 + FORM_FILES.length)).toEqual([
      '  kept    .omni-loop/config.yml    (pass --force to overwrite)',
      '  kept    .omni-loop/bin/omni.mjs  (pass --force to overwrite)',
      ...FORM_FILES.map((path) => `  wrote   ${path}`),
      '  wrote   .claude/settings.json  (statusLine)',
      '  wrote   .claude/settings.json  (enabledPlugins: omni-hud@omni-loop)',
    ]);
    expect(installBlock(out)).toContain('  commit  chore: install the Omni Loop');
  });

  it('writes no form outside .omni-loop/: a kept config whose playbook lies elsewhere leaves them to /omni:invade', async () => {
    const config = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\npaths:\n  playbook: docs/playbook\n';
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/bin/omni.mjs': 'bin\n' } });
    const { code, out } = await init(root);
    expect(code).toBe(0);
    expect(gitStatus(root)).toEqual([SETTINGS]);
    expect(out).toContain('  kept    .omni-loop/bin/omni.mjs  (pass --force to overwrite)\n  forms   not written: docs/ is outside .omni-loop/ — see step 4 below\n');
    expect(out).toContain('  4. Fill the forms in docs/ with what the repository can prove, in Claude Code:\n       /omni:invade\n');
    expect(installBlock(out)).toContain('  commit  chore: install the Omni Loop');
  });
});

describe('omni init — the status line (PRD 324)', () => {
  // The spec's key, verbatim ("The install"): the bin init installs, run as `statusline`.
  const KIT_LINE = {
    type: 'command',
    command: 'node "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/.omni-loop/bin/omni.mjs" statusline',
    refreshInterval: 30,
  };
  const settingsText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  const THEIRS = settingsText({ model: 'opus', statusLine: { type: 'command', command: 'npx claude-hud' } });
  const ON = `\n${STATUS_LINE_STEPS.join('\n')}\n\n${REMOVAL.join('\n')}\n`;
  // The band's line init adds beside it (PRD 1208).
  const HUD_ON = { 'omni-hud@omni-loop': true };

  it('creates .claude/settings.json holding the key, prints that it wrote it, and says who sees it and how to remove it', async () => {
    const { root, read } = makeRepo({ git: true });
    const { code, out } = await init(root);
    expect(code).toBe(0);
    expect(read(SETTINGS)).toBe(settingsText({ statusLine: KIT_LINE, enabledPlugins: HUD_ON }));
    expect(out).toContain('\n  wrote   .claude/settings.json  (statusLine)\n  wrote   .claude/settings.json  (enabledPlugins: omni-hud@omni-loop)\n');
    expect(closing(out).endsWith(ON)).toBe(true);
  });

  it('keeps every other key of the file, in its order and with its value', async () => {
    const before = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] }, enabledPlugins: { 'omni@omni-loop': true } };
    const { root, read } = makeRepo({ git: true, files: { [SETTINGS]: JSON.stringify(before) } });
    const { code, out } = await init(root);
    expect(code).toBe(0);
    expect(read(SETTINGS)).toBe(settingsText({ ...before, statusLine: KIT_LINE, enabledPlugins: { ...before.enabledPlugins, ...HUD_ON } }));
    expect(out).toContain('\n  wrote   .claude/settings.json  (statusLine)\n');
  });

  it('keeps the kit\'s own line as it is, and rewrites it with --force', async () => {
    const olderLine = { type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.omni-loop/bin/omni.mjs" statusline' };
    const { root, read } = makeRepo({ git: true, files: { [SETTINGS]: settingsText({ statusLine: olderLine, model: 'opus' }) } });
    const kept = await init(root);
    expect(kept.code).toBe(0);
    expect(read(SETTINGS)).toBe(settingsText({ statusLine: olderLine, model: 'opus', enabledPlugins: HUD_ON }));
    expect(kept.out).toContain('\n  kept    .claude/settings.json  (statusLine)\n');
    expect(closing(kept.out).endsWith(ON)).toBe(true);

    const forced = await init(root, ['--force']);
    expect(forced.code).toBe(0);
    expect(read(SETTINGS)).toBe(settingsText({ statusLine: KIT_LINE, model: 'opus', enabledPlugins: HUD_ON }));
    expect(forced.out).toContain('\n  wrote   .claude/settings.json  (statusLine)\n  kept    .claude/settings.json  (enabledPlugins: omni-hud@omni-loop)\n');
  });

  it('never touches someone else\'s line, even with --force, and then claims no status line of its own', async () => {
    for (const argv of [[], ['--force']] as string[][]) {
      const { root, read } = makeRepo({ git: true, files: { [SETTINGS]: THEIRS } });
      const { code, out } = await init(root, argv);
      expect(code, argv.join(' ')).toBe(0);
      // Their line is theirs; the band's line is added beside it, by its own rule.
      expect(read(SETTINGS)).toBe(settingsText({ ...JSON.parse(THEIRS), enabledPlugins: HUD_ON }));
      expect(out).toContain('\n  kept    .claude/settings.json  (its statusLine is not the kit\'s)\n  wrote   .claude/settings.json  (enabledPlugins: omni-hud@omni-loop)\n');
      expect(installBlock(out)).toContain('  commit  chore: install the Omni Loop');
      expect(out).not.toContain('settings.local.json');
      expect(closing(out).endsWith(`\n\n${REMOVAL_WITHOUT_KEY}\n`)).toBe(true);
    }
  });

  it('turns the band on beside the plugins already there, and never over a false someone else set (PRD 1208)', async () => {
    const mine = settingsText({ enabledPlugins: { 'omni@omni-loop': true } });
    const fresh = makeRepo({ git: true, files: { [SETTINGS]: mine } });
    expect((await init(fresh.root)).code).toBe(0);
    expect(fresh.read(SETTINGS)).toBe(settingsText({ enabledPlugins: { 'omni@omni-loop': true, ...HUD_ON }, statusLine: KIT_LINE }));

    for (const argv of [[], ['--force']] as string[][]) {
      const off = settingsText({ enabledPlugins: { 'omni-hud@omni-loop': false }, statusLine: KIT_LINE });
      const { root, read } = makeRepo({ git: true, files: { [SETTINGS]: off } });
      const { code, out } = await init(root, argv);
      expect(code, argv.join(' ')).toBe(0);
      expect(read(SETTINGS)).toBe(off);
      expect(out).toContain('\n  kept    .claude/settings.json  (its omni-hud@omni-loop is someone else\'s)\n');
    }
  });

  it('leaves a file that is not valid JSON byte-identical, says so, and still exits 0', async () => {
    for (const argv of [[], ['--force']]) {
      const text = '{\n  // mine\n  "model": "opus",\n}\n';
      const { root, read } = makeRepo({ git: true, files: { [SETTINGS]: text } });
      const { code, out, err } = await init(root, argv);
      expect(code, argv.join(' ')).toBe(0);
      expect(err).toBe('');
      expect(read(SETTINGS)).toBe(text);
      expect(out).toContain('\n  skipped .claude/settings.json: not valid JSON, no status line added\n');
      expect(out).not.toContain('settings.local.json');
      expect(closing(out).endsWith(`\n\n${REMOVAL_WITHOUT_KEY}\n`)).toBe(true);
      expect(gitStatus(root).some((path) => path.startsWith('.claude/'))).toBe(false);
    }
  });

  it('a repository that already has the loop gets the key by running init again, keeping the config and the bin', async () => {
    const { root, read } = makeRepo({ git: true });
    const fake = fakeExec();
    await init(root, [], { fake });
    rmSync(join(root, '.claude'), { recursive: true });
    const config = read('.omni-loop/config.yml');
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(read('.omni-loop/config.yml')).toBe(config);
    expect(read(SETTINGS)).toBe(settingsText({ statusLine: KIT_LINE, enabledPlugins: HUD_ON }));
    expect(out.split('\n').slice(1, 6)).toEqual([
      '  kept    .omni-loop/config.yml    (pass --force to overwrite)',
      '  kept    .omni-loop/bin/omni.mjs  (pass --force to overwrite)',
      '  wrote   .claude/settings.json  (statusLine)',
      '  wrote   .claude/settings.json  (enabledPlugins: omni-hud@omni-loop)',
      `  labels  already there: ${LOOP_LABELS.join(', ')}`,
    ]);
    expect(installBlock(out)).toContain('  commit  chore: install the Omni Loop');
  });
});

describe('omni init — the install pull request (PRD 420)', () => {
  const BRANCH = 'chore/install-omni-loop';
  const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  /** A fixture repository whose commits need no global identity, and one tracked file of the person's. */
  function repo() {
    const made = makeRepo({ git: true, files: { 'README.md': 'hello\n' } });
    git(made.root, 'config', 'user.email', 't@t');
    git(made.root, 'config', 'user.name', 't');
    return made;
  }

  it('switches, commits only its own files, pushes and opens the pull request, in that order, and prints its link', async () => {
    const { root, write } = repo();
    write('README.md', 'the person was editing this\n');
    const fake = fakeExec({ realCommit: true });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(fake.install.map((step) => step.cmd)).toEqual(['git switch', 'git add', 'git commit', 'git push', 'gh pr list', 'gh pr create']);
    expect(fake.install[0]?.args).toEqual(['switch', '-c', BRANCH]);
    expect(fake.install[3]?.args).toEqual(['push', '-u', 'origin', BRANCH]);
    expect(fake.install[5]?.args.slice(0, 8)).toEqual(['pr', 'create', '--base', 'trunk', '--head', BRANCH, '--title', 'chore: install the Omni Loop']);
    expect(git(root, 'branch', '--show-current')).toBe(BRANCH);
    expect(git(root, 'log', '-1', '--format=%s')).toBe('chore: install the Omni Loop');
    const committed = git(root, 'show', '--name-only', '--format=', 'HEAD').split('\n');
    expect(committed.every((path) => path.startsWith('.omni-loop/') || path === SETTINGS)).toBe(true);
    expect(committed).toContain(SETTINGS);
    expect(gitStatus(root)).toEqual(['README.md']);
    expect(installBlock(out).at(-1)).toBe('  PR      opened https://github.com/acme/widgets/pull/7');
  });

  it('already on the install branch, it stays there', async () => {
    const { root } = repo();
    git(root, 'switch', '-q', '-c', BRANCH);
    const fake = fakeExec();
    const { out } = await init(root, [], { fake });
    expect(fake.install.some((step) => step.cmd === 'git switch')).toBe(false);
    expect(git(root, 'branch', '--show-current')).toBe(BRANCH);
    expect(installBlock(out)[0]).toBe(`  branch  on ${BRANCH} already`);
  });

  it('a pull request that already exists is printed with "already", and none is created', async () => {
    const { root } = repo();
    const fake = fakeExec({ openPr: { url: 'https://github.com/acme/widgets/pull/3', number: 3 } });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(fake.install.some((step) => step.cmd === 'gh pr create')).toBe(false);
    expect(installBlock(out)).toContain('  PR      already open: https://github.com/acme/widgets/pull/3');
  });

  it('a push refused: exit 0, and the push and gh lines to type', async () => {
    const { root } = repo();
    const { code, out } = await init(root, [], { fake: fakeExec({ pushFails: true }) });
    expect(code).toBe(0);
    expect(installBlock(out)).toEqual([
      `  branch  created ${BRANCH}`,
      '  commit  chore: install the Omni Loop',
      '  push    origin refused the push',
      'Type these to finish the install pull request:',
      `     git push -u origin ${BRANCH}`,
      `     gh pr create --base trunk --head ${BRANCH} --title "chore: install the Omni Loop" --fill`,
      `     or open https://github.com/acme/widgets/compare/trunk...${BRANCH}?expand=1`,
    ]);
  });

  it('gh missing: exit 0, pushed, and the gh line to type', async () => {
    const { root } = repo();
    git(root, 'remote', 'add', 'origin', 'git@github.com:acme/gadgets.git');
    const { code, out } = await init(root, [], { fake: fakeExec({ ghFails: true }) });
    expect(code).toBe(0);
    expect(installBlock(out)).toEqual([
      `  branch  created ${BRANCH}`,
      '  commit  chore: install the Omni Loop',
      `  pushed  ${BRANCH} to origin`,
      '  PR      gh could not open the pull request',
      'Type these to finish the install pull request:',
      `     gh pr create --base main --head ${BRANCH} --title "chore: install the Omni Loop" --fill`,
      `     or open https://github.com/acme/gadgets/compare/main...${BRANCH}?expand=1`,
    ]);
  });

  it('a rerun with nothing new commits nothing and finds the pull request', async () => {
    const { root } = repo();
    await init(root, [], { fake: fakeExec({ realCommit: true }) });
    const head = git(root, 'rev-parse', 'HEAD');
    const fake = fakeExec({ realCommit: true, openPr: { url: 'https://github.com/acme/widgets/pull/7', number: 7 } });
    const { out } = await init(root, [], { fake });
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(installBlock(out)).toEqual([
      `  branch  on ${BRANCH} already`,
      '  commit  nothing new to commit, already committed',
      `  pushed  ${BRANCH} to origin`,
      '  PR      already open: https://github.com/acme/widgets/pull/7',
    ]);
  });
});

describe('omni init — the plugin and the sign-in (PRD 420)', () => {
  const PLUGIN_TODO = [
    'Type these in Claude Code to install the plugin:',
    `     /plugin marketplace add ${KIT_HOME}`,
    '     /plugin install omni@omni-loop',
  ];
  const ENTRY = { access_token: 'a', refresh_token: 'r', expires_at: null, email: 'ada@example.test' };

  /** A terminal: stdin and stdout are TTYs, and every command question is answered empty. */
  async function onTerminal(
    root: string,
    { fake = fakeExec(), home = freshHome(), signIn }: { fake?: ReturnType<typeof fakeExec>; home?: string; signIn?: () => Promise<unknown> } = {},
  ) {
    const s = io();
    Object.assign(s.stdout, { isTTY: true });
    const code = await main(['init'], { cwd: root, ...s, exec: fake.exec, bundle: fakeBundle(), home, signIn, stdin: { isTTY: true }, ask: () => '' });
    return { code, out: s.out.join('') };
  }

  it('adds the marketplace, then installs the plugin, with the names omni update uses', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec();
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(fake.plugin.filter((call) => !call.endsWith('--json'))).toEqual([
      `claude plugin marketplace add ${KIT_HOME}`,
      'claude plugin install omni@omni-loop',
    ]);
    expect(computerBlock(out)[0]).toBe('  plugin  installed omni@omni-loop, run /reload-plugins in an open Claude Code');
  });

  it('claude missing, or the install failing: exit 0, and the two /plugin lines to type', async () => {
    for (const claude of ['missing', 'fails']) {
      const { root } = makeRepo({ git: true });
      const { code, out } = await init(root, [], { fake: fakeExec({ claude }) });
      expect(code, claude).toBe(0);
      const lines = computerBlock(out);
      expect(lines[0], claude).toBe('  plugin  could not install omni@omni-loop from here');
      expect(lines.slice(2, 5), claude).toEqual(PLUGIN_TODO);
    }
  });

  it('a plugin installed already says "already", and nothing is installed', async () => {
    const { root } = makeRepo({ git: true });
    const fake = fakeExec({ claude: 'installed' });
    const { out } = await init(root, [], { fake });
    expect(fake.plugin).toEqual(['claude plugin list --json']);
    expect(computerBlock(out)[0]).toBe('  plugin  omni@omni-loop installed already');
  });

  it('on a terminal and signed out, it runs the sign-in flow, and prints who signed in', async () => {
    const { root } = makeRepo({ git: true });
    const home = freshHome();
    let flows = 0;
    const signIn = () => {
      flows += 1;
      credentials({ home }).write(ASK_HOST, ENTRY);
      return Promise.resolve(0);
    };
    const { code, out } = await onTerminal(root, { home, signIn });
    expect(code).toBe(0);
    expect(flows).toBe(1);
    expect(computerBlock(out)).toEqual([
      '  plugin  installed omni@omni-loop, run /reload-plugins in an open Claude Code',
      `  signin  signed in to ${ASK_HOST} as ${ENTRY.email}`,
    ]);
  });

  it('signed in already: "already", and no flow runs', async () => {
    const { root } = makeRepo({ git: true });
    const home = freshHome();
    credentials({ home }).write(ASK_HOST, ENTRY);
    let flows = 0;
    const { out } = await onTerminal(root, { home, signIn: () => { flows += 1; return Promise.resolve(0); } });
    expect(flows).toBe(0);
    expect(computerBlock(out)[1]).toBe(`  signin  signed in to ${ASK_HOST} already, as ${ENTRY.email}`);
  });

  it('a sign-in refused or timed out: exit 0, and omni signin as a later step', async () => {
    const { root } = makeRepo({ git: true });
    const { code, out } = await onTerminal(root, { signIn: () => Promise.resolve(1) });
    expect(code).toBe(0);
    expect(computerBlock(out).slice(1)).toEqual([
      `  signin  not signed in to ${ASK_HOST}: did not finish`,
      'Type this in a terminal to sign in later:',
      '     omni signin',
    ]);
  });

  it('a rerun on an installed repository prints "already" for each step that is done', async () => {
    const { root } = makeRepo({ git: true });
    for (const [key, value] of [['user.email', 't@t'], ['user.name', 't']] as const) execFileSync('git', ['config', key, value], { cwd: root });
    const home = freshHome();
    await init(root, [], { fake: fakeExec({ realCommit: true }), options: { home } });
    credentials({ home }).write(ASK_HOST, ENTRY);
    const fake = fakeExec({ realCommit: true, claude: 'installed', openPr: { url: 'https://github.com/acme/widgets/pull/7', number: 7 } });
    const { code, out } = await init(root, [], { fake, options: { home } });
    expect(code).toBe(0);
    expect(installBlock(out)).toEqual([
      '  branch  on chore/install-omni-loop already',
      '  commit  nothing new to commit, already committed',
      '  pushed  chore/install-omni-loop to origin',
      '  PR      already open: https://github.com/acme/widgets/pull/7',
    ]);
    expect(computerBlock(out)).toEqual([
      '  plugin  omni@omni-loop installed already',
      `  signin  signed in to ${ASK_HOST} already, as ${ENTRY.email}`,
    ]);
    expect(closing(out)).toContain('  2. Merge PR #7 into trunk:\n       https://github.com/acme/widgets/pull/7\n');
  });
});

describe('omni init — a repository already installed on its default branch (PRD 893)', () => {
  const INSTALLED_CONFIG = `kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: main\nask:\n  url: https://${ASK_HOST}\n`;
  const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  /**
   * A repository whose bare `origin` has `onMain` on `main`, checked out on a branch `work` of its
   * own: the branch a teammate is on when they run init.
   */
  function withOrigin(onMain: Record<string, string>) {
    const made = makeRepo({ git: true, files: onMain });
    const bare = join(mkdtempSync(join(tmpdir(), 'omni-origin-')), 'origin.git');
    git(made.root, 'clone', '-q', '--bare', made.root, bare);
    git(made.root, 'remote', 'add', 'origin', bare);
    git(made.root, 'fetch', '-q', 'origin');
    git(made.root, 'switch', '-q', '-c', 'work');
    return { ...made, bare };
  }
  const installedRepo = () => withOrigin({ '.omni-loop/config.yml': INSTALLED_CONFIG, [`${KNOWLEDGE}/playbook/testing.md`]: formText() });

  it('switches no branch, writes, commits, pushes and opens nothing, still installs the plugin and signs in, and ends with /omni:invade', async () => {
    const { root, bare } = installedRepo();
    const before = snapshot(root);
    const originBefore = git(bare, 'rev-parse', 'main');
    const fake = fakeExec({ defaultBranch: 'main' });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(git(root, 'branch', '--show-current')).toBe('work');
    expect(fake.install).toEqual([]);
    expect(fake.calls.filter((args) => args[0] === 'pr' || args[0] === 'label')).toEqual([]);
    expect(snapshot(root)).toEqual(before);
    expect(gitStatus(root)).toEqual([]);
    expect(git(bare, 'rev-parse', 'main')).toBe(originBefore);
    expect(fake.plugin.filter((call) => !call.endsWith('--json'))).toEqual([
      `claude plugin marketplace add ${KIT_HOME}`,
      'claude plugin install omni@omni-loop',
    ]);
    expect(out.split('\n')).toEqual([
      'Already installed on main — no install pull request.',
      '',
      'On this computer:',
      '  plugin  installed omni@omni-loop, run /reload-plugins in an open Claude Code',
      `  signin  not signed in to ${ASK_HOST}: no terminal`,
      '',
      'Type this in a terminal to sign in later:',
      '     omni signin',
      '',
      'Then, by hand:',
      '  1. Fill the forms in .omni-loop/knowledge/ with what the repository can prove, in Claude Code:',
      '       /omni:invade',
      '',
    ]);
    expect(out).not.toContain('Merge the install pull request');
    expect(out).not.toContain('GitHub App');
  });

  it('reads the install on origin/main even when the branch it runs on has no config', async () => {
    const { root } = installedRepo();
    git(root, 'switch', '-q', '--orphan', 'fresh');
    const { code, out } = await init(root, [], { fake: fakeExec({ defaultBranch: 'main' }) });
    expect(code).toBe(0);
    expect(out.split('\n')[0]).toBe('Already installed on main — no install pull request.');
    expect(existsSync(join(root, '.omni-loop/config.yml'))).toBe(false);
  });

  it('with --force it switches to the install branch and runs the full install', async () => {
    const { root } = installedRepo();
    const fake = fakeExec({ defaultBranch: 'main' });
    const { code, out } = await init(root, ['--force'], { fake });
    expect(code).toBe(0);
    expect(git(root, 'branch', '--show-current')).toBe('chore/install-omni-loop');
    expect(out).not.toContain('Already installed');
    expect(installBlock(out)).toContain('  branch  created chore/install-omni-loop');
    expect(fake.calls.some((args) => args[0] === 'pr' && args[1] === 'create')).toBe(true);
  });

  it('with no config on origin/main it runs the full install', async () => {
    const { root } = withOrigin({ 'README.md': 'hello\n' });
    const fake = fakeExec({ defaultBranch: 'main' });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(out.split('\n')[0]).toBe('omni init — acme/widgets is set up.');
    expect(git(root, 'branch', '--show-current')).toBe('chore/install-omni-loop');
    expect(fake.calls.some((args) => args[0] === 'pr' && args[1] === 'create')).toBe(true);
  });

  const filledForm = (invaded: string | null) => formText({ frontMatter: { state: 'filled', invaded } });
  // What an invaded repository prints after the computer's lines, its date line first.
  const invadedTail = (said: string) => [
    said,
    'To update the loop: node .omni-loop/bin/omni.mjs update',
    'To refresh the forms: /omni:invade --refresh',
    '',
  ];

  it('invaded: says so with the latest invaded: date, then how to update and refresh, and opens nothing', async () => {
    const { root, bare } = withOrigin({
      '.omni-loop/config.yml': INSTALLED_CONFIG,
      [`${KNOWLEDGE}/playbook/testing.md`]: filledForm('2026-09-25'),
      [`${KNOWLEDGE}/playbook/setup.md`]: filledForm('2026-08-02'),
    });
    const before = snapshot(root);
    const originBefore = git(bare, 'rev-parse', 'main');
    const fake = fakeExec({ defaultBranch: 'main' });
    const { code, out } = await init(root, [], { fake });
    expect(code).toBe(0);
    expect(git(root, 'branch', '--show-current')).toBe('work');
    expect(fake.install).toEqual([]);
    expect(fake.calls.filter((args) => args[0] === 'pr' || args[0] === 'label')).toEqual([]);
    expect(snapshot(root)).toEqual(before);
    expect(git(bare, 'rev-parse', 'main')).toBe(originBefore);
    const lines = out.split('\n');
    expect(lines[0]).toBe('Already installed on main — no install pull request.');
    expect(lines.slice(-4)).toEqual(invadedTail('Already invaded (2026-09-25).'));
    expect(out).toContain('On this computer:');
    expect(out).not.toContain('Fill the forms');
    expect(out).not.toContain('Then, by hand:');
    expect(out).not.toContain('Merge the install pull request');
    expect(out).not.toContain('Install pull request:');
  });

  it('invaded without a date: says "Already invaded."', async () => {
    const { root } = withOrigin({ '.omni-loop/config.yml': INSTALLED_CONFIG, [`${KNOWLEDGE}/playbook/testing.md`]: filledForm(null) });
    const { code, out } = await init(root, [], { fake: fakeExec({ defaultBranch: 'main' }) });
    expect(code).toBe(0);
    expect(out.split('\n').slice(-4)).toEqual(invadedTail('Already invaded.'));
  });

  it('reads the playbook a custom paths.playbook on origin/main names', async () => {
    const config = `${INSTALLED_CONFIG}paths:\n  playbook: handbook/playbook\n`;
    const invaded = withOrigin({ '.omni-loop/config.yml': config, 'handbook/playbook/testing.md': filledForm('2026-09-01') });
    const run = await init(invaded.root, [], { fake: fakeExec({ defaultBranch: 'main' }) });
    expect(run.out.split('\n').slice(-4)).toEqual(invadedTail('Already invaded (2026-09-01).'));

    const elsewhere = withOrigin({ '.omni-loop/config.yml': config, [`${KNOWLEDGE}/playbook/testing.md`]: filledForm('2026-09-01') });
    const { out } = await init(elsewhere.root, [], { fake: fakeExec({ defaultBranch: 'main' }) });
    expect(out).not.toContain('Already invaded');
    expect(out).toContain('  1. Fill the forms in handbook/ with what the repository can prove, in Claude Code:');
  });

  it('invaded, with --force: switches to the install branch and runs the full install', async () => {
    const { root } = withOrigin({ '.omni-loop/config.yml': INSTALLED_CONFIG, [`${KNOWLEDGE}/playbook/testing.md`]: filledForm('2026-09-25') });
    const fake = fakeExec({ defaultBranch: 'main' });
    const { code, out } = await init(root, ['--force'], { fake });
    expect(code).toBe(0);
    expect(git(root, 'branch', '--show-current')).toBe('chore/install-omni-loop');
    expect(out).not.toContain('Already');
    expect(fake.calls.some((args) => args[0] === 'pr' && args[1] === 'create')).toBe(true);
  });

  it('with a remote it cannot fetch it runs the full install', async () => {
    const { root } = installedRepo();
    git(root, 'remote', 'set-url', 'origin', join(tmpdir(), 'omni-no-such-origin.git'));
    const { code, out } = await init(root, [], { fake: fakeExec({ defaultBranch: 'main' }) });
    expect(code).toBe(0);
    expect(out).not.toContain('Already installed');
    expect(out).toContain(INSTALL_BLOCK);
  });
});
