// The words the kit's schemas fail with when a schema names none of its own (PRD 725, s3). Zod 4
// rewrote its default messages ("Required" became "Invalid input: expected string, received
// undefined"); the kit prints these messages to the people who run it, so it keeps Zod 3's words,
// passed at each parse: `Schema.safeParse(value, { error: KIT_MESSAGES })`. A message the schema
// names itself always wins over these. An issue this map does not word keeps Zod 4's default.
import type { z } from 'zod';

/** Zod 3's name for the type of `value`, as its "received" half printed it. */
function receivedType(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isNaN(value) ? 'nan' : 'number';
  if (value instanceof Date) return 'date';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  if (value instanceof Promise) return 'promise';
  return typeof value;
}

const quoted = (values: readonly unknown[]): string => values.map((value) => `'${String(value)}'`).join(' | ');

function tooSmall(origin: string, minimum: number | bigint, inclusive: boolean, exact: boolean): string | undefined {
  if (origin === 'string') return `String must contain ${exact ? 'exactly' : inclusive ? 'at least' : 'over'} ${minimum} character(s)`;
  if (origin === 'array' || origin === 'set') {
    return `Array must contain ${exact ? 'exactly' : inclusive ? 'at least' : 'more than'} ${minimum} element(s)`;
  }
  if (origin === 'number' || origin === 'int' || origin === 'bigint') {
    return `Number must be ${exact ? 'exactly equal to ' : inclusive ? 'greater than or equal to ' : 'greater than '}${minimum}`;
  }
  return undefined;
}

function tooBig(origin: string, maximum: number | bigint, inclusive: boolean, exact: boolean): string | undefined {
  if (origin === 'string') return `String must contain ${exact ? 'exactly' : inclusive ? 'at most' : 'under'} ${maximum} character(s)`;
  if (origin === 'array' || origin === 'set') {
    return `Array must contain ${exact ? 'exactly' : inclusive ? 'at most' : 'less than'} ${maximum} element(s)`;
  }
  if (origin === 'number' || origin === 'int' || origin === 'bigint') {
    return `Number must be ${exact ? 'exactly' : inclusive ? 'less than or equal to' : 'less than'} ${maximum}`;
  }
  return undefined;
}

/** The kit's error map: Zod 3's default words, issue by issue. */
export const KIT_MESSAGES: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined) return 'Required';
      if (issue.expected === 'int') return `Expected integer, received ${receivedType(issue.input) === 'number' ? 'float' : receivedType(issue.input)}`;
      return `Expected ${issue.expected}, received ${receivedType(issue.input)}`;
    case 'too_small':
      return tooSmall(issue.origin, issue.minimum, issue.inclusive ?? false, issue.exact ?? false);
    case 'too_big':
      return tooBig(issue.origin, issue.maximum, issue.inclusive ?? false, issue.exact ?? false);
    case 'invalid_value':
      if (issue.values.length === 1) return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
      return `Invalid enum value. Expected ${quoted(issue.values)}, received '${String(issue.input)}'`;
    case 'unrecognized_keys':
      return `Unrecognized key(s) in object: ${issue.keys.map((key) => `'${key}'`).join(', ')}`;
    case 'invalid_format':
      return issue.format === 'regex' ? 'Invalid' : `Invalid ${issue.format}`;
    case 'invalid_union': {
      const options = 'options' in issue && Array.isArray(issue.options) ? issue.options : null;
      return options && 'discriminator' in issue ? `Invalid discriminator value. Expected ${quoted(options)}` : 'Invalid input';
    }
    case 'not_multiple_of':
      return `Number must be a multiple of ${issue.divisor}`;
    case 'custom':
      return 'Invalid input';
    default:
      return undefined;
  }
};
