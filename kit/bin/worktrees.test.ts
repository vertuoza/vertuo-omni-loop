// PRD 2485, s1: `omni worktrees list|prune|remove|hint`, through `main()` on a temporary repository
// with a `file://` remote and real worktrees under `.claude/worktrees`. The board and the processes'
// working directories are injected seams: no test reads GitHub, the Omni page or the machine's processes.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { BoardSeam, WorktreeBoard } from '../lib/worktrees/engine.ts';
import { makeRepo, realExec } from '../test/fixture.ts';
import type { FakeExec } from '../test/fixture.ts';
import { COMMAND_TABLE } from './commands/index.ts';
import { main } from './omni.ts';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const FOLDER = '.claude/worktrees';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A board where every slice of PRD 7 is merged and the feature PR is open. */
const MERGED: WorktreeBoard = { featureOpen: true, slices: { s1: 'merged', s2: 'merged' } };

type Seams = { board?: BoardSeam; processes?: () => readonly string[] | null; exec?: FakeExec };

/**
 * A repository whose `main` is on a bare `file://` remote, with PRD 7 (`widgets`) in its inbox.
 * `add(name, branch)` adds a worktree under the worktrees folder on a new branch cut from `main`
 * (`null`: detached), commits one file in it, and pushes it unless told not to.
 */
function fixture() {
  const remote = mkdtempSync(join(tmpdir(), 'omni-remote-'));
  git(remote, 'init', '--bare', '-q', '-b', 'main');
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, '.omni-loop/delivery/inbox/0007-widgets/spec.md': '# Widgets\n', '.gitignore': '.claude/\n' } });
  git(repo.root, 'remote', 'add', 'origin', pathToFileURL(remote).href);
  git(repo.root, 'push', '-q', 'origin', 'main');
  const add = (name: string, branch: string | null, { push = true, upstream = true, at = join(repo.root, FOLDER, name) } = {}) => {
    if (branch === null) git(repo.root, 'worktree', 'add', '-q', '--detach', at, 'main');
    else git(repo.root, 'worktree', 'add', '-q', '-b', branch, at, 'main');
    writeFileSync(join(at, `${name}.txt`), `${name}\n`);
    git(at, 'add', '-A');
    git(at, 'commit', '-q', '-m', `work in ${name}`);
    if (push && branch !== null) git(at, 'push', '-q', ...(upstream ? ['-u'] : []), 'origin', branch);
    if (push && branch === null) git(at, 'push', '-q', 'origin', `HEAD:refs/heads/${name}`);
    return at;
  };
  const worktrees = () => git(repo.root, 'worktree', 'list', '--porcelain');
  const branches = () => git(repo.root, 'branch', '--format=%(refname:short)').split('\n').filter(Boolean);
  return { ...repo, remote, add, worktrees, branches };
}

async function run(root: string, args: string[], seams: Seams = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['worktrees', ...args], {
    cwd: root,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    board: seams.board ?? (() => Promise.resolve(MERGED)),
    processes: seams.processes ?? (() => []),
    ...(seams.exec === undefined ? {} : { exec: seams.exec }),
  });
  return { code, out: out.join(''), err: err.join('') };
}

const SIZE = String.raw`\d+(?:\.\d)? (?:B|KB|MB|GB|TB)`;

