// The `t3` agent (PRD 2537, "Agents behind one adapter"): T3 Code runs the coding CLIs, each of its
// provider instances signed in to one account, and the runner tells it what to do. An account with an
// `instance` runs through it.
//
// - **check:** `t3` runs, T3's server runs (`t3-home.ts`), and it knows the account's instance,
//   enabled and signed in; else `T3 is not installed`, `T3 not running`, `no such instance` or `not
//   signed in`. T3 takes an instance and a model together, so the account names its model.
// - **command:** `omni runner t3-run --instance <instance> --model <model>` in the job's worktree, the
//   message on its standard input (`t3-run.ts` adds the worktree as a T3 project, starts the thread,
//   follows it and prints what it reads). A Claude instance gets the job's line as it is (the trial on
//   T3 0.1.3 showed a T3 Claude thread lists every `/omni:` skill of the installed plugin); a Codex or
//   OpenCode instance gets it as words: `Use the omni-yolo skill with these arguments: 7`.
// - **step:** a Claude instance's transcript lines read as `steps.ts` reads Claude's stream; T3's own
//   lines name the thread, each new message, a stop, and the run's end (a `Done:` line, then the
//   hand-off and the pull requests it names, as a Claude run's result gives them).
// - **usage and context:** from the Claude instance's own transcripts for the worktree (PRD 2102), never
//   from T3, which gives no tokens. T3 shows no usage percent outside its app: usage hands off at the
//   wall only.
// - **limit:** a run that failed on T3's usage-limit words (`Claude usage limit reached…`, `Codex usage
//   limit reached…`, `…rate limit reached`), its reset counted from the run's end when T3 says `resets
//   in 2h 30m`, else none. A run waiting for an answer, or any other failure, is no limit.
// - **session, interrupt, resume:** the thread; a stop by SIGINT, which the T3 run turns into
//   `t3_thread_interrupt` through T3's MCP endpoint, open only once `omni runner t3-signin` signed the
//   runner in (`../t3-mcp.ts`), else `null`; the resume is `t3-run --thread <thread>`.
import { homedir } from 'node:os';
import { field } from '../../ask/schema.ts';
import type { ExecText } from '../../context.ts';
import { readAccounts } from '../accounts.ts';
import { LINE_CUT, stepLine } from '../steps.ts';
import type { StepContext } from '../steps.ts';
import { readT3Credential } from '../t3-mcp.ts';
import { tokenSource } from '../tokens.ts';
import type { Agent, AgentAccount, AgentJob, ContextPressure, Run, RunCommand } from './agent.ts';
import { t3HomeOf, t3Instance, t3Origin } from './t3-home.ts';

/** The agent's name, as an account's `agent` gives it. */
const T3_AGENT = 't3';

/** What the `t3` agent is built with; each has the real machine's as its default. */
export type T3Deps = {
  /** The person's home: the accounts file, the T3 sign-in and the Claude folders are under it. */
  home?: string | undefined;
  /** T3's home: `~/.t3` unless given. */
  t3Home?: string | undefined;
  /** Runs the check's `t3 --version`. */
  exec?: ExecText | undefined;
  /** The command that runs omni, before its own arguments: this process's node and script unless given. */
  omni?: readonly string[] | undefined;
  /** Whether a process lives: the check of T3's server. */
  alive?: ((pid: number) => boolean) | undefined;
  /** The instance an account runs on: read from the accounts file unless given. */
  instanceOf?: ((account: string) => string | null) | undefined;
  now?: (() => number) | undefined;
};

/** A model's context window, in tokens, unless its name says a million. */
const WINDOW = 200_000;
const WINDOW_1M = 1_000_000;

/** How long a run has to stop after SIGINT before it gets SIGTERM: the stop through T3 included. */
const STOP_GRACE_MS = 30_000;

/** T3's words for a run that ended on its account's usage limit. */
const LIMIT_WORDS = /usage limit (?:was )?reached|rate limit reached|hit your (?:usage )?limit/i;

/** The wait T3 names for a reset: `resets in 2h 30m`, `resets in 1d 3h`, `resets in 45m`. */
const RESETS_IN = /resets in (?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?/;

/** A job's line: a fixed skill's or a repository's own, and its arguments. */
const LINE = /^\/(omni:)?([a-z][a-z0-9-]*)(?: (.*))?$/s;

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);

