// `omni sync --fix` (PRD 1990, spec section 7), through `main()` on fixture repositories cloned from
// a local bare remote: a fast-forward; a switch to the default branch on a clean tree; no switch with
// a changed tracked file or a commit its upstream lacks; a diverged default branch printed and left
// untouched; a linked worktree left alone; and the remote's refs unchanged after every run. The
// plugin, kit and page steps are fakes here (`fixes`), and none of them runs on these fixtures, whose
// kit and page checks gather nothing yet: their rules are tested in `kit/lib/sync/fix.test.ts`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RunningKit } from '../lib/init/bundle.ts';
import { SYNC_FILE } from '../lib/sync/cache.ts';
import type { FixActions, FixStep } from '../lib/sync/fix.ts';
import { makeRepo } from '../test/fixture.ts';
import { NOT_INSTALLED } from './commands/sync.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n', 'README.md': '# widgets\n' };
const DAY = 24 * 3_600_000;
const KIT: RunningKit = { home: 'acme/kit', version: '0.0.423', source: false };

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();

/** Commits a change to `file` in `cwd`. */
function commit(cwd: string, file: string, message: string): void {
  writeFileSync(join(cwd, file), `${message} ${String(Math.random())}\n`);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', message);
}

/**
 * A clone of a bare remote whose `main` holds the config. `ahead()` commits on the remote's `main`
 * from another clone, so this one is behind; `refs()` lists the remote's refs, to prove nothing was
 * pushed.
 */
function fixture() {
  const seed = makeRepo({ git: true, files: CONFIG });
  const bare = mkdtempSync(join(tmpdir(), 'omni-sync-fix-origin-'));
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  git(seed.root, 'remote', 'add', 'origin', bare);
  git(seed.root, 'push', '-q', 'origin', 'main');
  const root = join(mkdtempSync(join(tmpdir(), 'omni-sync-fix-clone-')), 'work');
  git(tmpdir(), 'clone', '-q', bare, root);
  const ahead = () => {
    commit(seed.root, 'CHANGELOG.md', 'release');
    git(seed.root, 'push', '-q', 'origin', 'main');
  };
  const refs = () => git(bare, 'for-each-ref', '--format=%(refname) %(objectname)');
  return { root, bare, ahead, refs };
}

/** `omni sync --fix <args>` in `cwd`, with fake plugin, kit and page steps: `{ code, out, err, calls }`. */
async function fix(cwd: string, args: string[] = [], { now = Date.now() }: { now?: number } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const calls: FixStep[] = [];
  const act = (step: FixStep) => () => {
    calls.push(step);
    return { done: true, lines: [] };
  };
  const fixes: FixActions = { plugins: act('plugins'), kit: act('kit'), page: act('page') };
  const code = await main(['sync', '--fix', ...args], {
    cwd,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    env: {},
    now: () => now,
    spawn: () => ({ unref: () => undefined }),
    fixes,
    kit: KIT,
  });
  return { code, out: out.join(''), err: err.join(''), lines: out.join('').split('\n'), calls };
}

const head = (cwd: string) => git(cwd, 'rev-parse', 'HEAD');
const branchOf = (cwd: string) => git(cwd, 'symbolic-ref', '--short', 'HEAD');

