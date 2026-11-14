// The runner's restore (PRD 2809, s5): box-1 saved a lost job's work (s2's `saveJob`, on a fixture checkout with its own
// bare origin and a nested worktree); the resume's runner fetches each save into its own checkout as
// `omni-checkpoint/<branch>`, reads each branch against origin's, and writes the note its session reads first. Nothing
// here calls GitHub or the app: a portable save's download is a function handing the bundle's bytes.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExecText } from '../context.ts';
import { saveJob } from './checkpoint.ts';
import type { LocalSave } from './checkpoint.ts';
import { CheckpointManifestSchema } from './checkpoint.manifest.ts';
import type { CheckpointManifest } from './checkpoint.manifest.ts';
import type { ResumeClaim } from './resume.claim.ts';
import { chainCarriesOn, chainOf, FIRST, keepChain, lostWords, readChain, restoreSaves, resumedLine, resumeNote, resumeNotePath, resumePointer, standingOf } from './resume.ts';
import type { Restore } from './resume.ts';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const BOT = { name: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' };
const LOST = '00000000-0000-4000-8000-000028095001';
const RESUME = '00000000-0000-4000-8000-000028095002';

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const exec: ExecText = (file, args, options) => execFileSync(file, args, { ...options, encoding: 'utf8' });

/** The manifest the app holds of a save, as `sendSave` sends it. */
function manifestOf(save: LocalSave, kind: CheckpointManifest['kind'], handoff: string | null = null): CheckpointManifest {
  return CheckpointManifestSchema.parse({
    job: save.job, runner: save.runner, repo: save.repo, kind, savedAt: save.savedAt, keepUntil: save.keepUntil, bundleBytes: save.bundleBytes, bytes: save.bytes,
    branches: save.branches.map(({ branch, ref, path, base, head, files, commits }) => ({ branch, ref, path, base, head, files, commits })), handoff, failed: save.failed,
  });
}

/**
 * Box-1's checkout of `acme/widgets`, with a bare origin ignoring `.env`, and the lost job's folder `~/wt/widgets-job-<lost>` on
 * `agent/job-<lost>` with a slice's worktree `feat/x--s3` inside it: one commit never pushed, then an uncommitted edit, a new
 * file and an ignored `.env`. Box-3 is a second clone of origin, with its own home.
 */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'omni-resume-'));
  const origin = join(root, 'remote', 'widgets.git');
  mkdirSync(origin, { recursive: true });
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  const box1 = join(root, 'box-1', 'repos', 'widgets');
  mkdirSync(box1, { recursive: true });
  git(box1, 'init', '-q', '-b', 'main');
  writeFileSync(join(box1, 'README.md'), 'widgets\n');
  writeFileSync(join(box1, '.gitignore'), '.env\n');
  git(box1, 'add', '-A');
  git(box1, 'commit', '-q', '-m', 'seed');
  git(box1, 'remote', 'add', 'origin', origin);
  git(box1, 'push', '-q', '-u', 'origin', 'main');
  const home1 = join(root, 'box-1', 'home');
  const folder = join(home1, 'wt', `widgets-job-${LOST}`);
  mkdirSync(join(home1, 'wt'), { recursive: true });
  git(box1, 'worktree', 'add', '-q', '--no-track', '-b', `agent/job-${LOST}`, folder, 'origin/main');
  const slice = join(folder, '.claude', 'worktrees', 's3');
  git(folder, 'worktree', 'add', '-q', '--no-track', '-b', 'feat/x--s3', slice, 'origin/main');
  writeFileSync(join(slice, 'slice.ts'), 'export const one = 1;\n');
  git(slice, 'add', '-A');
  git(slice, 'commit', '-q', '-m', 'slice: one');
  writeFileSync(join(slice, 'slice.ts'), 'export const one = 1;\nexport const two = 2;\n');
  writeFileSync(join(slice, 'more.ts'), 'export const more = true;\n');
  writeFileSync(join(slice, '.env'), 'TOKEN=never-leaves\n');
  const save = (runner = 'box-1'): LocalSave => {
    const saved = saveJob({ exec, checkout: box1, folder, job: LOST, repo: 'acme/widgets', runner, author: BOT, now: NOW });
    if (saved === null) throw new Error('nothing saved');
    return saved;
  };
  const box3 = join(root, 'box-3', 'repos', 'widgets');
  mkdirSync(join(root, 'box-3', 'repos'), { recursive: true });
  git(root, 'clone', '-q', origin, box3);
  const home3 = join(root, 'box-3', 'home');
  const claim = (saves: ResumeClaim['saves'], attempt = 2): ResumeClaim => ({ attempt, chain: [LOST], saves });
  return { root, origin, box1, home1, folder, slice, save, box3, home3, claim };
}

