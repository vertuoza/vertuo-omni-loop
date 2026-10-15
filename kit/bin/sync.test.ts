// `omni sync` (PRD 1990), through `main()` on fixture repositories cloned from a local bare remote:
// the printed block for each status, `--json` equal to the cache, `--quiet`, `--background`,
// `--strict` exiting 1 on red only, a linked worktree, and a folder where the loop is not installed.
// No test calls GitHub: the kit, knowledge and page checks gather nothing yet.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYNC_FILE, SYNC_LOCK, takeSyncLock } from '../lib/sync/cache.ts';
import { makeRepo } from '../test/fixture.ts';
import { COMMAND_TABLE } from './commands/index.ts';
import { NOT_INSTALLED } from './commands/sync.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n', 'README.md': '# widgets\n' };
const DAY = 24 * 3_600_000;

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe', encoding: 'utf8' });

/**
 * A clone of a bare remote whose `main` holds the config. `ahead()` commits on the remote's `main`
 * from another clone, so this one is behind; `worktree(branch)` adds a linked worktree on a branch of
 * its own, cut from `origin/main`.
 */
function fixture() {
  const seed = makeRepo({ git: true, files: CONFIG });
  const bare = mkdtempSync(join(tmpdir(), 'omni-sync-origin-'));
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  git(seed.root, 'remote', 'add', 'origin', bare);
  git(seed.root, 'push', '-q', 'origin', 'main');
  const root = join(mkdtempSync(join(tmpdir(), 'omni-sync-clone-')), 'work');
  git(tmpdir(), 'clone', '-q', bare, root);
  const ahead = () => {
    writeFileSync(join(seed.root, 'CHANGELOG.md'), `${String(Date.now())}\n`);
    git(seed.root, 'add', '-A');
    git(seed.root, 'commit', '-q', '-m', 'release');
    git(seed.root, 'push', '-q', 'origin', 'main');
  };
  const worktree = (branch: string) => {
    const dir = join(mkdtempSync(join(tmpdir(), 'omni-sync-wt-')), 'wt');
    git(root, 'worktree', 'add', '-q', '-b', branch, dir, 'origin/main');
    return dir;
  };
  const refs = () => git(bare, 'for-each-ref', '--format=%(refname) %(objectname)');
  return { root, bare, ahead, worktree, refs };
}

type Spawned = { command: string; args: readonly string[]; options: unknown };

/** `omni sync <args>` in `cwd`: `{ code, out, err, spawned }`. */
async function sync(cwd: string, args: string[] = [], { now = Date.now() }: { now?: number } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const spawned: Spawned[] = [];
  const spawn = (command: string, argv: readonly string[], options: unknown) => {
    spawned.push({ command, args: argv, options });
    return { unref: () => undefined };
  };
  const code = await main(['sync', ...args], {
    cwd,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    env: {},
    now: () => now,
    spawn,
  });
  return { code, out: out.join(''), err: err.join(''), spawned };
}

const cacheOf = (root: string): unknown => JSON.parse(readFileSync(join(root, SYNC_FILE), 'utf8'));

