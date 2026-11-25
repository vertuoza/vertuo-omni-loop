// The `claude` agent (PRD 2537, "Agents behind one adapter"): Claude Code run directly, as a runner
// ran every job before there were agents (PRD 1830, PRD 1904). A run is
// `claude --dangerously-skip-permissions -p --output-format stream-json --verbose`, the job's line on
// its standard input, `--model` when the account names one, and the account's own secret, when it has
// one, as `CLAUDE_CODE_OAUTH_TOKEN` for that run only. A job of a repository's own skill whose worktree
// holds `.mcp.json` loads it too (PRD 2313).
//
// Everything else is read from the run's stream-json lines:
// - its readable lines are `steps.ts`'s;
// - its tokens come from Claude's transcripts for the job's worktree (`tokens.ts`, PRD 2102), its
//   model from the `init` event;
// - the limit is a run that failed (an `is_error` result, or a non-zero exit) on Claude's usage limit:
//   a `rate_limit_event` whose status is `rejected`, Claude's synthetic `rate_limit` message, or its
//   words (`usage limit reached`, `hit your limit`, `<window> limit reached`). The reset is the
//   rejected event's `resetsAt`, else the epoch an older message ends with (`…reached|<epoch>`), else
//   none;
// - the pressure is the last `rate_limit_event` (its status, `allowed_warning` past a threshold, its
//   window, its reset, and a percent only when it gives a `utilization`) and the context of the last
//   real assistant message: its input, cache and output tokens against the model's window (200,000
//   tokens; a million for a `[1m]` model);
// - the session is the one its events name; it resumes with `--resume <session>`, and stops with
//   SIGINT, then SIGTERM after 30 seconds;
// - a run that exited 0 is waiting (bug 3288) when its last words (the `result`'s text, else the last
//   thing it said) say it waits and name its background work or a notification, or say it waits while
//   a command it sent to the background (a tool result naming its ID, or a backgrounded `task_started`)
//   never reported its end (a `task_notification`, or a `<task-notification>` naming its ID).
// A line that does not parse is a readable line as it is and counts for nothing else.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { field } from '../../ask/schema.ts';
import type { ExecText } from '../../context.ts';
import { checkRunnerLine } from '../line.ts';
import { stepLine } from '../steps.ts';
import { tokenSource } from '../tokens.ts';
import type { Agent, AgentAccount, AgentJob, ContextPressure, Limit, Run, RunCommand, UsagePressure } from './agent.ts';

/** The program a run starts. */
const CLAUDE = 'claude';

/** The arguments claude runs a job with: unattended, printing one JSON event per line. */
const CLAUDE_ARGS: readonly string[] = ['--dangerously-skip-permissions', '-p', '--output-format', 'stream-json', '--verbose'];

/** The MCP servers a repository declares, in its worktree's root. */
const MCP_CONFIG = '.mcp.json';

/** The variable a run reads its account's token from (PRD 1894). */
const TOKEN_VARIABLE = 'CLAUDE_CODE_OAUTH_TOKEN';

/** A model's context window, in tokens, unless its name says a million. */
const CONTEXT_WINDOW = 200_000;
const MILLION_WINDOW = 1_000_000;

/** How long a run has to stop after SIGINT before it gets SIGTERM. */
const INTERRUPT_GRACE_MS = 30_000;

/** The name Claude gives a message it wrote itself (a limit, an error), which spent no tokens. */
const SYNTHETIC = '<synthetic>';

/** Claude's words for its usage limit, and never for a server that is only busy. */
const LIMIT_WORDS = /usage limit reached|hit your (?:usage )?limit|\b(?:5-hour|five-hour|weekly|session|opus|sonnet) limit reached/i;

/** Last words that wait: the turn ends meaning to carry on later (bug 3288). */
const WAITS = /\b(?:wait(?:s|ing)?|continue when|carry on when)\b/i;

/** Last words naming what they wait on as the run's own background work, or its notification. */
const ON_BACKGROUND = /\b(?:background|notif(?:y|ies|ied|ication))\b/i;

