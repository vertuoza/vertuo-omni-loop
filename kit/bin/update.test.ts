// `omni update` (PRD 347, s3): the pull request that brings a repository to a release. Through
// `main()` on a fixture repository whose remote is a local bare repository: git is real, `gh` and
// the hand-over to the new bundle (`node <bundle> update --apply`) are faked. No test here ever
// calls GitHub.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { planLaunch } from '../lib/launch/launch.ts';
import { writeForms } from '../lib/playbook/write-forms.ts';
import { main } from './omni.ts';

const LOOP_LABELS = ['omni:prd', 'omni:phase-0', 'omni:feature', 'omni:sub', 'omni:in-progress', 'omni:needs-fix', 'omni:outbox-go', 'omni:retro', 'omni:knowledge', 'omni:visual', 'omni:bug', 'omni:regression', 'omni:risk-critical', 'omni:risk-high', 'omni:risk-medium', 'omni:risk-low', 'omni:concept'];
const CONFIG = 'kit: 1\n# kept by hand, comments and all\nrepo:\n  slug: acme/widgets\npaths:\n  context: []\n';
// Each bin carries its marker the way esbuild writes it into a real bundle (kit/build.ts).
const binOf = (version) => `#!/usr/bin/env node\n    define_OMNI_BUNDLE_default = { home: "acme/kit", version: ${version ? `"${version}"` : 'null'} };\n`;
const OLD_BIN = binOf('0.0.13');
const NEW_BIN = binOf('0.0.15');
const UNVERSIONED_BIN = '#!/usr/bin/env node\n// omni, installed before versions\n';
const MISSING_FORM = '.omni-loop/knowledge/playbook/releasing.md';
const KEPT_FORM = '.omni-loop/knowledge/playbook/testing.md';
const KIT = { home: 'acme/kit', version: '0.0.15', source: false };
const PR_URL = 'https://github.com/acme/widgets/pull/88';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * A repository installed at v0.0.13, pushed to a bare `origin`: its config, its bin, every form but
 * one, and a form the person filled in.
 */
function installedRepo({ config = CONFIG, bin = OLD_BIN } = {}) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/bin/omni.mjs': bin } });
  writeForms({ ctx: repo.ctx });
  rmSync(join(repo.root, MISSING_FORM));
  repo.write(KEPT_FORM, '# Testing\n\nOurs, by hand.\n');
  git(repo.root, 'config', 'user.email', 't@t');
  git(repo.root, 'config', 'user.name', 't');
  git(repo.root, 'add', '-A');
  git(repo.root, 'commit', '-q', '-m', 'install');
  const remote = mkdtempSync(join(tmpdir(), 'omni-remote-'));
  git(remote, 'init', '-q', '--bare', '-b', 'main');
  git(repo.root, 'remote', 'add', 'origin', remote);
  git(repo.root, 'push', '-q', 'origin', 'main');
  return { ...repo, remote };
}

/**
 * git real, `gh` faked: `release view` answers `tags` (the latest when no tag is named), `release
 * download` writes the new bundle, `pr list` answers `openPr`, `pr create` answers the PR's link,
 * `label list` holds every loop label. `node` is the hand-over, answered with `nodeStatus`.
 */
function fakeExec({ tags = ['v0.0.12', 'v0.0.15'], latest = 'v0.0.15', ghDown = false, openPr = '', nodeStatus = 0, claude = 'ok' } = {}) {
  const calls = [];
  const exec = (file, args, options = {}) => {
    if (file === 'git') return execFileSync(file, args, options);
    calls.push({ file, args, options });
    if (file === 'claude') {
      if (claude === 'missing') throw Object.assign(new Error('spawnSync claude ENOENT'), { code: 'ENOENT' });
      if (claude === 'fails') throw Object.assign(new Error('Command failed: claude plugin update'), { status: 1, stderr: 'plugin not found' });
      return '';
    }
    if (file === 'node') {
      if (nodeStatus !== 0) throw Object.assign(new Error('child failed'), { status: nodeStatus });
      return null;
    }
    if (file !== 'gh') throw new Error(`unexpected ${file}`);
    if (ghDown) throw new Error('gh: could not connect');
    const [area, verb] = args;
    if (area === 'release' && verb === 'view') {
      const tag = args[2]?.startsWith('v') ? args[2] : latest;
      if (!tags.includes(tag)) throw new Error('release not found');
      return `${tag}\n`;
    }
    if (area === 'release' && verb === 'download') {
      writeFileSync(join(args[args.indexOf('--dir') + 1], 'omni.mjs'), NEW_BIN);
      return '';
    }
    if (area === 'pr' && verb === 'list') return `${openPr}\n`;
    if (area === 'pr' && verb === 'create') return `${PR_URL}\n`;
    if (area === 'label' && verb === 'list') return JSON.stringify(LOOP_LABELS.map((name) => ({ name })));
    return '';
  };
  return { exec, calls };
}

