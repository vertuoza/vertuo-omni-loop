// PRD #1208, slice s1: `omni now [--json]` through `main()` — what this session is on: the PRD of
// its branch, else of its record (PRD 324's shape), its stage (`building` while a slice is not
// merged), and the slices in flight and stuck by id and name from the cached board. Every case exits
// 0, prints nothing on stderr, writes no file and never runs `gh` or `git fetch`.
import { execFile, execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePrd } from '../lib/ids.ts';
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
 * A clone whose default branch holds the shipped folder `0003-alpha` and the inbox folders
 * `0007-bravo` and `0009-charlie`, and a phase-0 branch for `0011-delta`. `on(branch, start)` checks
 * `branch` out in a worktree of its own; `board(prd, slices)` writes a cached board a few seconds old;
 * `record(session, body)` writes a session's record.
 */
function fixture() {
  const seed = makeRepo({ git: true, files: CONFIG });
  commit(seed.root, {
    [`${DELIVERY}/shipped/0003-alpha/spec.md`]: '# alpha\n',
    [`${DELIVERY}/inbox/0007-bravo/spec.md`]: '# bravo\n',
    [`${DELIVERY}/inbox/0009-charlie/spec.md`]: '# charlie\n',
  });
  git(seed.root, 'checkout', '-q', '-b', 'docs/phase-0-delta');
  commit(seed.root, { [`${DELIVERY}/inbox/0011-delta/spec.md`]: '# delta\n' });
  git(seed.root, 'checkout', '-q', 'main');
  const bare = mkdtempSync(join(tmpdir(), 'omni-now-origin-'));
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  git(seed.root, 'remote', 'add', 'origin', bare);
  git(seed.root, 'push', '-q', 'origin', 'main', 'docs/phase-0-delta');
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
  return JSON.parse(run.out);
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
    expect({ ...run, stdout: JSON.parse(run.stdout) }).toEqual({ code: 0, stdout: NOTHING, stderr: '' });
  });

  it('prints its help entry', async () => {
    const run = await now(repo.root, []);
    expect(run.code).toBe(0);
    const out: string[] = [];
    expect(await main(['help', 'now'], { cwd: repo.root, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} }, env: {} })).toBe(0);
    expect(out.join('')).toMatch(/^omni now \[--json\]/);
  });
});
