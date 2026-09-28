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
    expect(out).toContain('  delivered  nothing yet: /omni:brainstorm to start\n');
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
