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
import { field } from '../ask/schema.ts';
import { accountBook, accountsStateFile, DEFAULT_HANDOFF } from './accounts.ts';
import type { Account } from './accounts.ts';
import type { Agent } from './agents/agent.ts';
import { claudeAgent } from './agents/claude.ts';
import { runJobProcess } from './job.ts';
import {
  CAP_REASON, FRESH_CAP_REASON, GUESSED_RESET_MS, handoffPath, MAX_ACCOUNT_CHANGES, MAX_FRESH_SESSIONS, noTokensReason, notePrompt, partsPath, plannedHandoff, readParts, runnerNote,
  takeoverLine, tokensSince, turnoverOf,
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
function job({ first = 'limit', firstExit = 1, accounts, agents = {}, line = '/omni:yolo 7', secret = null, script, firstAgent = claude, more = {} }: {
  first?: string; firstExit?: number; accounts: Account[]; agents?: Record<string, Agent>; line?: string; secret?: string | null;
  /** The fake `claude`'s lines after its shebang, in place of the replay of `first`. */
  script?: string[];
  /** The agent of the job's first part. */
  firstAgent?: Agent;
  more?: Partial<Turnover>;
}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-turnover-'));
  const bin = join(root, 'bin');
  const cwd = join(root, 'wt');
  const logs = join(root, 'logs');
  for (const dir of [bin, cwd, logs]) mkdirSync(dir);
  writeFileSync(join(bin, 'claude'), ['#!/bin/sh', ...(script ?? ['cat > /dev/null', `cat "${recording(first)}"`, ...(secret === null ? [] : [`echo "token ${secret}"`]), `exit ${String(firstExit)}`]), ''].join('\n'));
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
    pressureEveryMs: 10,
    ...more,
  };
  let pane = '';
  const out = { write: (chunk: string) => (pane += chunk) };
  const first0 = accounts[0];
  const run = () => runJobProcess({ cwd, files, out, env: { PATH: `${bin}:${String(process.env.PATH)}` }, agent: firstAgent, account: { id: first0?.id ?? 'claude', model: first0?.model ?? null, secret: null }, turnover });
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

describe('a planned handoff, read from the pressure (PRD 2537, s8)', () => {
  const thresholds = { usage: 90, context: 75 };
  const at = Date.parse('2026-10-28T13:41:02.000Z');
  const usage = (fields: Partial<{ percent: number | null; status: string | null; window: string | null; resetsAt: string | null }>) => ({ percent: null, status: null, window: null, resetsAt: null, ...fields });
  const read = (pressure: Parameters<typeof plannedHandoff>[0]['pressure'], more: Partial<Parameters<typeof plannedHandoff>[0]> = {}) => plannedHandoff({ pressure, thresholds, contextWindow: null, budget: null, now: at, ...more });

  it('hands off on usage at the threshold, naming the percent and the window', () => {
    expect(read({ usage: usage({ percent: 91, window: 'five_hour', resetsAt: '2026-10-28T18:00:00.000Z' }), context: null })).toEqual({ ended: 'usage', why: 'its account reached 91 % of its 5-hour window', resetsAt: '2026-10-28T18:00:00.000Z' });
    expect(read({ usage: usage({ percent: 90 }), context: null })).toEqual({ ended: 'usage', why: 'its account reached 90 % of its usage window', resetsAt: null });
    expect(read({ usage: usage({ percent: 89, status: 'allowed' }), context: null })).toBeNull();
  });

  it("hands off on Claude's allowed_warning, which gives no percent", () => {
    expect(read({ usage: usage({ status: 'allowed_warning', window: 'seven_day', resetsAt: '2026-11-01T00:00:00.000Z' }), context: null })).toEqual({ ended: 'usage', why: 'its account warned that its weekly window is nearly used up', resetsAt: '2026-11-01T00:00:00.000Z' });
    expect(read({ usage: usage({ status: 'allowed_warning', window: 'seven_day_opus' }), context: null })?.why).toBe('its account warned that its weekly Opus window is nearly used up');
    expect(read({ usage: usage({ status: 'allowed_warning', window: 'primary' }), context: null })?.why).toBe('its account warned that its primary window is nearly used up');
  });

  it("hands off on an account's day past its budget, out until the next day", () => {
    expect(read({ usage: null, context: null }, { budget: { limit: 1000, spent: 1000 } })).toEqual({ ended: 'usage', why: 'its account spent its budget of 1000 tokens for the day', resetsAt: '2026-10-29T00:00:00.000Z' });
    expect(read({ usage: null, context: null }, { budget: { limit: 1000, spent: 999 } })).toBeNull();
  });

  it("hands off on context at the threshold of the model's window, or of the account's own", () => {
    expect(read({ usage: null, context: { used: 152_000, window: 200_000 } })).toEqual({ ended: 'context', why: 'its context was 76 % full' });
    expect(read({ usage: null, context: { used: 148_432, window: 200_000 } })).toBeNull();
    expect(read({ usage: null, context: { used: 152_000, window: 200_000 } }, { contextWindow: 1_000_000 })).toBeNull();
    expect(read({ usage: null, context: { used: 760_000, window: 200_000 } }, { contextWindow: 1_000_000 })).toEqual({ ended: 'context', why: 'its context was 76 % full' });
    expect(read({ usage: null, context: { used: 10, window: 0 } })).toBeNull();
  });

  it('puts usage before context: the account moves on, and the next one starts a fresh session anyway', () => {
    expect(read({ usage: usage({ percent: 95 }), context: { used: 190_000, window: 200_000 } })?.ended).toBe('usage');
  });

  it('asks the outgoing agent for its note at a path beside the log, and nothing else', () => {
    expect(notePrompt('/logs/job-7.handoff.md')).toBe('Write the handoff note for whoever continues this job to /logs/job-7.handoff.md: what is done, what is next, the pull requests and branches open, and every decision you took. Change no other file.');
  });
});

/** The shell words that read the note's path from the note prompt on standard input. */
const NOTE_PATH = String.raw`sed -n 's/^Write the handoff note for whoever continues this job to \(.*\): what is done.*$/\1/p'`;

/** The resetsAt of the recorded Claude warning, and of the Codex event below: 2026-10-28 at 17:00 UTC. */
const WARNING_RESET = new Date(1_793_206_800 * 1000).toISOString();

/** The number at `path` inside `value`, or `null`. */
const numberAt = (value: unknown, path: readonly string[]): number | null => {
  const found = path.reduce<unknown>((at, key) => field(at, key), value);
  return typeof found === 'number' ? found : null;
};

/** How a Codex-shaped agent's note turn goes: it writes its note, fails after writing it, outlives its time, or writes nothing. */
type NoteTurn = 'write' | 'fail' | 'hang' | 'nothing';

/**
 * A Codex-shaped agent, built on the recorded shape of `codex exec --json`: each run prints `events` (one
 * JSON line each) and waits to be stopped, until it has run `stopsFor` times, then says `all done`. Its
 * pressure reads Codex's `used_percent` and `token_count`, its session the `session_id`, and its resume
 * writes the note as `note` says. It records every run's worktree and standard input under `root`.
 */
function codexLike(root: string, name: string, { events, note = 'write', stopsFor = 1, interrupt = true, hold = 'stop' }: {
  events: object[]; note?: NoteTurn; stopsFor?: number; interrupt?: boolean;
  /** `stop`: a run waits to be stopped; `brief`: it ends on its own a moment after its events, long after its pressure was read. */
  hold?: 'stop' | 'brief';
}): Agent {
  const eventsFile = join(root, `${name}.events.jsonl`);
  writeFileSync(eventsFile, events.map((event) => JSON.stringify(event)).join('\n') + '\n');
  const count = join(root, `${name}.runs`);
  const runScript = join(root, `${name}.run.sh`);
  writeFileSync(runScript, [
    `pwd > "${join(root, `${name}.cwd`)}"`,
    `cat >> "${join(root, `${name}.stdin`)}"`,
    `n=$(cat "${count}" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "${count}"`,
    `if [ "$n" -gt ${String(stopsFor)} ]; then echo "all done"; exit 0; fi`,
    `cat "${eventsFile}"`,
    hold === 'stop' ? 'exec sleep 30' : 'sleep 0.3; exit 0',
    '',
  ].join('\n'));
  const noteScript = join(root, `${name}.note.sh`);
  const noteStdin = join(root, `${name}.note-stdin`);
  const writes = `printf '# Where I stopped\\n\\nThe tests are half written. token ${SECRET}\\n' > "$(${NOTE_PATH} "${noteStdin}")"`;
  writeFileSync(noteScript, [
    `cat > "${noteStdin}"`,
    ...(note === 'write' ? [writes, 'exit 0'] : note === 'fail' ? [writes, 'exit 1'] : note === 'hang' ? ['exec sleep 30'] : ['exit 0']),
    '',
  ].join('\n'));
  const lastOf = (lines: readonly string[], key: string): Record<string, unknown> | undefined => lines.flatMap((line) => {
    try {
      const event: unknown = JSON.parse(line);
      return typeof event === 'object' && event !== null && key in event ? [Object.fromEntries(Object.entries(event))] : [];
    } catch {
      return [];
    }
  }).at(-1);
  return {
    ...claude,
    name,
    check: () => null,
    command: (job, _account, handoff) => ({ file: 'sh', args: [runScript], env: {}, stdin: handoff === undefined ? `${job.line}\n` : `${job.line}\n\n${handoff}\n` }),
    step: (line) => [line],
    usage: () => ({ tokens: { input: 10, output: 2, cacheRead: 0, cacheWrite: 0 }, model: `${name}-model` }),
    limit: () => null,
    pressure: (run) => {
      const percent = numberAt(lastOf(run.lines, 'rate_limits'), ['rate_limits', 'primary', 'used_percent']);
      const used = numberAt(lastOf(run.lines, 'context'), ['context', 'used']);
      return {
        usage: percent === null ? null : { percent: Math.round(percent), status: null, window: 'five_hour', resetsAt: WARNING_RESET },
        context: used === null ? null : { used, window: 200_000 },
      };
    },
    session: (run) => {
      const event = lastOf(run.lines, 'session_id');
      return typeof event?.session_id === 'string' ? event.session_id : null;
    },
    interrupt: () => (interrupt ? { kind: 'signal', first: 'SIGINT', then: 'SIGTERM', afterMs: 2000 } : null),
    resume: (_job, _account, _session, prompt) => ({ file: 'sh', args: [noteScript], env: {}, stdin: `${prompt}\n` }),
  };
}

/** A Codex run's events: its session, then its usage window at `percent` and its context at `used` tokens. */
const codexEvents = ({ percent = 12, used = 40_000 }: { percent?: number; used?: number } = {}): object[] => [
  { type: 'session_configured', session_id: 'codex-session-1' },
  { type: 'event_msg', rate_limits: { primary: { used_percent: percent, window_minutes: 300, resets_at: 1_793_206_800 } } },
  { type: 'event_msg', context: { used } },
];

describe('a planned handoff, before the wall (PRD 2537, s8)', () => {
  it("stops a Claude run on its recorded allowed_warning, resumes its session for the agent's note, and the next account carries on (acceptance 3)", async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const f = job({
      accounts: [direct('claude-1'), direct('codex-1')],
      agents: { 'codex-1': fakeAgent(root, 'codex') },
      script: [
        'R="$(dirname "$0")/.."',
        'case "$*" in',
        `  *--resume*) printf '%s\\n' "$@" > "$R/resume.args"; cat > "$R/resume.stdin"; printf 'The lint is clean; the tests are next.\\n' > "$(${NOTE_PATH} "$R/resume.stdin")"; cat "${recording('done')}"; exit 0 ;;`,
        'esac',
        'cat > /dev/null',
        `cat "${recording('warning')}"`,
        'exec sleep 30',
      ],
    });
    expect(await f.run()).toBe(0);

    const record = readParts(partsPath(f.files.log));
    expect(record?.reason).toBeNull();
    expect(record?.parts.map((part) => [part.account, part.ended, part.note])).toEqual([['claude-1', 'usage', 'agent'], ['codex-1', 'done', undefined]]);
    expect(record?.parts[0]).toMatchObject({ resetsAt: WARNING_RESET, guessed: false });
    expect(f.book.stateOf('claude-1')).toEqual({ state: 'out', resetsAt: WARNING_RESET });

    // The same session, resumed for one turn, asked for its note beside the log.
    expect(readFileSync(join(f.root, 'resume.args'), 'utf8').split('\n')).toEqual(expect.arrayContaining(['--resume', '7d8e9f0a-1b2c-4d3e-9f4a-5b6c7d8e9f0a']));
    expect(readFileSync(join(f.root, 'resume.stdin'), 'utf8')).toBe(`${notePrompt(handoffPath(f.files.log))}\n`);
    expect(readFileSync(handoffPath(f.files.log), 'utf8')).toBe('The lint is clean; the tests are next.\n');

    const stdin = readFileSync(join(root, 'codex.stdin'), 'utf8');
    expect(stdin).toBe('/omni:yolo 7\n\nYou are taking over this job from claude because its account warned that its weekly window is nearly used up. Here is where it stopped:\n\nThe lint is clean; the tests are next.\n\n');
    expect(readdirSync(f.cwd).filter((name) => name !== '.git')).toEqual([]);
    expect(readFileSync(f.files.log, 'utf8')).toContain(`↻ account claude-1 hands off, its account warned that its weekly window is nearly used up, out until ${WARNING_RESET}: account codex-1 takes over`);
  });

  it("stops a Codex run at a used_percent of 91, the agent's note masked, and the next account carries on (acceptance 3)", async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const codex = codexLike(root, 'codex', { events: codexEvents({ percent: 91 }) });
    const f = job({ accounts: [direct('codex-1', { secret: '/s', model: 'gpt-5-codex' }), direct('claude-2')], agents: { 'codex-1': codex, 'claude-2': fakeAgent(root, 'claude2') }, firstAgent: codex });
    expect(await f.run()).toBe(0);

    const record = readParts(partsPath(f.files.log));
    expect(record?.parts[0]).toMatchObject({ agent: 'codex', model: 'codex-model', account: 'codex-1', ended: 'usage', note: 'agent', resetsAt: WARNING_RESET, guessed: false });
    expect(record?.parts[1]).toMatchObject({ account: 'claude-2', ended: 'done' });
    const note = readFileSync(handoffPath(f.files.log), 'utf8');
    expect(note).toBe('# Where I stopped\n\nThe tests are half written. token ***\n');
    const stdin = readFileSync(join(root, 'claude2.stdin'), 'utf8');
    expect(stdin.startsWith(`/omni:yolo 7\n\nYou are taking over this job from codex (codex-model) because its account reached 91 % of its 5-hour window. Here is where it stopped:\n\n${note}`)).toBe(true);
    expect(stdin).not.toContain(SECRET);
    expect(readFileSync(f.files.log, 'utf8')).not.toContain(SECRET);
  });

  it.each([
    ['fails', 'fail'],
    ['outlives its five minutes', 'hang'],
    ['writes nothing', 'nothing'],
  ] satisfies [string, NoteTurn][])("writes the runner's note when the note's turn %s", async (_name, note) => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const codex = codexLike(root, 'codex', { events: codexEvents({ percent: 95 }), note });
    const f = job({ accounts: [direct('codex-1'), direct('claude-2')], agents: { 'codex-1': codex, 'claude-2': fakeAgent(root, 'claude2') }, firstAgent: codex, more: { noteTurnMs: 300 } });
    expect(await f.run()).toBe(0);
    expect(readParts(partsPath(f.files.log))?.parts[0]).toMatchObject({ ended: 'usage', note: 'runner' });
    const written = readFileSync(handoffPath(f.files.log), 'utf8');
    expect(written.startsWith('# Handoff note, written by the runner')).toBe(true);
    expect(written).not.toContain(SECRET);
    expect(readFileSync(join(root, 'claude2.stdin'), 'utf8')).toContain(written);
    expect(readFileSync(f.files.log, 'utf8')).toContain('↻ the agent wrote no handoff note: the runner wrote it');
  });

  it("writes the runner's note when the run named no session to resume", async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const codex = codexLike(root, 'codex', { events: codexEvents({ percent: 95 }).slice(1) });
    const f = job({ accounts: [direct('codex-1'), direct('claude-2')], agents: { 'codex-1': codex, 'claude-2': fakeAgent(root, 'claude2') }, firstAgent: codex });
    expect(await f.run()).toBe(0);
    expect(existsSync(join(root, 'codex.note-stdin'))).toBe(false);
    expect(readParts(partsPath(f.files.log))?.parts[0]).toMatchObject({ ended: 'usage', note: 'runner' });
  });

  it("opens a fresh session on the same account at a context of 76 %, with the agent's note (acceptance 4)", async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const codex = codexLike(root, 'codex', { events: codexEvents({ used: 152_000 }) });
    const f = job({ accounts: [direct('codex-1'), direct('claude-2')], agents: { 'codex-1': codex, 'claude-2': fakeAgent(root, 'claude2') }, firstAgent: codex });
    expect(await f.run()).toBe(0);
    const record = readParts(partsPath(f.files.log));
    expect(record?.parts.map((part) => [part.account, part.ended, part.note])).toEqual([['codex-1', 'context', 'agent'], ['codex-1', 'done', undefined]]);
    expect(f.book.stateOf('codex-1').state).toBe('ready');
    expect(existsSync(join(root, 'claude2.stdin'))).toBe(false);
    expect(readFileSync(join(root, 'codex.stdin'), 'utf8')).toContain('/omni:yolo 7\n\nYou are taking over this job from codex (codex-model) because its context was 76 % full. Here is where it stopped:\n\n# Where I stopped');
    expect(readFileSync(f.files.log, 'utf8')).toContain('↻ account codex-1 hands off, its context was 76 % full: a fresh session on the same account takes over');
  });

  it("reads the context against the account's own window, and the file's thresholds", async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const codex = codexLike(root, 'codex', { events: codexEvents({ used: 152_000 }), hold: 'brief' });
    const f = job({ accounts: [direct('codex-1', { contextWindow: 1_000_000 })], agents: { 'codex-1': codex }, firstAgent: codex, more: { handoff: { usage: 90, context: 75 } } });
    expect(await f.run()).toBe(0);
    expect(readParts(partsPath(f.files.log))?.parts.map((part) => part.ended)).toEqual(['done']);
  });

  it(`fails the job past ${String(MAX_FRESH_SESSIONS)} fresh sessions, naming the cap`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const codex = codexLike(root, 'codex', { events: codexEvents({ used: 190_000 }), stopsFor: 99 });
    const f = job({ accounts: [direct('codex-1')], agents: { 'codex-1': codex }, firstAgent: codex });
    expect(await f.run()).not.toBe(0);
    const record = readParts(partsPath(f.files.log));
    expect(record?.parts.map((part) => part.ended)).toEqual(Array.from({ length: MAX_FRESH_SESSIONS + 1 }, () => 'context'));
    expect(record?.reason).toBe(FRESH_CAP_REASON);
    expect(readFileSync(f.files.exit, 'utf8')).not.toBe('0\n');
  });

  it(`fails the job on its ${String(MAX_ACCOUNT_CHANGES + 1)}th usage handoff, naming the cap`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const agents = Object.fromEntries(ids.map((id) => [id, codexLike(root, id, { events: codexEvents({ percent: 92 }) })]));
    const f = job({ accounts: ids.map((id) => direct(id)), agents, firstAgent: agents.a ?? claude });
    expect(await f.run()).not.toBe(0);
    const record = readParts(partsPath(f.files.log));
    expect(record?.parts.map((part) => [part.account, part.ended])).toEqual([['a', 'usage'], ['b', 'usage'], ['c', 'usage'], ['d', 'usage']]);
    expect(record?.reason).toBe(CAP_REASON);
    expect(f.book.stateOf('e').state).toBe('ready');
  });

  it('fails the job when no account is left to take a usage handoff over', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const codex = codexLike(root, 'codex', { events: codexEvents({ percent: 95 }) });
    const f = job({ accounts: [direct('codex-1'), direct('open-1', { takes: ['plan'] })], agents: { 'codex-1': codex, 'open-1': fakeAgent(root, 'open') }, firstAgent: codex });
    expect(await f.run()).not.toBe(0);
    const record = readParts(partsPath(f.files.log));
    expect(record?.reason).toBe(`no tokens left: every account is out until ${WARNING_RESET}`);
    expect(record?.parts).toEqual([expect.objectContaining({ account: 'codex-1', ended: 'usage', resetsAt: WARNING_RESET })]);
    expect(existsSync(join(root, 'open.stdin'))).toBe(false);
    expect(existsSync(join(root, 'codex.note-stdin'))).toBe(false);
  });

  it('reads no pressure for an agent that offers no clean stop: it hands off at the wall only', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-handoff-agents-'));
    const codex = codexLike(root, 'codex', { events: codexEvents({ percent: 99, used: 199_000 }), interrupt: false, hold: 'brief' });
    const f = job({ accounts: [direct('codex-1'), direct('claude-2')], agents: { 'codex-1': codex, 'claude-2': fakeAgent(root, 'claude2') }, firstAgent: codex });
    expect(await f.run()).toBe(0);
    expect(readParts(partsPath(f.files.log))?.parts.map((part) => [part.account, part.ended])).toEqual([['codex-1', 'done']]);
  });
});

