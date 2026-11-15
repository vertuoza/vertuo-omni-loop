// PRD 2898, s1: the loosening detector of the ready rule's check 4, one fixture per kind and per
// weakening the spec lists, and clean diffs that must pass. The markers it looks for are built at run
// time here (`dot('it', 'skip')`), so this file's own diff never reads as a loosening.
import { describe, expect, it } from 'vitest';
import { parseCriteria } from './criteria.ts';
import { loosenings } from './loosening.ts';
import type { DiffFile } from './loosening.ts';

const dot = (...parts: string[]) => parts.join('.');
const SKIP = dot('it', 'skip');
const ONLY = dot('it', 'only');
const TODO = dot('it', 'todo');
const DESCRIBE_SKIP = dot('describe', 'skip');
const XIT = ['x', 'it'].join('');
const XDESCRIBE = ['x', 'describe'].join('');
const DISABLE = ['eslint', 'disable', 'next', 'line'].join('-');
const IGNORE = ['@ts', 'ignore'].join('-');
const EXPECT_ERROR = ['@ts', 'expect', 'error'].join('-');

const GROUND = { floors: ['mutation/floor.json'], baselines: ['fallow/', 'layering/'] };

const modified = (path: string, before: string, after: string): DiffFile => ({ path, status: 'modified', before, after });
const added = (path: string, after: string): DiffFile => ({ path, status: 'added', before: null, after });
const deleted = (path: string, before: string): DiffFile => ({ path, status: 'deleted', before, after: null });

const TEST = 'kit/lib/x.test.ts';

/** A test file of `tests`, each `[title, body]`, in one describe. */
function testFile(tests: readonly (readonly [string, string])[], opener = 'it'): string {
  return [`describe('x', () => {`, ...tests.map(([title, body]) => `  ${opener}('${title}', () => {\n    ${body}\n  });`), '});', ''].join('\n');
}

const TWO = testFile([['reads one', 'expect(read(1)).toEqual({ a: 1 });'], ['reads two', 'expect(read(2)).toEqual({ a: 2 });\n    expect(read(3)).toEqual({ a: 3 });']]);

const findings = (files: readonly DiffFile[], criteria: Parameters<typeof loosenings>[1]['criteria'] = { base: [], head: [] }) =>
  loosenings(files, { ground: GROUND, criteria }).findings.map(({ kind, path, what }) => `${kind} ${path}: ${what}`);

describe('loosenings: deleted or skipped tests (PRD 2898)', () => {
  it('finds a test file deleted', () => {
    expect(findings([deleted(TEST, TWO)])).toEqual([`tests ${TEST}: the test file was deleted`]);
  });

  it('finds a test or a describe removed', () => {
    const one = testFile([['reads one', 'expect(read(1)).toEqual({ a: 1 });\n    expect(read(2)).toEqual({ a: 2 });\n    expect(read(3)).toEqual({ a: 3 });']]);
    expect(findings([modified(TEST, TWO, one)])).toEqual([`tests ${TEST}: 1 test or describe removed (3 → 2)`]);
  });

  it('finds each of .skip, .todo, .only, xit and xdescribe added, in a changed or a new test file', () => {
    for (const [marker, what] of [[SKIP, '.skip'], [TODO, '.todo'], [ONLY, '.only'], [XIT, 'xit'], [DESCRIBE_SKIP, '.skip']] as const) {
      const after = TWO.replace("it('reads two'", `${marker}('reads two'`);
      expect(findings([modified(TEST, TWO, after)]), marker).toEqual([`tests ${TEST}: ${what} added`]);
    }
    const describedAway = TWO.replace("describe('x'", `${XDESCRIBE}('x'`);
    expect(findings([modified(TEST, TWO, describedAway)])).toEqual([`tests ${TEST}: xdescribe added`]);
    expect(findings([added('kit/lib/new.test.ts', TWO.replace("it('reads one'", `${SKIP}('reads one'`))])).toEqual(['tests kit/lib/new.test.ts: .skip added']);
  });
});

