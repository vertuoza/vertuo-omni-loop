// The direct Claude adapter (PRD 2537, s1), against recordings of `claude -p --output-format
// stream-json --verbose` in `../fixtures/claude/`: what a job runs, its readable lines, its tokens, the
// usage limit and its reset, the pressure on the account and the context, the session and its resume.
// A fake `claude` on the PATH replays a recording through the job's process, which must print what it
// printed before the adapter existed. No test calls the real CLI.
//
// The recordings follow the stream-json events of Claude Code 2.1: `system`/`init` (the session and the
// model), `rate_limit_event` (`rate_limit_info`: `status` allowed, allowed_warning or rejected,
// `resetsAt` in epoch seconds, `rateLimitType`, `utilization` when given), the assistant's messages with
// their `usage`, and the `result`. At the limit, Claude says so in a synthetic assistant message
// (`"error": "rate_limit"`) and in an `is_error` result, then exits 1.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExecText } from '../../context.ts';
import { rawLogPath, runJobProcess } from '../job.ts';
import { stepLine } from '../steps.ts';
import { projectFolder, tokenSource } from '../tokens.ts';
import type { AgentAccount, Run } from './agent.ts';
import { claudeAgent } from './claude.ts';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures', 'claude');
const recording = (name: string): string => join(FIXTURES, `${name}.jsonl`);
const linesOf = (name: string): string[] => readFileSync(recording(name), 'utf8').split('\n').filter((line) => line !== '');
const runOf = (name: string, exit: number | null, cwd = '/home/runner/wt/widgets-job-7'): Run => ({ cwd, lines: linesOf(name), exit });

const ACCOUNT: AgentAccount = { id: 'claude', model: null, secret: null };
const ARGS = ['--dangerously-skip-permissions', '-p', '--output-format', 'stream-json', '--verbose'];
/** The reset every recording names: 2026-10-28 at 17:00 UTC. */
const RESET = '2026-10-28T17:00:00.000Z';

const agent = claudeAgent({ projects: join(tmpdir(), 'omni-claude-no-projects') });

describe('the claude adapter: command', () => {
  it('runs claude unattended with stream-json, the job line on its standard input, and adds no variable', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'omni-claude-'));
    expect(agent.command({ line: '/omni:yolo 7', cwd }, ACCOUNT)).toEqual({ file: 'claude', args: ARGS, env: {}, stdin: '/omni:yolo 7\n' });
  });

  it("runs the account's model and gives its secret to that run only", () => {
    const cwd = mkdtempSync(join(tmpdir(), 'omni-claude-'));
    const command = agent.command({ line: '/omni:yolo 7', cwd }, { id: 'claude-direct', model: 'claude-opus-5-5', secret: 'sk-ant-oat01-fixture' });
    expect(command.args).toEqual([...ARGS, '--model', 'claude-opus-5-5']);
    expect(command.env).toEqual({ CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-fixture' });
    expect(command.stdin).not.toContain('sk-ant');
  });

  it("loads the repository's MCP servers for a repository's own skill only (PRD 2313)", () => {
    const cwd = mkdtempSync(join(tmpdir(), 'omni-claude-'));
    writeFileSync(join(cwd, '.mcp.json'), '{"mcpServers":{}}\n');
    expect(agent.command({ line: '/validate-prd 347', cwd }, ACCOUNT).args).toEqual([...ARGS, '--mcp-config', '.mcp.json']);
    expect(agent.command({ line: '/omni:yolo 7', cwd }, ACCOUNT).args).toEqual(ARGS);
    const bare = mkdtempSync(join(tmpdir(), 'omni-claude-'));
    expect(agent.command({ line: '/validate-prd 347', cwd: bare }, ACCOUNT).args).toEqual(ARGS);
  });

  it('sends a takeover message after the job line', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'omni-claude-'));
    const handoff = 'You are taking over this job from codex (gpt-5-codex) because it reached its usage limit. Here is where it stopped:\n\nAll green.';
    expect(agent.command({ line: '/omni:yolo 7', cwd }, ACCOUNT, handoff).stdin).toBe(`/omni:yolo 7\n\n${handoff}\n`);
  });
});

