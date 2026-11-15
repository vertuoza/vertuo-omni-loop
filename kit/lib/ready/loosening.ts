// PRD 2898, s1: the loosening detector of the ready rule's check 4 — what in a pull request's diff
// against the default branch made a test easier to pass. Four kinds:
//
// - `tests`: a test file deleted, a test or a describe removed, or a skip, a todo, an only, an
//   x-prefixed test or describe added;
// - `assertions`: fewer `expect(` calls than before, an assertion turned weaker (toEqual to
//   toBeDefined or toBeTruthy, toThrow with its message to toThrow with none, toHaveBeenCalledWith to
//   toHaveBeenCalled), or a snapshot file rewritten;
// - `suppressions`: a lint or type-check suppression comment added, a floor lowered, a test timeout or
//   retry raised, a baseline grown;
// - `ac-tests`: a test titled `AC-<n>: …` whose title or steps changed while the spec's `AC-<n>` did not.
//
// Pure: each changed file's text at both ends in, findings out. It counts, file by file, what the text
// holds at each end, so a renamed test and a stronger assertion are no finding. A file it needs and
// cannot read is named as unjudged, never as clean. The markers are built from parts below, so that this
// file never holds one itself.
import type { Criterion } from './criteria.ts';

/** One file of the diff, its text at the base and at the head; a side is null when the file has none
 * there (added, deleted) or when it could not be read. */
export type DiffFile = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** A renamed file's path at the base. */
  previousPath?: string;
  before: string | null;
  after: string | null;
};

/** The four kinds of loosening. */
type LooseningKind = 'tests' | 'assertions' | 'suppressions' | 'ac-tests';

/** One loosening: its kind, the file, and what it is, in a few plain words. */
type Finding = { kind: LooseningKind; path: string; what: string };

/** The files whose numbers are a floor (each numeric value may never go down) and the folders whose
 * JSON files are a baseline (no entry may be added, no count may grow). */
export type LooseningGround = { floors: readonly string[]; baselines: readonly string[] };

/** The spec's criteria at the base and at the head, or null when either could not be read. */
type CriteriaEnds = { base: readonly Criterion[]; head: readonly Criterion[] } | null;

/** What the detector found, and the files it could not judge, each with why. */
type Loosenings = { findings: Finding[]; unjudged: string[] };

const TEST_FILE = /(?:^|\/)__tests__\/|\.(?:test|spec|e2e)\.[cm]?[jt]sx?$/;
const SNAPSHOT = /\.snap$/;
const CODE = /\.[cm]?[jt]sx?$/;
const TEST_CONFIG = /(?:^|\/)(?:vitest|vite|playwright|jest)\.(?:config|workspace)\.[cm]?[jt]s$/;

const NOT_AFTER_NAME = '(?<![\\w.$])';
const DECLARATION = new RegExp(`${NOT_AFTER_NAME}x?(?:it|test|describe|suite)(?:\\.\\w+)*\\s*\\(`, 'g');
const EXPECT = new RegExp(`${NOT_AFTER_NAME}expect(?:\\.\\w+)?\\s*\\(`, 'g');
const AC_TEST = new RegExp(`${NOT_AFTER_NAME}(?:it|test)(?:\\.\\w+)*\\s*\\(\\s*(['"\`])AC-([1-9]\\d*):`, 'g');

/** A modifier on a test or a describe: `<it|test|describe|suite>…<modifier>`. */
const modifier = (name: string, also = '') => new RegExp(`${NOT_AFTER_NAME}(?:it|test|describe|suite)(?:\\.\\w+)*\\.${name}${also}\\b`, 'g');
/** A call of an x-prefixed test or describe. */
const prefixed = (name: string) => new RegExp(`${NOT_AFTER_NAME}${name}\\s*\\(`, 'g');

const X_IT = ['x', 'it'].join('');
const X_DESCRIBE = ['x', 'describe'].join('');
const SKIPS: readonly { what: string; pattern: RegExp }[] = [
  { what: '.skip', pattern: modifier('skip', '(?:If)?') },
  { what: '.todo', pattern: modifier('todo') },
  { what: '.only', pattern: modifier('only') },
  { what: X_IT, pattern: prefixed(X_IT) },
  { what: X_DESCRIBE, pattern: prefixed(X_DESCRIBE) },
];