describe('omni worktrees list (PRD 2485)', () => {
  it("classes the kit's worktrees by branch shape and folder, and every other one as other", async () => {
    const repo = fixture();
    const slice = repo.add('slice', 'feat/widgets--s1');
    const feature = repo.add('feature', 'feat/widgets');
    const phase0 = repo.add('phase0', 'docs/phase-0-widgets');
    const odd = repo.add('odd', 'spike/anything');
    const detached = repo.add('detached', null);
    const outside = repo.add('outside', 'feat/widgets--s2', { at: join(mkdtempSync(join(tmpdir(), 'omni-out-')), 'outside') });
    const result = await run(repo.root, ['list', '--json']);
    expect(result).toMatchObject({ code: 0, err: '' });
    const { worktrees } = JSON.parse(result.out) as { worktrees: { path: string; kind: string; verdict: string | null; prd: number | null }[] };
    const kinds = Object.fromEntries(worktrees.map((entry) => [entry.path, entry.kind]));
    expect(kinds).toMatchObject({ [slice]: 'kit', [feature]: 'kit', [phase0]: 'kit', [odd]: 'other', [detached]: 'other', [outside]: 'other' });
    expect(worktrees.find((entry) => entry.path === slice)).toMatchObject({ verdict: 'safe', prd: 7 });
    expect(worktrees.find((entry) => entry.path === odd)).toMatchObject({ verdict: null });
  });

  it('prints one line per worktree, with each kit verdict', async () => {
    const repo = fixture();
    const slice = repo.add('slice', 'feat/widgets--s1', { push: false });
    const result = await run(repo.root, ['list']);
    expect(result.code).toBe(0);
    expect(result.out).toContain(`kit    ${slice} · feat/widgets--s1 · kept: unpushed\n`);
    expect(result.out).toMatch(/^other {2}\S+ · main\n/);
  });
});

describe('omni worktrees prune: the keep reasons (PRD 2485)', () => {
  it('keeps a worktree with an uncommitted change', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    writeFileSync(join(path, 'slice.txt'), 'changed\n');
    expect((await run(repo.root, ['prune'])).out).toBe(`kept ${path} · uncommitted\nfreed 0 B\n`);
    expect(existsSync(path)).toBe(true);
  });

  it('keeps a worktree with an untracked file', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    writeFileSync(join(path, 'new.txt'), 'new\n');
    expect((await run(repo.root, ['prune'])).out).toContain(`kept ${path} · uncommitted\n`);
  });

  it('keeps a worktree whose HEAD no remote branch holds, after one fetch', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1', { push: false });
    expect((await run(repo.root, ['prune'])).out).toBe(`kept ${path} · unpushed\nfreed 0 B\n`);
    expect(existsSync(path)).toBe(true);
  });

  it('reads the remote as fetched now, not as last fetched', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    // The remote holds the commit; this clone's last fetch does not know it yet.
    git(repo.root, 'update-ref', '-d', 'refs/remotes/origin/feat/widgets--s1');
    expect((await run(repo.root, ['prune'])).out).toMatch(new RegExp(`^removed ${path} · ${SIZE}`));
  });

  it('keeps a claimed slice while the feature PR is open', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    for (const state of ['in-flight', 'claimed-stale'] as const) {
      const board = () => Promise.resolve({ featureOpen: true, slices: { s1: state } });
      expect((await run(repo.root, ['prune'], { board })).out, state).toBe(`kept ${path} · claimed\nfreed 0 B\n`);
    }
  });

  it('keeps a red slice while the feature PR is open', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    for (const state of ['stuck', 'blocked', 'runnable'] as const) {
      const board = () => Promise.resolve({ featureOpen: true, slices: { s1: state } });
      expect((await run(repo.root, ['prune'], { board })).out, state).toBe(`kept ${path} · red slice\nfreed 0 B\n`);
    }
    const missing = () => Promise.resolve({ featureOpen: true, slices: {} });
    expect((await run(repo.root, ['prune'], { board: missing })).out).toBe(`kept ${path} · red slice\nfreed 0 B\n`);
  });

  it("removes a red slice's clean, pushed worktree once the feature PR is merged or closed", async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    const board = () => Promise.resolve({ featureOpen: false, slices: { s1: 'stuck' as const } });
    const result = await run(repo.root, ['prune'], { board });
    expect(result.out).toMatch(new RegExp(`^removed ${path} · ${SIZE}\nfreed ${SIZE}\n$`));
    expect(existsSync(path)).toBe(false);
  });

  it('keeps a slice whose board cannot be read, saying why', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    const board = () => Promise.resolve('not signed in');
    expect((await run(repo.root, ['prune'], { board })).out).toBe(`kept ${path} · no board: not signed in\nfreed 0 B\n`);
    const other = repo.add('other', 'feat/gadgets--s1');
    expect((await run(repo.root, ['prune'])).out).toContain(`kept ${other} · no board: no PRD folder for gadgets\n`);
  });

  it('reads the board once per PRD, and never for a feature or phase-0 worktree', async () => {
    const repo = fixture();
    repo.add('s1', 'feat/widgets--s1');
    repo.add('s2', 'feat/widgets--s2');
    repo.add('feature', 'feat/widgets');
    repo.add('phase0', 'docs/phase-0-widgets');
    const read: number[] = [];
    const board = (prd: number) => {
      read.push(prd);
      return Promise.resolve(MERGED);
    };
    const result = await run(repo.root, ['prune'], { board });
    expect(result.out.match(/^removed /gm)).toHaveLength(4);
    expect(read).toEqual([7]);
  });

  it('keeps a worktree a process works in, and every one when the processes cannot be read', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    expect((await run(repo.root, ['prune'], { processes: () => [join(path, 'deep')] })).out).toBe(`kept ${path} · in use\nfreed 0 B\n`);
    expect((await run(repo.root, ['prune'], { processes: () => [path] })).out).toBe(`kept ${path} · in use\nfreed 0 B\n`);
    expect((await run(repo.root, ['prune'], { processes: () => null })).out).toBe(`kept ${path} · in use\nfreed 0 B\n`);
    expect((await run(repo.root, ['prune'], { processes: () => [`${path}-other`] })).out).toMatch(/^removed /);
  });

  it('keeps a worktree git holds locked', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    git(repo.root, 'worktree', 'lock', '--reason', 'an agent works here', path);
    expect((await run(repo.root, ['prune'])).out).toBe(`kept ${path} · locked\nfreed 0 B\n`);
  });
});

