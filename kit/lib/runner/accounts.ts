// A runner's accounts (PRD 2537, "Accounts"): the file `~/.config/omni/accounts.yml`, read when `omni
// runner` starts, each field checked and a malformed one refused before the runner registers, naming
// the account and the field; the states the runner keeps in `~/.config/omni/accounts-state.json`, so a
// restart remembers an account that is out; and the choice of the account a job starts on, the first
// in the file's order that is ready, whose `takes` allows the job's skill and whose agent passed its
// check. No file is one account, `claude`, run directly from the token the runner already reads.
//
// A secret (the file a direct account names) is read when a run starts and goes to that run's process
// only: nothing here keeps it, and the runner masks it in every line it sends.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import type { AgentAccount } from './agents/agent.ts';
import { RUNNABLE_SKILLS } from './line.ts';

/** One account of the file. `secret` is the path of the file holding its token, `null` for none of its own. */
export type Account = {
  id: string;
  agent: 'claude' | 't3';
  instance: string | null;
  model: string | null;
  secret: string | null;
  budget: number | null;
  takes: readonly string[] | null;
};

/** The two planned handoff thresholds, in whole percents. */
export type HandoffThresholds = { usage: number; context: number };

/** What the file says: its accounts in order, its thresholds, and whether a file was read at all. */
export type Accounts = { file: boolean; accounts: readonly Account[]; handoff: HandoffThresholds };

/** A file the runner refuses to start with: the message names the account and the field. */
export class AccountsError extends Error {}

export const DEFAULT_HANDOFF: HandoffThresholds = { usage: 90, context: 75 };

/** The account of a runner with no file: Claude run directly, from the token the runner reads. */
export const FALLBACK_ACCOUNT: Account = { id: 'claude', agent: 'claude', instance: null, model: null, secret: null, budget: null, takes: null };

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const ACCOUNT_KEYS = new Set(['id', 'instance', 'agent', 'model', 'secret', 'budget', 'takes']);

/** Where the accounts file is: `~/.config/omni/accounts.yml`. */
const accountsFile = (home: string): string => join(home, '.config', 'omni', 'accounts.yml');
/** Where the states are kept: `~/.config/omni/accounts-state.json`. */
export const accountsStateFile = (home: string): string => join(home, '.config', 'omni', 'accounts-state.json');

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A string field: its trimmed text, `null` when absent, else the refusal. */
function text(name: string, key: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') throw new AccountsError(`account ${name}: ${key} must be a non-empty text`);
  return value.trim();
}

/** `takes`: the skills of `RUNNABLE_SKILLS` an account may run, or the refusal. */
function takesOf(name: string, value: unknown): readonly string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length === 0) throw new AccountsError(`account ${name}: takes must be a list of skills, one at least`);
  const skills: string[] = [];
  const listed: readonly unknown[] = value;
  for (const skill of listed) {
    if (typeof skill !== 'string' || !RUNNABLE_SKILLS.includes(skill)) throw new AccountsError(`account ${name}: takes holds "${String(skill)}", which is not a skill a runner runs`);
    skills.push(skill);
  }
  return skills;
}

/** `budget`: tokens a day, a whole positive number. */
function budgetOf(name: string, value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new AccountsError(`account ${name}: budget must be a whole positive number of tokens a day`);
  return value;
}

/** The agent and instance an account names: `instance` runs through T3, `agent: claude` runs Claude directly. */
function agentOf(name: string, instance: string | null, agent: string | null): Pick<Account, 'agent' | 'instance'> {
  if (agent !== null && agent !== 'claude' && agent !== 't3') throw new AccountsError(`account ${name}: agent must be claude or t3, got "${agent}"`);
  if (instance !== null) {
    if (agent === 'claude') throw new AccountsError(`account ${name}: agent claude runs without T3, so it takes no instance`);
    return { agent: 't3', instance };
  }
  if (agent === 'claude') return { agent: 'claude', instance: null };
  throw new AccountsError(`account ${name}: name an instance (a T3 provider instance) or agent: claude`);
}

