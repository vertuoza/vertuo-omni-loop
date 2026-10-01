import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FINDING_ORDER,
  ISSUES_PER_RUN,
  REFUSED_GAME_WORDS,
  REFUSED_PERSON_WORDS,
  REFUSED_WORDS,
  RULES_VERSION,
  THRESHOLDS,
  rankOf,
  refusedWordsIn,
  rulesSheet,
} from './rules.ts';

/** The quoted words of one `const NAME = [ … ];` list in the kit's banter test. */
function kitList(name: string): string[] {
  const source = readFileSync(
    fileURLToPath(new URL('../../../../kit/lib/outbox/banter.test.ts', import.meta.url)),
    'utf8',
  );
  const start = source.indexOf(`const ${name} = [`);
  expect(start).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf('];', start));
  const code = body
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
  return [...code.matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2] ?? "");
}

describe('rules', () => {
  it('has a version, which a retro records', () => {
    expect(RULES_VERSION).toBe(1);
    expect(rulesSheet().version).toBe(RULES_VERSION);
  });

  it('ranks the findings in the spec’s order, a repeated red and a flaky run sharing one rank', () => {
    expect(FINDING_ORDER).toEqual([
      ['bug'],
      ['override'],
      ['drift'],
      ['repeated-red', 'flaky'],
      ['failing-test'],
      ['review'],
      ['friction'],
      ['territory'],
      ['churn'],
      ['slow-slice'],
    ]);
    expect(rankOf('repeated-red')).toBe(rankOf('flaky'));
    expect(rankOf('bug')).toBeLessThan(rankOf('slow-slice'));
    expect(rankOf('something-new')).toBe(FINDING_ORDER.length);
  });

  it('caps the issues at five per run', () => {
    expect(ISSUES_PER_RUN).toBe(5);
  });

  it('holds the spec’s thresholds', () => {
    expect(THRESHOLDS).toMatchObject({
      slowSliceFactor: 3,
      repeatedRedCommits: 2,
      repeatedRedSlices: 2,
      failingTestRuns: 2,
      churnRangeCommits: 3,
      churnFilePercent: 50,
      churnFileLines: 40,
      afterMergeDays: 14,
    });
  });

  it('refuses the same words the kit’s question pool may not hold, copied word for word', () => {
    expect(REFUSED_GAME_WORDS).toEqual(kitList('GAME_WORDS'));
    expect(REFUSED_PERSON_WORDS).toEqual(kitList('PERSON_OR_TEAM_WORDS'));
    expect(REFUSED_WORDS).toEqual([...REFUSED_GAME_WORDS, ...REFUSED_PERSON_WORDS]);
  });

  it('finds a refused word whole, a space matching a hyphen or nothing', () => {
    expect(refusedWordsIn('The Omni-Man scored points.')).toEqual(['scored', 'points', 'omni man']);
    expect(refusedWordsIn('A check went red on two commits.')).toEqual([]);
    expect(refusedWordsIn('The display stayed red.')).toEqual([]);
  });

  it('is copied into the fact sheet whole, so retro.json holds every number retro.md shows of it', () => {
    const sheet = rulesSheet();
    expect(sheet.issuesPerRun).toBe(ISSUES_PER_RUN);
    expect(sheet.thresholds).toEqual(THRESHOLDS);
    expect(JSON.parse(JSON.stringify(sheet))).toEqual(sheet);
  });
});