describe('omni worktrees prune: removing (PRD 2485)', () => {
  it('removes every safe kit worktree and its branch, prints each size and the total, and never touches another', async () => {
    const repo = fixture();
    const slice = repo.add('slice', 'feat/widgets--s1');
    const feature = repo.add('feature', 'feat/widgets');
    const odd = repo.add('odd', 'spike/anything');
    const detached = repo.add('detached', null);
    const result = await run(repo.root, ['prune']);
    expect(result.code).toBe(0);
    // One line per kit worktree, by path.
    expect(result.out).toMatch(new RegExp(`^removed ${feature} · ${SIZE}\nremoved ${slice} · ${SIZE}\nfreed ${SIZE}\n$`));
    expect(existsSync(slice) || existsSync(feature)).toBe(false);
    expect(existsSync(odd) && existsSync(detached)).toBe(true);
    expect(repo.branches()).toEqual(['main', 'spike/anything']);
  });

  it('limits itself to one PRD with --prd', async () => {
    const repo = fixture();
    repo.write('.omni-loop/delivery/inbox/0008-gadgets/spec.md', '# Gadgets\n');
    const widgets = repo.add('widgets', 'feat/widgets--s1');
    const gadgets = repo.add('gadgets', 'feat/gadgets--s1');
    const result = await run(repo.root, ['prune', '--prd', '8'], { board: () => Promise.resolve({ featureOpen: true, slices: { s1: 'merged' } }) });
    expect(result.out).toMatch(new RegExp(`^removed ${gadgets} · ${SIZE}\nfreed ${SIZE}\n$`));
    expect(existsSync(widgets)).toBe(true);
  });

  it('removes nothing under --dry-run, printing would remove with each size and the total', async () => {
    const repo = fixture();
    const slice = repo.add('slice', 'feat/widgets--s1');
    const kept = repo.add('unpushed', 'feat/widgets--s2', { push: false });
    const result = await run(repo.root, ['prune', '--dry-run']);
    expect(result.out).toMatch(new RegExp(`^would remove ${slice} · ${SIZE}\nkept ${kept} · unpushed\nwould free ${SIZE}\n$`));
    expect(existsSync(slice)).toBe(true);
    expect(repo.branches()).toContain('feat/widgets--s1');
  });

  it('removes the worktree and keeps the branch git refuses to delete, saying so', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1', { upstream: false });
    const result = await run(repo.root, ['prune']);
    expect(result.out).toMatch(new RegExp(`^removed ${path} · ${SIZE} · branch feat/widgets--s1 kept: .*not fully merged.*\nfreed ${SIZE}\n$`));
    expect(existsSync(path)).toBe(false);
    expect(repo.branches()).toContain('feat/widgets--s1');
  });

  it('never runs a forced removal or a forced branch delete', async () => {
    const repo = fixture();
    repo.add('slice', 'feat/widgets--s1');
    repo.add('kept', 'feat/widgets--s2', { upstream: false });
    const calls: string[][] = [];
    const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions) => {
      calls.push([file, ...args]);
      return realExec(file, args, options);
    };
    await run(repo.root, ['prune'], { exec });
    const gitCalls = calls.filter(([file]) => file === 'git').map((call) => call.join(' '));
    expect(gitCalls.filter((call) => call.includes('worktree remove'))).toHaveLength(2);
    expect(gitCalls.filter((call) => call.includes('branch -d'))).toHaveLength(2);
    expect(gitCalls.some((call) => / (?:-D|--force|-f)\b/.test(call))).toBe(false);
  });

  it('exits 0 whatever it keeps, and 1 only when the repository cannot be read', async () => {
    const repo = fixture();
    repo.add('slice', 'feat/widgets--s1', { push: false });
    for (const args of [['list'], ['prune'], ['prune', '--dry-run'], ['hint']]) expect((await run(repo.root, args)).code, args.join(' ')).toBe(0);
    const bare = makeRepo({ files: { '.omni-loop/config.yml': CONFIG } });
    for (const args of [['list'], ['prune'], ['remove', 'x'], ['hint']]) {
      const result = await run(bare.root, args);
      expect(result.code, args.join(' ')).toBe(1);
      expect(result.err).toMatch(/^omni worktrees: /);
    }
  });

  it('exits 2 on a malformed call', async () => {
    const repo = fixture();
    for (const args of [[], ['sweep'], ['prune', '--prd', 'x'], ['prune', '--force'], ['remove'], ['remove', 'a', 'b'], ['hint', '--json']]) {
      const result = await run(repo.root, args);
      expect(result.code, args.join(' ')).toBe(2);
      expect(result.err).toMatch(/omni worktrees/);
    }
  });
});

