// A bare `omni status`: the repository's overview, read from git. The fixture is a `makeRepo` seed
// cloned into a local bare repository, which a second clone (the checkout `omni status` runs in)
// takes as its `origin`, so every test reads a real remote-tracking ref and never the network.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const DELIVERY = '.omni-loop/delivery';
const USAGE = 'usage: omni status [--fetch] | omni status <prd> [--labels a,b] [--base <ref> | --changes]';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const commit = (cwd, message) => {
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', message);
};

/** One PRD folder's spec, as a file map entry. */
const folder = (stage, name) => ({ [`${DELIVERY}/${stage}/${name}/spec.md`]: `# ${name}\n` });

/** A seed repository holding `files`, its bare copy, and a clone of the bare copy to run in. */
function cloned(files = {}) {
  const seed = makeRepo({ git: true, files: { ...CONFIG, ...files } });
  const bare = join(mkdtempSync(join(tmpdir(), 'omni-bare-')), 'origin.git');
  git(seed.root, 'clone', '-q', '--bare', seed.root, bare);
  const root = join(mkdtempSync(join(tmpdir(), 'omni-clone-')), 'work');
  git(seed.root, 'clone', '-q', bare, root);
  return { seed, bare, root };
}

const THREE_AND_TWO = {
  ...folder('shipped', '0001-first'),
  ...folder('shipped', '0002-second'),
  ...folder('shipped', '0003-third'),
  ...folder('inbox', '0004-fourth'),
  ...folder('inbox', '0005-fifth'),
};