function accountOf(entry: unknown, index: number, seen: Set<string>): Account {
  const place = `account ${String(index + 1)}`;
  if (!isRecord(entry)) throw new AccountsError(`${place}: must be a mapping with an id`);
  const id = typeof entry.id === 'string' ? entry.id : '';
  if (!ID.test(id)) throw new AccountsError(`${place}: id must be 1 to 40 letters, digits, dots, dashes or underscores`);
  if (seen.has(id)) throw new AccountsError(`account ${id}: id is used twice`);
  seen.add(id);
  for (const key of Object.keys(entry)) if (!ACCOUNT_KEYS.has(key)) throw new AccountsError(`account ${id}: ${key} is not a field of an account`);
  const where = agentOf(id, text(id, 'instance', entry.instance), text(id, 'agent', entry.agent));
  const secret = text(id, 'secret', entry.secret);
  if (secret !== null && where.agent !== 'claude') throw new AccountsError(`account ${id}: secret is for a direct claude account; a T3 account's sign-in lives in T3`);
  return { id, ...where, model: text(id, 'model', entry.model), secret, budget: budgetOf(id, entry.budget), takes: takesOf(id, entry.takes) };
}

/** One threshold: a whole percent from 50 to 99, `fallback` when absent. */
function percentOf(key: string, value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 50 || value > 99) throw new AccountsError(`handoff: ${key} must be a whole percent from 50 to 99`);
  return value;
}

function handoffOf(value: unknown): HandoffThresholds {
  if (value === undefined || value === null) return DEFAULT_HANDOFF;
  if (!isRecord(value)) throw new AccountsError('handoff: must be a mapping with usage and context');
  for (const key of Object.keys(value)) if (key !== 'usage' && key !== 'context') throw new AccountsError(`handoff: ${key} is not a threshold (usage, context)`);
  return { usage: percentOf('usage', value.usage, DEFAULT_HANDOFF.usage), context: percentOf('context', value.context, DEFAULT_HANDOFF.context) };
}

/** The accounts a file's text holds, or the `AccountsError` naming the account and the field. */
export function parseAccounts(source: string): Accounts {
  let doc: unknown;
  try {
    doc = parse(source);
  } catch {
    throw new AccountsError('the file is not valid YAML');
  }
  if (!isRecord(doc)) throw new AccountsError('the file must be a mapping with an accounts list');
  for (const key of Object.keys(doc)) if (key !== 'accounts' && key !== 'handoff') throw new AccountsError(`${key} is not a section of the file (accounts, handoff)`);
  if (!Array.isArray(doc.accounts) || doc.accounts.length === 0) throw new AccountsError('accounts must be a list of one account at least');
  const seen = new Set<string>();
  const entries: readonly unknown[] = doc.accounts;
  const accounts = entries.map((entry, index) => accountOf(entry, index, seen));
  return { file: true, accounts, handoff: handoffOf(doc.handoff) };
}

/** What a read of the accounts file needs: the person's home, and a test's own read. */
export type AccountsIo = { home: string; read?: ((path: string) => string) | undefined };

/** The accounts of the file under `home`; none there is the one fallback account. A file that cannot be read or is malformed throws. */
export function readAccounts({ home, read = (path) => readFileSync(path, 'utf8') }: AccountsIo): Accounts {
  const path = accountsFile(home);
  let source: string;
  try {
    source = read(path);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return { file: false, accounts: [FALLBACK_ACCOUNT], handoff: DEFAULT_HANDOFF };
    throw new AccountsError(`${path} cannot be read`);
  }
  return parseAccounts(source);
}

/** The value of a secret file, trimmed; `''` when it cannot be read, so the agent's check says not signed in. */
export function readSecret(path: string, home: string): string {
  const full = path.startsWith('~/') ? join(home, path.slice(2)) : resolve(path);
  try {
    return readFileSync(full, 'utf8').trim();
  } catch {
    return '';
  }
}

