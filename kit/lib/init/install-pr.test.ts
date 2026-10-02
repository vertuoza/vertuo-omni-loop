import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { makeRepo } from '../../test/fixture.ts';
import { INSTALL_BRANCH, INSTALL_COMMIT, installLines, openInstallPr, switchToInstallBranch } from './install-pr.ts';

const PR_URL = 'https://github.com/acme/widgets/pull/12';
const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

/** A fixture repository whose commits need no global identity. */
function repo(files: Record<string, string> = {}) {
  const made = makeRepo({ git: true, files });
  git(made.root, 'config', 'user.email', 't@t');
  git(made.root, 'config', 'user.name', 't');
  return made;
}

/**
 * git real but `push`, gh faked. Records every faked call as `cmd args…`. `open` is the pull request
 * `gh pr list` finds for the branch; `ghMissing` makes every gh call fail as a missing binary does.
 */
function fakeExec({ pushFails = false, ghMissing = false, open = null, createFails = false }: {
  pushFails?: boolean;
  ghMissing?: boolean;
  open?: { url: string; number: number } | null;
  createFails?: boolean;
} = {}) {
  const calls: string[] = [];
  const exec = (cmd: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding): string => {
    if (cmd === 'git' && args[0] !== 'push') {
      calls.push(`git ${args[0]}`);
      return execFileSync(cmd, args, options);
    }
    calls.push(`${cmd} ${args.join(' ')}`);
    if (cmd === 'git') {
      if (pushFails) throw new Error('! [remote rejected]');
      return '';
    }
    if (ghMissing) throw Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(open ? [open] : []);
    if (args[0] === 'pr' && args[1] === 'create') {
      if (createFails) throw new Error('gh: HTTP 422');
      return `${PR_URL}\n`;
    }
    return '';
  };
  return { exec, calls };
}

const PATHS = ['.omni-loop', '.claude/settings.json'];
const OPTIONS = { paths: PATHS, remote: 'origin', base: 'main', slug: 'acme/widgets' };

describe('switchToInstallBranch', () => {
  it('creates the install branch from HEAD', () => {
    const { root } = repo();
    const { exec, calls } = fakeExec();
    expect(switchToInstallBranch(root, { exec })).toEqual({ outcome: 'created', branch: INSTALL_BRANCH });
    expect(git(root, 'branch', '--show-current')).toBe(INSTALL_BRANCH);
    expect(calls).toContain('git switch');
  });

  it('stays on the install branch when it is already checked out', () => {
    const { root } = repo();
    git(root, 'switch', '-q', '-c', INSTALL_BRANCH);
    const { exec, calls } = fakeExec();
    expect(switchToInstallBranch(root, { exec })).toEqual({ outcome: 'stayed', branch: INSTALL_BRANCH });
    expect(calls).not.toContain('git switch');
  });

  it('switches to the install branch a previous run created', () => {
    const { root } = repo();
    git(root, 'branch', INSTALL_BRANCH);
    const { exec } = fakeExec();
    expect(switchToInstallBranch(root, { exec })).toEqual({ outcome: 'switched', branch: INSTALL_BRANCH });
    expect(git(root, 'branch', '--show-current')).toBe(INSTALL_BRANCH);
  });

  it('reports a failure and never throws', () => {
    const { root } = repo();
    const exec = (cmd: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding): string => {
      if (args[0] === 'switch') throw new Error('fatal: nope');
      return execFileSync(cmd, args, options);
    };
    expect(switchToInstallBranch(root, { exec })).toEqual({ outcome: 'failed', branch: INSTALL_BRANCH });
  });
});