const claudeCalls = (calls) => calls.filter(({ file }) => file === 'claude').map(({ args }) => args.join(' '));
const PLUGIN_CALLS = ['plugin marketplace update omni-loop', 'plugin update omni@omni-loop'];
const gh = (calls, area, verb) => calls.filter(({ file, args }) => file === 'gh' && args[0] === area && args[1] === verb);

/** A fake bundle file: the new version's `omni.mjs`, as `--apply` runs from it. */
function newBundle() {
  const file = join(mkdtempSync(join(tmpdir(), 'omni-bundle-')), 'omni.mjs');
  writeFileSync(file, NEW_BIN);
  return file;
}

async function update(root, argv, { fake = fakeExec(), kit = KIT, bundle = newBundle() } = {}) {
  const s = io();
  const code = await main(['update', ...argv], { cwd: root, ...s, exec: fake.exec, kit, bundle });
  return { code, out: s.out.join(''), err: s.err.join(''), calls: fake.calls };
}

const BRANCH = 'chore/omni-update-v0.0.15';
const onRemote = (remote, path, branch = BRANCH) => git(remote, 'show', `${branch}:${path}`);
const remoteBranches = (remote) => git(remote, 'branch', '--format=%(refname:short)').split('\n').filter(Boolean);

describe('omni update: the running bin finds the release and hands over to it', () => {
  it('behind the latest: downloads its bundle and runs it as update --apply --from the running version', async () => {
    const { root } = installedRepo();
    const { code, calls } = await update(root, [], { kit: { ...KIT, version: '0.0.13' } });
    expect(code).toBe(0);
    expect(gh(calls, 'release', 'view')[0].args).toEqual(['release', 'view', '--repo', 'acme/kit', '--json', 'tagName', '--jq', '.tagName']);
    const download = gh(calls, 'release', 'download')[0].args;
    expect(download.slice(0, 6)).toEqual(['release', 'download', 'v0.0.15', '--repo', 'acme/kit', '--pattern']);
    const node = calls.find(({ file }) => file === 'node');
    const dir = download[download.indexOf('--dir') + 1];
    expect(node.args).toEqual([join(dir, 'omni.mjs'), 'update', '--apply', '--from', '0.0.13']);
    expect(node.options.cwd).toBe(root);
    expect(existsSync(dir)).toBe(false);
  });

  it('the hand-over is one the launcher lets the new bundle run itself, not the repository’s older bin (#643)', async () => {
    for (const [bin, version] of [[OLD_BIN, '0.0.13'], [UNVERSIONED_BIN, null]]) {
      const { root } = installedRepo({ bin });
      const { calls } = await update(root, [], { kit: { ...KIT, version } });
      const [bundle, ...argv] = calls.find(({ file }) => file === 'node').args;
      expect(planLaunch(argv, { cwd: root, self: bundle }), argv.join(' ')).toEqual({ kind: 'self' });
    }
  });

  it("the new bundle's exit code is update's", async () => {
    const { root } = installedRepo();
    const { code } = await update(root, [], { kit: { ...KIT, version: '0.0.13' }, fake: fakeExec({ nodeStatus: 1 }) });
    expect(code).toBe(1);
  });

  it('an unversioned bin hands over with no --from', async () => {
    const { root } = installedRepo({ bin: UNVERSIONED_BIN });
    const { calls } = await update(root, [], { kit: { ...KIT, version: null } });
    expect(calls.find(({ file }) => file === 'node').args.slice(1)).toEqual(['update', '--apply']);
  });

  it('--to v0.0.12 targets that tag', async () => {
    const { root } = installedRepo();
    const { code, calls } = await update(root, ['--to', 'v0.0.12'], { kit: { ...KIT, version: '0.0.13' } });
    expect(code).toBe(0);
    expect(gh(calls, 'release', 'view')[0].args.slice(0, 3)).toEqual(['release', 'view', 'v0.0.12']);
    expect(gh(calls, 'release', 'download')[0].args[2]).toBe('v0.0.12');
  });

  it('an unknown tag stops before any write, exit 1', async () => {
    const { root, remote } = installedRepo();
    const { code, err, calls } = await update(root, ['--to', 'v0.0.99'], { kit: { ...KIT, version: '0.0.13' } });
    expect(code).toBe(1);
    expect(err).toMatch(/^omni update: .*v0\.0\.99.*\n$/);
    expect(gh(calls, 'release', 'download')).toEqual([]);
    expect(calls.some(({ file }) => file === 'node')).toBe(false);
    expect(remoteBranches(remote)).toEqual(['main']);
  });

  it('GitHub out of reach stops before any write, exit 1', async () => {
    const { root } = installedRepo();
    const { code, err, calls } = await update(root, [], { kit: { ...KIT, version: '0.0.13' }, fake: fakeExec({ ghDown: true }) });
    expect(code).toBe(1);
    expect(err).toMatch(/^omni update: [^\n]*latest release[^\n]*\n$/);
    expect(calls.some(({ file }) => file === 'node')).toBe(false);
  });

  it('--to that is no version: a usage error, exit 2', async () => {
    const { root } = installedRepo();
    const { code, err } = await update(root, ['--to', 'latest']);
    expect(code).toBe(2);
    expect(err).toMatch(/--to/);
  });

  it('up to date: nothing is written and no PR', async () => {
    const { root, remote } = installedRepo({ bin: NEW_BIN });
    const { code, out, calls } = await update(root, []);
    expect(code).toBe(0);
    expect(out).toMatch(/v0\.0\.15 is up to date/);
    expect(calls.filter(({ file }) => file !== 'claude').map(({ file, args }) => `${file} ${args[0]} ${args[1]}`)).toEqual(['gh release view']);
    expect(remoteBranches(remote)).toEqual(['main']);
  });

  it('from the kit source: no bin, no worktree, no PR, and GitHub is not asked', async () => {
    const { root, remote } = installedRepo();
    const { code, out, calls } = await update(root, [], { kit: { ...KIT, source: true } });
    expect(code).toBe(0);
    expect(out).toMatch(/kit source/);
    expect(calls.filter(({ file }) => file !== 'claude')).toEqual([]);
    expect(remoteBranches(remote)).toEqual(['main']);
  });
});

