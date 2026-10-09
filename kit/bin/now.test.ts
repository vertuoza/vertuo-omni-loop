// PRD #1208, slice s1: `omni now [--json]` through `main()` — what this session is on: the PRD of
// its branch, else of its record (PRD 324's shape), its stage (`building` while a slice is not
// merged), and the slices in flight and stuck by id and name from the cached board. Every case exits
// 0, prints nothing on stderr, writes no file and never runs `gh` or `git fetch`.
import { execFile, execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePrd } from '../lib/ids.ts';
import { LOOP_FILE } from '../lib/loop/local.ts';
import { BOARD_DIR, boardFile } from '../lib/statusline/board-cache.ts';
import { SESSIONS_DIR } from '../lib/statusline/sessions.ts';
import { makeRepo, realExec } from '../test/fixture.ts';
import { COMMAND_TABLE } from './commands/index.ts';
import { main } from './omni.ts';

const CLI = fileURLToPath(new URL('./omni.ts', import.meta.url));
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };
const DELIVERY = '.omni-loop/delivery';
const NOW = Date.parse('2026-10-08T12:00:00Z');
const NOTHING = { headline: null, work: null, doing: null };
const NO_PRD = 'no PRD · /omni:brainstorm to start\n';

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe', encoding: 'utf8' });

function commit(root: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'change');
}

/**
 * A clone whose default branch holds the shipped folder `0003-alpha`, the inbox folders
 * `0007-bravo` and `0009-charlie`, the merged bug fix `1170-crash` and the merged visual fix
 * `1150-sidebar`; a phase-0 branch for `0011-delta`, and the fix branches `fix/login-redirect` (bug
 * `1180`) and `fix/tooltip` (visual fix `1160`) holding their folders. `on(branch, start)` checks
 * `branch` out in a worktree of its own; `board(prd, slices)` writes a cached board a few seconds old;
 * `record(session, body)` writes a session's record. `extra` adds files to the default branch.
 */
function fixture(extra: Record<string, string> = {}) {
  const seed = makeRepo({ git: true, files: CONFIG });
  commit(seed.root, {
    ...extra,
    [`${DELIVERY}/shipped/0003-alpha/spec.md`]: '# alpha\n',
    [`${DELIVERY}/inbox/0007-bravo/spec.md`]: '# bravo\n',
    [`${DELIVERY}/inbox/0009-charlie/spec.md`]: '# charlie\n',
    [`${DELIVERY}/bugs/1170-crash/bug.md`]: '# crash\n',
    [`${DELIVERY}/visual/1150-sidebar/before-after.html`]: '<p>sidebar</p>\n',
  });
  const branchWith = (branch: string, files: Record<string, string>) => {
    git(seed.root, 'checkout', '-q', '-b', branch);
    commit(seed.root, files);
    git(seed.root, 'checkout', '-q', 'main');
  };
  branchWith('docs/phase-0-delta', { [`${DELIVERY}/inbox/0011-delta/spec.md`]: '# delta\n' });
  branchWith('fix/login-redirect', { [`${DELIVERY}/bugs/1180-login-redirect/bug.md`]: '# login\n' });
  branchWith('fix/tooltip', { [`${DELIVERY}/visual/1160-tooltip/before-after.html`]: '<p>tooltip</p>\n' });
  const bare = mkdtempSync(join(tmpdir(), 'omni-now-origin-'));
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  git(seed.root, 'remote', 'add', 'origin', bare);
  git(seed.root, 'push', '-q', 'origin', 'main', 'docs/phase-0-delta', 'fix/login-redirect', 'fix/tooltip');
  const root = join(mkdtempSync(join(tmpdir(), 'omni-now-clone-')), 'work');
  git(tmpdir(), 'clone', '-q', bare, root);
  const on = (branch: string, start = 'origin/main') => {
    const dir = join(mkdtempSync(join(tmpdir(), 'omni-now-wt-')), 'wt');
    git(root, 'worktree', 'add', '-q', '-b', branch, dir, start);
    return dir;
  };
  const board = (prd: number, slices: unknown[]) => {
    mkdirSync(join(root, BOARD_DIR), { recursive: true });
    writeFileSync(boardFile(root, parsePrd(prd)), JSON.stringify({ at: new Date(NOW - 5000).toISOString(), slices }));
  };
  const record = (session: string, body: unknown) => {
    mkdirSync(join(root, SESSIONS_DIR), { recursive: true });
    writeFileSync(join(root, SESSIONS_DIR, `${session}.json`), JSON.stringify(body));
  };
  return { root, on, board, record };
}

