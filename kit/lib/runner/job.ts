// What runs inside a job's tmux session (PRD 1830, "Each job"; PRD 1904, "One readable line per
// step"): `pnpm install --frozen-lockfile` when the worktree has a lockfile, then the job's run on its
// account, through that account's agent (PRD 2537, `agents/`): the agent says which program runs, with
// which arguments, variables and standard input, the job's line among them, read from a file: no
// shell ever sees the line. The run prints one line per event; the agent turns each into its readable
// lines, written to the job's log and to the session, for a person attached to it, while the raw
// output goes to `job-<id>.jsonl` beside the log and never leaves the machine. The install's output
// and the run's standard error are written as they are. The exit code goes to a file of its own once
// the run ends, which is how the runner learns it ended. A job with no account given runs on the
// fallback agent's one account, as every job ran before there were accounts.
//
// A job given its runner's accounts turns over (PRD 2537, s3, `turnover.ts`): a run that ends on its
// account's usage limit marks that account out and the job carries on, in the same worktree, on the next
// account that can take it, with the runner's handoff note; at most three times. Every run is a part of
// the job, kept in `job-<id>.parts.json` beside the log for the runner to report; a job with no accounts
// has its one part too.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { processEnv } from '../env/read.ts';
import { chooseAccount } from './accounts.ts';
import type { Account } from './accounts.ts';
import type { Agent, AgentAccount, Limit, RunCommand, Usage } from './agents/agent.ts';
import { fallbackAccount, fallbackAgent } from './agents/index.ts';
import { checkRunnerLine } from './line.ts';
import type { Out } from './runner.ts';
import { CAP_REASON, GUESSED_RESET_MS, handoffPath, LIMIT_WHY, masked, MAX_ACCOUNT_CHANGES, noTokensReason, partsPath, runnerNote, takeoverLine, tokensSince, writeParts } from './turnover.ts';
import type { JobPart, PartsRecord, Turnover } from './turnover.ts';

/** The files a job's run reads and writes. */
export type JobFiles = { line: string; log: string; exit: string };

/** The lockfile whose presence makes the run install first. */
const LOCKFILE = 'pnpm-lock.yaml';

/** Where a job's raw stream goes: its log's path with `.jsonl` for `.log`. */
export function rawLogPath(log: string): string {
  return `${log.replace(/\.log$/, '')}.jsonl`;
}

/** The variables a process starts with. */
type Variables = Readonly<Record<string, string | undefined>>;

/** What one run writes: the log and the pane, each chunk of its standard output, and its variables. */
type RunTo = { cwd: string; stdin: string | null; log: string; out: Out; env?: Variables | undefined; stdout?: (chunk: Buffer) => void };

