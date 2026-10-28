// A job's turnover at the wall (PRD 2537, "Handoffs, in the middle of a job"): a run that ends on its
// account's usage limit marks that account out until the reset the agent gave (one hour when it gave
// none, the part saying the time was guessed), and the job carries on in the same worktree on the next
// account, in the file's order, that is not out, whose `takes` allows the job's skill and whose agent
// passed its check. After a limit the account has no turn left, so the runner writes the handoff note
// itself: the job line, the last 40 step lines, `git status --short`, `git log --oneline` since the
// job's start, `git worktree list`, and the pull requests the log named. The note goes beside the job's
// log (`job-<id>.handoff.md`), never in the worktree, every secret of the accounts masked. The next run
// gets the job line, then `You are taking over this job from <agent> (<model>) because <why>. Here is
// where it stopped:`, then the note.
//
// A job changes account at most three times; past that, or with no account left, it fails `no tokens
// left: …`. A run that ends without a recognised limit (a crash, a failure) never turns over.
//
// A job also hands off before the wall (s8): while a run goes, its pressure (`plannedHandoff`) calls for
// a handoff on usage (at `handoff.usage` percent of a window, Claude's `allowed_warning`, or the account's
// `budget` spent) to the next account, or on context (at `handoff.context` percent of the model's window)
// to a fresh session of the same account. The run is stopped, the same session is resumed for one turn
// to write its own note (`notePrompt`, five minutes at most), and the runner's note is the fallback when
// that turn fails, times out or writes nothing. At most five fresh sessions a job.
//
// Before a run on a T3 Codex or OpenCode instance, the kit's skills are written in that instance's own
// skills folder (`plugin.ts`, `prepareInstanceSkills`); an instance that cannot have them is unusable.
//
// Each run is a part of the job: its agent, model, account, start and end, tokens, and how it ended.
// The parts are kept in `job-<id>.parts.json` beside the log, written as each part starts and ends, with
// the reason the job failed on when turnover ended it; the runner reads the file and sends the parts
// with the job's reports.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { kitSkills } from '../agents/skills.ts';
import { field } from '../ask/schema.ts';
import type { ExecText } from '../context.ts';
import { runningBundle, runningKit } from '../init/bundle.ts';
import { agentAccountOf, DEFAULT_HANDOFF, readAccounts } from './accounts.ts';
import type { Account, AccountBook, HandoffThresholds } from './accounts.ts';
import type { Agent, AgentAccount, Pressure } from './agents/agent.ts';
import { agentNamed } from './agents/index.ts';
import { t3HomeOf, t3Instance } from './agents/t3-home.ts';
import { maskTokens } from './github-token.ts';
import { prepareInstanceSkills } from './plugin.ts';
import type { TokenCounts } from './tokens.ts';

/** How many times a job may change account. */
export const MAX_ACCOUNT_CHANGES = 3;

/** How long an account is out when its agent gave no reset time: one hour, the part saying it was guessed. */
export const GUESSED_RESET_MS = 60 * 60 * 1000;

/** How many of the log's last lines the runner's note carries. */
const NOTE_STEP_LINES = 40;

/** How a part ended: a planned handoff (`usage`, `context`), the wall (`limit`), or the job's own end; `null` while it runs. */
const PART_ENDS = ['usage', 'context', 'limit', 'done', 'failed'] as const;

/** A count of tokens: a whole number, never below 0. */
const count = z.number().int().nonnegative();

/** One run of a job, as the job's report carries it. */
const JobPartSchema = z.object({
  agent: z.string().min(1).max(40),
  model: z.string().min(1).max(120).nullable(),
  account: z.string().min(1).max(40),
  from: z.string(),
  to: z.string().nullable(),
  tokens: z.object({ input: count, output: count, cacheRead: count, cacheWrite: count }).strict().optional(),
  ended: z.enum(PART_ENDS).nullable(),
  resetsAt: z.string().nullable().optional(),
  guessed: z.boolean().optional(),
  note: z.enum(['agent', 'runner']).optional(),
}).strict();
export type JobPart = z.infer<typeof JobPartSchema>;