describe("a Codex or OpenCode instance's skills, before it runs (PRD 2537, s5 and s8, acceptance 10)", () => {
  it('starts the job on the next account when the first cannot have the kit skills', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-skills-agents-'));
    const asked: string[] = [];
    const prepare = (account: Account, cwd: string): string | null => {
      asked.push(`${account.id} ${cwd}`);
      return account.id === 'codex-1' ? 'no skills' : null;
    };
    const f = job({ accounts: [direct('codex-1'), direct('claude-2')], agents: { 'claude-2': fakeAgent(root, 'claude2') }, firstAgent: fakeAgent(root, 'codex'), more: { prepare } });
    expect(await f.run()).toBe(0);
    expect(asked).toEqual([`codex-1 ${f.cwd}`, `codex-1 ${f.cwd}`, `claude-2 ${f.cwd}`]);
    expect(existsSync(join(root, 'codex.stdin'))).toBe(false);
    expect(readParts(partsPath(f.files.log))?.parts.map((part) => [part.account, part.ended])).toEqual([['claude-2', 'done']]);
    expect(readFileSync(f.files.log, 'utf8')).toContain('↻ account codex-1 is unusable: no skills');
  });

  it('passes over an instance without the skills when it turns over, and fails when none can take the job', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-skills-agents-'));
    const over = job({ accounts: [direct('claude-1'), direct('codex-2'), direct('claude-3')], agents: { 'codex-2': fakeAgent(root, 'codex'), 'claude-3': fakeAgent(root, 'claude3') }, more: { prepare: (account) => (account.id === 'codex-2' ? 'no skills' : null) } });
    expect(await over.run()).toBe(0);
    expect(readParts(partsPath(over.files.log))?.parts.map((part) => part.account)).toEqual(['claude-1', 'claude-3']);

    const none = job({ accounts: [direct('codex-1'), direct('codex-2')], agents: { 'codex-2': fakeAgent(root, 'codex2') }, firstAgent: fakeAgent(root, 'codex1'), more: { prepare: () => 'no skills' } });
    expect(await none.run()).toBe(1);
    expect(readParts(partsPath(none.files.log))).toEqual({ parts: [], reason: 'no tokens left: no account can take this job over' });
  });
});