/** The checkout's files, tracked or not, ignored or not: what a run must leave as it found it. */
const tree = (root: string) => git(root, 'status', '--porcelain', '--ignored', '--untracked-files=all');

/** `omni now <args>` in `cwd`: `{ code, out, err, calls }`, each call `<file> <args…>`. */
async function now(cwd: string, args: string[] = [], { env = {}, stdin }: { env?: Record<string, string>; stdin?: string } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const calls: string[] = [];
  const exec = (file: string, argv: readonly string[], options?: ExecFileSyncOptions) => {
    calls.push([file, ...argv].join(' '));
    return realExec(file, argv, options);
  };
  const code = await main(['now', ...args], {
    cwd,
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    exec,
    env,
    now: () => NOW,
    ...(stdin === undefined ? {} : { stdin }),
  });
  return { code, out: out.join(''), err: err.join(''), calls };
}

/** `omni now --json` in `cwd`, held to the rules every case keeps: exit 0, no stderr, no network, no file written. */
async function nowJson(cwd: string, root: string, args: string[] = [], options = {}) {
  const before = tree(root);
  const run = await now(cwd, ['--json', ...args], options);
  expect({ code: run.code, err: run.err }).toEqual({ code: 0, err: '' });
  expect(run.calls.filter((call) => /^gh\b/.test(call) || /^git\b.*\bfetch\b/.test(call))).toEqual([]);
  expect(tree(root)).toBe(before);
  const answer: unknown = JSON.parse(run.out);
  return answer;
}

const BOARD = [
  { id: 's1', wave: 1, state: 'merged', name: 'the base' },
  { id: 's2', wave: 1, state: 'merged', name: 'the record' },
  { id: 's3', wave: 2, state: 'in-flight', name: 'tabs' },
  { id: 's4', wave: 2, state: 'claimed-stale', name: 'board' },
  { id: 's5', wave: 3, state: 'stuck' },
  { id: 's6', wave: 4, state: 'blocked', name: 'later' },
];

