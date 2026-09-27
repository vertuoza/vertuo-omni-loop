// When each shipped folder first reached main, read from a throwaway repository built here: never
// this checkout's history, never the network.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { firstAdded } from './git';

const INBOX = '.omni-loop/delivery/inbox';
const SHIPPED = '.omni-loop/delivery/shipped';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

/** An empty repository on `main`, and the few git moves the tests make in it, each at a date of its own. */
function repository() {
  const root = mkdtempSync(join(tmpdir(), 'omni-releases-git-'));
  roots.push(root);
  const git = (args: string[], date = '2026-09-01T00:00:00+00:00') => execFileSync('git', [
    '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args,
  ], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    // The author date is a week earlier than the committer date: the reading must return the latter.
    env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: '2026-08-01T00:00:00+00:00' },
  }).trim();
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const commit = (message: string, date: string) => {
    git(['add', '-A']);
    git(['commit', '-q', '--allow-empty', '-m', message], date);
    return git(['rev-parse', 'HEAD']);
  };
  git(['init', '-q', '-b', 'main']);
  commit('root', '2026-09-01T00:00:00+00:00');
  return { root, git, write, commit };
}

describe('firstAdded — when each shipped spec first reached main', () => {
  it('finds the commit that moved a PRD folder from inbox/ to shipped/, and returns its committer date', () => {
    const { root, git, write, commit } = repository();
    write(`${INBOX}/0262-release-notes/spec.md`, '---\nprd: 262\n---\n');
    write(`${INBOX}/0262-release-notes/plan.md`, '# Plan\n');
    commit('docs(prd): release-notes', '2026-09-27T09:00:00+02:00');
    mkdirSync(join(root, SHIPPED), { recursive: true });
    git(['mv', `${INBOX}/0262-release-notes`, `${SHIPPED}/0262-release-notes`]);
    const shipped = commit('feat: release notes (#270)', '2026-09-28T11:15:00+02:00');
    write(`${SHIPPED}/0262-release-notes/spec.md`, '---\nprd: 262\n---\nEdited after it shipped.\n');
    commit('docs: edit a shipped spec', '2026-09-30T08:00:00+02:00');

    const found = firstAdded(root, [`${SHIPPED}/0262-release-notes/spec.md`]);
    expect(found.get(`${SHIPPED}/0262-release-notes/spec.md`)).toEqual({ commit: shipped, committedAt: '2026-09-28T11:15:00+02:00' });
  });

  it('dates a folder merged into main by the merge, not by the branch commit that shipped it', () => {
    const { root, git, write, commit } = repository();
    write(`${INBOX}/0007-skills/spec.md`, 'spec');
    commit('docs(prd): skills', '2026-09-24T09:00:00+00:00');
    git(['checkout', '-q', '-b', 'feat/skills']);
    mkdirSync(join(root, SHIPPED), { recursive: true });
    git(['mv', `${INBOX}/0007-skills`, `${SHIPPED}/0007-skills`]);
    commit('chore: ship', '2026-09-24T10:00:00+00:00');
    git(['checkout', '-q', 'main']);
    write('README.md', 'meanwhile on main');
    commit('docs: readme', '2026-09-24T11:00:00+00:00');
    git(['merge', '-q', '--no-ff', 'feat/skills', '-m', 'Merge feat/skills'], '2026-09-24T12:00:00+00:00');
    const merge = git(['rev-parse', 'HEAD']);

    expect(firstAdded(root, [`${SHIPPED}/0007-skills/spec.md`]).get(`${SHIPPED}/0007-skills/spec.md`))
      .toEqual({ commit: merge, committedAt: '2026-09-24T12:00:00+00:00' });
  });

  it('reads many folders in one walk, the oldest addition of each, and leaves out a spec main never held', () => {
    const { root, git, write, commit } = repository();
    write(`${SHIPPED}/0003-kit/spec.md`, 'kit');
    const kit = commit('ship kit', '2026-09-24T10:00:00+00:00');
    git(['rm', '-q', '-r', `${SHIPPED}/0003-kit`]);
    commit('remove it by mistake', '2026-09-25T10:00:00+00:00');
    write(`${SHIPPED}/0003-kit/spec.md`, 'kit');
    write(`${SHIPPED}/0028-app/spec.md`, 'app');
    const both = commit('put it back, ship the app', '2026-09-26T10:00:00+00:00');
    write(`${SHIPPED}/0050-local/spec.md`, 'not committed');

    const found = firstAdded(root, [`${SHIPPED}/0003-kit/spec.md`, `${SHIPPED}/0028-app/spec.md`, `${SHIPPED}/0050-local/spec.md`]);
    expect(Object.fromEntries(found)).toEqual({
      [`${SHIPPED}/0003-kit/spec.md`]: { commit: kit, committedAt: '2026-09-24T10:00:00+00:00' },
      [`${SHIPPED}/0028-app/spec.md`]: { commit: both, committedAt: '2026-09-26T10:00:00+00:00' },
    });
  });

  it('reads nothing when asked about no file', () => {
    const { root } = repository();
    expect(firstAdded(root, []).size).toBe(0);
  });
});
