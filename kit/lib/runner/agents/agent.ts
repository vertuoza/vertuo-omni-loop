// The shape every agent a runner runs a job with fits (PRD 2537, "Agents behind one adapter"): how one
// account's work starts, reads and ends. A job's process (`../job.ts`) only ever speaks to this shape,
// so a new agent is a new module beside `claude.ts` and a line in `index.ts`, never a change to the job.
//
// - `check`: whether the account can run now, or the one line saying why not.
// - `command`: the program, its arguments, the variables it adds and its standard input, for one run.
// - `step`: one line of the run's output as the readable lines the log and the Terminal show.
// - `usage`: the run's tokens and the model's name, or `null` when they cannot be read.
// - `limit`: whether the run ended on the account's usage limit, with the reset time the agent gave.
// - `pressure`: read while the run goes: the account's usage and the run's context, each `null` when
//   the agent does not say.
// - `session`, `interrupt`, `resume`: the run's session, how to stop it cleanly (`null` when the agent
//   offers no clean stop), and the command that continues that session with one more message.
import type { StepContext } from '../steps.ts';
import type { TokenCounts } from '../tokens.ts';

/** One account as an agent sees it: its name, the model it runs (`null`: the agent's own), and its secret's value (`null`: none of its own). */
export type AgentAccount = { id: string; model: string | null; secret: string | null };

/** The job one run works on: its line (`/omni:yolo 7`, no trailing newline) and its worktree. */
export type AgentJob = { line: string; cwd: string };

/** One run's process: the program, its arguments, the variables it adds to the job's, and its standard input. */
export type RunCommand = { file: string; args: readonly string[]; env: Readonly<Record<string, string>>; stdin: string };

/** What a run printed, one raw line each, in its worktree, and its exit code (`null` while it goes). */
export type Run = { cwd: string; lines: readonly string[]; exit: number | null };

/** A run that ended on its account's usage limit: when the limit resets (ISO time), `null` when the agent gave no time. */
export type Limit = { resetsAt: string | null };

/** How full the account's usage window is: a percent when the agent gives one, its status, the window's name and its reset. */
export type UsagePressure = { percent: number | null; status: string | null; window: string | null; resetsAt: string | null };

/** How full the run's context is, in tokens. */
export type ContextPressure = { used: number; window: number };

/** What a run reads while it goes; each part `null` when the agent does not say. */
export type Pressure = { usage: UsagePressure | null; context: ContextPressure | null };

/** A run's tokens and the model that spent them. */
export type Usage = { tokens: TokenCounts; model: string | null };

/** A clean stop by signals: the first, then the second when the run still goes after `afterMs`. */
export type Interrupt = { kind: 'signal'; first: NodeJS.Signals; then: NodeJS.Signals; afterMs: number };

/** One agent: how a runner runs, reads and ends an account's work. */
export type Agent = {
  /** The agent's name, as an account names it. */
  name: string;
  /** `null` when the account can run now, else the one line saying why not. */
  check(account: AgentAccount): string | null;
  /** The run of `job` on `account`; `handoff`, when given, is the takeover message sent after the job's line. */
  command(job: AgentJob, account: AgentAccount, handoff?: string): RunCommand;
  /** The readable lines of one line the run printed; pass the same `context` for a whole run. */
  step(line: string, context: StepContext): string[];
  /** The run's tokens and model, or `null` when they cannot be read. */
  usage(run: Run): Usage | null;
  /** The limit the run ended on, or `null`: a run that did not end on its account's limit, a crash, or output that does not parse. */
  limit(run: Run): Limit | null;
  /** The account's usage and the run's context, as far as the run has printed. */
  pressure(run: Run): Pressure;
  /** The run's session, or `null` when it named none. */
  session(run: Run): string | null;
  /** How to stop the run cleanly, keeping its session; `null` when the agent offers no clean stop. */
  interrupt(run: Run): Interrupt | null;
  /** The run that continues `session` on `account` with one more message, `prompt`, in `job`'s worktree. */
  resume(job: AgentJob, account: AgentAccount, session: string, prompt: string): RunCommand;
};
