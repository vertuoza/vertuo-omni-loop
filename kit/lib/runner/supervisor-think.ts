// How the Supervisor's seat thinks (PRD omni-loop-34 s4, spec "1. The seat"): Claude Code, headless, on one of the
// runner's own agent accounts (never the workspace's stored AI key: BR-PRODUCT-59, L-GDPR-5), with the six tools of the
// seat's MCP server (`omni supervisor mcp`, ./supervisor-mcp.ts) and nothing else: no shell, no file, no web. The tools
// call the Supervisor API only, with the runner's sign-in.
//
// - The prompt is what the look found to judge (`lookPrompt`): the signals no finding holds yet, the findings the
//   checks wrote alone, the owners' messages waiting for an answer, and the memory, with the rules the spec sets.
// - The run is `claude -p --output-format stream-json --verbose`, the prompt on its standard input, in a folder of its
//   own under the home (no repository's CLAUDE.md or MCP servers), its MCP config given inline and strict.
// - Its tokens are the sum `usageSum` reads (each assistant message once: input, output, cache read and write), as a
//   job's tokens count on the runner card; the seat checks in with them.
// - A run past its time is stopped (SIGTERM); a run that cannot start, or ends non-zero, says why in one line.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { usageSum } from '../ask/context.ts';
import { processEnv } from '../env/read.ts';
import { field } from '../ask/schema.ts';
import type { SeatFinding, SeatMessage, SeatNote, SeatSignal, SupervisorSeat } from './api.ts';
import type { AgentAccount } from './agents/agent.ts';
import { SEAT_TOOLS } from './supervisor-mcp.ts';

/** What one think needs: the prompt, and the signal that stops it. */
export type ThinkInput = { prompt: string; signal: AbortSignal };
/** What one think spent and how it ended: its tokens, whether it ended well, and a line saying how. */
export type Thought = { tokens: number; ok: boolean; line: string };
export type Think = (input: ThinkInput) => Promise<Thought>;

/** What the look found to judge. */
export type LookWork = {
  seat: SupervisorSeat;
  /** Open signals no finding holds yet. */
  signals: readonly SeatSignal[];
  /** Open findings a check wrote alone: no Supervisor look yet. */
  unlooked: readonly SeatFinding[];
  /** Owners' messages no answer replies to yet. */
  messages: readonly SeatMessage[];
  notes: readonly SeatNote[];
};

/** A finding the seat raised, as the runner prints it: the check that fired first, then the title. */
export const raisedLine = (finding: SeatFinding): string => `Supervisor raised: ${findingText(finding)}`;

/** Whether the look found anything to judge: a signal, a check's finding or an owner's message. */
export const hasWork = (work: Omit<LookWork, 'seat' | 'notes'>): boolean => work.signals.length + work.unlooked.length + work.messages.length > 0;

/** The rules the spec sets for the Supervisor, said once in every prompt. */
const RULES = [
  'You are the Supervisor of an Omni Loop workspace: an agent that watches its runners, jobs, scheduled tasks and missions, and brings the workspace owners what needs them.',
  'Use only your tools: snapshot, lines, memory, raise, reply, propose. They read and write this workspace only.',
  'For each signal: raise it in a finding naming its signal ids (the check that fired and its figures are shown first, before your explanation), or let it go with a short-term memory note saying why.',
  'Group signals that share one cause (one repository, one kind of wait, one failing route) into one finding with a group fingerprint; never raise one finding per job when the cause is the same.',
  'For each finding a check wrote alone: propose up to two actions on it with your explanation, or leave it.',
  'For each owner message: reply in its thread (replyTo its id), citing jobs, numbers and what you remember; quote the memory note that shaped the answer as remembered.',
  'A suggestion is only one of the actions the App already has: stop-resume-job, open-terminal, open-bug-fix, pause-mission, resume-mission, wake-mission, open-mission, clean-worktrees, copy-kit-update. Never propose a merge, an approval, a skipped check or a retry until green.',
  'Severity high only when an owner must act now; medium otherwise. One finding per cause: a group fingerprint is raised once, and a second raise of it adds its new signals.',
  'Keep lessons and baselines in long-term memory, what you watch today in short-term memory; each note one line of 300 characters at most, citing 1 to 10 ids.',
  'Never write a token, key or password, nor a person\'s personal data, in a finding, a reply or a note.',
].join('\n');

const one = (text: string | null, max = 300): string => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** A finding as the seat reads it: the check that fired and its figures first, then the explanation. */
function findingText(finding: SeatFinding): string {
  const check = finding.checkLine ?? 'Raised by the Supervisor, no check fired';
  const explained = finding.explanation === null ? 'No Supervisor look yet' : one(finding.explanation);
  return `${finding.id} · ${finding.severity} ${finding.kind} · ${finding.title} — ${check} — ${explained}`;
}