describe('omni update --apply: the new version opens the pull request', () => {
  it('behind the latest: one signed commit on the update branch, and the PR into the default branch', async () => {
    const { root, remote, read } = installedRepo();
    const before = { head: git(root, 'rev-parse', 'HEAD'), branch: git(root, 'branch', '--show-current'), config: read('.omni-loop/config.yml') };
    const { code, out, err, calls } = await update(root, ['--apply', '--from', '0.0.13']);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(out).toBe([
      'v0.0.13 → v0.0.15',
      '  bin      updated',
      '  config   kept, valid under v0.0.15',
      `  forms    1 created (${MISSING_FORM})`,
      '  labels   ok',
      `PR: ${PR_URL}`,
      '',
    ].join('\n'));

    // The branch: the new bin, mode 755; config.yml byte-identical; the missing form; the kept form as it was.
    expect(remoteBranches(remote)).toContain(BRANCH);
    expect(onRemote(remote, '.omni-loop/bin/omni.mjs')).toBe(NEW_BIN);
    expect(git(remote, 'ls-tree', BRANCH, '.omni-loop/bin/omni.mjs')).toMatch(/^100755 /);
    expect(onRemote(remote, '.omni-loop/config.yml')).toBe(CONFIG);
    expect(onRemote(remote, MISSING_FORM)).toMatch(/^---\nform: releasing\n/);
    expect(onRemote(remote, KEPT_FORM)).toBe('# Testing\n\nOurs, by hand.\n');
    expect(git(remote, 'rev-parse', `${BRANCH}~1`)).toBe(git(remote, 'rev-parse', 'main'));

    // The commit: its title, then the signature's trailer.
    const message = git(remote, 'log', '-1', '--format=%B', BRANCH).trimEnd();
    expect(message.split('\n')[0]).toBe('chore(omni): update to v0.0.15');
    expect(message.split('\n').at(-1)).toBe('Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>');

    // The PR: into the default branch, with the compare link and the footer line.
    const create = gh(calls, 'pr', 'create')[0].args;
    const flag = (name) => create[create.indexOf(name) + 1];
    expect(flag('--base')).toBe('main');
    expect(flag('--head')).toBe(BRANCH);
    expect(flag('--title')).toBe('chore(omni): update to v0.0.15');
    expect(flag('--body')).toContain('https://github.com/acme/kit/compare/v0.0.13...v0.0.15');
    expect(flag('--body')).toContain('  config   kept, valid under v0.0.15');
    expect(flag('--body').trimEnd().split('\n').at(-1)).toMatch(/Omni Loop.*<!-- omni-loop:signed -->$/);

    // The person's checkout is as it was, and the worktree is gone.
    expect(git(root, 'rev-parse', 'HEAD')).toBe(before.head);
    expect(git(root, 'branch', '--show-current')).toBe(before.branch);
    expect(git(root, 'status', '--porcelain', '--untracked-files=all')).toBe('');
    expect(read('.omni-loop/config.yml')).toBe(before.config);
    expect(read('.omni-loop/bin/omni.mjs')).toBe(OLD_BIN);
    expect(existsSync(join(root, MISSING_FORM))).toBe(false);
    expect(git(root, 'worktree', 'list', '--porcelain').match(/^worktree /gm)).toHaveLength(1);
  });

  it('an open PR from the update branch: its link is printed, no commit and no second PR, exit 0', async () => {
    const { root, remote } = installedRepo();
    const fake = fakeExec({ openPr: PR_URL });
    const { code, out, calls } = await update(root, ['--apply', '--from', '0.0.13'], { fake });
    expect(code).toBe(0);
    expect(out).toMatch(new RegExp(`already open.*${PR_URL}`));
    expect(gh(calls, 'pr', 'list')[0].args).toEqual(expect.arrayContaining(['--head', BRANCH, '--state', 'open']));
    expect(gh(calls, 'pr', 'create')).toEqual([]);
    expect(remoteBranches(remote)).toEqual(['main']);
  });

  it('a config.yml that fails the schema: the key is named, nothing is committed, exit 1', async () => {
    const { root, remote } = installedRepo({ config: `${CONFIG}branches:\n  nope: x\n` });
    const { code, err, calls } = await update(root, ['--apply', '--from', '0.0.13']);
    expect(code).toBe(1);
    expect(err).toMatch(/^omni update: [^\n]*config\.yml[^\n]*v0\.0\.15[^\n]*branches[^\n]*nope[^\n]*\n$/);
    expect(gh(calls, 'pr', 'create')).toEqual([]);
    expect(remoteBranches(remote)).toEqual(['main']);
    expect(git(root, 'status', '--porcelain', '--untracked-files=all')).toBe('');
  });

  it('a branches.update the config sets names the branch', async () => {
    const { root, remote } = installedRepo({ config: `${CONFIG}branches:\n  update: kit/bump-{version}\n` });
    expect((await update(root, ['--apply', '--from', '0.0.13'])).code).toBe(0);
    expect(remoteBranches(remote)).toContain('kit/bump-v0.0.15');
  });

  it('with no --from: the header says unversioned and the body links the release', async () => {
    const { root } = installedRepo();
    const { out, calls } = await update(root, ['--apply']);
    expect(out.split('\n')[0]).toBe('unversioned → v0.0.15');
    const body = gh(calls, 'pr', 'create')[0].args;
    expect(body[body.indexOf('--body') + 1]).toContain('https://github.com/acme/kit/releases/tag/v0.0.15');
  });

  it('from the kit source, --apply refuses: there is no bundle to install', async () => {
    const { root } = installedRepo();
    const { code, err } = await update(root, ['--apply'], { kit: { ...KIT, source: true }, bundle: null });
    expect(code).toBe(2);
    expect(err).toMatch(/kit source/);
  });

  it('is listed by omni help', async () => {
    const s = io();
    expect(await main(['help'], { cwd: mkdtempSync(join(tmpdir(), 'omni-help-')), ...s })).toBe(0);
    expect(s.out.join('')).toMatch(/omni update/);
  });
});