/** The ID of a command a tool result says went to the background, past its timeout or from the start. */
const SENT_BACK = /(?:moved to the background \(ID: |running in background with ID: )([\w-]+)/g;

/** The ID a `<task-notification>` names. */
const NOTIFIED = /<task-id>([\w-]+)<\/task-id>/g;

/** The epoch an older limit message ends with: `Claude AI usage limit reached|1793206800`. */
const LIMIT_EPOCH = /\|(\d{10,13})\s*$/;

type Event = object;

/** The type an event names. */
const kind = (event: Event): unknown => field(event, 'type');

/** The run's lines that parse as a JSON object, in order. */
function eventsOf(run: Run): Event[] {
  return run.lines.flatMap((line) => {
    try {
      const event: unknown = JSON.parse(line);
      return typeof event === 'object' && event !== null && !Array.isArray(event) ? [event] : [];
    } catch {
      return [];
    }
  });
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
const numberOf = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const count = (value: unknown): number => Math.max(0, Math.trunc(numberOf(value) ?? 0));

/** An epoch in seconds (or milliseconds, past 10^12) as an ISO time; `null` for anything else. */
function isoOf(epoch: unknown): string | null {
  const value = numberOf(epoch);
  if (value === null || value <= 0) return null;
  return new Date(value < 1e12 ? value * 1000 : value).toISOString();
}

/** The text an assistant message says, its text blocks joined. */
function saidBy(event: Event): string {
  const content = field(field(event, 'message'), 'content');
  if (!Array.isArray(content)) return '';
  return content.map((block: unknown) => (field(block, 'type') === 'text' ? textOf(field(block, 'text')) : '')).join('\n');
}

/** A message's content as text: a string, or its text and tool results' text joined. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((block: unknown) => (field(block, 'type') === 'tool_result' ? contentText(field(block, 'content')) : textOf(field(block, 'text')))).join('\n');
}

/** The run's last words: its `result`'s text, else the last thing it said. */
function lastWords(events: readonly Event[]): string {
  const last = events.filter((event) => kind(event) === 'result' || (kind(event) === 'assistant' && saidBy(event) !== '')).at(-1);
  if (last === undefined) return '';
  return kind(last) === 'result' ? textOf(field(last, 'result')) : saidBy(last);
}

/** The IDs `pattern` captures in `text`. */
const idsIn = (text: string, pattern: RegExp): string[] => [...text.matchAll(pattern)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));

/** The text a user event carries: its tool results' output and its notifications. */
const userText = (event: Event): string => contentText(field(field(event, 'message'), 'content'));

/** The task ID a system event of `subtype` names, as a list of none or one. */
function systemTask(event: Event, subtype: string): string[] {
  const id = textOf(field(event, 'task_id'));
  return field(event, 'subtype') === subtype && id !== '' ? [id] : [];
}

/** The IDs of the commands an event says went to the background: a backgrounded `task_started`, or a tool result naming one. */
function sentBack(event: Event): string[] {
  if (kind(event) === 'system') return field(event, 'is_backgrounded') === true ? systemTask(event, 'task_started') : [];
  return kind(event) === 'user' ? idsIn(userText(event), SENT_BACK) : [];
}

/** The IDs of the tasks an event says ended: a `task_notification`, or a `<task-notification>` naming one. */
function endedTasks(event: Event): string[] {
  if (kind(event) === 'system') return systemTask(event, 'task_notification');
  return kind(event) === 'user' ? idsIn(userText(event), NOTIFIED) : [];
}

/** Whether a command the run sent to the background never reported its end. */
function backgroundLeft(events: readonly Event[]): boolean {
  const ended = new Set(events.flatMap(endedTasks));
  return events.flatMap(sentBack).some((id) => !ended.has(id));
}

/** Whether a run that exited 0 ended with its last turn waiting on its own background work (bug 3288). */
function endedWaiting(run: Run): boolean {
  if (run.exit !== 0) return false;
  const events = eventsOf(run);
  if (events.some((event) => kind(event) === 'result' && field(event, 'is_error') === true)) return false;
  const words = lastWords(events);
  return WAITS.test(words) && (ON_BACKGROUND.test(words) || backgroundLeft(events));
}

/** The `rate_limit_info` of each rate limit event, in order. */
const rateLimits = (events: readonly Event[]): unknown[] => events.filter((event) => kind(event) === 'rate_limit_event').map((event) => field(event, 'rate_limit_info'));

/** The model the run's `init` event names, or `null`. */
function modelOf(events: readonly Event[]): string | null {
  const init = events.find((event) => kind(event) === 'system' && field(event, 'subtype') === 'init');
  const model = textOf(field(init, 'model'));
  return model === '' ? null : model;
}

/** The arguments of a run of `account`: the model when it names one. */
const accountArgs = (account: AgentAccount): string[] => (account.model === null ? [] : ['--model', account.model]);

/** The variables a run of `account` adds: its token, when it has one. */
const accountEnv = (account: AgentAccount): Record<string, string> => (account.secret === null ? {} : { [TOKEN_VARIABLE]: account.secret });

/**
 * The arguments a job's line runs with in `cwd`. A line of a repository's own skill (PRD 2313) — any
 * line but a fixed skill's, since the runner let nothing else through — loads the repository's MCP
 * servers when the worktree holds `.mcp.json`; allowing the skill allowed them.
 */
function mcpArgs(job: AgentJob): string[] {
  if (checkRunnerLine(job.line).ok || !existsSync(join(job.cwd, MCP_CONFIG))) return [];
  return ['--mcp-config', MCP_CONFIG];
}

/** Whether the run failed on Claude's usage limit, as the events say it. */
function endedOnLimit(events: readonly Event[]): boolean {
  if (rateLimits(events).some((info) => field(info, 'status') === 'rejected')) return true;
  return events.some((event) => {
    if (kind(event) === 'assistant') return field(event, 'error') === 'rate_limit' || (field(field(event, 'message'), 'model') === SYNTHETIC && LIMIT_WORDS.test(saidBy(event)));
    return kind(event) === 'result' && LIMIT_WORDS.test(textOf(field(event, 'result')));
  });
}

/** When the limit resets: the rejected event's time, else the epoch a limit message ends with. */
function resetOf(events: readonly Event[]): string | null {
  const rejected = rateLimits(events).filter((info) => field(info, 'status') === 'rejected').at(-1);
  const fromEvent = isoOf(field(rejected, 'resetsAt'));
  if (fromEvent !== null) return fromEvent;
  for (const event of [...events].reverse()) {
    const words = kind(event) === 'result' ? textOf(field(event, 'result')) : kind(event) === 'assistant' ? saidBy(event) : '';
    const epoch = LIMIT_EPOCH.exec(words)?.[1];
    if (epoch !== undefined) return isoOf(Number(epoch));
  }
  return null;
}

/** The account's usage, as the last rate limit event gives it. */
function usagePressure(events: readonly Event[]): UsagePressure | null {
  const info = rateLimits(events).at(-1);
  if (typeof info !== 'object' || info === null) return null;
  const utilization = numberOf(field(info, 'utilization'));
  const status = textOf(field(info, 'status'));
  const window = textOf(field(info, 'rateLimitType'));
  return {
    percent: utilization === null ? null : Math.round(utilization * 100),
    status: status === '' ? null : status,
    window: window === '' ? null : window,
    resetsAt: isoOf(field(info, 'resetsAt')),
  };
}

/** The run's context: the last real assistant message's tokens against the model's window. */
function contextPressure(events: readonly Event[]): ContextPressure | null {
  const last = events.filter((event) => kind(event) === 'assistant' && field(field(event, 'message'), 'model') !== SYNTHETIC && typeof field(field(event, 'message'), 'usage') === 'object').at(-1);
  if (last === undefined) return null;
  const usage = field(field(last, 'message'), 'usage');
  const used = count(field(usage, 'input_tokens')) + count(field(usage, 'cache_read_input_tokens')) + count(field(usage, 'cache_creation_input_tokens')) + count(field(usage, 'output_tokens'));
  const model = modelOf(events) ?? '';
  return { used, window: model.endsWith('[1m]') ? MILLION_WINDOW : CONTEXT_WINDOW };
}

/** Whether `claude args` runs and exits 0, with its output. */
function runs(exec: ExecText, args: readonly string[]): { ok: boolean; out: string } {
  try {
    return { ok: true, out: exec(CLAUDE, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }) };
  } catch {
    return { ok: false, out: '' };
  }
}