/** The account as its agent sees it: the model, and the secret read now (`null` for an account with none of its own). */
export function agentAccountOf(account: Account, home: string = homedir()): AgentAccount {
  return { id: account.id, model: account.model, secret: account.secret === null ? null : readSecret(account.secret, home) };
}

/** An account's state. */
export type AccountState = { state: 'ready' | 'active' | 'out'; resetsAt: string | null };

/** The states of a runner's accounts: kept in a file, an account that is out remembered across a restart. */
export type AccountBook = {
  stateOf(id: string): AccountState;
  /** The account is out until `resetsAt` (an ISO time). */
  markOut(id: string, resetsAt: string): void;
  /** A job runs on the account. */
  activate(id: string): void;
  /** The job on the account ended. */
  release(id: string): void;
};

/** The accounts `file` keeps out, by id, with their reset times: none when there is no file or it does not parse. */
function keptOut(file: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const kept: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (isRecord(kept)) {
      for (const [id, entry] of Object.entries(kept)) {
        const resetsAt = isRecord(entry) ? entry.resetsAt : undefined;
        if (typeof resetsAt === 'string' && !Number.isNaN(Date.parse(resetsAt))) out.set(id, resetsAt);
      }
    }
  } catch {
    // No file yet, or one that does not parse: every account is ready.
  }
  return out;
}

/**
 * The book kept in `file`: only the accounts that are out are written, an active one is ready again after a restart.
 * The file is read again at every look and before every mark, so an account a job's process marked out (its turnover,
 * PRD 2537 s3) reads out to the runner too, and neither process drops the other's mark.
 */
export function accountBook({ file, now = Date.now }: { file: string; now?: (() => number) | undefined }): AccountBook {
  let out = keptOut(file);
  const active = new Map<string, number>();
  const save = (): void => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(Object.fromEntries([...out].map(([id, resetsAt]) => [id, { state: 'out', resetsAt }])), null, 2)}\n`, { mode: 0o600 });
    chmodSync(file, 0o600);
  };
  return {
    stateOf(id) {
      out = keptOut(file);
      const resetsAt = out.get(id);
      if (resetsAt !== undefined) {
        if (Date.parse(resetsAt) > now()) return { state: 'out', resetsAt };
        out.delete(id);
        save();
      }
      return { state: (active.get(id) ?? 0) > 0 ? 'active' : 'ready', resetsAt: null };
    },
    markOut(id, resetsAt) {
      out = keptOut(file);
      out.set(id, resetsAt);
      save();
    },
    activate(id) {
      active.set(id, (active.get(id) ?? 0) + 1);
    },
    release(id) {
      active.set(id, Math.max(0, (active.get(id) ?? 0) - 1));
    },
  };
}

/** Whether the account may run `skill` (`null`: a repository's own skill, which an account with `takes` never runs). */
export function allowsSkill(account: Account, skill: string | null): boolean {
  return account.takes === null || (skill !== null && account.takes.includes(skill));
}

/** The account a job starts on, or why none can: the first not-out, `takes`-allowed one (an active account takes another job: slots share it) whose agent passed its check (`unusable` gives the reason it did not, `null` when it did). */
export function chooseAccount({ accounts, book, skill, unusable }: {
  accounts: readonly Account[];
  book: AccountBook;
  skill: string | null;
  unusable: (account: Account) => string | null;
}): { account: Account } | { none: string } {
  const reasons: string[] = [];
  for (const account of accounts) {
    const state = book.stateOf(account.id);
    if (state.state === 'out') {
      reasons.push(`${account.id} is out until ${state.resetsAt ?? '?'}`);
      continue;
    }
    if (!allowsSkill(account, skill)) {
      reasons.push(`${account.id} does not take this skill`);
      continue;
    }
    const why = unusable(account);
    if (why !== null) {
      reasons.push(`${account.id} is unusable: ${why}`);
      continue;
    }
    return { account };
  }
  return { none: `no account can take this job: ${reasons.join('; ')}` };
}
