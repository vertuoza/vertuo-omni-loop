// How the seat thinks (PRD omni-loop-34 s4): Claude Code headless with the seat's six tools alone, on the runner's own
// account, its tokens counted as a job's. A stubbed process: no real model is called.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planLaunch } from '../launch/launch.ts';
import { claudeThinker, lookPrompt } from './supervisor-think.ts';
import type { SpawnThink } from './supervisor-think.ts';

const RUNNER = '00000000-0000-4000-8000-000000000900';
const SECRET = ['sk', 'ant', 'oat01', 'fakeSeatAccountSecret0123'].join('-');

function stubProcess(lines: string[], exit: number | null, { hang = false } = {}) {
  const runs: { file: string; args: readonly string[]; env: Readonly<Record<string, string>>; stdin: string; cwd: string }[] = [];
  let killed = false;
  const spawn: SpawnThink = (file, args, options) => {
    runs.push({ file, args, ...options });
    let release = (): void => undefined;
    const ended = new Promise<void>((resolve) => {
      release = resolve;
      if (!hang) resolve();
    });
    return {
      lines: (async function* () {
        yield* lines;
        await ended;
      })(),
      exit: ended.then(() => (killed ? null : exit)),
      kill: () => {
        killed = true;
        release();
      },
    };
  };
  return { spawn, runs, killed: () => killed };
}

const assistant = (id: string, usage: object) => JSON.stringify({ type: 'assistant', message: { id, usage } });

describe('the seat\'s think', () => {
  it('runs claude headless with the seat\'s MCP server alone and its six tools allowed, on the account\'s model and secret', async () => {
    const stub = stubProcess([], 0);
    const think = claudeThinker({ omni: ['/usr/bin/node', '/opt/omni.mjs'], runner: RUNNER, askUrl: 'https://omni.test', home: mkdtempSync(join(tmpdir(), 'omni-think-')), account: { id: 'claude-a', model: 'sonnet', secret: SECRET }, spawn: stub.spawn });
    await think({ prompt: 'look', signal: new AbortController().signal });
    const [run] = stub.runs;
    expect(run?.file).toBe('claude');
    expect(run?.stdin).toBe('look\n');
    expect(run?.env).toEqual({ CLAUDE_CODE_OAUTH_TOKEN: SECRET });
    expect(run?.cwd.endsWith('.omni-supervisor')).toBe(true);
    const args = run?.args ?? [];
    expect(args).toContain('--strict-mcp-config');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(JSON.parse(args[args.indexOf('--mcp-config') + 1] ?? '{}')).toEqual({
      mcpServers: { supervisor: { command: '/usr/bin/node', args: ['/opt/omni.mjs', 'supervisor', 'mcp', '--runner', RUNNER, '--page', 'https://omni.test'] } },
    });
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('mcp__supervisor__snapshot,mcp__supervisor__lines,mcp__supervisor__memory,mcp__supervisor__raise,mcp__supervisor__reply,mcp__supervisor__propose');
    expect(args[args.indexOf('--disallowedTools') + 1]).toContain('Bash');
    expect(args.slice(-2)).toEqual(['--model', 'sonnet']);
  });

  it('starts a tools server the omni launcher runs in the think\'s own folder, which is no checkout (#3328)', async () => {
    const stub = stubProcess([], 0);
    const think = claudeThinker({ omni: ['/usr/bin/node', '/opt/omni.mjs'], runner: RUNNER, askUrl: 'https://omni.test', home: mkdtempSync(join(tmpdir(), 'omni-think-')), account: { id: 'claude', model: null, secret: null }, spawn: stub.spawn });
    await think({ prompt: 'look', signal: new AbortController().signal });
    const [run] = stub.runs;
    const args = run?.args ?? [];
    const mcp: unknown = JSON.parse(args[args.indexOf('--mcp-config') + 1] ?? '{}');
    const server = (mcp as { mcpServers: { supervisor: { args: string[] } } }).mcpServers.supervisor;
    const [script = '', ...argv] = server.args;
    expect(planLaunch(argv, { cwd: run?.cwd ?? '', self: script })).toEqual({ kind: 'self' });
  });

  it('counts its tokens as a job\'s: each assistant message once, its four counts summed', async () => {
    const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 1000, cache_creation_input_tokens: 30 };
    const stub = stubProcess([assistant('m1', usage), assistant('m1', usage), 'not json', assistant('m2', { input_tokens: 5, output_tokens: 5 })], 0);
    const think = claudeThinker({ omni: ['node', 'omni.mjs'], runner: RUNNER, askUrl: 'https://omni.test', home: mkdtempSync(join(tmpdir(), 'omni-think-')), account: { id: 'claude', model: null, secret: null }, spawn: stub.spawn });
    expect(await think({ prompt: 'look', signal: new AbortController().signal })).toEqual({ tokens: 1160, ok: true, line: 'thought' });
    expect(stub.runs[0]?.env).toEqual({});
  });

  it('stops a think past its time, and says how a run that failed ended', async () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-think-'));
    const hung = stubProcess([], 0, { hang: true });
    const slow = claudeThinker({ omni: ['node', 'omni.mjs'], runner: RUNNER, askUrl: 'https://omni.test', home, account: { id: 'claude', model: null, secret: null }, spawn: hung.spawn, timeoutMs: 5 });
    expect(await slow({ prompt: 'look', signal: new AbortController().signal })).toMatchObject({ ok: false, line: 'stopped after 0 min' });
    expect(hung.killed()).toBe(true);
    const failed = claudeThinker({ omni: ['node', 'omni.mjs'], runner: RUNNER, askUrl: 'https://omni.test', home, account: { id: 'claude', model: null, secret: null }, spawn: stubProcess([], 2).spawn });
    expect(await failed({ prompt: 'look', signal: new AbortController().signal })).toEqual({ tokens: 0, ok: false, line: 'claude ended 2' });
  });

  it('prompts with the rules, then only the sections the look found', () => {
    const seat = { workspace: 'w', runner: RUNNER, paused: false, thinking: true, dailyTokens: 5_000_000, tokensToday: 1200, missedLooks: 0, lastLookAt: null };
    const prompt = lookPrompt({ seat, signals: [], unlooked: [], messages: [], notes: [{ id: 'n1', scope: 'long', line: 'Baseline wave: 2.5 min', createdAt: 'x' }] });
    expect(prompt).toContain('Never propose a merge, an approval, a skipped check or a retry until green.');
    expect(prompt).toContain('Seat: 1200 of 5000000 tokens used today.');
    expect(prompt).toContain('## Memory\n- n1 · long · Baseline wave: 2.5 min');
    expect(prompt).not.toContain('## Signals');
  });
});
