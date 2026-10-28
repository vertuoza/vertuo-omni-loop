// A job's turnover at the wall (PRD 2537, s3): a recorded Claude limit, then a fake second agent that
// finishes, ends the job done with two parts, in the same worktree, with the runner's handoff note beside
// the log and the takeover message first; a crash never turns over; an account whose `takes` leaves out
// the skill never takes over; a fourth limit, or no account left, fails the job naming why; and no secret
// reaches the note or the parts. A fake `claude` on the PATH replays the recordings; no test calls a real
// agent, and none reads the real home.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountBook, accountsStateFile } from './accounts.ts';
import type { Account } from './accounts.ts';
import type { Agent } from './agents/agent.ts';
import { claudeAgent } from './agents/claude.ts';
import { runJobProcess } from './job.ts';
import {
  CAP_REASON, GUESSED_RESET_MS, handoffPath, MAX_ACCOUNT_CHANGES, noTokensReason, partsPath, readParts, runnerNote, takeoverLine, tokensSince,
} from './turnover.ts';
import type { Turnover } from './turnover.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'claude');
const recording = (name: string): string => join(FIXTURES, `${name}.jsonl`);
/** The reset the limit recording names: 2026-10-28 at 17:00 UTC. */
const RESET = '2026-10-28T17:00:00.000Z';
const NOW = Date.parse('2026-10-28T13:41:02.000Z');
// Built at run time, so no secret-shaped text sits in the source.
const SECRET = ['sk', 'ant', 'oat01', 'turnover', 'fixture'].join('-');

const claude = claudeAgent({ projects: join(tmpdir(), 'omni-turnover-no-projects') });
const direct = (id: string, extra: Partial<Account> = {}): Account => ({ id, agent: 'claude', instance: null, model: null, secret: null, budget: null, takes: null, ...extra });

/** A fake agent that records its worktree and its standard input, prints `printed`, and exits `exit`. */
function fakeAgent(root: string, name: string, { printed = 'all done', exit = 0 }: { printed?: string; exit?: number } = {}): Agent {
  return {
    ...claude,
    name,
    check: () => null,
    command: (job, _account, handoff) => ({
      file: 'sh',
      args: ['-c', `pwd > "${join(root, `${name}.cwd`)}"; cat > "${join(root, `${name}.stdin`)}"; echo "${printed}"; exit ${String(exit)}`],
      env: {},
      stdin: handoff === undefined ? `${job.line}\n` : `${job.line}\n\n${handoff}\n`,
    }),
    step: (line) => [line],
    usage: () => ({ tokens: { input: 10, output: 2, cacheRead: 0, cacheWrite: 0 }, model: `${name}-model` }),
    limit: () => null,
  };
}

/** A job in a git worktree, a fake `claude` replaying `first` on the PATH, and the accounts it may turn over to. */
function job({ first = 'limit', firstExit = 1, accounts, agents = {}, line = '/omni:yolo 7', secret = null }: {
  first?: string; firstExit?: number; accounts: Account[]; agents?: Record<string, Agent>; line?: string; secret?: string | null;
}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-turnover-'));
  const bin = join(root, 'bin');
  const cwd = join(root, 'wt');
  const logs = join(root, 'logs');
  for (const dir of [bin, cwd, logs]) mkdirSync(dir);
  writeFileSync(join(bin, 'claude'), ['#!/bin/sh', 'cat > /dev/null', `cat "${recording(first)}"`, ...(secret === null ? [] : [`echo "token ${secret}"`]), `exit ${String(firstExit)}`, ''].join('\n'));
  chmodSync(join(bin, 'claude'), 0o755);
  const git = (args: readonly string[]): string => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q', '-b', 'main']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-q', '--allow-empty', '-m', 'start']);
  const files = { line: join(logs, 'job-7.line'), log: join(logs, 'job-7.log'), exit: join(logs, 'job-7.exit') };
  writeFileSync(files.line, `${line}\n`);
  writeFileSync(files.log, '');
  const book = accountBook({ file: accountsStateFile(root), now: () => NOW });
  const secretFile = join(root, 'secret');
  writeFileSync(secretFile, `${SECRET}\n`);
  const turnover: Turnover = {
    accounts,
    book,
    agentOf: (account) => agents[account.id] ?? { ...claude, check: () => null },
    seenAs: (account) => ({ id: account.id, model: account.model, secret: account.secret === null ? null : readFileSync(secretFile, 'utf8').trim() }),
    git: (dir, args) => {
      try {
        return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch {
        return null;
      }
    },
    now: () => NOW,
  };
  let pane = '';
  const out = { write: (chunk: string) => (pane += chunk) };
  const run = () => runJobProcess({ cwd, files, out, env: { PATH: `${bin}:${String(process.env.PATH)}` }, agent: claude, account: { id: accounts[0]?.id ?? 'claude', model: null, secret: null }, turnover });
  return { root, cwd, files, book, run, pane: () => pane };
}