const bytesOf = (save: LocalSave): Uint8Array => {
  if (save.bundle === null) throw new Error('no bundle');
  return new Uint8Array(readFileSync(save.bundle));
};

describe('restoreSaves', () => {
  it('brings a portable save back on another runner as omni-checkpoint/<branch>, its commit and its uncommitted edits, never the ignored .env', async () => {
    const f = fixture();
    const save = f.save();
    const downloaded: string[] = [];
    const restore = await restoreSaves({
      exec, checkout: f.box3, home: f.home3, runner: 'box-3',
      resume: f.claim([{ job: LOST, kind: 'portable', manifest: manifestOf(save, 'portable'), url: 'https://store.test/sign/x.bundle?token=t', expiresAt: null }]),
      download: (url) => {
        downloaded.push(url);
        return Promise.resolve(bytesOf(save));
      },
    });
    expect(downloaded).toEqual(['https://store.test/sign/x.bundle?token=t']);
    expect(restore.behind).toEqual([]);
    expect(restore.restored).toEqual([
      expect.objectContaining({ job: LOST, runner: 'box-1', branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: '.claude/worktrees/s3', files: 2, commits: 1, standing: 'new' }),
    ]);
    expect(git(f.box3, 'show', 'omni-checkpoint/feat/x--s3:slice.ts')).toBe('export const one = 1;\nexport const two = 2;\n');
    expect(git(f.box3, 'show', 'omni-checkpoint/feat/x--s3:more.ts')).toBe('export const more = true;\n');
    expect(git(f.box3, 'ls-tree', '-r', '--name-only', 'omni-checkpoint/feat/x--s3')).not.toContain('.env');
    // No other branch moved: box-3 holds main and the checkpoint alone.
    expect(git(f.box3, 'for-each-ref', '--format=%(refname)', 'refs/heads').split('\n').filter(Boolean)).toEqual(['refs/heads/main', 'refs/heads/omni-checkpoint/feat/x--s3']);
  });

  it('restores a local save from its own runner\'s disk, and says a local save on another runner stayed there', async () => {
    const f = fixture();
    const save = f.save();
    const local = f.claim([{ job: LOST, kind: 'local', manifest: manifestOf(save, 'local') }]);
    const own = await restoreSaves({ exec, checkout: f.box1, home: f.home1, runner: 'box-1', resume: local, download: () => Promise.reject(new Error('no download for a local save')) });
    expect(own.restored.map(({ ref, standing }) => ({ ref, standing }))).toEqual([{ ref: 'refs/heads/omni-checkpoint/feat/x--s3', standing: 'new' }]);
    expect(git(f.box1, 'show', 'omni-checkpoint/feat/x--s3:more.ts')).toBe('export const more = true;\n');

    const elsewhere = await restoreSaves({ exec, checkout: f.box3, home: f.home3, runner: 'box-3', resume: local, download: () => Promise.reject(new Error('unused')) });
    expect(elsewhere).toEqual({ restored: [], behind: [{ job: LOST, runner: 'box-1', branch: 'feat/x--s3', files: 2, commits: 1, why: 'its save stayed on box-1' }], handoff: null });
  });

  it('says why a portable save could not come: no link, or a download that failed', async () => {
    const f = fixture();
    const save = f.save();
    const manifest = manifestOf(save, 'portable');
    const unsigned = await restoreSaves({ exec, checkout: f.box3, home: f.home3, runner: 'box-3', resume: f.claim([{ job: LOST, kind: 'portable', manifest, url: null, expiresAt: null }]), download: () => Promise.reject(new Error('unused')) });
    expect(unsigned.behind).toEqual([expect.objectContaining({ branch: 'feat/x--s3', why: 'the app gave no link to its bundle' })]);
    const failing = await restoreSaves({
      exec, checkout: f.box3, home: f.home3, runner: 'box-3',
      resume: f.claim([{ job: LOST, kind: 'portable', manifest, url: 'https://store.test/x', expiresAt: null }]),
      download: () => Promise.reject(new Error('the storage answered 404')),
    });
    expect(failing.behind).toEqual([expect.objectContaining({ why: 'its bundle could not be downloaded: the storage answered 404' })]);
    expect(git(f.box3, 'for-each-ref', 'refs/heads/omni-checkpoint')).toBe('');
  });

  it('reads each branch against origin\'s: it fast-forwards, origin already holds it, or it diverged', async () => {
    const f = fixture();
    const save = f.save();
    const resume = f.claim([{ job: LOST, kind: 'portable', manifest: manifestOf(save, 'portable'), url: 'https://store.test/x', expiresAt: null }]);
    const download = () => Promise.resolve(bytesOf(save));
    // Origin got the branch at its base: the save fast-forwards from it.
    git(f.box1, 'push', '-q', 'origin', 'origin/main:refs/heads/feat/x--s3');
    git(f.box3, 'fetch', '-q', 'origin');
    expect((await restoreSaves({ exec, checkout: f.box3, home: f.home3, runner: 'box-3', resume, download })).restored[0]?.standing).toBe('fast-forward');
    // Someone pushed another commit to it meanwhile: it diverged.
    const other = join(f.root, 'other');
    git(f.root, 'clone', '-q', '-b', 'feat/x--s3', f.origin, other);
    writeFileSync(join(other, 'theirs.ts'), 'export const theirs = 1;\n');
    git(other, 'add', '-A');
    git(other, 'commit', '-q', '-m', 'theirs');
    git(other, 'push', '-q', 'origin', 'feat/x--s3');
    git(f.box3, 'fetch', '-q', 'origin');
    expect(standingOf(exec, f.box3, 'feat/x--s3', 'refs/heads/omni-checkpoint/feat/x--s3')).toBe('diverged');
    // Origin already holds it all once the checkpoint itself is pushed.
    git(f.box3, 'push', '-q', '-f', 'origin', 'omni-checkpoint/feat/x--s3:feat/x--s3');
    git(f.box3, 'fetch', '-q', 'origin');
    expect(standingOf(exec, f.box3, 'feat/x--s3', 'refs/heads/omni-checkpoint/feat/x--s3')).toBe('on origin');
    expect(standingOf(exec, f.box3, null, 'refs/heads/omni-checkpoint/detached/root')).toBe('detached');
  });

  it('takes a branch two saves hold from the newest, and keeps the newest handoff note', async () => {
    const f = fixture();
    const first = f.save();
    const firstBytes = bytesOf(first);
    writeFileSync(join(f.slice, 'later.ts'), 'export const later = 1;\n');
    const second = f.save();
    const secondJob = '00000000-0000-4000-8000-000028095003';
    const resume: ResumeClaim = {
      attempt: 3,
      chain: [LOST, secondJob],
      saves: [
        { job: LOST, kind: 'portable', manifest: manifestOf(first, 'portable', 'Next: the route.'), url: 'https://store.test/1', expiresAt: null },
        { job: secondJob, kind: 'portable', manifest: { ...manifestOf(second, 'portable', 'Next: the tests.'), job: secondJob }, url: 'https://store.test/2', expiresAt: null },
      ],
    };
    const restore = await restoreSaves({ exec, checkout: f.box3, home: f.home3, runner: 'box-3', resume, download: (url) => Promise.resolve(url.endsWith('/1') ? firstBytes : bytesOf(second)) });
    expect(restore.restored).toEqual([expect.objectContaining({ job: secondJob, files: 3 })]);
    expect(restore.handoff).toBe('Next: the tests.');
    expect(git(f.box3, 'show', 'omni-checkpoint/feat/x--s3:later.ts')).toBe('export const later = 1;\n');
  });

  it('names a save that failed on its runner, holding no branch, with its failure', async () => {
    const f = fixture();
    const failed: CheckpointManifest = { ...manifestOf(f.save(), 'local'), branches: [], bundleBytes: 0, failed: 'the save failed: git broke' };
    const restore = await restoreSaves({ exec, checkout: f.box3, home: f.home3, runner: 'box-3', resume: f.claim([{ job: LOST, kind: 'local', manifest: failed }]), download: () => Promise.reject(new Error('unused')) });
    expect(restore.behind).toEqual([{ job: LOST, runner: 'box-1', branch: null, files: 0, commits: 0, why: 'the save failed: git broke' }]);
  });
});