/** The process `exec` runs a check with: none given, the command is never run. */
const NO_EXEC: ExecText = () => {
  throw new Error('no exec given');
};

/**
 * The `claude` agent. `projects` is where Claude keeps its transcripts (`~/.claude/projects` unless
 * given); `exec` runs the checks.
 */
export function claudeAgent({ projects = join(homedir(), '.claude', 'projects'), exec = NO_EXEC }: { projects?: string; exec?: ExecText } = {}): Agent {
  const tokens = tokenSource({ projects });
  return {
    name: CLAUDE,
    check(account) {
      if (!runs(exec, ['--version']).ok) return 'claude is not installed';
      if (account.secret !== null) return account.secret.trim() === '' ? 'not signed in' : null;
      const status = runs(exec, ['auth', 'status']);
      return !status.ok || /"loggedIn"\s*:\s*false/.test(status.out) ? 'not signed in' : null;
    },
    command(job, account, handoff): RunCommand {
      const stdin = handoff === undefined ? `${job.line}\n` : `${job.line}\n\n${handoff}\n`;
      return { file: CLAUDE, args: [...CLAUDE_ARGS, ...accountArgs(account), ...mcpArgs(job)], env: accountEnv(account), stdin };
    },
    step(line, context) {
      return stepLine(line, context);
    },
    usage(run) {
      const counts = tokens.job(run.cwd);
      return counts === null ? null : { tokens: counts, model: modelOf(eventsOf(run)) };
    },
    limit(run): Limit | null {
      if (run.exit === null) return null;
      const events = eventsOf(run);
      const failed = run.exit !== 0 || events.some((event) => kind(event) === 'result' && field(event, 'is_error') === true);
      if (!failed || !endedOnLimit(events)) return null;
      return { resetsAt: resetOf(events) };
    },
    pressure(run) {
      const events = eventsOf(run);
      return { usage: usagePressure(events), context: contextPressure(events) };
    },
    session(run) {
      const named = eventsOf(run).find((event) => textOf(field(event, 'session_id')) !== '');
      return named === undefined ? null : textOf(field(named, 'session_id'));
    },
    interrupt() {
      return { kind: 'signal', first: 'SIGINT', then: 'SIGTERM', afterMs: INTERRUPT_GRACE_MS };
    },
    resume(_job, account, session, prompt) {
      return { file: CLAUDE, args: [...CLAUDE_ARGS, ...accountArgs(account), '--resume', session], env: accountEnv(account), stdin: `${prompt}\n` };
    },
    waiting(run) {
      return endedWaiting(run);
    },
  };
}