/** Runs `file args` in `cwd`, `stdin` written to its standard input; its standard output goes to `stdout` when given, else as it is, its standard error as it is. Answers its exit code. */
function run(file: string, args: readonly string[], { cwd, stdin, log, out, env, stdout }: RunTo): Promise<number> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(file, args, { cwd, stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'], ...(env ? { env } : {}) });
    } catch {
      resolve(127);
      return;
    }
    const write = (chunk: Buffer): void => {
      appendFileSync(log, chunk);
      out.write(chunk.toString('utf8'));
    };
    child.stdout?.on('data', stdout ?? write);
    child.stderr?.on('data', write);
    child.stdin?.on('error', () => {
      // A run that exits before reading its input leaves nothing to write it to.
    });
    if (stdin !== null) child.stdin?.end(stdin);
    child.on('error', () => {
      appendFileSync(log, `${file}: could not be started\n`);
      resolve(127);
    });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

/** Reads a run's standard output whole lines at a time: each raw to `raw` and to `printed`, its readable lines, as `agent` reads them, to the log and the pane. */
function streamReader({ agent, log, raw, out, printed }: { agent: Agent; log: string; raw: string; out: Out; printed: string[] }): { chunk(data: Buffer): void; end(): void } {
  const context = { seen: new Set<string>() };
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const emit = (line: string): void => {
    printed.push(line);
    const lines = agent.step(line, context);
    if (lines.length === 0) return;
    const text = `${lines.join('\n')}\n`;
    appendFileSync(log, text);
    out.write(text);
  };
  return {
    chunk(data) {
      appendFileSync(raw, data);
      const parts = (pending + decoder.write(data)).split('\n');
      pending = parts.pop() ?? '';
      for (const line of parts) emit(line);
    },
    end() {
      pending += decoder.end();
      if (pending !== '') emit(pending);
      pending = '';
    },
  };
}

/** The variables a run starts with: the job's (`env`, else this process's), plus the ones its command adds. */
function runEnv(env: Readonly<Record<string, string>> | undefined, command: RunCommand): Variables | undefined {
  if (Object.keys(command.env).length === 0) return env;
  return { ...(env ?? processEnv()), ...command.env };
}

/** One run of the job on one account: what it printed, line by line, and its exit code. */
async function runOnce({ cwd, files, out, env, agent, command }: { cwd: string; files: JobFiles; out: Out; env: Variables | undefined; agent: Agent; command: RunCommand }): Promise<{ code: number; printed: string[] }> {
  const printed: string[] = [];
  const reader = streamReader({ agent, log: files.log, raw: rawLogPath(files.log), out, printed });
  try {
    const code = await run(command.file, command.args, { cwd, stdin: command.stdin, log: files.log, out, env, stdout: (chunk) => { reader.chunk(chunk); } });
    return { code, printed };
  } finally {
    reader.end();
  }
}

/** The fixed skill a job's line runs, `null` for a repository's own: an account with `takes` never takes one over. */
function skillOf(line: string): string | null {
  const checked = checkRunnerLine(line);
  return checked.ok && checked.kind === 'omni' ? checked.skill : null;
}

/** Writes `text` as one line to the job's log and its pane. */
function say(files: JobFiles, out: Out, text: string): void {
  appendFileSync(files.log, `${text}\n`);
  out.write(`${text}\n`);
}

/** The account the job takes over on, with its agent, or the reason it fails on: every account out until the earliest reset. */
function nextAccount(turnover: Turnover, skill: string | null): { account: Account; agent: Agent } | { none: string } {
  const agents = new Map<string, Agent>();
  const chosen = chooseAccount({
    accounts: turnover.accounts,
    book: turnover.book,
    skill,
    unusable: (account) => {
      const agent = turnover.agentOf(account);
      if (agent === null) return `the ${account.agent} agent is not available in this kit`;
      agents.set(account.id, agent);
      return agent.check(turnover.seenAs(account));
    },
  });
  const agent = 'account' in chosen ? agents.get(chosen.account.id) : undefined;
  if ('account' in chosen && agent !== undefined) return { account: chosen.account, agent };
  const resets = turnover.accounts.flatMap((account) => {
    const state = turnover.book.stateOf(account.id);
    return state.state === 'out' && state.resetsAt !== null ? [state.resetsAt] : [];
  });
  return { none: noTokensReason(resets) };
}

/** How a run that exited `code` ended: done, at the wall when its agent read a limit, else failed. */
const endOf = (code: number, limit: Limit | null): JobPart['ended'] => (code === 0 ? 'done' : limit === null ? 'failed' : 'limit');

/** The part `started` once its run ended: its end, its model as the run named it, and its tokens when they could be read. */
function endedPart(started: JobPart, { code, limit, usage, before, to }: { code: number; limit: Limit | null; usage: Usage | null; before: Usage | null; to: string }): JobPart {
  const tokens = tokensSince(usage?.tokens ?? null, before?.tokens ?? null);
  return { ...started, model: usage?.model ?? started.model, to, ended: endOf(code, limit), ...(tokens === null ? {} : { tokens }) };
}

/** Where a job's runs go: its worktree, files, pane and variables. */
type JobPlace = { cwd: string; files: JobFiles; out: Out; env: Readonly<Record<string, string>> | undefined };

/** Who runs a part: the agent, and the account as it sees it. */
type Runs = { agent: Agent; account: AgentAccount };

/** A job's parts as they go: the record, written to the parts file at every change, and the clock. */
type Parts = { record: PartsRecord; keep(part: JobPart, at: number): void; fail(reason: string): void; iso(): string };

/** A run that ended: its exit code, the limit its agent read (`null`: none), its part and where it sits in the record. */
type Ran = { code: number; limit: Limit | null; part: JobPart; at: number };

const isoOf = (ms: number): string => new Date(ms).toISOString();

/** The parts of the job whose log is `log`, kept in its parts file. */
function partsOf(log: string, now: () => number): Parts {
  const record: PartsRecord = { parts: [], reason: null };
  return {
    record,
    keep(part, at) {
      record.parts[at] = part;
      writeParts(partsPath(log), record);
    },
    fail(reason) {
      record.reason = reason;
      writeParts(partsPath(log), record);
    },
    iso: () => isoOf(now()),
  };
}

/** Runs one part of the job: `line` on `runs`, `handoff` after it when it takes over. */
async function runPart({ cwd, files, out, env }: JobPlace, { line, runs, handoff, parts }: { line: string; runs: Runs; handoff: string | undefined; parts: Parts }): Promise<Ran> {
  const at = parts.record.parts.length;
  const before = runs.agent.usage({ cwd, lines: [], exit: null });
  const started: JobPart = { agent: runs.agent.name, model: runs.account.model, account: runs.account.id, from: parts.iso(), to: null, ended: null };
  parts.keep(started, at);
  const command = runs.agent.command({ line, cwd }, runs.account, handoff);
  const { code, printed } = await runOnce({ cwd, files, out, env: runEnv(env, command), agent: runs.agent, command });
  const ran = { cwd, lines: printed, exit: code };
  const limit = code === 0 ? null : runs.agent.limit(ran);
  const part = endedPart(started, { code, limit, usage: runs.agent.usage(ran), before, to: parts.iso() });
  parts.keep(part, at);
  return { code, limit, part, at };
}

/**
 * After a run that hit its account's limit (`ran.limit`): the account is out until the reset the agent
 * gave (an hour, guessed, when it gave none), and the job goes on on the next account with the runner's
 * note, or fails naming why when it changed account `MAX_ACCOUNT_CHANGES` times or no account is left.
 */
function turnOver(place: JobPlace, { line, start, runs, ran, changes, parts, turnover }: {
  line: string; start: string | null; runs: Runs; ran: Ran & { limit: Limit }; changes: number; parts: Parts; turnover: Turnover;
}): { runs: Runs; handoff: string } | { failed: string } {
  const { files, out, cwd } = place;
  const guessed = ran.limit.resetsAt === null;
  const resetsAt = ran.limit.resetsAt ?? isoOf(Date.parse(parts.iso()) + GUESSED_RESET_MS);
  parts.keep({ ...ran.part, resetsAt, guessed, note: 'runner' }, ran.at);
  turnover.book.markOut(runs.account.id, resetsAt);
  const next = changes >= MAX_ACCOUNT_CHANGES ? { none: CAP_REASON } : nextAccount(turnover, skillOf(line));
  if ('none' in next) {
    say(files, out, `↻ account ${runs.account.id} reached its usage limit: ${next.none}`);
    return { failed: next.none };
  }
  const note = masked(turnover, runnerNote({ line, log: readFileSync(files.log, 'utf8'), start, git: (args) => turnover.git(cwd, args) }));
  writeFileSync(handoffPath(files.log), note);
  say(files, out, `↻ account ${runs.account.id} reached its usage limit, out until ${resetsAt}${guessed ? ' (guessed)' : ''}: account ${next.account.id} takes over`);
  return {
    runs: { agent: next.agent, account: turnover.seenAs(next.account) },
    handoff: `${takeoverLine({ agent: ran.part.agent, model: ran.part.model, why: LIMIT_WHY })}\n\n${note}`,
  };
}

/** The commit the job's worktree starts on, which the runner's note counts commits from; `null` when git cannot say. */
function startOf(turnover: Turnover, cwd: string): string | null {
  const head = (turnover.git(cwd, ['rev-parse', 'HEAD']) ?? '').trim();
  return head === '' ? null : head;
}

/**
 * The job's runs, from `first`: one, unless `turnover` is given and a run ends on its account's usage
 * limit; the job then carries on on the next account with the runner's handoff note, at most
 * `MAX_ACCOUNT_CHANGES` times. Every run is a part, written to the parts file as it starts and as it
 * ends. Answers the last run's exit code.
 */
async function runParts(place: JobPlace, first: Runs, turnover: Turnover | undefined): Promise<number> {
  writeFileSync(rawLogPath(place.files.log), '');
  const line = readFileSync(place.files.line, 'utf8').replace(/\n$/, '');
  const parts = partsOf(place.files.log, turnover === undefined ? Date.now : turnover.now);
  const start = turnover === undefined ? null : startOf(turnover, place.cwd);
  let runs = first;
  let handoff: string | undefined;
  for (let changes = 0; ; changes += 1) {
    const ran = await runPart(place, { line, runs, handoff, parts });
    const { limit } = ran;
    if (limit === null || turnover === undefined) return ran.code;
    const next = turnOver(place, { line, start, runs, ran: { ...ran, limit }, changes, parts, turnover });
    if ('failed' in next) {
      parts.fail(next.failed);
      return ran.code;
    }
    ({ runs, handoff } = next);
  }
}


/**
 * The job's run in `cwd`: the install when there is a lockfile, then the run of `account` through
 * `agent` (the fallback agent's one account, unless given), turning over to the next of `turnover`'s
 * accounts at the wall when given. Writes the exit code last. `env`, when given, is the variables every
 * run starts with in place of the runner's own.
 */
export async function runJobProcess({ cwd, files, out, env, agent = fallbackAgent(), account = fallbackAccount(), turnover }: {
  cwd: string;
  files: JobFiles;
  out: Out;
  env?: Readonly<Record<string, string>>;
  agent?: Agent;
  account?: AgentAccount;
  turnover?: Turnover | undefined;
}): Promise<number> {
  let code = 0;
  if (existsSync(join(cwd, LOCKFILE))) {
    appendFileSync(files.log, '$ pnpm install --frozen-lockfile\n');
    code = await run('pnpm', ['install', '--frozen-lockfile'], { cwd, stdin: null, log: files.log, out, env });
  }
  if (code === 0) code = await runParts({ cwd, files, out, env }, { agent, account }, turnover);
  writeFileSync(files.exit, `${String(code)}\n`);
  return code;
}