const STRONG_EQUAL = /\.(?:toEqual|toStrictEqual)\(/g;
const WEAKENINGS: readonly { what: string; strong: RegExp; weak: RegExp }[] = [
  { what: 'toEqual turned toBeDefined', strong: STRONG_EQUAL, weak: /\.toBeDefined\(/g },
  { what: 'toEqual turned toBeTruthy', strong: STRONG_EQUAL, weak: /\.toBeTruthy\(/g },
  { what: 'toThrow(<message>) turned toThrow()', strong: /\.toThrow(?:Error)?\(\s*[^)\s]/g, weak: /\.toThrow(?:Error)?\(\s*\)/g },
  { what: 'toHaveBeenCalledWith turned toHaveBeenCalled', strong: /\.toHaveBeenCalledWith\(/g, weak: /\.toHaveBeenCalled\(\s*\)/g },
];

const LINT_OFF = ['eslint', 'disable'].join('-');
const TYPES_OFF = ['@ts', 'ignore'].join('-');
const TYPES_EXPECTED = ['@ts', 'expect', 'error'].join('-');
const SUPPRESSIONS: readonly { what: string; pattern: RegExp }[] = [
  { what: LINT_OFF, pattern: new RegExp(LINT_OFF, 'g') },
  { what: TYPES_OFF, pattern: new RegExp(`${TYPES_OFF}\\b`, 'g') },
  { what: TYPES_EXPECTED, pattern: new RegExp(`${TYPES_EXPECTED}\\b`, 'g') },
];

const KEYED_TIMEOUT = /(?<![\w$])(testTimeout|hookTimeout|teardownTimeout|timeout|retry|retries)\s*:\s*(\d[\d_]*)/g;
const POSITIONAL_TIMEOUT = /\}\s*,\s*(\d[\d_]{3,})\s*\)/g;
const POSITIONAL_NAME = 'a test timeout';

const count = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].length;

/** The two texts of a file, an absent side read as empty, or null when a side it has was not read. */
function texts(file: DiffFile): { before: string; after: string } | null {
  const before = file.status === 'added' ? '' : file.before;
  const after = file.status === 'deleted' ? '' : file.after;
  return before === null || after === null ? null : { before, after };
}

type Ends = { before: string; after: string };

/** A count that went up from `before` to `after`. */
const rose = ({ before, after }: Ends, pattern: RegExp) => count(after, pattern) > count(before, pattern);

/** Tests and describes removed, and skips added. */
function testFindings(ends: Ends): { kind: LooseningKind; what: string }[] {
  const out: { kind: LooseningKind; what: string }[] = [];
  const [had, has] = [count(ends.before, DECLARATION), count(ends.after, DECLARATION)];
  if (has < had) out.push({ kind: 'tests', what: `${String(had - has)} test or describe removed (${String(had)} → ${String(has)})` });
  for (const { what, pattern } of SKIPS) if (rose(ends, pattern)) out.push({ kind: 'tests', what: `${what} added` });
  return out;
}

/** Fewer expects, and assertions turned weaker. */
function assertionFindings(ends: Ends): { kind: LooseningKind; what: string }[] {
  const out: { kind: LooseningKind; what: string }[] = [];
  const [had, has] = [count(ends.before, EXPECT), count(ends.after, EXPECT)];
  if (has < had) out.push({ kind: 'assertions', what: `fewer expect( calls (${String(had)} → ${String(has)})` });
  for (const { what, strong, weak } of WEAKENINGS) {
    if (count(ends.after, strong) < count(ends.before, strong) && rose(ends, weak)) out.push({ kind: 'assertions', what });
  }
  return out;
}

/** Suppression comments added. */
function suppressionFindings(ends: Ends): { kind: LooseningKind; what: string }[] {
  return SUPPRESSIONS.filter(({ pattern }) => rose(ends, pattern)).map(({ what }) => ({ kind: 'suppressions', what: `${what} added` }));
}

/** The highest value each timeout or retry key holds in `text`. */
function timeouts(text: string, positional: boolean): Map<string, number> {
  const out = new Map<string, number>();
  const keep = (key: string, raw: string) => out.set(key, Math.max(out.get(key) ?? -Infinity, Number(raw.replace(/_/g, ''))));
  for (const match of text.matchAll(KEYED_TIMEOUT)) keep(match[1] ?? '', match[2] ?? '0');
  if (positional) for (const match of text.matchAll(POSITIONAL_TIMEOUT)) keep(POSITIONAL_NAME, match[1] ?? '0');
  return out;
}

/** Timeouts and retries raised: a key whose highest value went up, or that is new. */
function timeoutFindings(ends: Ends, positional: boolean): { kind: LooseningKind; what: string }[] {
  const [had, has] = [timeouts(ends.before, positional), timeouts(ends.after, positional)];
  return [...has]
    .filter(([key, value]) => value > (had.get(key) ?? -Infinity))
    .map(([key, value]) => ({ kind: 'suppressions', what: `${key} raised (${String(had.get(key) ?? 'none')} → ${String(value)})` }));
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Every number `value` holds, by its dotted path. */
function numbers(value: unknown, at: string): [string, number][] {
  if (typeof value === 'number') return [[at, value]];
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, inner]) => numbers(inner, at === '' ? key : `${at}.${key}`));
}