describe('omni update: the Claude plugin on this machine (s4)', () => {
  const BEHIND = { kit: { ...KIT, version: '0.0.13' } };

  it('after the pull request: marketplace update, then plugin update, then run /reload-plugins', async () => {
    const { root } = installedRepo();
    const { code, out, calls } = await update(root, [], BEHIND);
    expect(code).toBe(0);
    expect(claudeCalls(calls)).toEqual(PLUGIN_CALLS);
    const order = calls.map(({ file }) => file);
    expect(order.indexOf('node')).toBeLessThan(order.indexOf('claude'));
    expect(out).toMatch(/^ {2}plugin {3}updated to v0\.0\.15, run \/reload-plugins$/m);
  });

  for (const claude of ['missing', 'fails']) {
    it(`a claude that is ${claude}: the two /plugin lines, and the repository step's exit code`, async () => {
      const { root } = installedRepo();
      const { code, out } = await update(root, [], { ...BEHIND, fake: fakeExec({ claude }) });
      expect(code).toBe(0);
      expect(out).toContain('/plugin marketplace update omni-loop\n');
      expect(out).toContain('/plugin update omni@omni-loop\n');
      expect(out).not.toMatch(/reload-plugins/);
    });
  }

  it('a claude that fails its first call runs no second one', async () => {
    const { root } = installedRepo();
    const { calls } = await update(root, [], { ...BEHIND, fake: fakeExec({ claude: 'fails' }) });
    expect(claudeCalls(calls)).toEqual([PLUGIN_CALLS[0]]);
  });

  it('up to date: the plugin step still runs', async () => {
    const { root } = installedRepo({ bin: NEW_BIN });
    const { code, out, calls } = await update(root, []);
    expect(code).toBe(0);
    expect(claudeCalls(calls)).toEqual(PLUGIN_CALLS);
    expect(out).toMatch(/run \/reload-plugins/);
  });

  it('from the kit source: the plugin step still runs', async () => {
    const { root } = installedRepo();
    const { code, calls } = await update(root, [], { kit: { ...KIT, source: true } });
    expect(code).toBe(0);
    expect(claudeCalls(calls)).toEqual(PLUGIN_CALLS);
  });

  it('a repository step that fails: its exit code, and the plugin is left alone', async () => {
    const { root } = installedRepo();
    const { code, calls } = await update(root, [], { ...BEHIND, fake: fakeExec({ nodeStatus: 1 }) });
    expect(code).toBe(1);
    expect(claudeCalls(calls)).toEqual([]);
  });

  it('an unknown --to stops before the plugin too', async () => {
    const { root } = installedRepo();
    const { code, calls } = await update(root, ['--to', 'v0.0.99'], BEHIND);
    expect(code).toBe(1);
    expect(claudeCalls(calls)).toEqual([]);
  });

  it('--apply never touches the plugin: the bin that handed over does', async () => {
    const { root } = installedRepo();
    const { code, calls } = await update(root, ['--apply', '--from', '0.0.13']);
    expect(code).toBe(0);
    expect(claudeCalls(calls)).toEqual([]);
  });
});