describe('the resume note', () => {
  const resume: ResumeClaim = { attempt: 2, chain: [LOST], saves: [] };
  const restore: Restore = {
    restored: [
      { job: LOST, runner: 'box-1', branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: '.claude/worktrees/s3', files: 2, commits: 1, standing: 'fast-forward' },
      { job: LOST, runner: 'box-1', branch: 'feat/x--s4', ref: 'refs/heads/omni-checkpoint/feat/x--s4', path: '.claude/worktrees/s4', files: 1, commits: 0, standing: 'diverged' },
    ],
    behind: [{ job: LOST, runner: 'box-1', branch: 'feat/x--s5', files: 3, commits: 0, why: 'its save stayed on box-1' }],
    handoff: 'Next: the route.',
  };

  it('says the attempt, each branch and how it stands, the rule, what stayed behind, the claims and the handoff note', () => {
    expect(resumeNote(RESUME, resume, restore)).toBe([
      `# Job ${RESUME}: attempt 2 of 3`,
      '',
      `This job resumes job \`${LOST}\`, which its runner lost. Its chain's earlier jobs: \`${LOST}\`. Start from what GitHub holds and the saves below.`,
      '',
      '## The saved branches',
      '',
      `- \`feat/x--s3\` as \`omni-checkpoint/feat/x--s3\` (job ${LOST} on box-1): 2 files, 1 commit; fast-forwards from origin's \`feat/x--s3\`.`,
      `- \`feat/x--s4\` as \`omni-checkpoint/feat/x--s4\` (job ${LOST} on box-1): 1 file, 0 commits; diverged from origin's \`feat/x--s4\`: merge it.`,
      '',
      '## The rule',
      '',
      'After you check out a branch listed above, and before anything else, take its checkpoint:',
      '',
      '    git merge --ff-only omni-checkpoint/<branch>',
      '',
      'When it diverged from origin\'s, `git merge omni-checkpoint/<branch>` instead, and resolve. A branch origin has not got is',
      'checked out from its checkpoint (`git switch -c <branch> omni-checkpoint/<branch>`). Push it once taken.',
      '',
      '## What stayed behind',
      '',
      `- 3 files and 0 commits on feat/x--s5 stayed on box-1 (job ${LOST}): its save stayed on box-1.`,
      '',
      '## The claims',
      '',
      `A claim whose status comment names job \`${LOST}\` is this chain's: take it over as this job's (its \`job:\` line rewritten to \`${RESUME}\`) and build on it. No other job takes it.`,
      '',
      '## The handoff note',
      '',
      'Next: the route.',
      '',
    ].join('\n'));
  });

  it('says to start over when nothing was saved, with no rule to follow', () => {
    const note = resumeNote(RESUME, resume, { restored: [], behind: [], handoff: null });
    expect(note).toContain('Nothing was saved: start over from what GitHub holds.');
    expect(note).not.toContain('## The rule');
    expect(note).not.toContain('## What stayed behind');
    expect(note).toContain('## The claims');
  });

  it('is pointed at from the prompt, and printed in one line', () => {
    const path = resumeNotePath('/home/box', RESUME);
    expect(path).toBe(`/home/box/logs/job-${RESUME}.resume.md`);
    expect(resumePointer(resume, path)).toBe(`This job is attempt 2 of 3: it resumes job ${LOST}, which its runner lost. Before anything else, read ${path} and follow it.`);
    expect(resumedLine(RESUME, resume, restore)).toBe(`job ${RESUME}: attempt 2 of 3, 2 branches came back · 1 stayed behind`);
    expect(resumedLine(RESUME, resume, { restored: [], behind: [], handoff: null })).toBe(`job ${RESUME}: attempt 2 of 3, nothing saved came back`);
  });
});