describe('the claude adapter: resume', () => {
  it('continues the session with one more message, on the same stream-json', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'omni-claude-'));
    expect(agent.resume({ line: '/omni:yolo 7', cwd }, ACCOUNT, 'sess-1', 'Write the handoff note.')).toEqual({
      file: 'claude', args: [...ARGS, '--resume', 'sess-1'], env: {}, stdin: 'Write the handoff note.\n',
    });
  });

  it("keeps the account's model and secret", () => {
    const cwd = mkdtempSync(join(tmpdir(), 'omni-claude-'));
    const command = agent.resume({ line: '/omni:yolo 7', cwd }, { id: 'c', model: 'claude-sonnet-5-5', secret: 'sk-ant-oat01-fixture' }, 'sess-1', 'Go on.');
    expect(command.args).toEqual([...ARGS, '--model', 'claude-sonnet-5-5', '--resume', 'sess-1']);
    expect(command.env).toEqual({ CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-fixture' });
  });
});

describe('the claude adapter: step', () => {
  it("gives each recorded event the readable lines steps.ts gives it, one context for the run", () => {
    const now = new Date(2026, 9, 28, 9, 0, 0);
    const mine = { now, seen: new Set<string>() };
    const theirs = { now, seen: new Set<string>() };
    for (const line of linesOf('done')) expect(agent.step(line, mine)).toEqual(stepLine(line, theirs));
    const all = linesOf('done').flatMap((line) => agent.step(line, { now, seen: new Set<string>() }));
    expect(all).toContain('09:00:00 Bash: pnpm test');
  });

  it('prints a line that does not parse as it is', () => {
    expect(agent.step('npm WARN config this is no event', { now: new Date(2026, 9, 28, 9, 0, 0) })).toEqual(['npm WARN config this is no event']);
  });
});

describe('the claude adapter: limit', () => {
  it('reads the usage limit and its reset from the rejected rate limit event', () => {
    expect(agent.limit(runOf('limit', 1))).toEqual({ resetsAt: RESET });
  });

  it("reads the reset from an older message's epoch when no event names it", () => {
    expect(agent.limit(runOf('limit-epoch', 1))).toEqual({ resetsAt: RESET });
  });

  it('knows the limit with no reset time when Claude gives none', () => {
    expect(agent.limit(runOf('limit-no-reset', 1))).toEqual({ resetsAt: null });
  });

  it('is null on a crash, even one whose words speak of a limit', () => {
    expect(agent.limit(runOf('crash', 1))).toBeNull();
    expect(agent.limit({ cwd: '/w', lines: [], exit: 1 })).toBeNull();
    expect(agent.limit({ cwd: '/w', lines: linesOf('done').slice(0, 4), exit: 137 })).toBeNull();
  });

  it('is null on output that does not parse', () => {
    expect(agent.limit(runOf('garbled', 1))).toBeNull();
  });

  it('is null on a run that ended well, and on one that still goes', () => {
    expect(agent.limit(runOf('done', 0))).toBeNull();
    expect(agent.limit(runOf('limit', null))).toBeNull();
  });

  it('reads a reset given in milliseconds', () => {
    const lines = [JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: `Claude AI usage limit reached|${String(Date.parse(RESET))}` })];
    expect(agent.limit({ cwd: '/w', lines, exit: 1 })).toEqual({ resetsAt: RESET });
  });
});

describe('the claude adapter: pressure', () => {
  it("reads the warning, its window and reset, and the last message's context", () => {
    expect(agent.pressure(runOf('warning', null))).toEqual({
      usage: { percent: null, status: 'allowed_warning', window: 'seven_day', resetsAt: RESET },
      context: { used: 2 + 400 + 148_000 + 30, window: 200_000 },
    });
  });

  it('reads a percent when the event gives one', () => {
    const lines = linesOf('limit').slice(0, 3);
    expect(agent.pressure({ cwd: '/w', lines, exit: null }).usage).toEqual({ percent: 93, status: 'allowed_warning', window: 'five_hour', resetsAt: RESET });
  });

  it("skips Claude's own synthetic message when it reads the context", () => {
    expect(agent.pressure(runOf('limit', 1)).context).toEqual({ used: 6 + 2000 + 40_000 + 80, window: 200_000 });
  });

  it('counts a 1M-context model against its million tokens', () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 's', model: 'claude-opus-5-5[1m]' }),
      JSON.stringify({ type: 'assistant', message: { id: 'm', model: 'claude-opus-5-5', role: 'assistant', content: [], usage: { input_tokens: 10, cache_read_input_tokens: 400_000, cache_creation_input_tokens: 0, output_tokens: 5 } } }),
    ];
    expect(agent.pressure({ cwd: '/w', lines, exit: null }).context).toEqual({ used: 400_015, window: 1_000_000 });
  });

  it('is null in each part the run does not say', () => {
    expect(agent.pressure(runOf('garbled', null))).toEqual({ usage: null, context: null });
    expect(agent.pressure(runOf('limit-epoch', 1))).toEqual({ usage: null, context: null });
  });
});

