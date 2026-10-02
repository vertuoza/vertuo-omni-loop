// Reading a failed job's log (PRD 72, "Failing tests"): the last lines of the log in, the reporter it
// came from, the tests it names as failed and the counts its summary gives out. Pure: text in, plain
// data out, so the same tail always names the same tests.
//
// Four reporters are read: Vitest, Jest, Playwright and pytest. A log in any other format names no
// test and gives no count; the kind keeps its lines as an excerpt instead. A test is named the way
// its reporter names it, with the separators made one (` > `) and the line numbers Playwright adds
// left out, so the same test failing on two commits carries one name.

/** The timestamp GitHub Actions puts at the start of every line of a job's log. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z ?/;
/** Terminal colour and cursor codes. */
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007/g;

export type Reporter = 'vitest' | 'jest' | 'playwright' | 'pytest';
export type Counts = Record<string, number>;
export type TestLog = { reporter: Reporter | null; tests: string[]; counts: Counts | null };

type LogReader = {
  id: Reporter;
  detects: (lines: string[]) => boolean;
  read: (lines: string[]) => { tests: string[]; counts: Counts | null };
};

/** The count words kept, by the key they are kept under. */
const COUNT_KEYS: Readonly<Record<string, string>> = Object.freeze({
  failed: 'failed',
  passed: 'passed',
  skipped: 'skipped',
  flaky: 'flaky',
  error: 'errors',
  errors: 'errors',
  total: 'total',
});

/** A log as a person reads it: no byte-order mark, no Actions timestamps, no colour codes. */
export function cleanLog(text: unknown): string {
  return String(text ?? '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.replace(TIMESTAMP, '').replace(ANSI, ''))
    .join('\n');
}

/** The last `count` lines of `text`, a final newline not counted as a line. */
export function tailOf(text: unknown, count: number): string {
  const lines = String(text ?? '').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.slice(-count).join('\n');
}

/**
 * The reporter a log came from, the tests it names as failed (each once, as first named) and the
 * counts of its summary; `null` for the reporter and the counts when the log is in no format read here.
 */
export function readTestLog(text: string): TestLog {
  const lines = cleanLog(text).split('\n');
  for (const reader of READERS) {
    if (!reader.detects(lines)) continue;
    const { tests, counts } = reader.read(lines);
    return { reporter: reader.id, tests: unique(tests), counts };
  }
  return { reporter: null, tests: [], counts: null };
}

const pytest: LogReader = {
  id: 'pytest',
  detects: (lines) =>
    lines.some((line) => /^=+ (test session starts|short test summary info) =+$/.test(line) || PYTEST_SUMMARY.test(line)),
  read(lines) {
    const tests = present(lines.map((line) => /^FAILED (.+?)(?: - .*)?$/.exec(line.trim())?.[1]));
    const summary = lines.filter((line) => PYTEST_SUMMARY.test(line)).at(-1);
    return { tests, counts: summary ? countsIn(PYTEST_SUMMARY.exec(summary)?.[1] ?? '') : null };
  },
};
const PYTEST_SUMMARY = /^=+ (\d+ \w.*?) in [\d.]+s\b.*=+$/;

const PLAYWRIGHT_HEADER = /^\s*\d+\) (.+? › .+?)\s*[─═=-]*\s*$/;
const PLAYWRIGHT_COUNT = /^\s*(\d+) (failed|flaky|passed|skipped|interrupted|did not run)(?: \(.*\))?\s*$/;
const playwright: LogReader = {
  id: 'playwright',
  detects: (lines) =>
    lines.some((line) => /^Running \d+ tests? using \d+ workers?/.test(line.trim()) || PLAYWRIGHT_HEADER.test(line)),
  read(lines) {
    const { counts, listed } = playwrightSummary(lines);
    const failed = Object.keys(counts).length > 0 ? listed : present(lines.map((line) => PLAYWRIGHT_HEADER.exec(line)?.[1]));
    return { tests: failed.map(playwrightName), counts: Object.keys(counts).length > 0 ? counts : null };
  },
};

/** Playwright's summary: the counts it gives out, and the tests listed under its `failed` count. */
function playwrightSummary(lines: string[]): { counts: Counts; listed: string[] } {
  const counts: Counts = {};
  const listed: string[] = [];
  let section: string | null = null;
  for (const line of lines) {
    const count = PLAYWRIGHT_COUNT.exec(line);
    if (count) {
      section = keptCount(counts, count);
      continue;
    }
    const entry = /^\s{2,}(\S.*? › .+?)\s*[─═=-]*\s*$/.exec(line);
    if (section === 'failed' && entry?.[1] !== undefined) listed.push(entry[1]);
    else if (line.trim() !== '') section = null;
  }
  return { counts, listed };
}