/** What the parts file holds: the job's parts in order, and the reason turnover ended the job on, `null` when it did not. */
const PartsRecordSchema = z.object({ parts: z.array(JobPartSchema), reason: z.string().nullable() }).strict();
export type PartsRecord = z.infer<typeof PartsRecordSchema>;

/** The file a job's parts are kept in: its log's path with `.parts.json` for `.log`. */
export const partsPath = (log: string): string => `${log.replace(/\.log$/, '')}.parts.json`;

/** The file a job's handoff note is written to: its log's path with `.handoff.md` for `.log`, never in the worktree. */
export const handoffPath = (log: string): string => `${log.replace(/\.log$/, '')}.handoff.md`;

/** Writes the job's parts and the reason it failed on, when turnover ended it. */
export function writeParts(path: string, record: PartsRecord): void {
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
}

/** The parts a job's file holds, or `null` when there is no file or it does not parse. */
export function readParts(path: string): PartsRecord | null {
  try {
    const parsed = PartsRecordSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The tokens spent between two reads of the same count: each of the four, never below 0; `null` when the second cannot be read. */
export function tokensSince(after: TokenCounts | null, before: TokenCounts | null): TokenCounts | null {
  if (after === null) return null;
  const spent = (key: keyof TokenCounts): number => Math.max(0, after[key] - (before?.[key] ?? 0));
  return { input: spent('input'), output: spent('output'), cacheRead: spent('cacheRead'), cacheWrite: spent('cacheWrite') };
}

/** The line that opens the next run's message: who it takes over from, and why. */
export function takeoverLine({ agent, model, why }: { agent: string; model: string | null; why: string }): string {
  return `You are taking over this job from ${agent}${model === null ? '' : ` (${model})`} because ${why}. Here is where it stopped:`;
}

/** Why a part handed off, in the takeover line's words. */
export const LIMIT_WHY = 'it reached its usage limit';

/** The reason a job fails on when no account can take it over: every account is out until the earliest reset. */
export function noTokensReason(resets: readonly string[]): string {
  const earliest = [...resets].sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  return earliest === undefined ? 'no tokens left: no account can take this job over' : `no tokens left: every account is out until ${earliest}`;
}

/** The reason a job fails on when it changed account as many times as it may. */
export const CAP_REASON = `no tokens left: the job changed account ${String(MAX_ACCOUNT_CHANGES)} times, the most a job may`;

/** How many fresh sessions a job may open for its context. */
export const MAX_FRESH_SESSIONS = 5;

/** The reason a job fails on when it opened as many fresh sessions for its context as it may. */
export const FRESH_CAP_REASON = `context full: the job opened ${String(MAX_FRESH_SESSIONS)} fresh sessions, the most a job may`;

/** How long the outgoing agent has to write its handoff note. */
export const NOTE_TURN_MS = 5 * 60 * 1000;

/** The one message that resumes the outgoing session to write its handoff note at `path`. */
export const notePrompt = (path: string): string =>
  `Write the handoff note for whoever continues this job to ${path}: what is done, what is next, the pull requests and branches open, and every decision you took. Change no other file.`;

/** A planned handoff: on usage, to the next account (this one out until `resetsAt`, `null` when the agent gave none); on context, to a fresh session of the same account. `why` is the takeover line's. */
export type PlannedHandoff = { ended: 'usage'; why: string; resetsAt: string | null } | { ended: 'context'; why: string };

/** The usage windows' names, as the agents give them, in the takeover line's words. */
const WINDOW_WORDS: Readonly<Record<string, string>> = {
  five_hour: '5-hour',
  seven_day: 'weekly',
  seven_day_opus: 'weekly Opus',
  seven_day_sonnet: 'weekly Sonnet',
};

/** `its <window> window`, in plain words. */
const windowWords = (window: string | null): string => `its ${window === null ? 'usage' : (Object.hasOwn(WINDOW_WORDS, window) ? WINDOW_WORDS[window] : undefined) ?? window.replaceAll('_', ' ')} window`;

/** The start of the next UTC day after `now`, when a day's budget is spent again. */
const nextDay = (now: number): string => {
  const day = new Date(now);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1)).toISOString();
};

