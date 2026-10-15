// The main check's facts (PRD 1990), with `git` replaced by a fake: the fetch and its budget, the
// behind count and the oldest missing commit, the main checkout against a linked worktree, the
// changed tracked files and the default branch's commits the remote lacks.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainFacts } from './main.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const T = (hoursAgo: number) => String(Math.floor((NOW - hoursAgo * 3_600_000) / 1000));

/** An error as `execFileSync` throws it, with `code` set as a timeout sets it. */
function failure(code?: string): Error {
  return Object.assign(new Error('git failed'), code ? { code } : {});
}

/** A fake `git`: each answer keyed by its arguments, joined by spaces; a function answers by throwing. */
function fakeGit(answers: Record<string, string | Error>) {
  const calls: { args: string; options: ExecFileSyncOptionsWithStringEncoding }[] = [];
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding): string => {
    const key = args.join(' ');
    calls.push({ args: key, options });
    if (file !== 'git') throw new Error(`not git: ${file}`);
    const answer = Object.hasOwn(answers, key) ? answers[key] : failure();
    if (answer instanceof Error || answer === undefined) throw answer ?? failure();
    return answer;
  };
  return { exec, calls };
}

const root = realpathSync(mkdtempSync(join(tmpdir(), 'omni-sync-main-')));
const IO = { remote: 'origin', defaultBranch: 'main' };

/** The answers of a main checkout on `main`, up to date and clean. */
const MAIN_CHECKOUT: Record<string, string | Error> = {
  'rev-parse --path-format=absolute --git-dir --git-common-dir': `${root}/.git\n${root}/.git\n`,
  'symbolic-ref --quiet --short HEAD': 'main\n',
  'remote get-url origin': 'file:///remote.git\n',
  'fetch --quiet origin main': '',
  'log --format=%ct HEAD..refs/remotes/origin/main': '',
  'status --porcelain --untracked-files=no': '',
  'rev-parse --verify --quiet refs/heads/main': 'abc\n',
  'rev-parse --verify --quiet refs/remotes/origin/main': 'def\n',
  'rev-list --count refs/remotes/origin/main..refs/heads/main': '0\n',
};

describe('mainFacts', () => {
  it('reads a main checkout on main, up to date and clean, fetching within 10 s', () => {
    const { exec, calls } = fakeGit(MAIN_CHECKOUT);
    expect(mainFacts({ cwd: root, exec, ...IO })).toEqual({
      remote: 'origin', defaultBranch: 'main', linked: false, branch: 'main', behind: { count: 0, oldestAt: null }, changed: 0, unpushed: 0,
    });
    const fetch = calls.find((call) => call.args.startsWith('fetch'));
    expect(fetch?.options.timeout).toBe(10_000);
    expect(calls.every((call) => call.options.cwd === root)).toBe(true);
  });

  it('counts the commits HEAD lacks and the oldest one, the changed files and the unpushed commits', () => {
    const { exec } = fakeGit({
      ...MAIN_CHECKOUT,
      'symbolic-ref --quiet --short HEAD': 'feat/x\n',
      'log --format=%ct HEAD..refs/remotes/origin/main': `${T(1)}\n${T(30)}\n${T(5)}\n`,
      'status --porcelain --untracked-files=no': ' M a.ts\nM  b.ts\n',
      'rev-list --count refs/remotes/origin/main..refs/heads/main': '2\n',
    });
    expect(mainFacts({ cwd: root, exec, ...IO })).toEqual({
      remote: 'origin', defaultBranch: 'main', linked: false, branch: 'feat/x', behind: { count: 3, oldestAt: NOW - 30 * 3_600_000 }, changed: 2, unpushed: 2,
    });
  });

  it('reads a detached HEAD as no branch, and no local default branch as nothing unpushed', () => {
    const { exec } = fakeGit({ ...MAIN_CHECKOUT, 'symbolic-ref --quiet --short HEAD': failure(), 'rev-parse --verify --quiet refs/heads/main': failure() });
    expect(mainFacts({ cwd: root, exec, ...IO })).toMatchObject({ branch: null, unpushed: 0 });
  });

  it('judges a linked worktree on the behind rule alone: no status, no unpushed count', () => {
    const { exec, calls } = fakeGit({
      ...MAIN_CHECKOUT,
      'rev-parse --path-format=absolute --git-dir --git-common-dir': `${root}/.git/worktrees/wt\n${root}/.git\n`,
      'symbolic-ref --quiet --short HEAD': 'feat/x--s1\n',
      'log --format=%ct HEAD..refs/remotes/origin/main': `${T(2)}\n`,
    });
    expect(mainFacts({ cwd: root, exec, ...IO })).toEqual({
      remote: 'origin', defaultBranch: 'main', linked: true, branch: 'feat/x--s1', behind: { count: 1, oldestAt: NOW - 2 * 3_600_000 }, changed: 0, unpushed: 0,
    });
    expect(calls.map((call) => call.args).filter((args) => args.startsWith('status') || args.startsWith('rev-list'))).toEqual([]);
  });

  it('says why the behind count was not checked: a fetch timed out, one that failed, or no such remote', () => {
    const timedOut = fakeGit({ ...MAIN_CHECKOUT, 'fetch --quiet origin main': failure('ETIMEDOUT') });
    expect(mainFacts({ cwd: root, exec: timedOut.exec, ...IO })).toMatchObject({ behind: { notChecked: 'timed out' } });
    expect(timedOut.calls.some((call) => call.args.startsWith('log'))).toBe(false);
    const offline = fakeGit({ ...MAIN_CHECKOUT, 'fetch --quiet origin main': failure() });
    expect(mainFacts({ cwd: root, exec: offline.exec, ...IO })).toMatchObject({ behind: { notChecked: 'offline' } });
    const noRemote = fakeGit({ ...MAIN_CHECKOUT, 'remote get-url origin': failure() });
    expect(mainFacts({ cwd: root, exec: noRemote.exec, ...IO })).toMatchObject({ behind: { notChecked: 'no remote origin' } });
    expect(noRemote.calls.some((call) => call.args.startsWith('fetch'))).toBe(false);
  });

  it('says not checked for a count git would not give, and for a remote branch it does not hold', () => {
    const { exec } = fakeGit({
      ...MAIN_CHECKOUT,
      'log --format=%ct HEAD..refs/remotes/origin/main': failure(),
      'status --porcelain --untracked-files=no': failure(),
      'rev-parse --verify --quiet refs/remotes/origin/main': failure(),
    });
    expect(mainFacts({ cwd: root, exec, ...IO })).toMatchObject({
      behind: { notChecked: 'no origin/main' },
      changed: { notChecked: 'git status failed' },
      unpushed: { notChecked: 'no origin/main' },
    });
  });

  it('is not checked at all outside a git checkout', () => {
    const { exec } = fakeGit({});
    expect(mainFacts({ cwd: root, exec, ...IO })).toEqual({ notChecked: 'not a git checkout' });
  });
});