describe('loosenings: weaker assertions (PRD 2898)', () => {
  it('finds fewer expect( calls than before', () => {
    const fewer = TWO.replace('\n    expect(read(3)).toEqual({ a: 3 });', '');
    expect(findings([modified(TEST, TWO, fewer)])).toEqual([`assertions ${TEST}: fewer expect( calls (3 → 2)`]);
  });

  it('finds toEqual turned toBeDefined or toBeTruthy', () => {
    for (const weak of ['toBeDefined()', 'toBeTruthy()']) {
      const after = TWO.replace('expect(read(1)).toEqual({ a: 1 });', `expect(read(1)).${weak};`);
      expect(findings([modified(TEST, TWO, after)]), weak).toEqual([`assertions ${TEST}: toEqual turned ${weak.replace('()', '')}`]);
    }
  });

  it('finds toThrow(<message>) turned toThrow(), and toHaveBeenCalledWith turned toHaveBeenCalled', () => {
    const throwing = testFile([['throws', "expect(() => read(0)).toThrow(/no zero/);"]]);
    expect(findings([modified(TEST, throwing, throwing.replace('toThrow(/no zero/)', 'toThrow()'))])).toEqual([`assertions ${TEST}: toThrow(<message>) turned toThrow()`]);
    const called = testFile([['calls', 'expect(spy).toHaveBeenCalledWith(1);']]);
    expect(findings([modified(TEST, called, called.replace('toHaveBeenCalledWith(1)', 'toHaveBeenCalled()'))])).toEqual([`assertions ${TEST}: toHaveBeenCalledWith turned toHaveBeenCalled`]);
  });

  it('finds a snapshot file rewritten or deleted, never one added', () => {
    const snap = 'kit/lib/__snapshots__/x.test.ts.snap';
    expect(findings([modified(snap, 'a', 'b')])).toEqual([`assertions ${snap}: the snapshot was rewritten`]);
    expect(findings([deleted('kit/lib/prompt.snap', 'a')])).toEqual(['assertions kit/lib/prompt.snap: the snapshot was rewritten']);
    expect(findings([added('kit/lib/new.snap', 'a')])).toEqual([]);
  });
});

describe('loosenings: suppressions and floors (PRD 2898)', () => {
  it('finds each suppression added to any code file', () => {
    for (const marker of [DISABLE, IGNORE, EXPECT_ERROR]) {
      const name = marker === DISABLE ? ['eslint', 'disable'].join('-') : marker;
      expect(findings([modified('kit/lib/x.ts', 'const a = 1;\n', `// ${marker}\nconst a = 1;\n`)]), marker).toEqual([`suppressions kit/lib/x.ts: ${name} added`]);
    }
    expect(findings([added('apps/x/page.tsx', `// ${IGNORE}\n`)])).toEqual([`suppressions apps/x/page.tsx: ${IGNORE} added`]);
  });

  it('finds a mutation floor lowered or dropped, never one raised', () => {
    const floor = 'mutation/floor.json';
    const before = JSON.stringify({ board: 89, outbox: 75 });
    expect(findings([modified(floor, before, JSON.stringify({ board: 89, outbox: 70 }))])).toEqual([`suppressions ${floor}: the floor outbox lowered (75 → 70)`]);
    expect(findings([modified(floor, before, JSON.stringify({ board: 89 }))])).toEqual([`suppressions ${floor}: the floor outbox dropped (75 → none)`]);
    expect(findings([deleted(floor, before)])).toEqual([`suppressions ${floor}: the floor file was deleted`]);
    expect(findings([modified(floor, before, JSON.stringify({ board: 90, outbox: 75, retro: 100 }))])).toEqual([]);
  });

  it('finds a test timeout or a retry raised, in a test or in a test config', () => {
    const slow = testFile([['reads', 'expect(read(1)).toEqual({ a: 1 });']]);
    // Built from parts, as the markers above: this file's own diff never reads as a raised timeout.
    const positional = ['\n  }, ', '30_000);\n});'].join('');
    expect(findings([modified(TEST, slow, slow.replace('\n  });\n});', positional))])).toEqual([`suppressions ${TEST}: a test timeout raised (none → 30000)`]);
    const config = 'vitest.config.ts';
    const set = (key: string, value: number) => `test: { ${key}: ${String(value)} }`;
    const TIMEOUT = ['test', 'Timeout'].join('');
    const RETRY = ['re', 'try'].join('');
    expect(findings([modified(config, set(TIMEOUT, 5000), set(TIMEOUT, 10000))])).toEqual([`suppressions ${config}: testTimeout raised (5000 → 10000)`]);
    expect(findings([modified(config, set(RETRY, 0), set(RETRY, 2))])).toEqual([`suppressions ${config}: retry raised (0 → 2)`]);
    expect(findings([modified(config, set(TIMEOUT, 10000), set(TIMEOUT, 5000))])).toEqual([]);
  });

  it('finds a baseline grown, and passes one that shrank', () => {
    const layering = 'layering/baseline.json';
    const before = JSON.stringify({ breaches: ['a.ts controller-import', 'b.ts controller-import'] });
    expect(findings([modified(layering, before, JSON.stringify({ breaches: ['a.ts controller-import', 'b.ts controller-import', 'c.ts controller-import'] }))])).toEqual([
      `suppressions ${layering}: the baseline grew (breaches: "c.ts controller-import")`,
    ]);
    expect(findings([modified(layering, before, JSON.stringify({ breaches: ['a.ts controller-import'] }))])).toEqual([]);
    const health = 'fallow/health.json';
    const counts = (n: number) => JSON.stringify({ finding_counts: { 'a.ts': { crap_high: { count: n } } } });
    expect(findings([modified(health, counts(1), counts(2))])).toEqual([`suppressions ${health}: the baseline grew (finding_counts.a.ts.crap_high.count 1 → 2)`]);
    expect(findings([modified('fallow/README.md', 'a', 'b\nc')])).toEqual([]);
  });
});

