// The `t3` adapter (PRD 2537, s4), against T3 0.1.3's outputs in `../fixtures/t3/` and a fixture T3 home:
// its check (T3 installed and running, the instance known and signed in), the run it starts (`omni
// runner t3-run` in the job's worktree, the job's line as it is for a Claude instance and as words for
// another), its readable lines, its tokens and context from the Claude instance's own transcripts, the
// usage limit and its reset, a run waiting for an answer, the session and its resume, and the stop
// that only a runner signed in to T3 has. A job runs through it end to end with a fake `t3` and a fake
// `omni` on the PATH. No test calls the real T3.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExecText } from '../../context.ts';
import { accountBook, chooseAccount } from '../accounts.ts';
import type { Account } from '../accounts.ts';
import { rawLogPath, runJobProcess } from '../job.ts';
import { projectFolder } from '../tokens.ts';
import type { AgentAccount, Run } from './agent.ts';
import { t3Agent } from './t3.ts';
import type { T3Deps } from './t3.ts';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures', 't3');
const T3_HOME = join(FIXTURES, 'home');
const THREAD = 'mcp:fabd03d6-4537-4cfb-9d39-cc065784f406';
const CWD = '/home/runner/wt/widgets-job-7';
const OMNI = ['/usr/bin/node', '/opt/omni/omni.mjs'];
const AT = new Date(2026, 9, 27, 14, 2, 16);

const ACCOUNTS: Readonly<Record<string, string>> = { 'claude-1': 'claude-b', 'codex-1': 'codex-1', 'open-1': 'opencode', ghost: 'claude-9', off: 'claude-off' };
const instanceOf = (id: string): string | null => (Object.hasOwn(ACCOUNTS, id) ? (ACCOUNTS[id] ?? null) : null);
const installed: ExecText = () => '0.1.3\n';
const account = (id: string, model: string | null = 'claude-opus-5-5'): AgentAccount => ({ id, model, secret: null });

function agentWith(deps: T3Deps = {}) {
  return t3Agent({ home: '/home/runner', t3Home: T3_HOME, exec: installed, omni: OMNI, alive: (pid) => pid === 4242, instanceOf, ...deps });
}

const line = (value: object): string => JSON.stringify(value);
const fixtureLine = (name: string): string => readFileSync(join(FIXTURES, `${name}.json`), 'utf8').trim();
const threadLine = (instance = 'claude-b', model = 'claude-opus-5-5'): string => line({ type: 't3.thread', threadId: THREAD, instance, model });
function endLine(wait: string, ms = 185_000): string {
  const end: unknown = JSON.parse(fixtureLine(wait));
  return line({ type: 't3.end', ...(typeof end === 'object' ? end : {}), at: '2026-10-27T13:30:00.000Z', ms });
}
const transcript = (): string[] => readFileSync(join(FIXTURES, 'transcript.jsonl'), 'utf8').trim().split('\n');
const runOf = (lines: string[], exit: number | null): Run => ({ cwd: CWD, lines, exit });

describe('the t3 adapter: check', () => {
  it('lets an account run when T3 is installed and running, and its instance is known and signed in', () => {
    expect(agentWith().check(account('claude-1'))).toBeNull();
    expect(agentWith().name).toBe('t3');
  });

  it('says T3 not running when no server runs, and T3 is not installed when t3 does not run', () => {
    expect(agentWith({ alive: () => false }).check(account('claude-1'))).toBe('T3 not running');
    const missing: ExecText = () => {
      throw new Error('spawn t3 ENOENT');
    };
    expect(agentWith({ exec: missing }).check(account('claude-1'))).toBe('T3 is not installed');
  });

  it('says no such instance for an instance T3 does not know, a disabled one, or an account that names none', () => {
    expect(agentWith().check(account('ghost'))).toBe('no such instance');
    expect(agentWith().check(account('off'))).toBe('no such instance');
    expect(agentWith().check(account('claude-direct'))).toBe('no such instance');
  });

  it('says not signed in for an instance whose sign-in T3 does not hold', () => {
    expect(agentWith().check(account('codex-1', 'gpt-5-codex'))).toBe('not signed in');
  });

  it('wants the model the account runs: T3 takes an instance and a model together', () => {
    expect(agentWith().check(account('claude-1', null))).toBe('no model: a T3 account names the model it runs');
  });

  it('lets a job start on the next account, a direct Claude one included, while T3 is not running (acceptance 11)', () => {
    const accounts: Account[] = [
      { id: 'claude-1', agent: 't3', instance: 'claude-b', model: 'claude-opus-5-5', secret: null, budget: null, takes: null },
      { id: 'claude-direct', agent: 'claude', instance: null, model: null, secret: null, budget: null, takes: null },
    ];
    const book = accountBook({ file: join(mkdtempSync(join(tmpdir(), 'omni-t3-book-')), 'accounts-state.json') });
    const down = agentWith({ alive: () => false });
    const unusable = (candidate: Account): string | null => (candidate.agent === 't3' ? down.check(account(candidate.id, candidate.model)) : null);
    expect(chooseAccount({ accounts, book, skill: 'yolo', unusable })).toEqual({ account: accounts[1] });
    expect(chooseAccount({ accounts: accounts.slice(0, 1), book, skill: 'yolo', unusable })).toEqual({ none: 'no account can take this job: claude-1 is unusable: T3 not running' });
  });
});

