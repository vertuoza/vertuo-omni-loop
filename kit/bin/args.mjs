// Flag parsing for every `omni` command. Each command names the flags it takes (the same names its
// upstream script's CLI half read); anything else is a usage error — exit 2, one line.
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
