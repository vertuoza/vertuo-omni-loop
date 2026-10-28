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
// Each run is a part of the job: its agent, model, account, start and end, tokens, and how it ended.
// The parts are kept in `job-<id>.parts.json` beside the log, written as each part starts and ends, with
// the reason the job failed on when turnover ended it; the runner reads the file and sends the parts
// with the job's reports.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { ExecText } from '../context.ts';
import { agentAccountOf } from './accounts.ts';
import type { Account, AccountBook } from './accounts.ts';
import type { Agent, AgentAccount } from './agents/agent.ts';
import { agentNamed } from './agents/index.ts';
import { maskTokens } from './github-token.ts';
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
};

/** The turnover of a runner's accounts under `home`: their book kept in `accounts-state.json`, each agent's checks run with `exec`. */
export function turnoverOf({ accounts, book, exec, home = homedir(), omni, now = Date.now }: {
  accounts: readonly Account[];
  book: AccountBook;
  exec: ExecText;
  home?: string;
  /** The command that runs omni, for a T3 account's `t3-run`. */
  omni?: readonly string[] | undefined;
  now?: () => number;
}): Turnover {
  const projects = join(home, '.claude', 'projects');
  return {
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