describe('loosenings: changed AC tests (PRD 2898)', () => {
  const spec = (then: string) =>
    parseCriteria(['### AC-3 · test', '', '```gherkin', 'Scenario: s', '  Given a', '  When b', `  Then ${then}`, '```', ''].join('\n')).criteria;
  const acTest = (title: string, body: string) => testFile([[title, body]]);
  const before = acTest('AC-3: evidence still coming never passes', "expect(state).toBe('not finished');");

  it('finds an AC test whose title or steps changed while the spec\'s criterion did not', () => {
    const same = { base: spec('c'), head: spec('c') };
    expect(findings([modified(TEST, before, acTest('AC-3: evidence passes', "expect(state).toBe('not finished');"))], same)).toEqual([
      `ac-tests ${TEST}: AC-3's test changed while the spec's AC-3 did not`,
    ]);
    expect(findings([modified(TEST, before, acTest('AC-3: evidence still coming never passes', "expect(state).toBe('pass');"))], same)).toEqual([
      `ac-tests ${TEST}: AC-3's test changed while the spec's AC-3 did not`,
    ]);
  });

  it('passes an AC test changed with its criterion, a new criterion\'s test, and a change of whitespace only', () => {
    const changed = acTest('AC-3: evidence passes', "expect(state).toBe('pass');");
    expect(findings([modified(TEST, before, changed)], { base: spec('c'), head: spec('d') })).toEqual([]);
    expect(findings([modified(TEST, before, changed)], { base: [], head: spec('c') })).toEqual([]);
    expect(findings([modified(TEST, before, before.replace("expect(state)", "expect(  state )"))], { base: spec('c'), head: spec('c') })).toEqual([]);
  });

  it('leaves an AC test change it cannot judge, the spec unread at one end, unjudged', () => {
    const read = loosenings([modified(TEST, before, acTest('AC-3: evidence passes', "expect(state).toBe('not finished');"))], { ground: GROUND, criteria: null });
    expect(read).toEqual({ findings: [], unjudged: [`${TEST}: AC-3's test changed, and the spec could not be read at both ends`] });
  });
});

describe('loosenings: clean diffs (PRD 2898)', () => {
  it('passes a test renamed, an assertion made stronger, a new test and a file outside the tests', () => {
    const renamed = TWO.replace("'reads one'", "'reads the first'");
    expect(findings([modified(TEST, TWO, renamed)])).toEqual([]);
    const stronger = TWO.replace('expect(read(1)).toEqual({ a: 1 });', 'expect(read(1)).toStrictEqual({ a: 1 });');
    expect(findings([modified(TEST, testFile([['reads one', 'expect(read(1)).toBeDefined();']]), testFile([['reads one', 'expect(read(1)).toEqual({ a: 1 });']]))])).toEqual([]);
    expect(findings([modified(TEST, TWO, stronger)])).toEqual([]);
    expect(findings([modified(TEST, TWO, TWO.replace('});\n', "  it('reads four', () => {\n    expect(read(4)).toEqual({ a: 4 });\n  });\n});\n"))])).toEqual([]);
    expect(findings([modified('kit/lib/x.ts', 'const a = 1;\n', 'const a = 2;\n'), { path: 'docs/a.png', status: 'modified', before: null, after: null }])).toEqual([]);
  });

  it('passes a test file renamed with its tests unchanged', () => {
    expect(findings([{ path: 'kit/lib/y.test.ts', previousPath: TEST, status: 'renamed', before: TWO, after: TWO }])).toEqual([]);
  });

  it('names a test file whose content could not be read as unjudged, never as clean', () => {
    const read = loosenings([{ path: TEST, status: 'modified', before: TWO, after: null }], { ground: GROUND, criteria: { base: [], head: [] } });
    expect(read).toEqual({ findings: [], unjudged: [`${TEST}: its content could not be read`] });
  });
});
