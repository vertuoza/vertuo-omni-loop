// Flag parsing for every `omni` command. Each command names the flags it takes (the same names its
// upstream script's CLI half read); anything else is a usage error — exit 2, one line.
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { parseIssue, parsePr, parsePrd, WorkSliceIdSchema } from '../lib/ids.ts';
import type { IssueNumber, PrdNumber, PrNumber, WorkSliceId } from '../lib/ids.ts';
import { at, isOneOf, messageOf, propertyOf } from '../lib/narrow.ts';
import type { Out } from './io.ts';

export function usageError(message: string): Error {
  return Object.assign(new Error(message), { name: 'UsageError' });
}

/** The flags `parseArgs` read: each value flag a string, each boolean flag `true`, an absent one missing. */
export type Flags<V extends string, B extends string> = { [K in V]?: string } & { [K in B]?: true };

/**
 * Splits `argv` into positionals and flags. `values` are flags that take the next argument;
 * `booleans` are flags that stand alone. Any other `--flag`, or a value flag with no value, throws
 * a `UsageError` naming `command`.
 */
export function parseArgs<V extends string = never, B extends string = never>(
  command: string,
  argv: readonly string[],
  { values = [], booleans = [] }: { values?: readonly V[]; booleans?: readonly B[] } = {},
): { positional: string[]; flags: Flags<V, B> } {
  const positional: string[] = [];
  const valueFlags: { [K in V]?: string } = {};
  const booleanFlags: { [K in B]?: true } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = at(argv, index, 'the argument');
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (isOneOf(booleans, name)) {
      booleanFlags[name] = true;
    } else if (isOneOf(values, name)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw usageError(`omni ${command}: ${arg} needs a value.`);
      valueFlags[name] = value;
      index += 1;
    } else {
      throw usageError(`omni ${command}: unknown flag ${arg}.`);
    }
  }
  return { positional, flags: { ...valueFlags, ...booleanFlags } };
}

const DIGITS = /^\d+$/;

/** A positive integer argument written in plain digits, or a `UsageError` naming what it is: "1e2",
 * "0x10" or " 16" are refused rather than read as another number (bug #571). */
export function positiveInt(command: string, what: string, value: string | true | undefined): number {
  const number = Number(value);
  if (value === undefined || value === true || !DIGITS.test(value) || number <= 0) {
    throw usageError(`omni ${command}: ${what} must be a positive number${value === undefined ? '' : `, got "${value}"`}.`);
  }
  return number;
}

/** A PRD number argument, read as `positiveInt` reads one. */
export function prdArg(command: string, what: string, value: string | true | undefined): PrdNumber {
  return parsePrd(positiveInt(command, what, value));
}

/** A pull request number argument, read as `positiveInt` reads one. */
export function prArg(command: string, what: string, value: string | true | undefined): PrNumber {
  return parsePr(positiveInt(command, what, value));
}

/** An issue number argument, read as `positiveInt` reads one. */
export function issueArg(command: string, what: string, value: string | true | undefined): IssueNumber {
  return parseIssue(positiveInt(command, what, value));
}

/** A slice argument (`s1`, a rework's `fix-s1-01-…`), or a `UsageError` naming what it is. */
export function sliceArg(command: string, what: string, value: string): WorkSliceId {
  const slice = WorkSliceIdSchema.safeParse(value);
  if (!slice.success) throw usageError(`omni ${command}: ${what} must be a slice id like s1, got "${value}".`);
  return slice.data;
}

/** A comma-separated flag as a trimmed, non-empty list. */
export function list(value: string | true | undefined): string[] {
  return value ? String(value).split(',').map((item) => item.trim()).filter(Boolean) : [];
}

/** A path argument resolved against the repository root. */
export function inRoot(ctx: { root: string }, path: string): string {
  return isAbsolute(path) ? path : join(ctx.root, path);
}

export function println(stream: Out, text: string = ''): void {
  stream.write(`${text}\n`);
}

/** The text of a file the user named, or a `UsageError` naming it when it cannot be read. */
export function readUserFile(command: string, ctx: { root: string }, path: string): string {
  try {
    return readFileSync(inRoot(ctx, path), 'utf8');
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT' || code === 'EISDIR' || code === 'EACCES') {
      throw usageError(`omni ${command}: cannot read ${path} (${code}).`);
    }
    throw error;
  }
}

const SLUG = /^[\w.-]+\/[\w.-]+$/;

/** The repository slug a command talks to GitHub about — `--repo`, else `repo.slug` — or a one-line
 * `UsageError` when there is none or it is not `owner/name`. */
export function repoSlug(command: string, ctx: { config: { repo: { slug: string | null } } }, flag: string | undefined): string {
  const repo = flag ?? ctx.config.repo.slug;
  if (!repo) throw usageError(`omni ${command}: no repository slug — pass --repo <owner/name> or set repo.slug.`);
  if (!SLUG.test(repo)) throw usageError(`omni ${command}: --repo must be owner/name, got "${repo}".`);
  return repo;
}

const NO_FOLDER = /^PRD \d+ has no inbox or shipped folder$/;

/** Runs `fn`, turning the library's "PRD <n> has no inbox or shipped folder" — an item naming a PRD
 * this repository does not hold, which the user chose — into a one-line `UsageError`. */
export function withPrdFolder<T>(command: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (NO_FOLDER.test(message)) throw usageError(`omni ${command}: ${message}.`);
    throw error;
  }
}

/** The `code` of a system error (`ENOENT`, `EISDIR`, …), as `error?.code` reads it: `undefined` for
 * anything without one. */
export function errorCode(error: unknown): unknown {
  return propertyOf(error, 'code');
}

/** The `message` of what a library threw (every kit module throws an `Error`), else the value as text. */
export function errorMessage(error: unknown): string {
  return messageOf(error);
}