describe('the turnover of a runner (PRD 2537, s8)', () => {
  /** A home with T3's settings naming a Codex instance with its own folder, a Claude one, and one of an agent that reads no skills. */
  const t3Home = (): string => {
    const home = mkdtempSync(join(tmpdir(), 'omni-turnover-home-'));
    mkdirSync(join(home, '.t3', 'userdata'), { recursive: true });
    writeFileSync(join(home, '.t3', 'userdata', 'settings.json'), JSON.stringify({
      providerInstances: {
        'codex-1': { driver: 'codex', enabled: true, config: { homePath: '~/.codex-1' } },
        opencode: { driver: 'opencode', enabled: true },
        'claude-b': { driver: 'claudeAgent', enabled: true, config: { homePath: '~/.claude-b' } },
        gem: { driver: 'gemini', enabled: true },
      },
    }));
    return home;
  };
  const t3 = (id: string, instance: string): Account => direct(id, { agent: 't3', instance, model: 'm' });
  const exec = (): string => '';

  it("writes the kit's skills in a Codex or OpenCode instance's own folder, never in the worktree", () => {
    const home = t3Home();
    const worktree = mkdtempSync(join(tmpdir(), 'omni-turnover-wt-'));
    const turnover = turnoverOf({ accounts: [], book: accountBook({ file: accountsStateFile(home) }), exec, home });
    expect(turnover.prepare?.(t3('codex-1', 'codex-1'), worktree)).toBeNull();
    expect(readFileSync(join(home, '.codex-1', 'skills', 'omni-yolo', 'SKILL.md'), 'utf8')).toContain('name: omni-yolo');
    expect(turnover.prepare?.(t3('open-1', 'opencode'), worktree)).toBeNull();
    expect(existsSync(join(home, '.config', 'opencode', 'skills', 'omni-yolo', 'SKILL.md'))).toBe(true);
    expect(readdirSync(worktree)).toEqual([]);
  });

  it('leaves a direct account, a Claude instance and an instance T3 does not know alone, and refuses an agent that reads no skills', () => {
    const home = t3Home();
    const worktree = mkdtempSync(join(tmpdir(), 'omni-turnover-wt-'));
    const turnover = turnoverOf({ accounts: [], book: accountBook({ file: accountsStateFile(home) }), exec, home });
    expect(turnover.prepare?.(direct('claude-direct'), worktree)).toBeNull();
    expect(turnover.prepare?.(t3('claude-b', 'claude-b'), worktree)).toBeNull();
    expect(existsSync(join(home, '.claude-b'))).toBe(false);
    expect(turnover.prepare?.(t3('ghost', 'ghost'), worktree)).toBeNull();
    expect(turnover.prepare?.(t3('gem', 'gem'), worktree)).toBe('no skills');
  });

  it('reads the planned thresholds from the accounts file, the defaults without one or with a bad one', () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-turnover-home-'));
    const of = (): Turnover => turnoverOf({ accounts: [], book: accountBook({ file: accountsStateFile(home) }), exec, home });
    expect(of().handoff).toEqual(DEFAULT_HANDOFF);
    mkdirSync(join(home, '.config', 'omni'), { recursive: true });
    writeFileSync(join(home, '.config', 'omni', 'accounts.yml'), 'accounts:\n  - id: a\n    agent: claude\nhandoff:\n  usage: 80\n');
    expect(of().handoff).toEqual({ usage: 80, context: 75 });
    writeFileSync(join(home, '.config', 'omni', 'accounts.yml'), 'accounts: [');
    expect(of().handoff).toEqual(DEFAULT_HANDOFF);
    expect(turnoverOf({ accounts: [], book: accountBook({ file: accountsStateFile(home) }), exec, home, handoff: { usage: 60, context: 60 } }).handoff).toEqual({ usage: 60, context: 60 });
  });
});