/** The usage handoff the pressure (or a spent budget) calls for, or `null`. */
function usageHandoff({ usage, threshold, budget, now }: { usage: Pressure['usage']; threshold: number; budget: { limit: number; spent: number } | null; now: number }): PlannedHandoff | null {
  if (usage !== null && usage.percent !== null && usage.percent >= threshold) return { ended: 'usage', why: `its account reached ${String(usage.percent)} % of ${windowWords(usage.window)}`, resetsAt: usage.resetsAt };
  if (usage?.status === 'allowed_warning') return { ended: 'usage', why: `its account warned that ${windowWords(usage.window)} is nearly used up`, resetsAt: usage.resetsAt };
  if (budget !== null && budget.spent >= budget.limit) return { ended: 'usage', why: `its account spent its budget of ${String(budget.limit)} tokens for the day`, resetsAt: nextDay(now) };
  return null;
}

/**
 * The planned handoff a run's pressure calls for, before the wall (PRD 2537, "Handoffs"): usage at or above
 * `thresholds.usage` percent of a window, Claude's `allowed_warning`, or the account's day past its `budget`
 * hands off to the next account; the run's context at or above `thresholds.context` percent of the model's
 * window (the account's `contextWindow` when it names one) to a fresh session of the same account. Usage
 * comes first: the next account starts a fresh session anyway. `null`: carry on.
 */
export function plannedHandoff({ pressure, thresholds, contextWindow, budget, now }: {
  pressure: Pressure;
  thresholds: HandoffThresholds;
  contextWindow: number | null;
  budget: { limit: number; spent: number } | null;
  now: number;
}): PlannedHandoff | null {
  const usage = usageHandoff({ usage: pressure.usage, threshold: thresholds.usage, budget, now });
  if (usage !== null) return usage;
  const window = contextWindow ?? pressure.context?.window ?? 0;
  if (pressure.context === null || window <= 0) return null;
  const percent = Math.floor((pressure.context.used * 100) / window);
  return percent >= thresholds.context ? { ended: 'context', why: `its context was ${String(percent)} % full` } : null;
}

/** The pull requests a log names, in order, each once. */
function pullRequestsOf(log: string): string[] {
  return [...new Set(log.match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/g) ?? [])];
}

/** One section of the note: its title, then its text, or `(none)`. */
const section = (title: string, text: string | null): string => `## ${title}\n\n${text === null ? '(could not be read)' : text.trim() === '' ? '(none)' : text.trimEnd()}\n`;

/**
 * The runner's handoff note: the job line, the log's last 40 lines, the worktree's status, its commits
 * since the job started (`start`, `null` when unknown), the worktrees, and the pull requests the log named.
 * `git` runs git in the worktree and answers its output, `null` when it failed.
 */
export function runnerNote({ line, log, start, git }: { line: string; log: string; start: string | null; git: (args: readonly string[]) => string | null }): string {
  const steps = log.split('\n').filter((entry) => entry.trim() !== '').slice(-NOTE_STEP_LINES).join('\n');
  const commits = git(['log', '--oneline', ...(start === null ? ['-20'] : [`${start}..HEAD`])]);
  return [
    '# Handoff note, written by the runner',
    '',
    section('The job', line),
    section(`The last ${String(NOTE_STEP_LINES)} steps`, steps),
    section('git status --short', git(['status', '--short'])),
    section('git log --oneline since the job started', commits),
    section('git worktree list', git(['worktree', 'list'])),
    section('Pull requests the log named', pullRequestsOf(log).join('\n')),
  ].join('\n');
}

/** What a job's process needs to turn over: the accounts and their book, each one's agent, and the clock. */
export type Turnover = {
  /** The accounts, in the file's order. */
  accounts: readonly Account[];
  book: AccountBook;
  /** The agent `account` runs through, `null` when this kit has none of that name. */
  agentOf(account: Account): Agent | null;
  /** The account as its agent sees it, its secret read now. */
  seenAs(account: Account): AgentAccount;
  /** Runs git in `cwd`: its output, `null` when it failed. */
  git(cwd: string, args: readonly string[]): string | null;
  now: () => number;
  /** The planned handoffs' thresholds; none given, the defaults. */
  handoff?: HandoffThresholds | undefined;
  /** Readies `account` to run in the worktree `cwd` (a Codex or OpenCode instance's skills): `null` when it can run, else why not. */
  prepare?: ((account: Account, cwd: string) => string | null) | undefined;
  /** How long the outgoing agent has to write its note (`NOTE_TURN_MS` unless given). */
  noteTurnMs?: number | undefined;
  /** How often, at most, a running part's pressure is read (a second unless given). */
  pressureEveryMs?: number | undefined;
};