describe('the t3 adapter: command and resume', () => {
  it("starts omni's T3 run in the job's worktree, the job's line as it is on a Claude instance", () => {
    expect(agentWith().command({ line: '/omni:yolo 7', cwd: CWD }, account('claude-1'))).toEqual({
      file: '/usr/bin/node',
      args: ['/opt/omni/omni.mjs', 'runner', 't3-run', '--instance', 'claude-b', '--model', 'claude-opus-5-5'],
      env: {},
      stdin: '/omni:yolo 7\n',
    });
  });

  it('gives a Codex or OpenCode instance the line as words, with the takeover message after it', () => {
    const agent = agentWith();
    expect(agent.command({ line: '/omni:yolo 7', cwd: CWD }, account('codex-1', 'gpt-5-codex')).stdin).toBe('Use the omni-yolo skill with these arguments: 7\n');
    expect(agent.command({ line: '/omni:pr-care', cwd: CWD }, account('open-1', 'mistral/devstral-medium-latest')).stdin).toBe('Use the omni-pr-care skill.\n');
    expect(agent.command({ line: '/validate-prd 347', cwd: CWD }, account('open-1', 'm')).stdin).toBe('Use the validate-prd skill with these arguments: 347\n');
    const handoff = 'You are taking over this job from claude (Opus 5.5) because it reached its usage limit. Here is where it stopped:\n\nAll green.';
    expect(agent.command({ line: '/omni:yolo 7', cwd: CWD }, account('open-1', 'm'), handoff).stdin).toBe(`Use the omni-yolo skill with these arguments: 7\n\n${handoff}\n`);
  });

  it('resumes the thread with one more message', () => {
    expect(agentWith().resume({ line: '/omni:yolo 7', cwd: CWD }, account('claude-1'), THREAD, 'Write the handoff note.')).toEqual({
      file: '/usr/bin/node',
      args: ['/opt/omni/omni.mjs', 'runner', 't3-run', '--instance', 'claude-b', '--model', 'claude-opus-5-5', '--thread', THREAD],
      env: {},
      stdin: 'Write the handoff note.\n',
    });
  });
});