describe('omni status — the overview (PRD 315, slice s1)', () => {
  it('prints the header, the shipped and inbox counts and the bar, read from origin/main', async () => {
    const { root } = cloned(THREE_AND_TWO);
    git(root, 'fetch', '-q', 'origin');
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(0);
    expect(s.err.join('')).toBe('');
    expect(s.out.join('')).toBe([
      'omni status · acme/widgets · origin/main, fetched just now',
      '',
      '  SHIPPED 3     INBOX 2',
      '',
      `  delivered  ${'█'.repeat(18)}${'░'.repeat(12)}  3 of 5 · 60%`,
      '             2 in progress: 2 in the inbox',
      '',
      'omni help: the loop and every command',
      '',
    ].join('\n'));
  });

  it('says never fetched in a checkout that has no fetch yet', async () => {
    const { root } = cloned(THREE_AND_TWO);
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('').split('\n')[0]).toBe('omni status · acme/widgets · origin/main, never fetched');
  });

  it('counts origin/main, not the working tree, a checked-out branch or an unpushed commit', async () => {
    const { root } = cloned(THREE_AND_TWO);
    const write = (path) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), 'x\n');
    };
    git(root, 'checkout', '-q', '-b', 'side');
    write(`${DELIVERY}/inbox/0007-on-a-branch/spec.md`);
    commit(root, 'on a branch');
    git(root, 'checkout', '-q', 'main');
    write(`${DELIVERY}/shipped/0008-unpushed/spec.md`);
    commit(root, 'not pushed');
    git(root, 'checkout', '-q', 'side');
    write(`${DELIVERY}/shipped/0006-working-tree/spec.md`);
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toContain('  SHIPPED 3     INBOX 2\n');
  });

  it('reads the local main when there is no origin/main', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...folder('shipped', '0001-first'), ...folder('inbox', '0002-second') } });
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('');
    expect(out.split('\n')[0]).toBe('omni status · acme/widgets · main, never fetched');
    expect(out).toContain('  SHIPPED 1     INBOX 1\n');
    expect(out).toContain('  1 of 2 · 50%\n');
  });

  it('exits 2 with one line when neither origin/main nor main exists', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    git(root, 'branch', '-q', '-m', 'main', 'trunk');
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(2);
    expect(s.out.join('')).toBe('');
    expect(s.err.join('')).toBe('omni status: cannot read origin/main or main; run omni status --fetch\n');
  });

  it('names the configured remote and default branch when neither exists', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n  remote: upstream\n  defaultBranch: trunk\n' } });
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toBe('omni status: cannot read upstream/trunk or trunk; run omni status --fetch\n');
  });

  it('says nothing yet with no PRD at all', async () => {
    const { root } = cloned();
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('');
    expect(out).toContain('  SHIPPED 0     INBOX 0\n');
    expect(out).toContain('\n  nothing yet: /omni:brainstorm to start\n');
    expect(out).not.toContain('delivered');
  });

  it('never fetches without --fetch', async () => {
    const { root } = cloned(THREE_AND_TWO);
    const calls = [];
    const exec = (command, args, options) => {
      calls.push([command, ...args]);
      return execFileSync(command, args, options);
    };
    expect(await main(['status'], { cwd: root, ...io(), exec })).toBe(0);
    expect(calls.some(([command]) => command === 'git')).toBe(true);
    expect(calls.filter(([command, sub]) => command === 'git' && sub === 'fetch')).toEqual([]);
  });

  it('with --fetch, counts a shipped folder pushed after the clone, and says it just fetched', async () => {
    const { seed, bare, root } = cloned(THREE_AND_TWO);
    seed.write(`${DELIVERY}/shipped/0009-later/spec.md`, '# later\n');
    commit(seed.root, 'shipped later');
    git(seed.root, 'push', '-q', bare, 'main');

    const before = io();
    expect(await main(['status'], { cwd: root, ...before })).toBe(0);
    expect(before.out.join('')).toContain('  SHIPPED 3     INBOX 2\n');

    const after = io();
    expect(await main(['status', '--fetch'], { cwd: root, ...after })).toBe(0);
    const out = after.out.join('');
    expect(out.split('\n')[0]).toBe('omni status · acme/widgets · origin/main, fetched just now');
    expect(out).toContain('  SHIPPED 4     INBOX 2\n');
    expect(out).not.toContain('fetch failed');
  });

  it('with --fetch from a remote that does not exist, says so in one line, then shows the last fetch, exit 0', async () => {
    const { root } = cloned(THREE_AND_TWO);
    git(root, 'remote', 'set-url', 'origin', join(root, 'nowhere.git'));
    const s = io();
    expect(await main(['status', '--fetch'], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('').split('\n');
    expect(out[0]).toMatch(/^fetch failed: fatal: .*nowhere\.git.*; showing your last fetch$/);
    expect(out[1]).toBe('omni status · acme/widgets · origin/main, never fetched');
    expect(s.out.join('')).toContain('  SHIPPED 3     INBOX 2\n');
    expect(existsSync(join(root, '.git/FETCH_HEAD'))).toBe(false);
  });

  it('after a failed --fetch, still says when the last fetch that worked happened', async () => {
    const { root } = cloned(THREE_AND_TWO);
    git(root, 'fetch', '-q', 'origin');
    const fetchHead = join(root, '.git/FETCH_HEAD');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000 - 60 * 1000);
    utimesSync(fetchHead, twoHoursAgo, twoHoursAgo);
    const kept = readFileSync(fetchHead, 'utf8');
    git(root, 'remote', 'set-url', 'origin', join(root, 'nowhere.git'));

    const s = io();
    expect(await main(['status', '--fetch'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('').split('\n').slice(0, 2)).toEqual([
      expect.stringMatching(/^fetch failed: .*; showing your last fetch$/),
      'omni status · acme/widgets · origin/main, fetched 2 hours ago',
    ]);
    expect(readFileSync(fetchHead, 'utf8')).toBe(kept);

    const later = io();
    expect(await main(['status'], { cwd: root, ...later })).toBe(0);
    expect(later.out.join('').split('\n')[0]).toBe('omni status · acme/widgets · origin/main, fetched 2 hours ago');
  });

  it('says never fetched when the last fetch failed outside omni and left FETCH_HEAD empty', async () => {
    const { root } = cloned(THREE_AND_TWO);
    writeFileSync(join(root, '.git/FETCH_HEAD'), '');
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('').split('\n')[0]).toBe('omni status · acme/widgets · origin/main, never fetched');
  });

  it('keeps every line within 80 columns', async () => {
    const { root } = cloned(THREE_AND_TWO);
    const s = io();
    expect(await main(['status'], { cwd: root, ...s })).toBe(0);
    for (const line of s.out.join('').split('\n')) expect(line.length).toBeLessThanOrEqual(80);
  });
});