describe('omni worktrees remove (PRD 2485)', () => {
  it('removes the one kit worktree it is given, by any path to it', async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    const other = repo.add('feature', 'feat/widgets');
    const result = await run(repo.root, ['remove', `${FOLDER}/slice`]);
    expect(result).toMatchObject({ code: 0, err: '' });
    expect(result.out).toMatch(new RegExp(`^removed ${path} · ${SIZE}\n$`));
    expect(existsSync(other)).toBe(true);
  });

  it('removes a detached worktree under the folder the caller names, by the same rules', async () => {
    const repo = fixture();
    const path = repo.add('inline', null);
    expect((await run(repo.root, ['prune'])).out).toBe('freed 0 B\n');
    const dirty = repo.add('dirty', null);
    writeFileSync(join(dirty, 'x.txt'), 'x\n');
    expect((await run(repo.root, ['remove', dirty])).out).toBe(`kept ${dirty} · uncommitted\n`);
    expect((await run(repo.root, ['remove', path])).out).toMatch(new RegExp(`^removed ${path} · ${SIZE}\n$`));
    expect(existsSync(path)).toBe(false);
  });

  it("keeps a worktree that is not the kit's, and says when a path is no worktree", async () => {
    const repo = fixture();
    const odd = repo.add('odd', 'spike/anything');
    const outside = repo.add('outside', null, { at: join(mkdtempSync(join(tmpdir(), 'omni-out-')), 'outside') });
    expect((await run(repo.root, ['remove', odd])).out).toBe(`kept ${odd} · not the kit's\n`);
    expect((await run(repo.root, ['remove', outside])).out).toBe(`kept ${outside} · not the kit's\n`);
    expect((await run(repo.root, ['remove', repo.root])).out).toBe(`kept ${repo.root} · not the kit's\n`);
    expect(await run(repo.root, ['remove', 'nowhere'])).toEqual({ code: 0, out: 'no worktree at nowhere\n', err: '' });
  });

  it("keeps a claimed slice's worktree, as prune does", async () => {
    const repo = fixture();
    const path = repo.add('slice', 'feat/widgets--s1');
    const board = () => Promise.resolve({ featureOpen: true, slices: { s1: 'in-flight' as const } });
    expect((await run(repo.root, ['remove', path], { board })).out).toBe(`kept ${path} · claimed\n`);
  });
});