/** JSON, or undefined when the text is none. */
function json(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return undefined;
  }
}

/** A floor lowered or dropped: any number of the base's file that is lower, or gone, at the head. */
function floorFindings(file: DiffFile, ends: Ends): { kind: LooseningKind; what: string }[] | string {
  if (file.status === 'deleted') return [{ kind: 'suppressions', what: 'the floor file was deleted' }];
  const [had, has] = [json(ends.before), json(ends.after)];
  if (has === undefined) return 'it is not JSON';
  const now = new Map(numbers(has, ''));
  return numbers(had, '').flatMap(([key, value]) => {
    const kept = now.get(key);
    if (kept !== undefined && kept >= value) return [];
    return [{ kind: 'suppressions' as const, what: `the floor ${key} ${kept === undefined ? 'dropped' : 'lowered'} (${String(value)} → ${String(kept ?? 'none')})` }];
  });
}

/** The first thing `after` holds that `before` did not: an entry added to a list, a number grown, or
 * a number that is new. Null when it holds none. */
function grown(before: unknown, after: unknown, at: string): string | null {
  if (typeof after === 'number') return grownNumber(before, after, at);
  if (Array.isArray(after)) return grownList(before, after, at);
  return isRecord(after) ? grownRecord(before, after, at) : null;
}

/** A number that grew, or that is new. */
function grownNumber(before: unknown, after: number, at: string): string | null {
  const had = typeof before === 'number' ? before : null;
  if (had !== null && after <= had) return null;
  return `${at} ${String(had ?? 'none')} → ${String(after)}`;
}

/** The first entry of a list that the list did not hold before. */
function grownList(before: unknown, after: readonly unknown[], at: string): string | null {
  const had = new Set((Array.isArray(before) ? before : []).map((entry) => JSON.stringify(entry)));
  const added = after.find((entry) => !had.has(JSON.stringify(entry)));
  return added === undefined ? null : `${at}: ${JSON.stringify(added)}`;
}

/** The first thing one of a record's keys grew. */
function grownRecord(before: unknown, after: Record<string, unknown>, at: string): string | null {
  const had = isRecord(before) ? before : {};
  for (const [key, inner] of Object.entries(after)) {
    const found = grown(had[key], inner, at === '' ? key : `${at}.${key}`);
    if (found !== null) return found;
  }
  return null;
}

/** A baseline grown. */
function baselineFindings(file: DiffFile, ends: Ends): { kind: LooseningKind; what: string }[] | string {
  if (file.status === 'deleted') return [];
  const has = json(ends.after);
  if (has === undefined) return 'it is not JSON';
  const found = grown(json(ends.before), has, '');
  return found === null ? [] : [{ kind: 'suppressions', what: `the baseline grew (${found})` }];
}

/** Each AC test of a text, by its criterion's number: its title and steps, whitespace collapsed. */
function acTests(text: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const match of text.matchAll(AC_TEST)) {
    const start = match.index;
    const next = new RegExp(DECLARATION.source, 'g');
    next.lastIndex = start + match[0].length;
    const end = next.exec(text)?.index ?? text.length;
    const number = Number(match[2]);
    const segment = text.slice(start, end).replace(/\s+/g, '');
    out.set(number, [out.get(number), segment].filter(Boolean).join('\n'));
  }
  return out;
}

/** Whether the spec's `AC-<n>` reads the same at both ends: its kind and its lines. */
function sameCriterion(criteria: NonNullable<CriteriaEnds>, number: number): boolean {
  const shape = (list: readonly Criterion[]) => {
    const found = list.find((criterion) => criterion.number === number);
    return found === undefined ? null : JSON.stringify({ kind: found.kind, lines: found.lines.map((line) => line.trim()) });
  };
  const base = shape(criteria.base);
  return base !== null && base === shape(criteria.head);
}

