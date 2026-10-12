// PRD 1550: `design.ignore` — the globs `omni design touched` drops from a diff before it matches
// `design.paths` and the screen library. Its own file, so `kit/lib/config.test.ts`, a law's proof,
// stays as it is.
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { DEFAULT_DESIGN_IGNORE, designIgnore, dropIgnored } from './ignore.ts';

describe('design.ignore', () => {
  it('defaults to the common test shapes, naming no test framework', () => {
    expect(DEFAULT_DESIGN_IGNORE).toEqual(['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/test/**']);
    expect(designIgnore(parseConfig('kit: 1\n').design)).toEqual(DEFAULT_DESIGN_IGNORE);
    expect(designIgnore(parseConfig('kit: 1\ndesign:\n  enabled: true\n').design)).toEqual(DEFAULT_DESIGN_IGNORE);
  });

  it("accepts the repository's own list, and [] for none", () => {
    expect(designIgnore(parseConfig('kit: 1\ndesign:\n  ignore: ["e2e/**"]\n').design)).toEqual(['e2e/**']);
    expect(designIgnore(parseConfig('kit: 1\ndesign:\n  ignore: []\n').design)).toEqual([]);
  });

  it('refuses a list that is not a list of globs', () => {
    expect(() => parseConfig('kit: 1\ndesign:\n  ignore: "**/*.test.*"\n')).toThrow(/design\.ignore/);
    expect(() => parseConfig('kit: 1\ndesign:\n  ignore: [""]\n')).toThrow(/design\.ignore/);
  });
});

describe('dropIgnored', () => {
  const CHANGED = ['src/ui/Button.tsx', 'src/ui/Button.test.tsx', 'src/ui/a.spec.ts', 'src/ui/__tests__/x.tsx', 'test/fixture.css', 'kit/test/y.ts', 'src/testing/z.tsx'];

  it('drops every changed path an ignore glob matches, keeping the order of the rest', () => {
    expect(dropIgnored(DEFAULT_DESIGN_IGNORE, CHANGED)).toEqual(['src/ui/Button.tsx', 'src/testing/z.tsx']);
  });

  it('drops nothing with no glob', () => {
    expect(dropIgnored([], CHANGED)).toEqual(CHANGED);
  });
});