describe('omni sync', () => {
  it('is in the command table, and runs without a context', () => {
    expect(COMMAND_TABLE.sync?.withoutContext).toBe(true);
  });

  it('says the loop is not installed outside an installed checkout, and exits 0', async () => {
    const { root } = makeRepo({ git: true });
    expect(await sync(root)).toMatchObject({ code: 0, out: `${NOT_INSTALLED}\n`, err: '' });
    expect(await sync(mkdtempSync(join(tmpdir(), 'omni-sync-bare-')), ['--strict'])).toMatchObject({ code: 0, out: `${NOT_INSTALLED}\n` });
    expect(await sync(root, ['--quiet'])).toMatchObject({ code: 0, out: '' });
    const invalid = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nsync:\n  mainRedAfter: 0h\n' } });
    expect((await sync(invalid.root)).out).toMatch(/^sync: .*sync\.mainRedAfter/);
  });

  it('prints green on main, up to date, and keeps the record it printed', async () => {
    const { root } = fixture();
    const run = await sync(root);
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(run.out).toBe([
      '🟢 In sync',
      '  main       🟢 on main, up to date with origin/main',
      '  kit        🟢 n/a · not checked yet',
      '  knowledge  🟢 n/a · not checked yet',
      '  page       🟢 n/a · not checked yet',
      '',
    ].join('\n'));
    expect(cacheOf(root)).toMatchObject({ status: 'green', headline: null, setup: null, fix: null });
  });

  it('prints --json equal to the cache, and records setupDoneAt once', async () => {
    const { root } = fixture();
    const first = await sync(root, ['--json'], { now: Date.parse('2026-10-15T12:00:00Z') });
    expect(JSON.parse(first.out)).toEqual(cacheOf(root));
    expect(cacheOf(root)).toMatchObject({ checkedAt: '2026-10-15T12:00:00.000Z', setupDoneAt: '2026-10-15T12:00:00.000Z' });
    const second = await sync(root, ['--json'], { now: Date.parse('2026-10-16T12:00:00Z') });
    expect(JSON.parse(second.out)).toMatchObject({ checkedAt: '2026-10-16T12:00:00.000Z', setupDoneAt: '2026-10-15T12:00:00.000Z' });
    expect(JSON.parse(second.out)).toEqual(cacheOf(root));
  });

  it('rewrites a cache that does not read', async () => {
    const { root } = fixture();
    await sync(root, ['--quiet']);
    writeFileSync(join(root, SYNC_FILE), '{"checkedAt": ');
    expect((await sync(root, ['--json'])).code).toBe(0);
    expect(cacheOf(root)).toMatchObject({ status: 'green' });
  });

  it('is red past a day behind and green before it, and --strict exits 1 on red only', async () => {
    const repo = fixture();
    repo.ahead();
    const young = await sync(repo.root, ['--strict']);
    expect(young.code).toBe(0);
    expect(young.out).toMatch(/^🟢 In sync\n {2}main {7}🟢 on main, 1 behind \(the oldest \d+ s old\)\n/);
    const old = await sync(repo.root, ['--strict'], { now: Date.now() + 2 * DAY });
    expect(old.code).toBe(1);
    expect(old.out.split('\n')).toEqual([
      '🔴 Out of sync · main is 1 behind, the oldest 2 d old',
      '  main       🔴 main is 1 behind, the oldest 2 d old → omni sync --fix',
      '  kit        🟢 n/a · not checked yet',
      '  knowledge  🟢 n/a · not checked yet',
      '  page       🟢 n/a · not checked yet',
      'fix: omni sync --fix  (fast-forwards main)',
      '',
    ]);
    expect((await sync(repo.root, [], { now: Date.now() + 2 * DAY })).code).toBe(0);
  });

  it('is orange on another branch with changed files in the main checkout, and --strict exits 0 on orange', async () => {
    const { root } = fixture();
    git(root, 'switch', '-q', '-c', 'feat/x');
    writeFileSync(join(root, 'README.md'), '# changed\n');
    const run = await sync(root, ['--strict']);
    expect(run.code).toBe(0);
    expect(run.out.split('\n').slice(0, 3)).toEqual([
      '🟠 Needs action · on feat/x: plans are made on main',
      '  main       🟠 on feat/x: plans are made on main → omni sync --fix',
      '             🟠 1 changed file on feat/x',
    ]);
    expect(run.out).toContain('fix: omni sync --fix  (switches to main)\n');
  });

  it('judges a linked worktree on the behind rule alone, and keeps the record in the main checkout', async () => {
    const repo = fixture();
    const dir = repo.worktree('feat/x--s1');
    writeFileSync(join(dir, 'README.md'), '# changed\n');
    const green = await sync(dir);
    expect(green.out.split('\n')[1]).toBe('  main       🟢 on feat/x--s1, up to date with origin/main');
    expect(green.out.startsWith('🟢 In sync\n')).toBe(true);
    expect(cacheOf(repo.root)).toMatchObject({ status: 'green' });
    repo.ahead();
    const red = await sync(dir, ['--json'], { now: Date.now() + 3 * DAY });
    expect(JSON.parse(red.out)).toMatchObject({ status: 'red', headline: 'feat/x--s1 is 1 behind origin/main, the oldest 3 d old' });
  });

  it('fetches from the remote and pushes nothing to it', async () => {
    const repo = fixture();
    const before = repo.refs();
    repo.ahead();
    const after = repo.refs();
    await sync(repo.root);
    expect(repo.refs()).toBe(after);
    expect(after).not.toBe(before);
    expect(git(repo.root, 'rev-parse', 'origin/main')).toBe(git(repo.bare, 'rev-parse', 'main'));
  });

  it('prints nothing with --quiet, and does nothing while another run holds the lock', async () => {
    const { root } = fixture();
    expect(await sync(root, ['--quiet'])).toMatchObject({ code: 0, out: '', err: '' });
    expect(cacheOf(root)).toMatchObject({ status: 'green' });
    writeFileSync(join(root, SYNC_FILE), 'held');
    const now = Date.now();
    expect(takeSyncLock(root, now)).not.toBeNull();
    expect(await sync(root, ['--quiet'], { now })).toMatchObject({ code: 0, out: '' });
    expect(readFileSync(join(root, SYNC_FILE), 'utf8')).toBe('held');
    expect((await sync(root, ['--json'], { now })).code).toBe(0);
    expect(cacheOf(root)).toMatchObject({ status: 'green' });
    expect(readFileSync(join(root, SYNC_LOCK), 'utf8')).toContain('"at"');
  });

  it('starts omni sync --quiet detached with --background and returns, none while the lock is held', async () => {
    const { root } = fixture();
    const run = await sync(root, ['--background']);
    expect(run).toMatchObject({ code: 0, out: '', err: '' });
    expect(run.spawned).toHaveLength(1);
    expect(run.spawned[0]?.args.slice(1)).toEqual(['sync', '--quiet']);
    expect(run.spawned[0]?.options).toMatchObject({ cwd: root, detached: true, stdio: 'ignore' });
    const now = Date.now();
    takeSyncLock(root, now);
    expect((await sync(root, ['--background'], { now })).spawned).toEqual([]);
    expect((await sync(makeRepo({ git: true }).root, ['--background'])).spawned).toEqual([]);
  });

  it('refuses two output flags at once, and an argument', async () => {
    const { root } = fixture();
    expect((await sync(root, ['--json', '--quiet'])).code).toBe(2);
    expect((await sync(root, ['now'])).code).toBe(2);
    expect((await sync(root, ['--fix'])).code).toBe(2);
  });
});