describe('the chain kept beside the log', () => {
  it('keeps a job\'s attempt and earlier jobs, and reads none for a job of an older kit', () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-chain-'));
    expect(readChain(home, RESUME)).toBeNull();
    keepChain(home, RESUME, chainOf({ attempt: 2, chain: [LOST], saves: [] }));
    expect(readChain(home, RESUME)).toEqual({ attempt: 2, chain: [LOST] });
    keepChain(home, LOST, chainOf(null));
    expect(readChain(home, LOST)).toEqual(FIRST);
    writeFileSync(join(home, 'logs', 'job-x.chain.json'), '{"attempt": 9}');
    expect(readChain(home, 'x')).toBeNull();
  });

  it('carries a lost job\'s claims on when its skill resumes and it was not the third attempt', () => {
    expect(chainCarriesOn('/omni:wave 2809', { attempt: 1, chain: [] })).toBe(true);
    expect(chainCarriesOn('/omni:do-work 2809 s5 --in-wave', { attempt: 2, chain: [LOST] })).toBe(true);
    expect(chainCarriesOn('/omni:wave 2809', { attempt: 3, chain: [LOST, RESUME] })).toBe(false);
    expect(chainCarriesOn('/omni:plan 2809', FIRST)).toBe(false);
    expect(chainCarriesOn('/validate-prd 2809', FIRST)).toBe(false);
  });

  it('reads a refused report as a loss only when the app says the runner lost the job', () => {
    expect(lostWords('This job has ended: failed, runner lost. Stop it.')).toBe(true);
    expect(lostWords('This job has ended: cancelled. Stop it.')).toBe(false);
    expect(lostWords('This job has ended: failed, exit code 1. Stop it.')).toBe(false);
  });
});