describe('the claude adapter: session and interrupt', () => {
  it('gives the session the run named', () => {
    expect(agent.session(runOf('done', 0))).toBe('6f1d2c3a-9b8e-4f70-a1d2-5c4b3a291e07');
    expect(agent.session(runOf('garbled', 1))).toBeNull();
  });

  it('stops a run with SIGINT, then SIGTERM after 30 seconds', () => {
    expect(agent.interrupt(runOf('warning', null))).toEqual({ kind: 'signal', first: 'SIGINT', then: 'SIGTERM', afterMs: 30_000 });
  });
});

describe('the claude adapter: usage', () => {
  const assistant = (id: string, input: number, output: number): string =>
    JSON.stringify({ type: 'assistant', timestamp: '2026-10-28T09:00:00.000Z', message: { id, usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: 100, cache_creation_input_tokens: 7 } } });

  it("counts the job's transcripts as the runner does, and names the run's model", () => {
    const projects = mkdtempSync(join(tmpdir(), 'omni-claude-projects-'));
    const cwd = '/home/runner/wt/widgets-job-7';
    const path = join(projects, projectFolder(cwd), 'session.jsonl');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${[assistant('a', 10, 2), assistant('b', 5, 1), assistant('a', 12, 3)].join('\n')}\n`);
    const usage = claudeAgent({ projects }).usage(runOf('done', 0, cwd));
    expect(usage).toEqual({ tokens: tokenSource({ projects }).job(cwd), model: 'claude-opus-5-5' });
    expect(usage?.tokens).toEqual({ input: 17, output: 4, cacheRead: 200, cacheWrite: 14 });
  });

  it('is null when the transcripts cannot be read', () => {
    expect(agent.usage(runOf('done', 0))).toBeNull();
  });
});

describe('the claude adapter: check', () => {
  /** An exec that answers each `claude` call from `answers` (keyed by its first argument), throwing for a missing one. */
  const execOf = (answers: Record<string, string>, calls: string[][] = []): ExecText => (file, args) => {
    calls.push([file, ...args]);
    const answer = answers[args[0] ?? ''];
    if (answer === undefined) throw new Error('not found');
    return answer;
  };
  const projects = join(tmpdir(), 'omni-claude-no-projects');

  it('passes when claude is installed and signed in', () => {
    const exec = execOf({ '--version': '2.1.312 (Claude Code)', auth: '{"loggedIn": true}' });
    expect(claudeAgent({ projects, exec }).check(ACCOUNT)).toBeNull();
  });

  it('says claude is not installed', () => {
    expect(claudeAgent({ projects, exec: execOf({}) }).check(ACCOUNT)).toBe('claude is not installed');
  });

  it('says claude is not signed in', () => {
    expect(claudeAgent({ projects, exec: execOf({ '--version': '2.1.312', auth: '{"loggedIn": false}' }) }).check(ACCOUNT)).toBe('not signed in');
    expect(claudeAgent({ projects, exec: execOf({ '--version': '2.1.312' }) }).check(ACCOUNT)).toBe('not signed in');
  });

  it("trusts an account's own secret, which only a run can prove", () => {
    const calls: string[][] = [];
    const exec = execOf({ '--version': '2.1.312' }, calls);
    expect(claudeAgent({ projects, exec }).check({ id: 'c', model: null, secret: 'sk-ant-oat01-fixture' })).toBeNull();
    expect(calls).toEqual([['claude', '--version']]);
  });

  it('says an account whose secret is blank is not signed in', () => {
    const exec = execOf({ '--version': '2.1.312', auth: '{"loggedIn": true}' });
    expect(claudeAgent({ projects, exec }).check({ id: 'c', model: null, secret: '  ' })).toBe('not signed in');
  });
});

describe('a recorded Claude run through the job', () => {
  /** A job's folder, its files, and a fake `claude` on the PATH that replays `name` and exits `exit`. */
  function replay(name: string, exit: number) {
    const root = mkdtempSync(join(tmpdir(), 'omni-claude-job-'));
    const bin = join(root, 'bin');
    const cwd = join(root, 'wt');
    mkdirSync(bin);
    mkdirSync(cwd);
    writeFileSync(join(bin, 'claude'), ['#!/bin/sh', `cat > "${join(root, 'stdin')}"`, `cat "${recording(name)}"`, `exit ${String(exit)}`, ''].join('\n'));
    chmodSync(join(bin, 'claude'), 0o755);
    const files = { line: join(root, 'job-7.line'), log: join(root, 'job-7.log'), exit: join(root, 'job-7.exit') };
    writeFileSync(files.line, '/omni:yolo 7\n');
    writeFileSync(files.log, '');
    let pane = '';
    const out = { write: (chunk: string) => (pane += chunk) };
    return { root, cwd, files, out, env: { PATH: `${bin}:${String(process.env.PATH)}` }, pane: () => pane };
  }

  /** The readable lines a recording gives with one context for the run, unstamped: what the job printed before the adapter. */
  const before = (name: string): string[] => {
    const seen = new Set<string>();
    return linesOf(name).flatMap((line) => stepLine(line, { seen })).map((line) => line.replace(/^\d\d:\d\d:\d\d /, ''));
  };
  const unstamped = (log: string): string[] => log.split('\n').filter((line) => line !== '').map((line) => line.replace(/^\d\d:\d\d:\d\d /, ''));

  it('prints the same readable lines, keeps the raw stream, and writes the exit', async () => {
    const f = replay('done', 0);
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env })).toBe(0);
    expect(unstamped(readFileSync(f.files.log, 'utf8'))).toEqual(before('done'));
    expect(unstamped(f.pane())).toEqual(before('done'));
    expect(readFileSync(rawLogPath(f.files.log), 'utf8')).toBe(readFileSync(recording('done'), 'utf8'));
    expect(readFileSync(join(f.root, 'stdin'), 'utf8')).toBe('/omni:yolo 7\n');
    expect(readFileSync(f.files.exit, 'utf8')).toBe('0\n');
  });

  it("ends on the limit with Claude's exit, and the raw stream shows the limit", async () => {
    const f = replay('limit', 1);
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env })).toBe(1);
    expect(readFileSync(f.files.exit, 'utf8')).toBe('1\n');
    const lines = readFileSync(rawLogPath(f.files.log), 'utf8').split('\n').filter((line) => line !== '');
    expect(agent.limit({ cwd: f.cwd, lines, exit: 1 })).toEqual({ resetsAt: RESET });
  });

  it('runs the account it is given, its secret in that run only and in no line it writes', async () => {
    const f = replay('done', 0);
    const account = { id: 'claude-direct', model: 'claude-opus-5-5', secret: 'sk-ant-oat01-fixture' };
    writeFileSync(join(f.root, 'bin', 'claude'), [
      '#!/bin/sh',
      `printf '%s\\n' "$@" > "${join(f.root, 'args')}"`,
      `printf '%s' "$CLAUDE_CODE_OAUTH_TOKEN" > "${join(f.root, 'token')}"`,
      'cat > /dev/null',
      `cat "${recording('done')}"`,
      '',
    ].join('\n'));
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env, agent, account })).toBe(0);
    expect(readFileSync(join(f.root, 'args'), 'utf8').trim().split('\n')).toEqual([...ARGS, '--model', 'claude-opus-5-5']);
    expect(readFileSync(join(f.root, 'token'), 'utf8')).toBe('sk-ant-oat01-fixture');
    expect(readFileSync(f.files.log, 'utf8')).not.toContain('sk-ant');
    expect(f.pane()).not.toContain('sk-ant');
  });

  it('runs a job through any agent it is given, never naming one itself', async () => {
    const f = replay('done', 0);
    const echo = { ...agent, name: 'echo', command: () => ({ file: 'sh', args: ['-c', 'cat; echo plain'], env: {}, stdin: 'from the agent\n' }), step: (line: string) => [`» ${line}`] };
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env, agent: echo, account: ACCOUNT })).toBe(0);
    expect(readFileSync(f.files.log, 'utf8')).toBe('» from the agent\n» plain\n');
    expect(readFileSync(rawLogPath(f.files.log), 'utf8')).toBe('from the agent\nplain\n');
  });
});
