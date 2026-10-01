import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeRepo } from '../../test/fixture.mjs';
import { detectInstall } from './installed.mjs';

const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: main\n';

/** git real, gh faked: `gh repo view` names `defaultBranch`, or fails when it is null. */
function fakeExec({ defaultBranch = 'main' } = {}) {
  return (cmd, args, options) => {
    if (cmd !== 'gh') return execFileSync(cmd, args, options);
    if (!defaultBranch) throw new Error('gh: not logged in');
    return JSON.stringify({ nameWithOwner: 'acme/widgets', defaultBranchRef: { name: defaultBranch } });
  };
}

/**
 * A clone whose bare `origin` holds `onMain` on `main`, then left on a branch of its own with the
 * config removed, as a teammate's fresh checkout of another branch would be.
 */
function cloneOf(onMain, { keepConfig = false } = {}) {
  const { root: source } = makeRepo({ git: true, files: onMain });
  const bare = join(mkdtempSync(join(tmpdir(), 'omni-origin-')), 'origin.git');
  git(source, 'clone', '-q', '--bare', source, bare);
  const root = mkdtempSync(join(tmpdir(), 'omni-clone-'));
  git(root, 'clone', '-q', bare, '.');
  git(root, 'switch', '-q', '--orphan', 'work');
  if (keepConfig) execFileSync('git', ['checkout', 'origin/main', '--', '.'], { cwd: root });
  return root;
}

describe('detectInstall', () => {
  it('installed: the config is on origin/main, though not in the working tree', () => {
    const root = cloneOf({ '.omni-loop/config.yml': CONFIG });
    const found = detectInstall(root, { exec: fakeExec() });
    expect(found).toMatchObject({ remote: 'origin', defaultBranch: 'main' });
    expect(found.config.repo.slug).toBe('acme/widgets');
  });

  it('installed: the remote and branch come from the config on disk when it is there', () => {
    const root = cloneOf({ '.omni-loop/config.yml': CONFIG }, { keepConfig: true });
    // gh would name another branch: the config on disk wins.
    expect(detectInstall(root, { exec: fakeExec({ defaultBranch: 'trunk' }) })).toMatchObject({ remote: 'origin', defaultBranch: 'main' });
  });

  it('not installed: origin/main has no config', () => {
    const root = cloneOf({ 'README.md': 'hello\n' });
    expect(detectInstall(root, { exec: fakeExec() })).toBeNull();
  });

  it('not installed: an invalid config on origin/main is no install', () => {
    const root = cloneOf({ '.omni-loop/config.yml': 'kit: [\n' });
    expect(detectInstall(root, { exec: fakeExec() })).toBeNull();
  });

  it('no remote: nothing is detected', () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG } });
    expect(detectInstall(root, { exec: fakeExec() })).toBeNull();
  });

  it('a failing fetch: nothing is detected', () => {
    const root = cloneOf({ '.omni-loop/config.yml': CONFIG });
    git(root, 'remote', 'set-url', 'origin', join(tmpdir(), 'omni-no-such-origin.git'));
    expect(detectInstall(root, { exec: fakeExec() })).toBeNull();
  });

  it('no default branch anyone can name: nothing is detected', () => {
    const root = cloneOf({ '.omni-loop/config.yml': CONFIG });
    git(root, 'remote', 'set-head', 'origin', '-d');
    expect(detectInstall(root, { exec: fakeExec({ defaultBranch: null }) })).toBeNull();
  });
});