describe('the t3 adapter: step', () => {
  const agent = agentWith();
  const steps = (lines: string[]): string[] => {
    const context = { now: AT, seen: new Set<string>() };
    return lines.flatMap((each) => agent.step(each, context));
  };

  it("names the thread, then gives the Claude instance's transcript lines as steps.ts reads them", () => {
    expect(steps([threadLine(), ...transcript()])).toEqual([
      '14:02:16 T3: thread mcp:fabd03d6-4537-4cfb-9d39-cc065784f406 on claude-b (claude-opus-5-5)',
      '14:02:16 Bash: pnpm test',
      '14:02:16 › All green. Opening the feature PR next.',
    ]);
  });

  it("gives each new message thread show printed, and nothing for a state alone", () => {
    expect(steps([
      line({ type: 't3.show', status: 'running', activeRunId: 'r', pendingRequestCount: 0, itemCount: 4, messages: [] }),
      line({ type: 't3.show', status: 'running', activeRunId: 'r', pendingRequestCount: 0, itemCount: 9, messages: ['Edited notes/fruits.md.\nTwelve lines.'] }),
    ])).toEqual(['14:02:16 › Edited notes/fruits.md.']);
  });

  it("ends a completed run on a Done line, the hand-off after it, and the pull request it names", () => {
    expect(steps([endLine('wait-done')])).toEqual([
      '14:02:16 Done: ok · T3 completed · 3 min',
      '14:02:16 PRD 7 shipped: the feature PR is ready.',
      '14:02:16 https://github.com/acme/widgets/pull/42',
      '14:02:16 PR: https://github.com/acme/widgets/pull/42',
    ]);
  });

  it('ends a failed run on its error, and a run waiting for an answer naming it', () => {
    expect(steps([endLine('wait-failed', 4000)])).toEqual(['14:02:16 Done: error · T3 failed · under a minute', '14:02:16 ✗ Claude could not start the turn.']);
    expect(steps([endLine('wait-waiting')])).toEqual(['14:02:16 Done: error · T3 waiting · 3 min', '14:02:16 ✗ waiting for an answer in T3: a runner job cannot give one, so the job fails']);
  });

  it("says what came of a stop, and passes T3's own words and a line that does not parse as they are", () => {
    expect(steps([line({ type: 't3.interrupt', threadId: THREAD, status: 'interrupt_requested' })])).toEqual(['14:02:16 T3: stop asked (interrupt_requested)']);
    expect(steps([line({ type: 't3.interrupt', threadId: THREAD, refused: 'T3 cannot be reached at http://127.0.0.1:3799' })])).toEqual(['14:02:16 ✗ T3 could not stop the run: T3 cannot be reached at http://127.0.0.1:3799']);
    expect(steps(['No running T3 Code server uses /home/runner/.t3. Start T3 Code, then retry.', '{"type":"t3.end"'])).toEqual(['No running T3 Code server uses /home/runner/.t3. Start T3 Code, then retry.', '{"type":"t3.end"']);
  });
});

describe('the t3 adapter: limit', () => {
  const agent = agentWith();

  it("reads T3's usage limit on a Claude instance, its reset counted from the run's end", () => {
    expect(agent.limit(runOf([threadLine(), endLine('wait-limit')], 1))).toEqual({ resetsAt: '2026-10-27T16:00:00.000Z' });
  });

  it("reads Codex's limit in days and hours, and a limit with no reset time", () => {
    expect(agent.limit(runOf([endLine('wait-limit-codex')], 1))).toEqual({ resetsAt: '2026-10-28T16:30:00.000Z' });
    expect(agent.limit(runOf([endLine('wait-limit-no-reset')], 1))).toEqual({ resetsAt: null });
  });

  it('is no limit for a crash, a run waiting for an answer, a completed run, a run still going, or output that does not parse', () => {
    expect(agent.limit(runOf([endLine('wait-failed')], 1))).toBeNull();
    expect(agent.limit(runOf([endLine('wait-waiting')], 2))).toBeNull();
    expect(agent.limit(runOf([endLine('wait-done')], 0))).toBeNull();
    expect(agent.limit(runOf([endLine('wait-limit')], null))).toBeNull();
    expect(agent.limit(runOf(['No running T3 Code server uses /home/runner/.t3.', '{not json'], 1))).toBeNull();
  });
});

describe('the t3 adapter: tokens and context', () => {
  /** A Claude folder for the instance `claude-b`, its transcript for the worktree written. */
  function instanceHome() {
    const home = mkdtempSync(join(tmpdir(), 'omni-t3-person-'));
    const folder = join(home, '.claude-b', 'projects', projectFolder(CWD));
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'session.jsonl'), `${transcript().join('\n')}\n`);
    return home;
  }

  it("counts the run's tokens from the Claude instance's own transcripts for the worktree, and names its model", () => {
    const agent = agentWith({ home: instanceHome() });
    expect(agent.usage(runOf([threadLine(), ...transcript()], 0))).toEqual({
      tokens: { input: 2100, output: 920, cacheRead: 190_000, cacheWrite: 5000 },
      model: 'claude-opus-5-5',
    });
  });

  it('counts none for an instance that keeps no Claude transcripts, or a run that named no thread', () => {
    const agent = agentWith({ home: instanceHome() });
    expect(agent.usage(runOf([threadLine('codex-1', 'gpt-5-codex')], 0))).toBeNull();
    expect(agent.usage(runOf([], 0))).toBeNull();
  });

  it("reads the context from the last assistant message's tokens against the model's window, and no usage percent", () => {
    const agent = agentWith();
    expect(agent.pressure(runOf([threadLine(), ...transcript()], null))).toEqual({ usage: null, context: { used: 154_000, window: 200_000 } });
    expect(agent.pressure(runOf([threadLine('claude-b', 'claude-opus-5-5[1m]'), ...transcript()], null)).context).toEqual({ used: 154_000, window: 1_000_000 });
    expect(agent.pressure(runOf([threadLine()], null))).toEqual({ usage: null, context: null });
  });
});

