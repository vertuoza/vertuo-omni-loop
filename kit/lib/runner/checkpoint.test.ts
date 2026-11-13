// The runner's save (PRD 2809, s2): before a job's folder goes, what GitHub does not hold — every
// worktree's uncommitted changes and its commits not on `origin` — goes into one git bundle, as
// `omni-checkpoint/<branch>`, with no branch moved and no file of the worktrees changed. Each test runs on
// a fixture checkout with its own bare origin and a job folder holding a nested worktree; nothing here
// calls GitHub.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExecText } from '../context.ts';
import { RunnerRefused, RunnerUnreachable } from './api.ts';
import type { CheckpointApi, SaveRecord } from './api.ts';
import { KEEP_DAYS, readSave, saveJob, savePaths, sendSave, worktreesIn } from './checkpoint.ts';
import { CHECKPOINT_BYTES_MAX, CheckpointManifestSchema } from './checkpoint.manifest.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-13T12:00:00Z');
const BOT = { name: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' };

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const exec: ExecText = (file, args, options) => execFileSync(file, args, { ...options, encoding: 'utf8' });

/**
 * A checkout `repos/widgets` of `acme/widgets` with a bare origin holding a `.gitignore` that ignores
 * `.env`, and the folder of job 7, `~/wt/widgets-job-7`, on `agent/job-7` as the runner cuts it, with a
 * worktree of its own on `feat/x--s2` inside it, as `/omni:wave` makes one per slice.
 */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'omni-checkpoint-'));
  const origin = join(root, 'remote', 'acme', 'widgets.git');
  mkdirSync(origin, { recursive: true });
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  const checkout = join(root, 'repos', 'widgets');
  mkdirSync(checkout, { recursive: true });
  git(checkout, 'init', '-q', '-b', 'main');
  writeFileSync(join(checkout, 'README.md'), 'widgets\n');
  // Only `.env` is ignored: the nested worktree is an untracked folder of its parent, as in a repository that ignores none.
  writeFileSync(join(checkout, '.gitignore'), '.env\n');
  git(checkout, 'add', '-A');
  git(checkout, 'commit', '-q', '-m', 'seed');
  git(checkout, 'remote', 'add', 'origin', origin);
  git(checkout, 'push', '-q', '-u', 'origin', 'main');
  const home = join(root, 'home');
  const folder = join(home, 'wt', 'widgets-job-7');
  mkdirSync(join(home, 'wt'), { recursive: true });
  git(checkout, 'worktree', 'add', '-q', '--no-track', '-b', 'agent/job-7', folder, 'origin/main');
  const nested = join(folder, '.claude', 'worktrees', 's2');
  git(folder, 'worktree', 'add', '-q', '--no-track', '-b', 'feat/x--s2', nested, 'origin/main');
  const save = (over: Partial<Parameters<typeof saveJob>[0]> = {}) =>
    saveJob({ exec, checkout, folder, job: '7', repo: 'acme/widgets', runner: 'box-1', author: BOT, now: NOW, ...over });
  /** Every branch with its commit, and every worktree's `git status`, to prove nothing moved. */
  const state = (): string => [git(checkout, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'), git(folder, 'status', '--porcelain'), git(nested, 'status', '--porcelain'), git(folder, 'diff', '--cached', '--name-only'), git(nested, 'diff', '--cached', '--name-only')].join('\n--\n');
  /** A fresh clone of origin with the bundle's checkpoints fetched in, as a resume on another runner does. */
  const restored = (bundle: string): string => {
    const clone = join(root, `restored-${String(Math.random()).slice(2)}`);
    git(root, 'clone', '-q', origin, clone);
    git(clone, 'fetch', '-q', bundle, 'refs/heads/omni-checkpoint/*:refs/heads/omni-checkpoint/*');
    return clone;
  };
  return { root, origin, checkout, home, folder, nested, save, state, restored };
}

describe('worktreesIn', () => {
  it('lists the job folder and every worktree inside it, the folder first, and no other worktree of the checkout', () => {
    const f = fixture();
    git(f.checkout, 'worktree', 'add', '-q', '--no-track', '-b', 'agent/job-8', join(f.home, 'wt', 'widgets-job-8'), 'origin/main');
    git(f.checkout, 'worktree', 'add', '-q', '--no-track', '-b', 'agent/job-70', join(f.home, 'wt', 'widgets-job-70'), 'origin/main');
    expect(worktreesIn(exec, f.checkout, f.folder).map(({ path, branch }) => ({ path, branch }))).toEqual([
      { path: f.folder, branch: 'agent/job-7' },
      { path: f.nested, branch: 'feat/x--s2' },
    ]);
  });

  it('lists none for a folder that is no worktree, or a checkout git cannot read', () => {
    const f = fixture();
    expect(worktreesIn(exec, f.checkout, join(f.home, 'wt', 'widgets-job-9'))).toEqual([]);
    expect(worktreesIn(exec, join(f.root, 'nowhere'), f.folder)).toEqual([]);
  });
});

describe('saveJob', () => {
  it('saves nothing, and writes nothing, when every worktree holds only what origin has', () => {
    const f = fixture();
    // A branch pushed with its commit: origin has it all.
    writeFileSync(join(f.nested, 'pushed.txt'), 'pushed\n');
    git(f.nested, 'add', '-A');
    git(f.nested, 'commit', '-q', '-m', 'pushed');
    git(f.nested, 'push', '-q', 'origin', 'feat/x--s2');
    git(f.checkout, 'fetch', '-q', 'origin');
    // An ignored file is no work to save.
    writeFileSync(join(f.folder, '.env'), 'TOKEN=abc\n');
    expect(f.save()).toBeNull();
    const paths = savePaths(f.folder);
    expect(existsSync(paths.manifest)).toBe(false);
    expect(existsSync(paths.bundle)).toBe(false);
  });

  it('bundles the uncommitted edits and the unpushed commits of the folder and its nested worktree as omni-checkpoint/<branch>, moving nothing', () => {
    const f = fixture();
    // The folder: a tracked file changed, a new file, and a staged one.
    writeFileSync(join(f.folder, 'README.md'), 'widgets, changed\n');
    writeFileSync(join(f.folder, 'notes.md'), 'new\n');
    writeFileSync(join(f.folder, 'staged.md'), 'staged\n');
    git(f.folder, 'add', 'staged.md');
    // The slice's worktree: one commit never pushed, then an edit on top of it.
    writeFileSync(join(f.nested, 'slice.ts'), 'export const one = 1;\n');
    git(f.nested, 'add', '-A');
    git(f.nested, 'commit', '-q', '-m', 'slice: one');
    writeFileSync(join(f.nested, 'slice.ts'), 'export const one = 1;\nexport const two = 2;\n');
    const before = f.state();

    const save = f.save();

    expect(f.state()).toBe(before);
    expect(save).not.toBeNull();
    const paths = savePaths(f.folder);
    expect(save).toMatchObject({ job: '7', repo: 'acme/widgets', runner: 'box-1', kind: 'local', folder: f.folder, bundle: paths.bundle, failed: null, lost: null });
    expect(save?.savedAt).toBe(new Date(NOW).toISOString());
    expect(save?.keepUntil).toBe(new Date(NOW + KEEP_DAYS * DAY).toISOString());
    expect(save?.bundleBytes).toBe(statSync(paths.bundle).size);
    expect(save?.bytes).toBeGreaterThan(save?.bundleBytes ?? 0);
    const seed = git(f.checkout, 'rev-parse', 'origin/main').trim();
    const sliceCommit = git(f.nested, 'rev-parse', 'HEAD').trim();
    expect(save?.branches.map(({ branch, ref, path, base, files, commits }) => ({ branch, ref, path, base, files, commits }))).toEqual([
      { branch: 'agent/job-7', ref: 'refs/heads/omni-checkpoint/agent/job-7', path: '.', base: seed, files: 3, commits: 0 },
      { branch: 'feat/x--s2', ref: 'refs/heads/omni-checkpoint/feat/x--s2', path: '.claude/worktrees/s2', base: seed, files: 1, commits: 1 },
    ]);
    expect(readSave(paths.manifest)).toEqual(save);

    // Another runner, from origin and the bundle alone, gets both branches back at their saved heads, the edits included.
    const clone = f.restored(paths.bundle);
    expect(save?.branches.map(({ head }) => head)).toEqual(['agent/job-7', 'feat/x--s2'].map((branch) => git(clone, 'rev-parse', `omni-checkpoint/${branch}`).trim()));
    expect(git(clone, 'show', 'omni-checkpoint/agent/job-7:README.md')).toBe('widgets, changed\n');
    expect(git(clone, 'show', 'omni-checkpoint/agent/job-7:notes.md')).toBe('new\n');
    expect(git(clone, 'show', 'omni-checkpoint/agent/job-7:staged.md')).toBe('staged\n');
    expect(git(clone, 'show', 'omni-checkpoint/feat/x--s2:slice.ts')).toBe('export const one = 1;\nexport const two = 2;\n');
    // The snapshot sits on the unpushed commit, which sits on what origin had: a fast-forward of both.
    expect(git(clone, 'rev-parse', 'omni-checkpoint/feat/x--s2~1').trim()).toBe(sliceCommit);
    expect(git(clone, 'rev-parse', 'omni-checkpoint/agent/job-7~1').trim()).toBe(seed);
    // The snapshot is the job's app's, never a person's.
    expect(git(clone, 'log', '-1', '--format=%an <%ae>|%cn <%ce>', 'omni-checkpoint/agent/job-7').trim()).toBe(`${BOT.name} <${BOT.email}>|${BOT.name} <${BOT.email}>`);
    // The nested worktree is never in its parent's snapshot.
    expect(git(clone, 'ls-tree', '-r', '--name-only', 'omni-checkpoint/agent/job-7').split('\n').filter(Boolean).sort()).toEqual(['.gitignore', 'README.md', 'notes.md', 'staged.md']);
  });

  it('holds only the commits origin lacks: the bundle needs what origin had', () => {
    const f = fixture();
    writeFileSync(join(f.nested, 'slice.ts'), 'x\n');
    git(f.nested, 'add', '-A');
    git(f.nested, 'commit', '-q', '-m', 'slice');
    const save = f.save();
    const seed = git(f.checkout, 'rev-parse', 'origin/main').trim();
    const heads = git(f.checkout, 'bundle', 'list-heads', String(save?.bundle));
    expect(heads.trim()).toBe(`${git(f.nested, 'rev-parse', 'HEAD').trim()} refs/heads/omni-checkpoint/feat/x--s2`);
    // A repository without origin's commit cannot take the bundle: it names that commit as a prerequisite.
    const empty = join(f.root, 'empty');
    mkdirSync(empty);
    git(empty, 'init', '-q');
    let refused = '';
    try {
      execFileSync('git', ['bundle', 'verify', String(save?.bundle)], { cwd: empty, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      refused = String((error as { stderr?: string }).stderr);
    }
    expect(refused).toContain(seed);
    expect(save?.branches.map(({ branch, files, commits }) => ({ branch, files, commits }))).toEqual([{ branch: 'feat/x--s2', files: 0, commits: 1 }]);
  });

  it('never puts a file git ignores in the bundle', () => {
    const f = fixture();
    writeFileSync(join(f.folder, '.env'), 'OMNI_SECRET=never-leaves\n');
    writeFileSync(join(f.nested, '.env'), 'OMNI_SECRET=never-leaves\n');
    writeFileSync(join(f.folder, 'work.md'), 'work\n');
    writeFileSync(join(f.nested, 'work.md'), 'work\n');
    const save = f.save();
    const clone = f.restored(String(save?.bundle));
    for (const branch of ['omni-checkpoint/agent/job-7', 'omni-checkpoint/feat/x--s2']) {
      expect(git(clone, 'ls-tree', '-r', '--name-only', branch).split('\n')).not.toContain('.env');
    }
    // `git grep` exits 1 when no file of either branch holds the secret.
    let status = 0;
    try {
      git(clone, 'grep', '-l', 'never-leaves', 'omni-checkpoint/agent/job-7', 'omni-checkpoint/feat/x--s2');
    } catch (error) {
      status = (error as { status?: number }).status ?? -1;
    }
    expect(status).toBe(1);
  });

  it('names a detached worktree after its path in the folder', () => {
    const f = fixture();
    const detached = join(f.folder, '.claude', 'worktrees', 'inline');
    git(f.folder, 'worktree', 'add', '-q', '--detach', detached, 'origin/main');
    writeFileSync(join(detached, 'inline.md'), 'inline\n');
    const save = f.save();
    expect(save?.branches).toEqual([
      expect.objectContaining({ branch: null, ref: 'refs/heads/omni-checkpoint/detached/claude/worktrees/inline', path: '.claude/worktrees/inline', files: 1, commits: 0 }),
    ]);
    const clone = f.restored(String(save?.bundle));
    expect(git(clone, 'show', 'omni-checkpoint/detached/claude/worktrees/inline:inline.md')).toBe('inline\n');
  });

  it('authors the snapshot as the runner when the job\'s app is not known', () => {
    const f = fixture();
    writeFileSync(join(f.folder, 'work.md'), 'work\n');
    const save = f.save({ author: null });
    const clone = f.restored(String(save?.bundle));
    expect(git(clone, 'log', '-1', '--format=%an <%ae>', 'omni-checkpoint/agent/job-7').trim()).toBe('omni runner box-1 <box-1@runner.omni.invalid>');
  });

  it('keeps the folder, saying why, when the save itself fails', () => {
    const f = fixture();
    writeFileSync(join(f.folder, 'work.md'), 'work\n');
    const failing: ExecText = (file, args, options) => {
      if (args.includes('bundle')) throw new Error('no space left on device');
      return exec(file, args, options);
    };
    const save = f.save({ exec: failing });
    expect(save).toMatchObject({ kind: 'local', bundle: null, bundleBytes: 0, branches: [], failed: 'the save failed: no space left on device' });
    expect(existsSync(savePaths(f.folder).bundle)).toBe(false);
    expect(readSave(savePaths(f.folder).manifest)).toEqual(save);
  });
});

// Sending a save to the app (PRD 2809, s4): the bundle goes through a signed link to the private bucket and its
// manifest is recorded `portable`; a failed or refused upload, a bundle over 100 MB, or a save that failed records
// it `local`, the folder kept. Nothing here throws: a save the app could not hear of stays on the runner.
describe('sendSave', () => {
  const LINK = { path: 'w/7/b.bundle', url: 'https://store.test/upload/sign/runner-checkpoints/w/7/b.bundle?token=t', expiresAt: '2026-11-13T14:00:00.000Z' };
  const TOKEN = ['ghs', 'fakeTokenOfTheJob0123456789ABCDEF'].join('_');

  /** A fake app: what each call was given, and how each answers (`fail` names the call that throws). */
  function fakeApi(fail: { link?: Error; upload?: Error; record?: (save: SaveRecord) => Error | null } = {}) {
    const calls: { link: { job: string; bytes: number }[]; upload: Uint8Array[]; record: { job: string; save: SaveRecord }[] } = { link: [], upload: [], record: [] };
    const api: CheckpointApi = {
      link(job, bytes) {
        calls.link.push({ job, bytes });
        return fail.link ? Promise.reject(fail.link) : Promise.resolve(LINK);
      },
      upload(_link, bundle) {
        calls.upload.push(bundle);
        return fail.upload ? Promise.reject(fail.upload) : Promise.resolve();
      },
      record(job, save) {
        calls.record.push({ job, save });
        const refused = fail.record?.(save) ?? null;
        return refused ? Promise.reject(refused) : Promise.resolve({ id: 'c1', kind: save.kind, keepUntil: '2026-11-20T12:00:00.000Z' });
      },
    };
    return { api, calls };
  }

  function savedWork() {
    const f = fixture();
    writeFileSync(join(f.folder, 'work.md'), 'work\n');
    writeFileSync(join(f.nested, 'slice.md'), 'slice\n');
    const save = f.save();
    if (save === null) throw new Error('the fixture saved nothing');
    return { f, save };
  }

  it('uploads the bundle as it is and records it portable, its manifest naming no folder and holding no file', async () => {
    const { f, save } = savedWork();
    const { api, calls } = fakeApi();
    const sent = await sendSave({ save, api, handoff: null, secrets: [], now: NOW });
    expect(sent).toEqual({ kind: 'portable', why: null, recorded: { id: 'c1', kind: 'portable', keepUntil: '2026-11-20T12:00:00.000Z' } });
    expect(calls.link).toEqual([{ job: '7', bytes: save.bundleBytes }]);
    expect(Buffer.from(calls.upload[0] ?? []).equals(readFileSync(String(save.bundle)))).toBe(true);
    const recorded = calls.record[0]?.save;
    expect(recorded).toMatchObject({ kind: 'portable', path: LINK.path });
    const manifest = CheckpointManifestSchema.parse(recorded?.manifest);
    expect(manifest).toMatchObject({ job: '7', runner: 'box-1', repo: 'acme/widgets', kind: 'portable', keepUntil: save.keepUntil, bundleBytes: save.bundleBytes, bytes: save.bytes, failed: null, handoff: null });
    expect(manifest.branches.map(({ branch, ref, files }) => ({ branch, ref, files }))).toEqual(save.branches.map(({ branch, ref, files }) => ({ branch, ref, files })));
    expect(JSON.stringify(recorded)).not.toContain(f.root);
    // The runner's own manifest says where the bundle went.
    expect(readSave(savePaths(f.folder).manifest)?.sent).toEqual({ at: new Date(NOW).toISOString(), path: LINK.path });
  });

  it('records the save local, the folder kept, when the upload fails or the app refuses the link', async () => {
    for (const fail of [{ upload: new RunnerUnreachable('the storage is unreachable') }, { link: new RunnerRefused('This job was claimed by none of your runners.') }]) {
      const { f, save } = savedWork();
      const { api, calls } = fakeApi(fail);
      const sent = await sendSave({ save, api, handoff: null, secrets: [], now: NOW });
      const why = `the upload failed: ${(fail.upload ?? fail.link).message}`;
      expect(sent).toMatchObject({ kind: 'local', why, recorded: { kind: 'local' } });
      expect(calls.record).toHaveLength(1);
      expect(calls.record[0]?.save).toMatchObject({ kind: 'local', manifest: { kind: 'local', failed: why, bytes: save.bytes, keepUntil: save.keepUntil, runner: 'box-1' } });
      expect(calls.record[0]?.save).not.toHaveProperty('path');
      expect(existsSync(f.folder)).toBe(true);
      expect(readSave(savePaths(f.folder).manifest)?.sent ?? null).toBeNull();
    }
  });

  it('records a portable save local when the app refuses its record, and sends nothing for a bundle over 100 MB', async () => {
    const refused = savedWork();
    const portableRefused = fakeApi({ record: (save) => (save.kind === 'portable' ? new RunnerRefused('No bundle was uploaded at this path.') : null) });
    expect(await sendSave({ save: refused.save, api: portableRefused.api, handoff: null, secrets: [], now: NOW }))
      .toMatchObject({ kind: 'local', why: 'the upload failed: No bundle was uploaded at this path.' });
    expect(portableRefused.calls.record.map(({ save }) => save.kind)).toEqual(['portable', 'local']);

    const { save } = savedWork();
    const { api, calls } = fakeApi();
    const big = { ...save, bundleBytes: CHECKPOINT_BYTES_MAX + 1 };
    expect(await sendSave({ save: big, api, handoff: null, secrets: [], now: NOW })).toMatchObject({ kind: 'local', why: 'the bundle is over 100 MB' });
    expect(calls.link).toEqual([]);
    expect(calls.upload).toEqual([]);
  });

  it('records a save that failed local, with its why, and asks for no link', async () => {
    const f = fixture();
    writeFileSync(join(f.folder, 'work.md'), 'work\n');
    const failing: ExecText = (file, args, options) => {
      if (args.includes('bundle')) throw new Error('no space left on device');
      return exec(file, args, options);
    };
    const save = f.save({ exec: failing });
    if (save === null) throw new Error('the fixture saved nothing');
    const { api, calls } = fakeApi();
    expect(await sendSave({ save, api, handoff: null, secrets: [], now: NOW })).toMatchObject({ kind: 'local', why: 'the save failed: no space left on device' });
    expect(calls.link).toEqual([]);
    expect(calls.record[0]?.save.manifest).toMatchObject({ kind: 'local', branches: [], failed: 'the save failed: no space left on device' });
  });

  it('sends the handoff note masked and cut to 8 KB, with no credential', async () => {
    const { save } = savedWork();
    const { api, calls } = fakeApi();
    await sendSave({ save, api, handoff: `Next: s4. Pushed with ${TOKEN}, key acct-key-99.\n${'x'.repeat(9000)}`, secrets: ['acct-key-99'], now: NOW });
    const handoff = calls.record[0]?.save.manifest.handoff ?? '';
    expect(handoff.startsWith('Next: s4.')).toBe(true);
    expect(handoff).not.toContain(TOKEN);
    expect(handoff).not.toContain('acct-key-99');
    expect(new TextEncoder().encode(handoff).length).toBeLessThanOrEqual(8 * 1024);
  });

  it('never throws: a save the app hears nothing of stays local, unrecorded', async () => {
    const { save } = savedWork();
    const { api } = fakeApi({ link: new RunnerUnreachable('omni.test is unreachable'), record: () => new RunnerUnreachable('omni.test is unreachable') });
    expect(await sendSave({ save, api, handoff: null, secrets: [], now: NOW })).toEqual({ kind: 'local', why: 'the upload failed: omni.test is unreachable', recorded: null });
  });
});

describe('readSave', () => {
  it('reads null for a missing file, or one that is not a save', () => {
    const f = fixture();
    const path = join(f.root, 'not-a-save.json');
    expect(readSave(path)).toBeNull();
    writeFileSync(path, '{"job": 7}');
    expect(readSave(path)).toBeNull();
    writeFileSync(path, 'not json');
    expect(readSave(path)).toBeNull();
    expect(readFileSync(path, 'utf8')).toBe('not json');
  });
});