describe('omni update run by npx, in a repository installed before versions (s4)', () => {
  it("the latest bundle, not the repository's bin: it applies itself, and the PR says unversioned", async () => {
    const { root, remote } = installedRepo({ bin: UNVERSIONED_BIN });
    const { code, out, calls } = await update(root, []);
    expect(code).toBe(0);
    expect(out.split('\n')[0]).toBe('unversioned → v0.0.15');
    expect(out).toContain(`PR: ${PR_URL}\n`);
    expect(gh(calls, 'release', 'download')).toEqual([]);
    expect(calls.some(({ file }) => file === 'node')).toBe(false);
    expect(onRemote(remote, '.omni-loop/bin/omni.mjs')).toBe(NEW_BIN);
    expect(claudeCalls(calls)).toEqual(PLUGIN_CALLS);
  });

  it('a bin of an older version: the header says which', async () => {
    const { root } = installedRepo();
    const { out } = await update(root, []);
    expect(out.split('\n')[0]).toBe('v0.0.13 → v0.0.15');
  });

  it('--to an older release hands over from the version the repository runs', async () => {
    const { root } = installedRepo();
    const { calls } = await update(root, ['--to', 'v0.0.12']);
    expect(calls.find(({ file }) => file === 'node').args.slice(1)).toEqual(['update', '--apply', '--from', '0.0.13']);
  });
});
