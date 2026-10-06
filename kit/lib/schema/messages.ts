// The words the kit's schemas fail with when a schema names none of its own (PRD 725, s3). Zod 4
// rewrote its default messages ("Required" became "Invalid input: expected string, received
// undefined"); the kit prints these messages to the people who run it, so it keeps Zod 3's words,
// passed at each parse: `Schema.safeParse(value, { error: KIT_MESSAGES })`. A message the schema
// names itself always wins over these. An issue this map does not word keeps Zod 4's default.
import type { z } from 'zod';

/** The classes Zod 3 named by their own word, in the order it tried them. */
const NAMED_CLASSES: readonly (readonly [abstract new (...args: never[]) => unknown, string])[] = [
  [Date, 'date'],
  [Map, 'map'],
  [Set, 'set'],
  [Promise, 'promise'],
];

/** Zod 3's name for the type of `value`, as its "received" half printed it. */
function receivedType(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isNaN(value) ? 'nan' : 'number';
  return NAMED_CLASSES.find(([type]) => value instanceof type)?.[1] ?? typeof value;
}

const quoted = (values: readonly unknown[]): string => values.map((value) => `'${String(value)}'`).join(' | ');

/** What a size bound measures, and how it bounds: exactly, at the limit, or past it. */
type Measure = 'string' | 'array' | 'number';
type Bound = 'exact' | 'inclusive' | 'exclusive';

/** The measure each issue origin is worded as; an origin not here keeps Zod 4's default. */
const MEASURES = new Map<string, Measure>([
  ['string', 'string'],
  ['array', 'array'],
  ['set', 'array'],
  ['number', 'number'],
  ['int', 'number'],
  ['bigint', 'number'],
]);

/** The sentence of each measure, around the words of its bound and its limit. */
const SENTENCES: Readonly<Record<Measure, (words: string, limit: number | bigint) => string>> = {
  string: (words, limit) => `String must contain ${words} ${limit} character(s)`,
  array: (words, limit) => `Array must contain ${words} ${limit} element(s)`,
  number: (words, limit) => `Number must be ${words} ${limit}`,
};

type BoundWords = Readonly<Record<Measure, Readonly<Record<Bound, string>>>>;

const TOO_SMALL: BoundWords = {
  string: { exact: 'exactly', inclusive: 'at least', exclusive: 'over' },
  array: { exact: 'exactly', inclusive: 'at least', exclusive: 'more than' },
  number: { exact: 'exactly equal to', inclusive: 'greater than or equal to', exclusive: 'greater than' },
};

const TOO_BIG: BoundWords = {
  string: { exact: 'exactly', inclusive: 'at most', exclusive: 'under' },
  array: { exact: 'exactly', inclusive: 'at most', exclusive: 'less than' },
  number: { exact: 'exactly', inclusive: 'less than or equal to', exclusive: 'less than' },
};

function boundOf(inclusive: boolean | undefined, exact: boolean | undefined): Bound {
  if (exact) return 'exact';
  return inclusive ? 'inclusive' : 'exclusive';
}

/** A too_small or too_big issue in Zod 3's words, or undefined for an origin it did not word. */
function sizeMessage(words: BoundWords, origin: string, limit: number | bigint, bound: Bound): string | undefined {
  const measure = MEASURES.get(origin);
  return measure === undefined ? undefined : SENTENCES[measure](words[measure][bound], limit);
}

type Issue = Parameters<z.core.$ZodErrorMap>[0];
type IssueOf<C extends Issue['code']> = Extract<Issue, { code: C }>;

function invalidType(issue: IssueOf<'invalid_type'>): string {
  if (issue.input === undefined) return 'Required';
  const received = receivedType(issue.input);
  if (issue.expected === 'int') return `Expected integer, received ${received === 'number' ? 'float' : received}`;
  return `Expected ${issue.expected}, received ${received}`;
}

function invalidValue(issue: IssueOf<'invalid_value'>): string {
  if (issue.values.length === 1) return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
  return `Invalid enum value. Expected ${quoted(issue.values)}, received '${String(issue.input)}'`;
}

function invalidUnion(issue: IssueOf<'invalid_union'>): string {
  const options = 'options' in issue && Array.isArray(issue.options) ? issue.options : null;
  return options && 'discriminator' in issue ? `Invalid discriminator value. Expected ${quoted(options)}` : 'Invalid input';
}

/** Each issue code's words; a code not here keeps Zod 4's default. */
const BY_CODE: { readonly [C in Issue['code']]?: (issue: IssueOf<C>) => string | undefined } = {
  invalid_type: invalidType,
  too_small: (issue) => sizeMessage(TOO_SMALL, issue.origin, issue.minimum, boundOf(issue.inclusive, issue.exact)),
  too_big: (issue) => sizeMessage(TOO_BIG, issue.origin, issue.maximum, boundOf(issue.inclusive, issue.exact)),
  invalid_value: invalidValue,
  unrecognized_keys: (issue) => `Unrecognized key(s) in object: ${issue.keys.map((key) => `'${key}'`).join(', ')}`,
  invalid_format: (issue) => (issue.format === 'regex' ? 'Invalid' : `Invalid ${issue.format}`),
  invalid_union: invalidUnion,
  not_multiple_of: (issue) => `Number must be a multiple of ${issue.divisor}`,
  custom: () => 'Invalid input',
};

function wordIssue<C extends Issue['code']>(issue: IssueOf<C>): string | undefined {
  const words: ((issue: IssueOf<C>) => string | undefined) | undefined = BY_CODE[issue.code];
  return words?.(issue);
}

/** The kit's error map: Zod 3's default words, issue by issue. */
export const KIT_MESSAGES: z.core.$ZodErrorMap = (issue) => wordIssue(issue);