/** Keeps a Playwright count line's number under its key; the section the line opens. */
function keptCount(counts: Counts, count: RegExpExecArray): string | null {
  const section = count[2] ?? null;
  const key = section === null ? undefined : COUNT_KEYS[section];
  if (key) counts[key] = Number(count[1]);
  return section;
}

/** A Playwright title without its line and column, nor the retry it was printed for. */
function playwrightName(title: string): string {
  return normalize(title.replace(/(\S+?\.\w+):\d+:\d+/g, '$1').replace(/\s*\(retry #\d+\)\s*$/, ''));
}

const JEST_SKIPPED = /^(Console|Validation Warning|Validation Error|Deprecation Warning)\b/;
const jest: LogReader = {
  id: 'jest',
  detects: (lines) => lines.some((line) => /^(Tests|Test Suites):\s+\d/.test(line.trim()) || /^\s*● \S/.test(line)),
  read(lines) {
    const tests: string[] = [];
    let file: string | null = null;
    for (const line of lines) {
      const fail = /^\s*FAIL\s+(\S+)/.exec(line);
      if (fail?.[1] !== undefined) file = fail[1];
      else tests.push(...jestFailed(line, file));
    }
    const summary = present(lines.map((line) => /^\s*Tests:\s+(.+)$/.exec(line)?.[1])).at(-1);
    return { tests, counts: summary ? countsIn(summary) : null };
  },
};

/** The test a Jest `●` line names as failed, under the file of the last FAIL line: none for any other line. */
function jestFailed(line: string, file: string | null): string[] {
  const block = /^\s*● (.+?)\s*$/.exec(line);
  if (block?.[1] === undefined || JEST_SKIPPED.test(block[1])) return [];
  if (block[1] === 'Test suite failed to run') return file ? [file] : [];
  return [normalize(file ? `${file} › ${block[1]}` : block[1])];
}

const VITEST_SUMMARY = /^\s*Tests\s{2,}(.+)$/;
const vitest: LogReader = {
  id: 'vitest',
  detects: (lines) =>
    lines.some((line) => /^\s*Test Files\s{2,}\d/.test(line) || VITEST_SUMMARY.test(line) || /^\s*FAIL\s{2,}\S.* > /.test(line)),
  read(lines) {
    const failLines = present(lines.map((line) => /^\s*FAIL\s{2,}(\S.*?)\s*$/.exec(line)?.[1]))
      .map((rest) => normalize(rest.replace(/\s+\[\s*.+?\s*\]$/, '')));
    const tests = failLines.length > 0 ? failLines : vitestCrosses(lines);
    const summary = present(lines.map((line) => VITEST_SUMMARY.exec(line)?.[1])).at(-1);
    return { tests, counts: summary ? countsIn(summary) : null };
  },
};

/** Vitest's `×` lines, each under the `❯ <file> (<n> tests…)` line of its file: its failing tests when the tail holds no FAIL line. */
function vitestCrosses(lines: string[]): string[] {
  const tests: string[] = [];
  let file: string | null = null;
  for (const line of lines) {
    const header = /^\s*❯\s+(\S+)\s+\(\d+ tests?\b/.exec(line);
    if (header?.[1] !== undefined) {
      file = header[1];
      continue;
    }
    const cross = /^\s*[×✗]\s+(.+?)(?:\s+\d+(?:\.\d+)?m?s)?\s*$/.exec(line);
    if (cross?.[1] !== undefined) tests.push(normalize(file ? `${file} > ${cross[1]}` : cross[1]));
  }
  return tests;
}

/** The order the reporters are tried in: the most distinctive signature first. */
const READERS: readonly LogReader[] = Object.freeze([pytest, playwright, jest, vitest]);

/** `2 failed | 5 passed (7)`, `2 failed, 6 passed, 8 total`… as `{ failed: 2, passed: 5, total: 7 }`; `null` with no count. */
function countsIn(text: string): Counts | null {
  const counts: Counts = {};
  for (const [, number, word] of text.matchAll(/(\d+) ([a-z]+)/g)) {
    const key = word === undefined ? undefined : COUNT_KEYS[word];
    if (key && !(key in counts)) counts[key] = Number(number);
  }
  const total = /\((\d+)\)\s*$/.exec(text.trim());
  if (total && !('total' in counts)) counts.total = Number(total[1]);
  return Object.keys(counts).length > 0 ? counts : null;
}

/** One separator between a test's file, its suites and its title: ` > `. */
function normalize(name: string): string {
  return name
    .replace(/\s+[›>]\s+/g, ' > ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** The values a list of optional matches holds: what `.filter(Boolean)` kept, an empty match left out too. */
function present(values: readonly (string | undefined)[]): string[] {
  return values.filter((value): value is string => Boolean(value));
}