describe('the t3 adapter: session and stop', () => {
  it('names the thread as its session', () => {
    const agent = agentWith();
    expect(agent.session(runOf([threadLine()], null))).toBe(THREAD);
    expect(agent.session(runOf([endLine('wait-done')], 0))).toBe(THREAD);
    expect(agent.session(runOf(['plain'], 1))).toBeNull();
  });

  it('stops a run by SIGINT, which the T3 run turns into a stop through T3, only once the runner is signed in to T3', () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-t3-person-'));
    const agent = agentWith({ home, now: () => Date.parse('2026-10-27T14:00:00.000Z') });
    expect(agent.interrupt(runOf([threadLine()], null))).toBeNull();
    mkdirSync(join(home, '.config', 'omni'), { recursive: true });
    writeFileSync(join(home, '.config', 'omni', 't3-mcp.json'), JSON.stringify({ origin: 'http://127.0.0.1:3799', token: 'tok', expiresAt: '2026-11-26T14:00:00.000Z' }));
    expect(agent.interrupt(runOf([threadLine()], null))).toEqual({ kind: 'signal', first: 'SIGINT', then: 'SIGTERM', afterMs: 30_000 });
  });
});

describe('the t3 adapter: a job runs through it', () => {
  it("runs the job's line as a T3 thread in its worktree, its readable lines in the log and its raw lines beside it", async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-t3-job-'));
    const bin = join(root, 'bin');
    const cwd = join(root, 'wt');
    mkdirSync(bin);
    mkdirSync(cwd);
    writeFileSync(join(bin, 'omni'), ['#!/bin/sh', `printf '%s\\n' "$@" > "${join(root, 'args')}"`, `cat > "${join(root, 'stdin')}"`, `printf '%s\\n' '${threadLine()}'`, `cat "${join(FIXTURES, 'transcript.jsonl')}"`, `printf '%s\\n' '${endLine('wait-done')}'`, ''].join('\n'));
    chmodSync(join(bin, 'omni'), 0o755);
    const files = { line: join(root, 'job-7.line'), log: join(root, 'job-7.log'), exit: join(root, 'job-7.exit') };
    writeFileSync(files.line, '/omni:yolo 7\n');
    writeFileSync(files.log, '');
    let pane = '';
    const agent = agentWith({ omni: ['omni'] });
    const code = await runJobProcess({ cwd, files, out: { write: (chunk: string) => (pane += chunk) }, env: { PATH: `${bin}:${String(process.env.PATH)}` }, agent, account: account('claude-1') });
    expect(code).toBe(0);
    expect(readFileSync(join(root, 'args'), 'utf8').trim().split('\n')).toEqual(['runner', 't3-run', '--instance', 'claude-b', '--model', 'claude-opus-5-5']);
    expect(readFileSync(join(root, 'stdin'), 'utf8')).toBe('/omni:yolo 7\n');
    const log = readFileSync(files.log, 'utf8').split('\n').map((each) => each.replace(/^\d\d:\d\d:\d\d /, ''));
    expect(log).toEqual(expect.arrayContaining(['T3: thread mcp:fabd03d6-4537-4cfb-9d39-cc065784f406 on claude-b (claude-opus-5-5)', 'Bash: pnpm test', 'Done: ok · T3 completed · 3 min', 'PR: https://github.com/acme/widgets/pull/42']));
    expect(pane).toContain('Bash: pnpm test');
    expect(readFileSync(rawLogPath(files.log), 'utf8')).toContain('"type":"t3.end"');
    const raw = readFileSync(rawLogPath(files.log), 'utf8').trim().split('\n');
    expect(agent.session({ cwd, lines: raw, exit: 0 })).toBe(THREAD);
    expect(agent.limit({ cwd, lines: raw, exit: 0 })).toBeNull();
  });
});