describe('turnover at the wall', () => {
  it('carries the job on the next account in the same worktree, done with two parts, the note beside the log (acceptance 2)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-turnover-agents-'));
    const f = job({ accounts: [direct('claude-1'), direct('codex-1')], agents: { 'codex-1': fakeAgent(root, 'codex') } });
    expect(await f.run()).toBe(0);
    expect(readFileSync(f.files.exit, 'utf8')).toBe('0\n');

    const record = readParts(partsPath(f.files.log));
    expect(record?.reason).toBeNull();
    expect(record?.parts).toEqual([
      { agent: 'claude', model: null, account: 'claude-1', from: new Date(NOW).toISOString(), to: new Date(NOW).toISOString(), ended: 'limit', resetsAt: RESET, guessed: false, note: 'runner' },
      { agent: 'codex', model: 'codex-model', account: 'codex-1', from: new Date(NOW).toISOString(), to: new Date(NOW).toISOString(), ended: 'done', tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
    ]);
    expect(f.book.stateOf('claude-1')).toEqual({ state: 'out', resetsAt: RESET });

    // The same worktree, the job line first, then the takeover message, then the note.
    expect(readFileSync(join(root, 'codex.cwd'), 'utf8').trim()).toBe(execFileSync('sh', ['-c', 'pwd -P'], { cwd: f.cwd, encoding: 'utf8' }).trim());
    const stdin = readFileSync(join(root, 'codex.stdin'), 'utf8');
    expect(stdin.startsWith('/omni:yolo 7\n\nYou are taking over this job from claude because it reached its usage limit. Here is where it stopped:\n\n# Handoff note, written by the runner')).toBe(true);

    // The note beside the job's log, never in the worktree.
    const note = readFileSync(handoffPath(f.files.log), 'utf8');
    expect(handoffPath(f.files.log)).toBe(join(f.root, 'logs', 'job-7.handoff.md'));
    expect(stdin).toContain(note);
    expect(note).toContain('## The job\n\n/omni:yolo 7');
    expect(note).toContain('## git worktree list');
    expect(readdirSync(f.cwd).filter((name) => name !== '.git')).toEqual([]);

    const log = readFileSync(f.files.log, 'utf8');
    expect(log).toContain(`↻ account claude-1 reached its usage limit, out until ${RESET}: account codex-1 takes over`);
    expect(log).toContain('all done');
    expect(f.pane()).toContain('takes over');
  });

  it('guesses an hour when the agent gives no reset, and says so', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-turnover-agents-'));
    const f = job({ first: 'limit-no-reset', accounts: [direct('claude-1'), direct('codex-1')], agents: { 'codex-1': fakeAgent(root, 'codex') } });
    expect(await f.run()).toBe(0);
    const guessed = new Date(NOW + GUESSED_RESET_MS).toISOString();
    expect(readParts(partsPath(f.files.log))?.parts[0]).toMatchObject({ ended: 'limit', resetsAt: guessed, guessed: true });
    expect(readFileSync(f.files.log, 'utf8')).toContain(`out until ${guessed} (guessed)`);
  });

  it('fails the job on a crash and starts no other account (acceptance 6)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-turnover-agents-'));
    const f = job({ first: 'crash', accounts: [direct('claude-1'), direct('codex-1')], agents: { 'codex-1': fakeAgent(root, 'codex') } });
    expect(await f.run()).toBe(1);
    expect(existsSync(join(root, 'codex.stdin'))).toBe(false);
    expect(existsSync(handoffPath(f.files.log))).toBe(false);
    const record = readParts(partsPath(f.files.log));
    expect(record?.parts.map((part) => [part.account, part.ended])).toEqual([['claude-1', 'failed']]);
    expect(record?.reason).toBeNull();
    expect(f.book.stateOf('claude-1').state).toBe('ready');
  });

  it("never turns over to an account whose takes leaves out the job's skill (acceptance 5)", async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-turnover-agents-'));
    const f = job({ accounts: [direct('claude-1'), direct('open-1', { takes: ['plan', 'pr-care'] }), direct('codex-1')], agents: { 'open-1': fakeAgent(root, 'open'), 'codex-1': fakeAgent(root, 'codex') } });
    expect(await f.run()).toBe(0);
    expect(existsSync(join(root, 'open.stdin'))).toBe(false);
    expect(readParts(partsPath(f.files.log))?.parts.map((part) => part.account)).toEqual(['claude-1', 'codex-1']);
  });

  it('fails the job when no account is left: every account is out until the earliest reset', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-turnover-agents-'));
    const f = job({ accounts: [direct('claude-1'), direct('open-1', { takes: ['plan'] })], agents: { 'open-1': fakeAgent(root, 'open') } });
    f.book.markOut('later', '2026-10-29T09:00:00.000Z');
    expect(await f.run()).toBe(1);
    const record = readParts(partsPath(f.files.log));
    expect(record?.reason).toBe(`no tokens left: every account is out until ${RESET}`);
    expect(record?.parts).toHaveLength(1);
    expect(readFileSync(f.files.log, 'utf8')).toContain(`↻ account claude-1 reached its usage limit: no tokens left: every account is out until ${RESET}`);
  });

  it(`fails the job on its ${String(MAX_ACCOUNT_CHANGES + 1)}th limit, naming the cap`, async () => {
    const accounts = ['a', 'b', 'c', 'd', 'e'].map((id) => direct(id));
    const f = job({ accounts });
    expect(await f.run()).toBe(1);
    const record = readParts(partsPath(f.files.log));
    expect(record?.parts.map((part) => [part.account, part.ended])).toEqual([['a', 'limit'], ['b', 'limit'], ['c', 'limit'], ['d', 'limit']]);
    expect(record?.reason).toBe(CAP_REASON);
    expect(CAP_REASON.startsWith('no tokens left: ')).toBe(true);
    expect(f.book.stateOf('e').state).toBe('ready');
  });

  it('runs one part and turns over nothing without the accounts (acceptance 1)', async () => {
    const f = job({ first: 'done', firstExit: 0, accounts: [direct('claude')] });
    const { files } = f;
    expect(await runJobProcess({ cwd: f.cwd, files, out: { write: () => true }, env: { PATH: `${join(f.root, 'bin')}:${String(process.env.PATH)}` }, agent: claude })).toBe(0);
    const record = readParts(partsPath(files.log));
    expect(record?.parts.map((part) => [part.agent, part.account, part.ended])).toEqual([['claude', 'claude', 'done']]);
  });

  it('keeps every secret out of the note and the parts (acceptance 8)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-turnover-agents-'));
    const f = job({ accounts: [direct('claude-1', { secret: '/s' }), direct('codex-1')], agents: { 'codex-1': fakeAgent(root, 'codex') }, secret: SECRET });
    expect(await f.run()).toBe(0);
    expect(readFileSync(handoffPath(f.files.log), 'utf8')).not.toContain(SECRET);
    expect(readFileSync(handoffPath(f.files.log), 'utf8')).toContain('token ***');
    expect(readFileSync(partsPath(f.files.log), 'utf8')).not.toContain(SECRET);
    expect(readFileSync(join(root, 'codex.stdin'), 'utf8')).not.toContain(SECRET);
  });
});