describe('omni now', () => {
  const repo = fixture();

  it('is in the command table, and runs without a context', () => {
    expect(COMMAND_TABLE.now?.withoutContext).toBe(true);
  });

  it('names on a slice branch the PRD, its stage building, and the slices in flight and stuck by id and name', async () => {
    repo.board(7, BOARD);
    const dir = repo.on('feat/bravo--s3');
    expect(await nowJson(dir, repo.root)).toEqual({
      headline: null,
      work: {
        kind: 'prd',
        number: 7,
        topic: 'bravo',
        stage: 'building',
        slices: [
          { id: 's3', name: 'tabs', state: 'in-flight' },
          { id: 's4', name: 'board', state: 'claimed-stale' },
          { id: 's5', name: null, state: 'stuck' },
        ],
        links: [],
      },
      doing: 'building s3 tabs, s4 board',
    });
    const plain = await now(dir);
    expect(plain).toMatchObject({ code: 0, err: '', out: 'PRD 7 bravo · building\nbuilding s3 tabs, s4 board · stuck s5\n' });
  });

  it('reads outbox once every slice of the board is merged', async () => {
    repo.board(7, BOARD.map((slice) => ({ ...slice, state: 'merged' })));
    const dir = repo.on('feat/bravo--s7');
    expect(await nowJson(dir, repo.root)).toMatchObject({ work: { number: 7, stage: 'outbox', slices: [] }, doing: null });
    expect((await now(dir)).out).toBe('PRD 7 bravo · outbox\n');
  });

  it('reads the stage PRD 324 gives when no rule of the board applies', async () => {
    expect(await nowJson(repo.on('feat/charlie'), repo.root)).toMatchObject({ work: { number: 9, stage: 'inbox', slices: [] }, doing: null });
    expect(await nowJson(repo.on('docs/phase-0-delta', 'origin/docs/phase-0-delta'), repo.root)).toMatchObject({ work: { number: 11, topic: 'delta', stage: 'in review' } });
  });

  it("names on the default branch the PRD of the session's record, of PRD 324's shape", async () => {
    repo.record('rec-1', { prd: 3, at: new Date(NOW).toISOString() });
    expect(await nowJson(repo.root, repo.root)).toEqual(NOTHING);
    expect(await nowJson(repo.root, repo.root, ['--session', 'rec-1'])).toMatchObject({ work: { kind: 'prd', number: 3, topic: 'alpha', stage: 'shipped' } });
    expect(await nowJson(repo.root, repo.root, [], { env: { CLAUDE_CODE_SESSION_ID: 'rec-1' } })).toMatchObject({ work: { number: 3 } });
    expect((await now(repo.root, ['--session', 'rec-1'])).out).toBe('PRD 3 alpha · shipped\n');
  });

  it('takes --session over the environment, and an unsafe or unknown session as none', async () => {
    repo.record('rec-2', { prd: 9, at: new Date(NOW).toISOString() });
    expect(await nowJson(repo.root, repo.root, ['--session', 'rec-2'], { env: { CLAUDE_CODE_SESSION_ID: 'rec-1' } })).toMatchObject({ work: { number: 9 } });
    expect(await nowJson(repo.root, repo.root, ['--session', '../rec-2'])).toEqual(NOTHING);
    expect(await nowJson(repo.root, repo.root, ['--session', 'nobody'])).toEqual(NOTHING);
    expect(await nowJson(repo.root, repo.root, ['--session'], { env: { CLAUDE_CODE_SESSION_ID: 'rec-2' } })).toMatchObject({ work: { number: 9 } });
    expect(await nowJson(repo.root, repo.root, ['--session', '--json'], { env: { CLAUDE_CODE_SESSION_ID: 'rec-2' } })).toMatchObject({ work: { number: 9 } });
  });

  it("reads the session's folder and id from Claude Code's JSON with --stdin", async () => {
    repo.record('rec-3', { prd: 9, at: new Date(NOW).toISOString() });
    const elsewhere = mkdtempSync(join(tmpdir(), 'omni-now-elsewhere-'));
    const stdin = JSON.stringify({ session_id: 'rec-3', cwd: elsewhere, workspace: { current_dir: repo.root } });
    expect(await nowJson(elsewhere, repo.root, ['--stdin'], { stdin })).toMatchObject({ work: { number: 9, topic: 'charlie' } });
    const slice = repo.on('feat/bravo--s8');
    expect(await nowJson(repo.root, repo.root, ['--stdin'], { stdin: JSON.stringify({ cwd: slice }) })).toMatchObject({ work: { number: 7 } });
    expect(await nowJson(repo.root, repo.root, ['--stdin'], { stdin: 'not json' })).toEqual(NOTHING);
  });

  it('prints the nothing answer with no PRD, in a repository with no config and outside any', async () => {
    expect(await nowJson(repo.on('feat/zulu'), repo.root)).toEqual(NOTHING);
    expect((await now(repo.root)).out).toBe(NO_PRD);
    const bare = makeRepo({ git: true });
    expect(await nowJson(bare.root, bare.root)).toEqual(NOTHING);
    const outside = mkdtempSync(join(tmpdir(), 'omni-now-outside-'));
    const run = await now(outside, ['--json']);
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(JSON.parse(run.out)).toEqual(NOTHING);
  });

  it('exits 0 with nothing on stderr when run as a program outside any repository', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'omni-now-program-'));
    const run = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      execFile(process.execPath, [CLI, 'now', '--json'], { cwd: outside, env: { PATH: process.env.PATH } }, (error, stdout, stderr) => {
        resolve({ code: error ? Number(error.code) : 0, stdout, stderr });
      });
    });
    const answer: unknown = JSON.parse(run.stdout);
    expect({ ...run, stdout: answer }).toEqual({ code: 0, stdout: NOTHING, stderr: '' });
  });

  it('prints its help entry', async () => {
    const run = await now(repo.root, []);
    expect(run.code).toBe(0);
    const out: string[] = [];
    expect(await main(['help', 'now'], { cwd: repo.root, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} }, env: {} })).toBe(0);
    expect(out.join('')).toMatch(/^omni now \[--json\]/);
  });
});