/** The thresholds of the accounts file under `home`: the defaults when it has none or cannot be read. */
function thresholdsIn(home: string): HandoffThresholds {
  try {
    return readAccounts({ home }).handoff;
  } catch {
    return DEFAULT_HANDOFF;
  }
}

/** The folder a T3 instance runs its agent from (`config.homePath` in T3's settings), `null` when it names none. */
function instanceHome(t3Home: string, home: string, id: string): string | null {
  let settings: unknown;
  try {
    settings = JSON.parse(readFileSync(join(t3Home, 'userdata', 'settings.json'), 'utf8'));
  } catch {
    return null;
  }
  const path = field(field(field(field(settings, 'providerInstances'), id), 'config'), 'homePath');
  if (typeof path !== 'string' || path.trim() === '') return null;
  const named = path.trim();
  if (named === '~') return home;
  return named.startsWith('~/') ? join(home, named.slice(2)) : resolve(home, named);
}

/**
 * Readies a T3 account whose instance runs Codex, OpenCode or any agent but Claude: the kit's skills, at the
 * omni the worktree `cwd` pins, written in the instance's own folder (`prepareInstanceSkills`, s5), never in
 * the worktree. `null` when it can run (a direct account, a Claude instance, an instance T3 does not know,
 * which its agent's check refuses), else why not (`no skills`).
 */
function instanceSkills({ account, cwd, home, exec, skills }: { account: Account; cwd: string; home: string; exec: ExecText; skills: () => Record<string, string> }): string | null {
  if (account.instance === null) return null;
  const t3Home = t3HomeOf(home);
  const instance = t3Instance(t3Home, home, account.instance);
  if (instance === null || instance.claude) return null;
  const ready = prepareInstanceSkills({
    instance: { agent: instance.driver, dir: instanceHome(t3Home, home, account.instance), home },
    worktree: cwd,
    running: { version: runningKit({ exec }).version },
    bundle: runningBundle(),
    skills: skills(),
  });
  return 'unusable' in ready ? ready.unusable : null;
}

/**
 * The turnover of a runner's accounts under `home`: their book kept in `accounts-state.json`, each agent's
 * checks run with `exec`, the planned handoffs' thresholds read from the accounts file unless given, and
 * the kit's skills (read once) written for a Codex or OpenCode instance before it runs.
 */
export function turnoverOf({ accounts, book, exec, home = homedir(), omni, now = Date.now, handoff }: {
  accounts: readonly Account[];
  book: AccountBook;
  exec: ExecText;
  home?: string;
  /** The command that runs omni, for a T3 account's `t3-run`. */
  omni?: readonly string[] | undefined;
  now?: () => number;
  handoff?: HandoffThresholds | undefined;
}): Turnover {
  const projects = join(home, '.claude', 'projects');
  let skills: Record<string, string> | undefined;
  const kit = (): Record<string, string> => (skills ??= kitSkills());
  return {
    handoff: handoff ?? thresholdsIn(home),
    prepare: (account, cwd) => instanceSkills({ account, cwd, home, exec, skills: kit }),
    accounts,
    book,
    agentOf: (account) => agentNamed(account.agent, { projects, exec, home, omni }),
    seenAs: (account) => agentAccountOf(account, home),
    git(cwd, args) {
      try {
        return exec('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
      } catch {
        return null;
      }
    },
    now,
  };
}

/** Every secret the accounts hold, read now: masked in the note. */
function secretsOf(turnover: Turnover): string[] {
  return turnover.accounts.flatMap((account) => {
    const secret = turnover.seenAs(account).secret;
    return secret === null || secret === '' ? [] : [secret];
  });
}

/** `text` with every account's secret masked. */
export const masked = (turnover: Turnover, text: string): string => maskTokens(text, secretsOf(turnover));