/** The AC tests that changed while their criterion did not; with the spec unread, each change unjudged. */
function acTestFindings(path: string, ends: Ends, criteria: CriteriaEnds): Loosenings {
  const [had, has] = [acTests(ends.before), acTests(ends.after)];
  const changed = [...had].filter(([number, text]) => has.get(number) !== text).map(([number]) => number);
  if (criteria === null) return { findings: [], unjudged: changed.map((number) => `${path}: AC-${String(number)}'s test changed, and the spec could not be read at both ends`) };
  const findings = changed
    .filter((number) => sameCriterion(criteria, number))
    .map((number) => ({ kind: 'ac-tests' as const, path, what: `AC-${String(number)}'s test changed while the spec's AC-${String(number)} did not` }));
  return { findings, unjudged: [] };
}

/** What a test file's change loosened. */
function testFileFindings(file: DiffFile, ends: Ends, criteria: CriteriaEnds): Loosenings {
  const ac = acTestFindings(file.path, ends, criteria);
  if (file.status === 'deleted') return { findings: [{ kind: 'tests', path: file.path, what: 'the test file was deleted' }, ...ac.findings], unjudged: ac.unjudged };
  const own = [...testFindings(ends), ...assertionFindings(ends), ...timeoutFindings(ends, true)].map((finding) => ({ ...finding, path: file.path }));
  return { findings: [...own, ...ac.findings], unjudged: ac.unjudged };
}

/** Whether the detector reads `path` at all. */
function relevant(path: string, ground: LooseningGround): boolean {
  return CODE.test(path) || SNAPSHOT.test(path) || ground.floors.includes(path) || isBaseline(path, ground);
}

const isBaseline = (path: string, ground: LooseningGround) => path.endsWith('.json') && ground.baselines.some((prefix) => path.startsWith(prefix));

/** What one readable file's change loosened, beside its tests: suppressions, timeouts, a floor, a baseline. */
function groundFindings(file: DiffFile, ends: Ends, ground: LooseningGround): Loosenings {
  const out: Loosenings = { findings: [], unjudged: [] };
  const add = (found: { kind: LooseningKind; what: string }[] | string) => {
    if (typeof found === 'string') out.unjudged.push(`${file.path}: ${found}`);
    else out.findings.push(...found.map((finding) => ({ ...finding, path: file.path })));
  };
  if (CODE.test(file.path)) add(suppressionFindings(ends));
  if (TEST_CONFIG.test(file.path)) add(timeoutFindings(ends, false));
  if (ground.floors.includes(file.path)) add(floorFindings(file, ends));
  if (isBaseline(file.path, ground)) add(baselineFindings(file, ends));
  return out;
}

/** What one file's change loosened. */
function fileLoosenings(file: DiffFile, ground: LooseningGround, criteria: CriteriaEnds): Loosenings {
  if (SNAPSHOT.test(file.path)) return { findings: file.status === 'added' ? [] : [{ kind: 'assertions', path: file.path, what: 'the snapshot was rewritten' }], unjudged: [] };
  const ends = texts(file);
  if (ends === null) return { findings: [], unjudged: [`${file.path}: its content could not be read`] };
  const tests = TEST_FILE.test(file.path) ? testFileFindings(file, ends, criteria) : { findings: [], unjudged: [] };
  const rest = groundFindings(file, ends, ground);
  return { findings: [...tests.findings, ...rest.findings], unjudged: [...tests.unjudged, ...rest.unjudged] };
}

/**
 * Every loosening of a diff, file by file in its order, and every file it could not judge. A path under
 * one of `generated`'s prefixes is never read: it is rebuilt from sources the diff holds and are read.
 */
export function loosenings(
  files: readonly DiffFile[],
  { ground, criteria, generated = [] }: { ground: LooseningGround; criteria: CriteriaEnds; generated?: readonly string[] },
): Loosenings {
  const out: Loosenings = { findings: [], unjudged: [] };
  const read = files.filter(({ path }) => relevant(path, ground) && !generated.some((prefix) => path.startsWith(prefix)));
  for (const file of read) {
    const found = fileLoosenings(file, ground, criteria);
    out.findings.push(...found.findings);
    out.unjudged.push(...found.unjudged);
  }
  return out;
}