// PRD #1208, slice s2: a session on a bug fix or a visual fix — from its fix branch with no record,
// or from the record `omni bug <n>` and `omni visual <n>` leave; `in progress` until its folder is on
// the base, then `merged`.
describe('omni now — a fix', () => {
  const repo = fixture();
  const fix = (kind: string, number: number, topic: string, stage: string) => ({
    headline: null,
    work: { kind, number, topic, stage, slices: [], links: [] },
    doing: null,
  });

  /** `omni <argv>` through `main()` in `cwd`, for session `session`: its exit code. */
  async function omni(cwd: string, argv: string[], session: string) {
    return main(argv, { cwd, stdout: { write: () => true }, stderr: { write: () => true }, env: { CLAUDE_CODE_SESSION_ID: session } });
  }

  it('names on a fix branch the bug fix whose folder it holds, with no record', async () => {
    const dir = repo.on('fix/login-redirect', 'origin/fix/login-redirect');
    expect(await nowJson(dir, repo.root)).toEqual(fix('bug', 1180, 'login-redirect', 'in progress'));
    expect(await now(dir)).toMatchObject({ code: 0, err: '', out: 'bug #1180 login-redirect · in progress\n' });
  });

  it('names on a fix branch the visual fix whose folder it holds, merged once its folder is on the base', async () => {
    expect(await nowJson(repo.on('fix/tooltip', 'origin/fix/tooltip'), repo.root)).toEqual(fix('visual', 1160, 'tooltip', 'in progress'));
    const merged = repo.on('fix/sidebar');
    expect(await nowJson(merged, repo.root)).toEqual(fix('visual', 1150, 'sidebar', 'merged'));
    expect((await now(merged)).out).toBe('visual #1150 sidebar · merged\n');
  });

  it('reads a fix branch whose fix has no folder as no work', async () => {
    expect(await nowJson(repo.on('fix/nowhere'), repo.root)).toEqual(NOTHING);
  });

  it('names on the default branch the fix of the record `omni bug` and `omni visual` leave', async () => {
    await omni(repo.root, ['bug', '1170'], 'fix-1');
    expect(await nowJson(repo.root, repo.root, ['--session', 'fix-1'])).toEqual(fix('bug', 1170, 'crash', 'merged'));
    expect((await now(repo.root, ['--session', 'fix-1'])).out).toBe('bug #1170 crash · merged\n');
    await omni(repo.root, ['visual', '1150'], 'fix-1');
    expect(await nowJson(repo.root, repo.root, [], { env: { CLAUDE_CODE_SESSION_ID: 'fix-1' } })).toEqual(fix('visual', 1150, 'sidebar', 'merged'));
  });

  it('reads a record of a fix with no folder, or of the wrong kind for its folder, as no work', async () => {
    repo.record('fix-2', { kind: 'bug', number: 4242, at: new Date(NOW).toISOString() });
    expect(await nowJson(repo.root, repo.root, ['--session', 'fix-2'])).toEqual(NOTHING);
    repo.record('fix-3', { kind: 'visual', number: 1170, at: new Date(NOW).toISOString() });
    expect(await nowJson(repo.root, repo.root, ['--session', 'fix-3'])).toEqual(NOTHING);
  });

  it('reads a record of PRD 324\'s shape, and one of kind prd, as a PRD', async () => {
    repo.record('fix-4', { prd: 9, at: new Date(NOW).toISOString() });
    expect(await nowJson(repo.root, repo.root, ['--session', 'fix-4'])).toMatchObject({ work: { kind: 'prd', number: 9 } });
    repo.record('fix-5', { kind: 'prd', number: 9, at: new Date(NOW).toISOString() });
    expect(await nowJson(repo.root, repo.root, ['--session', 'fix-5'])).toMatchObject({ work: { kind: 'prd', number: 9 } });
  });

  it('takes the branch over the record: a PRD branch over a fix record, a fix branch over a PRD record', async () => {
    repo.record('fix-6', { kind: 'bug', number: 1170, at: new Date(NOW).toISOString() });
    expect(await nowJson(repo.on('feat/charlie'), repo.root, ['--session', 'fix-6'])).toMatchObject({ work: { kind: 'prd', number: 9 } });
    repo.record('fix-7', { kind: 'prd', number: 9, at: new Date(NOW).toISOString() });
    expect(await nowJson(repo.on('fix/crash'), repo.root, ['--session', 'fix-7'])).toEqual(fix('bug', 1170, 'crash', 'merged'));
  });
});

