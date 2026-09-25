// Flag parsing for every `omni` command. Each command names the flags it takes (the same names its
// upstream script's CLI half read); anything else is a usage error — exit 2, one line.
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export function usageError(message) {
  return Object.assign(new Error(message), { name: 'UsageError' });
}

/**
 * Splits `argv` into positionals and flags. `values` are flags that take the next argument;
 * `booleans` are flags that stand alone. Any other `--flag`, or a value flag with no value, throws
 * a `UsageError` naming `command`.
 *
 * @returns {{ positional: string[], flags: Record<string, string | true> }}
 */
export function parseArgs(command, argv, { values = [], booleans = [] } = {}) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (booleans.includes(name)) {
      flags[name] = true;
    } else if (values.includes(name)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw usageError(`omni ${command}: ${arg} needs a value.`);
      flags[name] = value;
      index += 1;
    } else {
      throw usageError(`omni ${command}: unknown flag ${arg}.`);
    }
  }
  return { positional, flags };
}

/** A positive integer argument, or a `UsageError` naming what it is. */
export function positiveInt(command, what, value) {
  const number = Number(value);
  if (value === undefined || value === true || !Number.isInteger(number) || number <= 0) {
    throw usageError(`omni ${command}: ${what} must be a positive number${value === undefined ? '' : `, got "${value}"`}.`);
  }
  return number;
}

/** A comma-separated flag as a trimmed, non-empty list. */
export function list(value) {
  return value ? String(value).split(',').map((item) => item.trim()).filter(Boolean) : [];
}

/** A path argument resolved against the repository root. */
export function inRoot(ctx, path) {
  return isAbsolute(path) ? path : join(ctx.root, path);
}

export function println(stream, text = '') {
  stream.write(`${text}\n`);
}

/** The text of a file the user named, or a `UsageError` naming it when it cannot be read. */
export function readUserFile(command, ctx, path) {
  try {
    return readFileSync(inRoot(ctx, path), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR' || error?.code === 'EACCES') {
      throw usageError(`omni ${command}: cannot read ${path} (${error.code}).`);
    }
    throw error;
  }
}

const NO_FOLDER = /^PRD \d+ has no inbox or shipped folder$/;

/** Runs `fn`, turning the library's "PRD <n> has no inbox or shipped folder" — an item naming a PRD
 * this repository does not hold, which the user chose — into a one-line `UsageError`. */
export function withPrdFolder(command, fn) {
  try {
    return fn();
  } catch (error) {
    if (NO_FOLDER.test(error?.message ?? '')) throw usageError(`omni ${command}: ${error.message}.`);
    throw error;
  }
}