/** The prompt of one think: the rules, the seat, then what the look found. */
export function lookPrompt(work: LookWork): string {
  const section = (title: string, lines: readonly string[]): string[] => (lines.length === 0 ? [] : ['', `## ${title}`, ...lines.map((line) => `- ${line}`)]);
  return [
    RULES,
    '',
    `Seat: ${String(work.seat.tokensToday)} of ${String(work.seat.dailyTokens)} tokens used today. Read the whole workspace with snapshot when you need it.`,
    ...section('Signals no finding holds yet', work.signals.map((s) => `${s.id} · ${s.kind} · ${s.fingerprint} — ${one(s.checkLine)}`)),
    ...section('Findings a check wrote alone', work.unlooked.map(findingText)),
    ...section('Owners\' messages waiting for an answer', work.messages.map((m) => `${m.id} · thread ${m.finding ?? 'general'} · ${m.by ?? 'an owner'}: ${one(m.body, 1000)}`)),
    ...section('Memory', work.notes.map((n) => `${n.id} · ${n.scope} · ${one(n.line)}`)),
  ].join('\n');
}

/** The tokens a run spent: each assistant message once, its four counts summed. */
function runTokens(lines: readonly string[]): number {
  const usages = new Map<string, object>();
  lines.forEach((line, index) => {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (field(event, 'type') !== 'assistant') return;
    const message = field(event, 'message');
    const usage = field(message, 'usage');
    const id = field(message, 'id');
    if (typeof usage === 'object' && usage !== null) usages.set(typeof id === 'string' ? id : `line-${String(index)}`, usage);
  });
  const sum = usageSum(usages.values());
  return sum.input + sum.output + sum.cacheRead + sum.cacheWrite;
}

/** A process the think starts: its output lines, how it ended, and its kill. */
export type Spawned = { lines: AsyncIterable<string>; exit: Promise<number | null>; kill(): void };
export type SpawnThink = (file: string, args: readonly string[], options: { cwd: string; env: Readonly<Record<string, string>>; stdin: string }) => Spawned;

/** The real process: claude, its stdout read line by line. */
const spawnReal: SpawnThink = (file, args, { cwd, env, stdin }) => {
  const child = spawn(file, args, { cwd, env: { ...processEnv(), ...env }, stdio: ['pipe', 'pipe', 'ignore'] });
  const exit = new Promise<number | null>((resolve) => {
    child.on('error', () => {
      resolve(null);
    });
    child.on('close', (code) => {
      resolve(code);
    });
  });
  child.stdin.on('error', () => undefined);
  child.stdin.end(stdin);
  async function* lines(): AsyncGenerator<string> {
    let buffer = '';
    for await (const chunk of child.stdout) {
      buffer += String(chunk);
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      yield* parts;
    }
    if (buffer !== '') yield buffer;
  }
  return { lines: lines(), exit, kill: () => child.kill('SIGTERM') };
};

/** How long one think may run. */
const THINK_MS = 5 * 60_000;

export type ThinkerOptions = {
  /** The command that runs omni: `node <omni.mjs>`. */
  omni: readonly string[];
  runner: string;
  /** The Omni page the MCP server calls. */
  askUrl: string;
  home: string;
  /** The account it thinks on: its model and its secret. */
  account: AgentAccount;
  spawn?: SpawnThink | undefined;
  timeoutMs?: number | undefined;
};

/** The claude arguments of a think: headless, the seat's MCP server alone, its six tools allowed and nothing else. */
function thinkArgs({ omni, runner, askUrl, account }: Pick<ThinkerOptions, 'omni' | 'runner' | 'askUrl' | 'account'>): string[] {
  const [command = 'omni', ...rest] = omni;
  const mcp = { mcpServers: { supervisor: { command, args: [...rest, 'supervisor', 'mcp', '--runner', runner, '--page', askUrl] } } };
  return [
    '-p', '--output-format', 'stream-json', '--verbose',
    '--strict-mcp-config', '--mcp-config', JSON.stringify(mcp),
    '--allowedTools', SEAT_TOOLS.map((tool) => `mcp__supervisor__${tool}`).join(','),
    '--disallowedTools', 'Bash,Edit,Write,MultiEdit,NotebookEdit,WebFetch,WebSearch,Task',
    ...(account.model === null ? [] : ['--model', account.model]),
  ];
}

/** The seat's think on Claude Code. */
export function claudeThinker(options: ThinkerOptions): Think {
  const run = options.spawn ?? spawnReal;
  const cwd = join(options.home, '.omni-supervisor');
  return async ({ prompt, signal }) => {
    mkdirSync(cwd, { recursive: true });
    const env = options.account.secret === null ? {} : { CLAUDE_CODE_OAUTH_TOKEN: options.account.secret };
    const child = run('claude', thinkArgs(options), { cwd, env, stdin: `${prompt}\n` });
    const timing = { late: false };
    const stop = (): void => {
      child.kill();
    };
    const timer = setTimeout(() => {
      timing.late = true;
      stop();
    }, options.timeoutMs ?? THINK_MS);
    signal.addEventListener('abort', stop, { once: true });
    const lines: string[] = [];
    try {
      for await (const line of child.lines) lines.push(line);
      const code = await child.exit;
      const tokens = runTokens(lines);
      if (timing.late) return { tokens, ok: false, line: `stopped after ${String(Math.round((options.timeoutMs ?? THINK_MS) / 60_000))} min` };
      if (code === null) return { tokens, ok: false, line: 'claude could not start' };
      return code === 0 ? { tokens, ok: true, line: 'thought' } : { tokens, ok: false, line: `claude ended ${String(code)}` };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
    }
  };
}