describe('omni status — the flags (PRD 315, slice s1)', () => {
  for (const args of [['--fetch', '7'], ['7', '--fetch'], ['--labels', 'a'], ['--base', 'x'], ['--changes'], ['7', '8']]) {
    it(`exits 2 with the usage line for omni status ${args.join(' ')}`, async () => {
      const { root } = cloned(THREE_AND_TWO);
      const s = io();
      expect(await main(['status', ...args], { cwd: root, ...s })).toBe(2);
      expect(s.out.join('')).toBe('');
      expect(s.err.join('')).toBe(`${USAGE}\n`);
    });
  }

  it('still runs the gate for one PRD number', async () => {
    const { root } = cloned(THREE_AND_TWO);
    const s = io();
    expect(await main(['status', '4'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).not.toContain('SHIPPED');
  });
});

/**
 * Cuts `branch` in the seed from `from`, writes `files` on it, commits, pushes it to the bare
 * repository and returns to `main`; the clone then fetches, so it reads `origin/<branch>`.
 */
function pushBranch({ seed, bare, root }, branch, files, { from = 'main' } = {}) {
  git(seed.root, 'checkout', '-q', '-b', branch, from);
  for (const [path, text] of Object.entries(files)) seed.write(path, text);
  commit(seed.root, `on ${branch}`);
  git(seed.root, 'push', '-q', bare, branch);
  git(seed.root, 'checkout', '-q', 'main');
  git(root, 'fetch', '-q', 'origin');
}

/** The counts line, the bar's numbers and the line under the bar of one `omni status` in `root`. */
async function overviewIn(root) {
  const s = io();
  expect(await main(['status'], { cwd: root, ...s })).toBe(0);
  expect(s.err.join('')).toBe('');
  const out = s.out.join('').split('\n');
  const bar = out.find((line) => line.startsWith('  delivered'));
  return { counts: out[2], bar: bar?.split('  ').at(-1), under: out[out.indexOf(bar) + 1] };
}

const OUTBOX = `${DELIVERY}/outbox`;
const CODE = { 'src/widget.mjs': 'export const widget = 1;\n' };

describe('omni status — the outbox and the PRDs in review (PRD 315, slice s2)', () => {
  it('counts a PRD in the outbox when its feature branch carries code, with its open items', async () => {
    const repo = cloned(THREE_AND_TWO);
    pushBranch(repo, 'feat/fourth', {
      ...CODE,
      [`${OUTBOX}/0004-fourth/s1-01-a.md`]: '# a\n',
      [`${OUTBOX}/0004-fourth/s1-02-b.md`]: '# b\n',
      [`${OUTBOX}/0004-fourth/settled.md`]: '# settled\n',
      [`${OUTBOX}/0004-fourth/accounts/s1.md`]: '# account\n',
    });
    const { counts, bar, under } = await overviewIn(repo.root);
    expect(counts).toBe('  SHIPPED 3     INBOX 1     OUTBOX 1 · 2 open items');
    expect(bar).toBe('3 of 5 · 60%');
    expect(under).toBe('             2 in progress: 1 in the inbox, 1 in the outbox');
  });

  it("counts a feature branch that is only its PRD's phase-0 copy in the inbox", async () => {
    const scenario = { 'acceptance/fifth.feature': 'Feature: fifth\n' };
    const repo = cloned({ ...THREE_AND_TWO, ...scenario });
    pushBranch(repo, 'feat/fifth', { ...folder('inbox', '0005-fifth'), ...scenario }, { from: 'main~1' });
    const { counts, bar } = await overviewIn(repo.root);
    expect(counts).toBe('  SHIPPED 3     INBOX 2');
    expect(bar).toBe('3 of 5 · 60%');
  });

  it('counts a feature branch with one open item and no code in the outbox', async () => {
    const repo = cloned(THREE_AND_TWO);
    pushBranch(repo, 'feat/fifth', { [`${OUTBOX}/0005-fifth/s1-01-a.md`]: '# a\n' });
    expect((await overviewIn(repo.root)).counts).toBe('  SHIPPED 3     INBOX 1     OUTBOX 1 · 1 open item');
  });

  it('counts a phase-0 branch whose PRD is in neither folder of main in review, out of the bar', async () => {
    const repo = cloned(THREE_AND_TWO);
    pushBranch(repo, 'docs/phase-0-ninth', folder('inbox', '0009-ninth'));
    const { counts, bar, under } = await overviewIn(repo.root);
    expect(counts).toBe('  SHIPPED 3     INBOX 2     IN REVIEW 1');
    expect(bar).toBe('3 of 5 · 60%');
    expect(under).toBe('             2 in progress: 2 in the inbox');
  });

  it('ignores the branches of a shipped PRD, and those whose topic names no folder', async () => {
    const repo = cloned(THREE_AND_TWO);
    pushBranch(repo, 'feat/first', { ...CODE, [`${OUTBOX}/0001-first/s1-01-a.md`]: '# a\n' });
    pushBranch(repo, 'docs/phase-0-first', folder('inbox', '0001-first'));
    pushBranch(repo, 'feat/nowhere', { ...CODE, [`${OUTBOX}/0004-fourth/s1-01-a.md`]: '# a\n' });
    pushBranch(repo, 'docs/phase-0-nowhere', folder('inbox', '0010-elsewhere'));
    const { counts, bar } = await overviewIn(repo.root);
    expect(counts).toBe('  SHIPPED 3     INBOX 2');
    expect(bar).toBe('3 of 5 · 60%');
  });

  it('reads the branch shapes the config names', async () => {
    const config = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nbranches:\n  feature: work/{topic}/main\n  phase0: review/{topic}\n' };
    const repo = cloned({ ...THREE_AND_TWO, ...config });
    pushBranch(repo, 'work/fourth/main', CODE);
    pushBranch(repo, 'feat/fifth', CODE);
    pushBranch(repo, 'review/ninth', folder('inbox', '0009-ninth'));
    pushBranch(repo, 'docs/phase-0-tenth', folder('inbox', '0010-tenth'));
    expect((await overviewIn(repo.root)).counts).toBe('  SHIPPED 3     INBOX 1     OUTBOX 1 · 0 open items     IN REVIEW 1');
  });

  it('skips a branch it cannot read, and still shows the overview', async () => {
    const repo = cloned(THREE_AND_TWO);
    pushBranch(repo, 'feat/fifth', CODE);
    const { root } = repo;
    const blob = git(root, 'rev-parse', 'HEAD:.omni-loop/config.yml').trim();
    git(root, 'update-ref', 'refs/remotes/origin/feat/fourth', blob);
    git(root, 'update-ref', 'refs/remotes/origin/docs/phase-0-ninth', blob);
    git(root, 'checkout', '-q', '--orphan', 'orphan');
    commit(root, 'no history in common with main');
    git(root, 'update-ref', 'refs/remotes/origin/feat/fifth', 'HEAD');
    git(root, 'checkout', '-q', '-f', 'main');
    expect((await overviewIn(root)).counts).toBe('  SHIPPED 3     INBOX 2');
  });

  it('reads the remote branches only: not a local branch, not the working tree, and never fetches', async () => {
    const repo = cloned(THREE_AND_TWO);
    pushBranch(repo, 'feat/fifth', CODE);
    const { root } = repo;
    git(root, 'checkout', '-q', '-b', 'feat/fourth');
    mkdirSync(join(root, `${OUTBOX}/0004-fourth`), { recursive: true });
    writeFileSync(join(root, `${OUTBOX}/0004-fourth/s1-01-a.md`), '# a\n');
    commit(root, 'not pushed');
    writeFileSync(join(root, `${OUTBOX}/0004-fourth/s1-02-b.md`), '# b\n');
    const calls = [];
    const exec = (command, args, options) => {
      calls.push([command, ...args]);
      return execFileSync(command, args, options);
    };
    const s = io();
    expect(await main(['status'], { cwd: root, ...s, exec })).toBe(0);
    expect(s.out.join('')).toContain('\n  SHIPPED 3     INBOX 1     OUTBOX 1 · 0 open items\n');
    expect(calls.filter(([, sub]) => sub === 'fetch')).toEqual([]);
  });
});

describe('omni status — the fetch time in a linked worktree (PRD 315, slice s2)', () => {
  /** A clone fetched two hours ago, and a linked worktree of it. */
  function withWorktree() {
    const { root } = cloned(THREE_AND_TWO);
    git(root, 'fetch', '-q', 'origin');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000 - 60 * 1000);
    utimesSync(join(root, '.git/FETCH_HEAD'), twoHoursAgo, twoHoursAgo);
    const worktree = join(mkdtempSync(join(tmpdir(), 'omni-worktree-')), 'wt');
    git(root, 'worktree', 'add', '-q', '--detach', worktree);
    return { root, worktree };
  }

  it('says when the main checkout last fetched, since the remote branches are shared', async () => {
    const { worktree } = withWorktree();
    const s = io();
    expect(await main(['status'], { cwd: worktree, ...s })).toBe(0);
    expect(s.out.join('').split('\n')[0]).toBe('omni status · acme/widgets · origin/main, fetched 2 hours ago');
    expect(s.out.join('')).toContain('\n  SHIPPED 3     INBOX 2\n');
  });

  it("says the newer of the worktree's own fetch and the main checkout's", async () => {
    const { root, worktree } = withWorktree();
    const s = io();
    expect(await main(['status', '--fetch'], { cwd: worktree, ...s })).toBe(0);
    expect(s.out.join('').split('\n')[0]).toBe('omni status · acme/widgets · origin/main, fetched just now');

    const back = io();
    expect(await main(['status'], { cwd: root, ...back })).toBe(0);
    expect(back.out.join('').split('\n')[0]).toBe('omni status · acme/widgets · origin/main, fetched 2 hours ago');
  });
});