/** The run's lines that parse as JSON objects, in order. */
function eventsOf(run: Run): object[] {
  return run.lines.flatMap((each) => {
    try {
      const event: unknown = JSON.parse(each);
      return typeof event === 'object' && event !== null && !Array.isArray(event) ? [event] : [];
    } catch {
      return [];
    }
  });
}

/** The run's last line of T3's of type `type`. */
const lastOf = (events: readonly object[], type: string): object | undefined => events.filter((event) => field(event, 'type') === type).at(-1);

/** The job's line as words, for an agent that reads skills by their names. */
function lineAsWords(line: string): string {
  const parsed = LINE.exec(line);
  if (parsed === null) return line;
  const skill = `${parsed[1] === undefined ? '' : 'omni-'}${parsed[2] ?? ''}`;
  const args = (parsed[3] ?? '').trim();
  return args === '' ? `Use the ${skill} skill.` : `Use the ${skill} skill with these arguments: ${args}`;
}

/** `hh:mm:ss text`, in the runner's local time, cut as `steps.ts` cuts its lines. */
function stamped(context: StepContext, texts: readonly string[]): string[] {
  const at = context.now ?? new Date();
  const time = [at.getHours(), at.getMinutes(), at.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
  return texts.map((text) => `${time} ${text}`.slice(0, LINE_CUT));
}

/** How long a run went, in plain words. */
const tookWords = (ms: number): string => (ms < 60_000 ? 'under a minute' : `${String(Math.round(ms / 60_000))} min`);

/** The lines of a run's end: its `Done:` line, then the hand-off and its pull requests, or the reason it failed. */
function endLines(event: object, context: StepContext): string[] {
  const status = textOf(field(event, 'status'));
  const done = `Done: ${status === 'completed' ? 'ok' : 'error'} · T3 ${status} · ${tookWords(count(field(event, 'ms')))}`;
  if (status === 'completed') {
    const handOff = stepLine(JSON.stringify({ type: 'result', subtype: 'success', result: textOf(field(event, 'reply')) }), context).slice(1);
    return [...stamped(context, [done]), ...handOff];
  }
  if (status === 'waiting') return stamped(context, [done, '✗ waiting for an answer in T3: a runner job cannot give one, so the job fails']);
  const error = textOf(field(event, 'error')).split('\n').find((each) => each.trim() !== '');
  return stamped(context, error === undefined ? [done] : [done, `✗ ${error.trim()}`]);
}

/** The readable lines of one of T3's own lines. */
function t3Lines(event: object, context: StepContext): string[] {
  switch (field(event, 'type')) {
    case 't3.thread':
      return stamped(context, [`T3: thread ${textOf(field(event, 'threadId'))} on ${textOf(field(event, 'instance'))} (${textOf(field(event, 'model'))})`]);
    case 't3.show': {
      const messages = field(event, 'messages');
      const said = Array.isArray(messages) ? messages.map((message: unknown) => textOf(message).split('\n').find((each) => each.trim() !== '')?.trim() ?? '').filter((each) => each !== '') : [];
      return stamped(context, said.map((each) => `› ${each}`));
    }
    case 't3.interrupt': {
      const refused = textOf(field(event, 'refused'));
      return stamped(context, [refused === '' ? `T3: stop asked (${textOf(field(event, 'status'))})` : `✗ T3 could not stop the run: ${refused}`]);
    }
    case 't3.end':
      return endLines(event, context);
    default:
      return [];
  }
}

/** When a limit resets: the wait T3 named, counted from the run's end; `null` when it named none. */
function resetOf(error: string, end: object): string | null {
  const wait = RESETS_IN.exec(error);
  const at = Date.parse(textOf(field(end, 'at')));
  if (wait === null || (wait[1] ?? wait[2] ?? wait[3]) === undefined || Number.isNaN(at)) return null;
  const minutes = Number(wait[1] ?? 0) * 24 * 60 + Number(wait[2] ?? 0) * 60 + Number(wait[3] ?? 0);
  return new Date(at + minutes * 60_000).toISOString();
}

/** The run's context: the last real assistant message of the Claude instance's transcript against the model's window. */
function contextOf(events: readonly object[]): ContextPressure | null {
  const last = events.filter((event) => field(event, 'type') === 'assistant' && typeof field(field(event, 'message'), 'usage') === 'object' && field(field(event, 'message'), 'model') !== '<synthetic>').at(-1);
  if (last === undefined) return null;
  const usage = field(field(last, 'message'), 'usage');
  const used = ['input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'output_tokens'].reduce((sum, key) => sum + count(field(usage, key)), 0);
  const model = textOf(field(lastOf(events, 't3.thread'), 'model'));
  return { used, window: model.endsWith('[1m]') ? WINDOW_1M : WINDOW };
}

/** The instance the account `id` names in the accounts file under `home`, or `null`. */
function instanceInFile(home: string, id: string): string | null {
  try {
    return readAccounts({ home }).accounts.find((account) => account.id === id && account.agent === T3_AGENT)?.instance ?? null;
  } catch {
    return null;
  }
}

/** Whether `t3 --version` runs. */
function installed(exec: ExecText): boolean {
  try {
    exec('t3', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

/** The process `exec` runs a check with: none given, `t3` is never run. */
const NO_EXEC: ExecText = () => {
  throw new Error('no exec given');
};

/** The `t3` agent. */
export function t3Agent(deps: T3Deps = {}): Agent {
  const home = deps.home ?? homedir();
  const t3Home = deps.t3Home ?? t3HomeOf(home);
  const exec = deps.exec ?? NO_EXEC;
  const [file = 'omni', ...omniArgs] = deps.omni ?? [process.execPath, process.argv[1] ?? 'omni'];
  const instanceOf = deps.instanceOf ?? ((id: string) => instanceInFile(home, id));
  const now = deps.now ?? Date.now;

  /** The run of `account` in a job's worktree: `--thread` resumes that thread. */
  const run = (account: AgentAccount, stdin: string, thread?: string): RunCommand => ({
    file,
    args: [...omniArgs, 'runner', 't3-run', '--instance', instanceOf(account.id) ?? account.id, ...(account.model === null ? [] : ['--model', account.model]), ...(thread === undefined ? [] : ['--thread', thread])],
    env: {},
    stdin,
  });

  /** The job's line as the account's instance reads it: as words unless it runs Claude. */
  const lineFor = (job: AgentJob, account: AgentAccount): string => {
    const instance = t3Instance(t3Home, home, instanceOf(account.id) ?? account.id);
    return instance !== null && !instance.claude ? lineAsWords(job.line) : job.line;
  };

  return {
    name: T3_AGENT,
    check(account) {
      const id = instanceOf(account.id);
      if (id === null) return 'no such instance';
      if (account.model === null) return 'no model: a T3 account names the model it runs';
      if (!installed(exec)) return 'T3 is not installed';
      if (t3Origin(t3Home, deps.alive) === null) return 'T3 not running';
      const instance = t3Instance(t3Home, home, id);
      if (instance === null || !instance.enabled) return 'no such instance';
      return instance.signedIn ? null : 'not signed in';
    },
    command(job, account, handoff) {
      const line = lineFor(job, account);
      return run(account, handoff === undefined ? `${line}\n` : `${line}\n\n${handoff}\n`);
    },
    step(each, context) {
      let event: unknown;
      try {
        event = JSON.parse(each);
      } catch {
        return stepLine(each, context);
      }
      const type = textOf(field(event, 'type'));
      return typeof event === 'object' && event !== null && type.startsWith('t3.') ? t3Lines(event, context) : stepLine(each, context);
    },
    usage(ran) {
      const thread = lastOf(eventsOf(ran), 't3.thread');
      const projects = thread === undefined ? null : t3Instance(t3Home, home, textOf(field(thread, 'instance')))?.projects ?? null;
      if (projects === null) return null;
      const tokens = tokenSource({ projects, now }).job(ran.cwd);
      const model = textOf(field(thread, 'model'));
      return tokens === null ? null : { tokens, model: model === '' ? null : model };
    },
    limit(ran) {
      if (ran.exit === null) return null;
      const end = lastOf(eventsOf(ran), 't3.end');
      if (end === undefined || field(end, 'status') !== 'failed') return null;
      const error = textOf(field(end, 'error'));
      return LIMIT_WORDS.test(error) ? { resetsAt: resetOf(error, end) } : null;
    },
    pressure(ran) {
      return { usage: null, context: contextOf(eventsOf(ran)) };
    },
    session(ran) {
      const events = eventsOf(ran);
      const thread = textOf(field(lastOf(events, 't3.thread') ?? lastOf(events, 't3.end'), 'threadId'));
      return thread === '' ? null : thread;
    },
    interrupt() {
      return readT3Credential(home, now) === null ? null : { kind: 'signal', first: 'SIGINT', then: 'SIGTERM', afterMs: STOP_GRACE_MS };
    },
    resume(_job, account, session, prompt) {
      return run(account, `${prompt}\n`, session);
    },
  };
}
