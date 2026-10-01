// @ts-nocheck
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanLog, readTestLog, tailOf } from './ci-logs.ts';

const fixture = (name) => readFileSync(new URL(`./ci.fixtures/${name}.log`, import.meta.url), 'utf8');

describe('cleanLog', () => {
  it('drops the byte-order mark, the timestamp Actions puts on every line and the colour codes', () => {
    const clean = cleanLog(fixture('vitest'));
    expect(clean).not.toMatch(/\u001b/);
    expect(clean).not.toMatch(/﻿/);
    expect(clean).not.toMatch(/^2026-09-20T/m);
    expect(clean.split('\n')[0]).toBe('##[group]Run pnpm test');
    expect(clean).toContain(' FAIL  src/cart/cart.test.ts > cart > adds an item');
  });

  it('leaves a log already clean as it was', () => {
    const once = cleanLog(fixture('jest'));
    expect(cleanLog(once)).toBe(once);
  });
});

describe('tailOf', () => {
  it('keeps only the last lines, the last one included', () => {
    const log = Array.from({ length: 500 }, (_, index) => `line ${index + 1}`).join('\n');
    const tail = tailOf(`${log}\n`, 200).split('\n');
    expect(tail).toHaveLength(200);
    expect(tail[0]).toBe('line 301');
    expect(tail.at(-1)).toBe('line 500');
  });

  it('keeps a short log whole', () => {
    expect(tailOf('a\nb\n', 200)).toBe('a\nb');
  });
});

describe('readTestLog — the failing tests a log names, and its counts', () => {
  it('reads Vitest: each FAIL line, and the Tests summary', () => {
    expect(readTestLog(fixture('vitest'))).toEqual({
      reporter: 'vitest',
      tests: ['src/cart/cart.test.ts > cart > adds an item', 'src/cart/cart.test.ts > cart > removes an item'],
      counts: { failed: 2, passed: 5, total: 7 },
    });
  });

  it('reads Jest: each ● block under its FAIL file, a suite that failed to run by its file, and the Tests summary', () => {
    expect(readTestLog(fixture('jest'))).toEqual({
      reporter: 'jest',
      tests: [
        'src/cart/cart.test.js > cart > adds an item',
        'src/cart/cart.test.js > cart > checkout > pays by card',
        'src/show/show.test.js',
      ],
      counts: { failed: 2, passed: 6, total: 8 },
    });
  });

  it('reads Playwright: the tests its summary lists as failed, without line numbers, and every count', () => {
    expect(readTestLog(fixture('playwright'))).toEqual({
      reporter: 'playwright',
      tests: ['[chromium] > tests/cart.spec.ts > cart > adds an item'],
      counts: { failed: 1, flaky: 1, skipped: 1, passed: 3 },
    });
  });

  it('reads pytest: each FAILED node id of the short summary, and the closing counts', () => {
    expect(readTestLog(fixture('pytest'))).toEqual({
      reporter: 'pytest',
      tests: ['tests/test_cart.py::test_add_item', 'tests/test_cart.py::TestCheckout::test_pays[card]'],
      counts: { failed: 2, passed: 10, skipped: 1 },
    });
  });

  it('reads no reporter, no test and no count from a log in any other format', () => {
    expect(readTestLog(fixture('unknown'))).toEqual({ reporter: null, tests: [], counts: null });
  });

  it('reads Vitest from its × lines when the tail was cut before its FAIL section', () => {
    const cut = [
      ' ❯ src/cart/cart.test.ts (3 tests | 1 failed) 9ms',
      '   × cart > adds an item 5ms',
      '     → expected 2 to be 3',
      '   ✓ cart > starts empty 1ms',
      ' Test Files  1 failed (1)',
      '      Tests  1 failed | 1 passed (2)',
    ].join('\n');
    expect(readTestLog(cut)).toEqual({
      reporter: 'vitest',
      tests: ['src/cart/cart.test.ts > cart > adds an item'],
      counts: { failed: 1, passed: 1, total: 2 },
    });
  });

  it('names a Vitest file that failed to load by the file alone', () => {
    const log = [' FAIL  src/show/show.test.ts [ src/show/show.test.ts ]', 'Error: Cannot find module', ' Test Files  1 failed (1)', '      Tests  no tests'].join('\n');
    expect(readTestLog(log)).toMatchObject({ reporter: 'vitest', tests: ['src/show/show.test.ts'] });
  });

  it('keeps the names but no count when the summary line was cut off', () => {
    const log = ['=========================== short test summary info ============================', 'FAILED tests/test_cart.py::test_add_item - assert 2 == 3'].join('\n');
    expect(readTestLog(log)).toEqual({ reporter: 'pytest', tests: ['tests/test_cart.py::test_add_item'], counts: null });
  });
});