describe('omni worktrees hint (PRD 2485)', () => {
  it('counts the clean, pushed kit worktrees, with no fetch, no board, no process read and no size', async () => {
    const repo = fixture();
    repo.add('a', 'feat/widgets--s1');
    repo.add('b', 'feat/widgets');
    repo.add('c', 'feat/widgets--s2', { push: false });
    const dirty = repo.add('d', 'feat/widgets--s3');
    writeFileSync(join(dirty, 'x.txt'), 'x\n');
    repo.add('e', 'spike/anything');
    const calls: string[] = [];
    const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions) => {
      calls.push(`${file} ${args.join(' ')}`);
      return realExec(file, args, options);
    };
    const never = () => {
      throw new Error('read');
    };
    const result = await run(repo.root, ['hint'], { exec, board: never, processes: never });
    expect(result).toEqual({ code: 0, out: '2 worktrees of the kit can be removed: omni worktrees prune\n', err: '' });
    expect(calls.filter((call) => call.startsWith('git fetch') || call.startsWith('du ') || call.startsWith('lsof'))).toEqual([]);
  });

  it('prints nothing when no worktree can be removed', async () => {
    const repo = fixture();
    expect(await run(repo.root, ['hint'])).toEqual({ code: 0, out: '', err: '' });
    repo.add('a', 'feat/widgets--s1', { push: false });
    expect(await run(repo.root, ['hint'])).toEqual({ code: 0, out: '', err: '' });
    repo.add('b', 'feat/widgets--s2');
    expect((await run(repo.root, ['hint'])).out).toBe('1 worktree of the kit can be removed: omni worktrees prune\n');
  });

  it('returns within one second on a repository of 50 worktrees', async () => {
    const repo = fixture();
    for (let index = 1; index <= 50; index += 1) git(repo.root, 'worktree', 'add', '-q', '-b', `feat/widgets--s${index}`, join(repo.root, FOLDER, `s${index}`), 'origin/main');
    const started = performance.now();
    const result = await run(repo.root, ['hint']);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(result.out).toBe('50 worktrees of the kit can be removed: omni worktrees prune\n');
  });
});

describe('omni help worktrees (PRD 2485)', () => {
  it('runs before a context exists, so the seams reach it', () => {
    expect(COMMAND_TABLE.worktrees?.withoutContext).toBe(true);
  });

  it('prints the four verbs', async () => {
    const out: string[] = [];
    const code = await main(['help', 'worktrees'], { cwd: makeRepo().root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => 0 } });
    expect(code).toBe(0);
    for (const verb of ['list', 'prune', 'remove', 'hint']) expect(out.join('')).toContain(`omni worktrees ${verb}`);
  });
});