describe('the pieces of a turnover', () => {
  it('opens the next run with who it takes over from and why', () => {
    expect(takeoverLine({ agent: 'claude', model: 'claude-opus-5-5', why: 'it reached its usage limit' })).toBe('You are taking over this job from claude (claude-opus-5-5) because it reached its usage limit. Here is where it stopped:');
  });

  it('names the earliest reset, whatever the order', () => {
    expect(noTokensReason(['2026-10-28T18:00:00.000Z', '2026-10-28T17:00:00.000Z'])).toBe('no tokens left: every account is out until 2026-10-28T17:00:00.000Z');
    expect(noTokensReason([])).toBe('no tokens left: no account can take this job over');
  });

  it('counts the tokens a part spent from two reads, never below zero', () => {
    expect(tokensSince({ input: 10, output: 5, cacheRead: 3, cacheWrite: 1 }, { input: 4, output: 5, cacheRead: 9, cacheWrite: 0 })).toEqual({ input: 6, output: 0, cacheRead: 0, cacheWrite: 1 });
    expect(tokensSince({ input: 1, output: 1, cacheRead: 1, cacheWrite: 1 }, null)).toEqual({ input: 1, output: 1, cacheRead: 1, cacheWrite: 1 });
    expect(tokensSince(null, { input: 1, output: 1, cacheRead: 1, cacheWrite: 1 })).toBeNull();
  });

  it("writes the runner's note from the log's last 40 lines, git and the pull requests the log named", () => {
    const log = [...Array.from({ length: 45 }, (_, i) => `step ${String(i + 1)}`), 'PR: https://github.com/acme/widgets/pull/42', 'again https://github.com/acme/widgets/pull/42'].join('\n');
    const asked: string[] = [];
    const note = runnerNote({ line: '/omni:yolo 7', log, start: 'abc123', git: (args) => { asked.push(args.join(' ')); return args[0] === 'status' ? null : `${args[0] ?? ''} out\n`; } });
    expect(note).toContain('step 8\n');
    expect(note).not.toContain('step 7\n');
    expect(note).toContain('## git status --short\n\n(could not be read)');
    expect(asked).toContain('log --oneline abc123..HEAD');
    expect(note.match(/pull\/42/g)).toHaveLength(3);
    expect(note).toContain('## Pull requests the log named\n\nhttps://github.com/acme/widgets/pull/42\n');
  });

  it('reads no parts from a file that is missing or out of shape', () => {
    const dir = mkdtempSync(join(tmpdir(), 'omni-parts-'));
    expect(readParts(join(dir, 'none.parts.json'))).toBeNull();
    writeFileSync(join(dir, 'bad.parts.json'), '{"parts":[{"agent":""}],"reason":null}');
    expect(readParts(join(dir, 'bad.parts.json'))).toBeNull();
    expect(partsPath('/home/ada/logs/job-7.log')).toBe('/home/ada/logs/job-7.parts.json');
  });
});