describe('openInstallPr', () => {
  function installed() {
    const made = repo({ 'README.md': 'hello\n' });
    git(made.root, 'switch', '-q', '-c', INSTALL_BRANCH);
    made.write('.omni-loop/config.yml', 'kit: 1\n');
    made.write('.claude/settings.json', '{}\n');
    return made;
  }

  it('commits only its own paths, pushes, and opens the pull request, in that order', () => {
    const { root, write } = installed();
    write('README.md', 'changed by the person\n');
    write('notes.txt', 'untracked\n');
    const { exec, calls } = fakeExec();
    const result = openInstallPr(root, { exec, ...OPTIONS });
    expect(result).toMatchObject({ commit: 'committed', push: 'pushed', pr: { url: PR_URL, number: 12, already: false } });
    expect(git(root, 'log', '-1', '--format=%s')).toBe(INSTALL_COMMIT);
    expect(git(root, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort()).toEqual(['.claude/settings.json', '.omni-loop/config.yml']);
    expect(git(root, 'status', '--porcelain').split('\n').map((line) => line.trim())).toEqual(['M README.md', '?? notes.txt']);
    const outward = calls.filter((call) => /^(git (commit|push)|gh pr)/.test(call));
    expect(outward).toEqual([
      'git commit',
      `git push -u origin ${INSTALL_BRANCH}`,
      `gh pr list --head ${INSTALL_BRANCH} --state open --json url,number`,
      expect.stringMatching(new RegExp(`^gh pr create --base main --head ${INSTALL_BRANCH} --title ${INSTALL_COMMIT}`)),
    ]);
  });

  it('commits what is there when one of its paths was never written', () => {
    const { root } = installed();
    execFileSync('rm', ['-r', '.claude'], { cwd: root });
    const result = openInstallPr(root, { ...fakeExec(), ...OPTIONS });
    expect(result.commit).toBe('committed');
    expect(git(root, 'show', '--name-only', '--format=', 'HEAD')).toBe('.omni-loop/config.yml');
  });

  it('leaves a path the person already staged out of the commit', () => {
    const { root, write } = installed();
    write('README.md', 'staged by the person\n');
    git(root, 'add', 'README.md');
    openInstallPr(root, { ...fakeExec(), ...OPTIONS });
    expect(git(root, 'show', '--name-only', '--format=', 'HEAD')).not.toContain('README.md');
    expect(git(root, 'diff', '--cached', '--name-only')).toBe('README.md');
  });

  it('commits nothing when its paths hold nothing new, and still finds the pull request', () => {
    const { root } = installed();
    git(root, 'add', '--', ...PATHS);
    git(root, 'commit', '-q', '-m', 'earlier');
    const { exec } = fakeExec({ open: { url: PR_URL, number: 12 } });
    const result = openInstallPr(root, { exec, ...OPTIONS });
    expect(result).toMatchObject({ commit: 'nothing', push: 'pushed', pr: { url: PR_URL, number: 12, already: true } });
    expect(git(root, 'log', '-1', '--format=%s')).toBe('earlier');
  });

  it('prints the pull request that already exists with "already", and creates none', () => {
    const { root } = installed();
    const { exec, calls } = fakeExec({ open: { url: PR_URL, number: 12 } });
    const result = openInstallPr(root, { exec, ...OPTIONS });
    expect(result.pr).toEqual({ url: PR_URL, number: 12, already: true });
    expect(calls.some((call) => call.startsWith('gh pr create'))).toBe(false);
    expect(installLines(result, OPTIONS).join('\n')).toContain(`already open: ${PR_URL}`);
  });

  it('a refused push skips the pull request and prints the commands left to type', () => {
    const { root } = installed();
    const { exec, calls } = fakeExec({ pushFails: true });
    const result = openInstallPr(root, { exec, ...OPTIONS });
    expect(result).toMatchObject({ commit: 'committed', push: 'failed', pr: null });
    expect(calls.some((call) => call.startsWith('gh pr'))).toBe(false);
    const text = installLines(result, OPTIONS).join('\n');
    expect(text).toContain(`git push -u origin ${INSTALL_BRANCH}`);
    expect(text).toContain(`gh pr create --base main --head ${INSTALL_BRANCH} --title "${INSTALL_COMMIT}" --fill`);
  });

  it('gh missing: pushes, then prints the gh line and the compare link', () => {
    const { root } = installed();
    const result = openInstallPr(root, { ...fakeExec({ ghMissing: true }), ...OPTIONS });
    expect(result).toMatchObject({ commit: 'committed', push: 'pushed', pr: null });
    const text = installLines(result, OPTIONS).join('\n');
    expect(text).toContain(`gh pr create --base main --head ${INSTALL_BRANCH}`);
    expect(text).toContain(`https://github.com/acme/widgets/compare/main...${INSTALL_BRANCH}?expand=1`);
    expect(text).not.toContain('git push');
  });

  it('a pull request gh refuses to create is looked up again, then left to the person', () => {
    const { root } = installed();
    const result = openInstallPr(root, { ...fakeExec({ createFails: true }), ...OPTIONS });
    expect(result.pr).toBeNull();
    expect(installLines(result, OPTIONS).join('\n')).toContain('gh pr create');
  });

  it('a commit git refuses skips the push and prints every line from the commit on', () => {
    const { root } = installed();
    const exec = (cmd: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding): string => {
      if (args[0] === 'commit') throw new Error('hook refused');
      if (args[0] === 'push' || cmd === 'gh') throw new Error('must not run');
      return execFileSync(cmd, args, options);
    };
    const result = openInstallPr(root, { exec, ...OPTIONS });
    expect(result).toMatchObject({ commit: 'failed', push: null, pr: null });
    const text = installLines(result, OPTIONS).join('\n');
    expect(text).toContain(`git add -- ${PATHS.join(' ')}`);
    expect(text).toContain(`git commit -m "${INSTALL_COMMIT}" -- ${PATHS.join(' ')}`);
    expect(text).toContain(`git push -u origin ${INSTALL_BRANCH}`);
  });

  it('never runs on a branch other than the install branch', () => {
    const { root } = repo();
    const { exec, calls } = fakeExec();
    const result = openInstallPr(root, { exec, ...OPTIONS });
    expect(result).toMatchObject({ commit: 'skipped', push: null, pr: null });
    expect(calls.filter((call) => /^(git (add|commit|push)|gh)/.test(call))).toEqual([]);
    expect(installLines(result, OPTIONS).join('\n')).toContain(`git switch -c ${INSTALL_BRANCH}`);
  });
});

describe('installLines', () => {
  it('names each step done, with the pull request link last', () => {
    const lines = installLines(
      { branch: { outcome: 'created', branch: INSTALL_BRANCH }, commit: 'committed', push: 'pushed', pr: { url: PR_URL, number: 12, already: false } },
      OPTIONS,
    );
    expect(lines).toEqual([
      `  branch  created ${INSTALL_BRANCH}`,
      `  commit  ${INSTALL_COMMIT}`,
      `  pushed  ${INSTALL_BRANCH} to origin`,
      `  PR      opened ${PR_URL}`,
    ]);
  });
});