describe('omni sync --fix', () => {
  it('fast-forwards a default branch that is behind, prints the new status, and pushes nothing', async () => {
    const repo = fixture();
    repo.ahead();
    repo.ahead();
    const refs = repo.refs();
    const run = await fix(repo.root, [], { now: Date.now() + 2 * DAY });
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(run.lines).toEqual([
      '✓ fast-forwarded main by 2 commits',
      '',
      '🟢 In sync',
      '  main       🟢 on main, up to date with origin/main',
      '  kit        🟢 n/a · not checked yet',
      '  knowledge  🟢 n/a · not checked yet',
      '  page       🟢 n/a · not checked yet',
      '',
    ]);
    expect(head(repo.root)).toBe(git(repo.bare, 'rev-parse', 'main'));
    expect(repo.refs()).toBe(refs);
    expect(run.calls).toEqual([]);
    expect(JSON.parse(readFileSync(join(repo.root, SYNC_FILE), 'utf8'))).toMatchObject({ status: 'green' });
  });

  it('fast-forwards a green main too: behind by commits under a day old', async () => {
    const repo = fixture();
    repo.ahead();
    expect((await fix(repo.root)).lines[0]).toBe('✓ fast-forwarded main by 1 commit');
    expect(head(repo.root)).toBe(git(repo.bare, 'rev-parse', 'main'));
  });

  it('says there is nothing to fix when everything is in sync', async () => {
    const repo = fixture();
    const run = await fix(repo.root);
    expect(run.lines.slice(0, 3)).toEqual(['fix: nothing to do', '', '🟢 In sync']);
  });

  it('switches to the default branch on a clean tree, then fast-forwards it', async () => {
    const repo = fixture();
    git(repo.root, 'switch', '-q', '-c', 'feat/x');
    repo.ahead();
    const refs = repo.refs();
    const run = await fix(repo.root);
    expect(run.lines.slice(0, 4)).toEqual(['✓ switched to main', '✓ fast-forwarded main by 1 commit', '', '🟢 In sync']);
    expect(branchOf(repo.root)).toBe('main');
    expect(head(repo.root)).toBe(git(repo.bare, 'rev-parse', 'main'));
    expect(repo.refs()).toBe(refs);
  });

  it('switches from a branch whose commits its upstream holds', async () => {
    const repo = fixture();
    git(repo.root, 'switch', '-q', '-c', 'feat/x');
    commit(repo.root, 'x.md', 'x');
    git(repo.root, 'push', '-q', '-u', 'origin', 'feat/x');
    const run = await fix(repo.root);
    expect(run.lines[0]).toBe('✓ switched to main');
    expect(branchOf(repo.root)).toBe('main');
  });

  it('stays on a branch with a changed tracked file, and changes nothing', async () => {
    const repo = fixture();
    git(repo.root, 'switch', '-q', '-c', 'feat/x');
    writeFileSync(join(repo.root, 'README.md'), '# changed\n');
    repo.ahead();
    const before = head(repo.root);
    const refs = repo.refs();
    const run = await fix(repo.root);
    expect(run.code).toBe(0);
    expect(run.lines.slice(0, 3)).toEqual(['· stayed on feat/x: 1 changed file', '', '🟠 Needs action · on feat/x: plans are made on main']);
    expect(branchOf(repo.root)).toBe('feat/x');
    expect(head(repo.root)).toBe(before);
    expect(readFileSync(join(repo.root, 'README.md'), 'utf8')).toBe('# changed\n');
    expect(repo.refs()).toBe(refs);
  });

  it('stays on a branch with a commit its upstream lacks', async () => {
    const repo = fixture();
    git(repo.root, 'switch', '-q', '-c', 'feat/x');
    commit(repo.root, 'x.md', 'x');
    git(repo.root, 'push', '-q', '-u', 'origin', 'feat/x');
    commit(repo.root, 'y.md', 'y');
    const refs = repo.refs();
    const run = await fix(repo.root);
    expect(run.lines[0]).toBe('· stayed on feat/x: 1 commit not on origin/feat/x');
    expect(branchOf(repo.root)).toBe('feat/x');
    expect(repo.refs()).toBe(refs);
  });

  it('stays on a branch never pushed whose commits no remote holds', async () => {
    const repo = fixture();
    git(repo.root, 'switch', '-q', '-c', 'feat/x');
    commit(repo.root, 'x.md', 'x');
    commit(repo.root, 'y.md', 'y');
    const run = await fix(repo.root);
    expect(run.lines[0]).toBe('· stayed on feat/x: 2 commits not on any remote');
    expect(branchOf(repo.root)).toBe('feat/x');
  });

  it('prints a diverged default branch and leaves it untouched', async () => {
    const repo = fixture();
    await fix(repo.root);
    commit(repo.root, 'local.md', 'local');
    repo.ahead();
    const before = head(repo.root);
    const refs = repo.refs();
    const run = await fix(repo.root, [], { now: Date.now() + 2 * DAY });
    expect(run.lines[0]).toBe('· main has diverged from origin: fix it by hand');
    expect(run.lines[2]).toMatch(/^🔴 Out of sync · main is 1 behind/);
    expect(head(repo.root)).toBe(before);
    expect(repo.refs()).toBe(refs);
  });

  it('does not fast-forward the default branch with a changed tracked file', async () => {
    const repo = fixture();
    writeFileSync(join(repo.root, 'README.md'), '# changed\n');
    repo.ahead();
    const before = head(repo.root);
    const run = await fix(repo.root);
    expect(run.lines[0]).toBe('· main not fast-forwarded: 1 changed file');
    expect(head(repo.root)).toBe(before);
  });

  it('leaves a linked worktree on its branch', async () => {
    const repo = fixture();
    const dir = join(mkdtempSync(join(tmpdir(), 'omni-sync-fix-wt-')), 'wt');
    git(repo.root, 'worktree', 'add', '-q', '-b', 'feat/x--s1', dir, 'origin/main');
    repo.ahead();
    const before = head(dir);
    const run = await fix(dir, [], { now: Date.now() + 2 * DAY });
    expect(run.lines[0]).toBe('fix: nothing to do');
    expect(branchOf(dir)).toBe('feat/x--s1');
    expect(head(dir)).toBe(before);
  });

  it('exits 1 with --strict when the new status is still red, and 0 once it is not', async () => {
    const repo = fixture();
    await fix(repo.root);
    commit(repo.root, 'local.md', 'local');
    repo.ahead();
    expect((await fix(repo.root, ['--strict'], { now: Date.now() + 2 * DAY })).code).toBe(1);
    git(repo.root, 'reset', '-q', '--hard', 'origin/main');
    expect((await fix(repo.root, ['--strict'], { now: Date.now() + 2 * DAY })).code).toBe(0);
  });

  it('refuses --fix with another mode, and says the loop is not installed outside it', async () => {
    const repo = fixture();
    expect((await fix(repo.root, ['--json'])).code).toBe(2);
    expect((await fix(repo.root, ['--quiet'])).code).toBe(2);
    expect(await fix(makeRepo({ git: true }).root)).toMatchObject({ code: 0, out: `${NOT_INSTALLED}\n` });
  });
});