// PRD #1208, slice s3: a session driving a loop or a roadmap — the headline (the loop, or the roadmap
// it drives, with its PRDs merged over its rows) while the loop is live or sleeping, the PRD of its
// last tick as the work, and that tick as what it is doing; a roadmap record with no loop is a
// headline with no work.
describe('omni now — a loop or a roadmap', () => {
  const ROADMAP = [
    '---', 'roadmap: 12', 'title: Launch', 'milestone: It ships.', '---', '', '## PRDs', '',
    '| id | PRD | title | blocked by | why | wave |', '|---|---|---|---|---|---|',
    '| P1 | #3 | Alpha | – | – | 1 |', '| P2 | #7 | Bravo | P1 | – | 2 |', '| P3 | #9 | Charlie | – | – | 1 |', '| P4 | #15 | Echo | – | – | 3 |', '',
  ].join('\n');
  const repo = fixture({ [`${DELIVERY}/inbox/roadmaps/0012-launch/roadmap.md`]: ROADMAP });
  const iso = (ms: number) => new Date(ms).toISOString();
  const LAST = { step: 4, prd: 7, action: 'wave', result: 's3 merged', at: iso(NOW - 30_000) };
  const ROADMAP_12 = { kind: 'roadmap', number: 12, progress: '1/4 merged', links: [] };
  const LOOP = { kind: 'loop', links: [] };

  /** Keeps `fields` over a loop live since a minute ago, of PRD 1139's shape, as this checkout's loop. */
  const loop = (fields: Record<string, unknown>) => {
    const kept = { loopId: 'loop-1', repo: 'acme/widgets', prds: [7, 9], state: 'running', startedAt: iso(NOW - 60_000), seenAt: iso(NOW - 60_000), nextWakeAt: null, planVersion: 1, ...fields };
    mkdirSync(join(repo.root, LOOP_FILE, '..'), { recursive: true });
    writeFileSync(join(repo.root, LOOP_FILE), JSON.stringify(kept));
  };

  it("shows a live loop's roadmap as the headline, the PRD of its last tick as the work, and that tick as doing", async () => {
    repo.board(7, BOARD);
    loop({ roadmap: 12, last: LAST });
    expect(await nowJson(repo.root, repo.root)).toEqual({
      headline: ROADMAP_12,
      work: { kind: 'prd', number: 7, topic: 'bravo', stage: 'building', slices: [{ id: 's3', name: 'tabs', state: 'in-flight' }, { id: 's4', name: 'board', state: 'claimed-stale' }, { id: 's5', name: null, state: 'stuck' }], links: [] },
      doing: 'step 4: wave PRD 7 · s3 merged',
    });
    expect((await now(repo.root)).out).toBe('roadmap 12 · 1/4 merged\nPRD 7 bravo · building\nstep 4: wave PRD 7 · s3 merged · stuck s5\n');
  });

  it('shows a sleeping loop with no roadmap as the loop, over the PRD of its last tick', async () => {
    loop({ nextWakeAt: iso(NOW + 60_000), roadmap: null, last: { ...LAST, step: 2, prd: 9, action: 'yolo', result: 'ready' } });
    expect(await nowJson(repo.root, repo.root)).toMatchObject({ headline: LOOP, work: { kind: 'prd', number: 9, topic: 'charlie' }, doing: 'step 2: yolo PRD 9 · ready' });
    expect((await now(repo.root)).out).toBe('loop\nPRD 9 charlie · inbox\nstep 2: yolo PRD 9 · ready\n');
  });

  it('shows no headline for a parked, stopped or silent loop', async () => {
    for (const fields of [{ state: 'parked' }, { state: 'stopped' }, { nextWakeAt: iso(NOW - 10 * 60_000) }, { seenAt: iso(NOW - 2 * 60 * 60_000) }]) {
      loop({ roadmap: 12, last: LAST, ...fields });
      expect(await nowJson(repo.root, repo.root)).toEqual(NOTHING);
    }
  });

  it("reads a loop.json of PRD 1139's shape as no last step and no roadmap: the loop over the session's own work", async () => {
    loop({});
    expect(await nowJson(repo.root, repo.root)).toEqual({ headline: LOOP, work: null, doing: null });
    repo.record('loop-1', { prd: 9, at: iso(NOW) });
    expect(await nowJson(repo.root, repo.root, ['--session', 'loop-1'])).toMatchObject({ headline: LOOP, work: { number: 9 }, doing: null });
  });

  it('shows the loop alone when its roadmap has no folder, and no work when its last PRD has none', async () => {
    loop({ roadmap: 13, last: { ...LAST, prd: 42 } });
    expect(await nowJson(repo.root, repo.root)).toEqual({ headline: LOOP, work: null, doing: 'step 4: wave PRD 42 · s3 merged' });
  });

  it('shows a roadmap record with no running loop as the headline with no work', async () => {
    loop({ state: 'stopped' });
    repo.record('road-1', { kind: 'roadmap', number: 12, at: iso(NOW) });
    expect(await nowJson(repo.root, repo.root, ['--session', 'road-1'])).toEqual({ headline: ROADMAP_12, work: null, doing: null });
    expect((await now(repo.root, ['--session', 'road-1'])).out).toBe('roadmap 12 · 1/4 merged\n');
    repo.record('road-2', { kind: 'roadmap', number: 13, at: iso(NOW) });
    expect(await nowJson(repo.root, repo.root, ['--session', 'road-2'])).toEqual(NOTHING);
  });

  it('links a loop with no roadmap to its Loop page once ask.url is set (PRD 1208, s4)', async () => {
    const linked = fixture({ '.omni-loop/config.yml': 'kit: 1\nask:\n  url: https://omni.example/\n' });
    const kept = { loopId: 'loop-9', repo: 'acme/widgets', prds: [9], state: 'running', startedAt: iso(NOW - 60_000), seenAt: iso(NOW - 60_000), nextWakeAt: null, planVersion: 1, roadmap: null };
    mkdirSync(join(linked.root, LOOP_FILE, '..'), { recursive: true });
    writeFileSync(join(linked.root, LOOP_FILE), JSON.stringify(kept));
    expect(await nowJson(linked.root, linked.root)).toEqual({ headline: { kind: 'loop', links: [{ label: 'loop page', href: 'https://omni.example/app/loop/loop-9' }] }, work: null, doing: null });
  });

  it("lists a roadmap headline's page from the links file, missing or 10 minutes old as none (PRD 1208, s4)", async () => {
    loop({ state: 'stopped' });
    repo.record('road-4', { kind: 'roadmap', number: 12, at: iso(NOW) });
    const dir = join(repo.root, '.omni-loop/local/now');
    mkdirSync(dir, { recursive: true });
    const page = { label: 'roadmap page', href: 'https://omni.example/roadmaps/r-12' };
    writeFileSync(join(dir, 'links-roadmap-12.json'), JSON.stringify({ at: iso(NOW - 60_000), links: [page] }));
    expect(await nowJson(repo.root, repo.root, ['--session', 'road-4'])).toMatchObject({ headline: { ...ROADMAP_12, links: [page] } });
    writeFileSync(join(dir, 'links-roadmap-12.json'), JSON.stringify({ at: iso(NOW - 10 * 60_000), links: [page] }));
    expect(await nowJson(repo.root, repo.root, ['--session', 'road-4'])).toMatchObject({ headline: ROADMAP_12 });
    rmSync(dir, { recursive: true, force: true });
  });

  it('records the roadmap of `omni roadmap check <n>`, which `omni now` then shows', async () => {
    rmSync(join(repo.root, LOOP_FILE), { force: true });
    await main(['roadmap', 'check', '12'], { cwd: repo.root, stdout: { write: () => true }, stderr: { write: () => true }, env: { CLAUDE_CODE_SESSION_ID: 'road-3' } });
    expect(await nowJson(repo.root, repo.root, ['--session', 'road-3'])).toEqual({ headline: ROADMAP_12, work: null, doing: null });
  });
});
