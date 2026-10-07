// PRD 1138: which generated outputs a range's diff made stale.
import { describe, expect, it } from 'vitest';
import { staleness } from './stale.ts';

const BUNDLE = { path: 'out/', from: ['src/', 'lib/'], build: 'pnpm build' };
const API = { path: 'api/', from: ['app/', 'lib/'], build: 'node build.ts' };

describe('staleness', () => {
  it('makes an entry stale when a changed path starts with one of its from prefixes', () => {
    expect(staleness([BUNDLE], ['README.md', 'lib/a.ts'])).toEqual([{ ...BUNDLE, stale: true }]);
    expect(staleness([BUNDLE], ['src/deep/b.ts'])).toEqual([{ ...BUNDLE, stale: true }]);
  });

  it('leaves it fresh when only the output itself or unrelated paths changed', () => {
    expect(staleness([BUNDLE], ['out/bundle.mjs', 'docs/a.md', 'srcx/a.ts'])).toEqual([{ ...BUNDLE, stale: false }]);
    expect(staleness([BUNDLE], [])).toEqual([{ ...BUNDLE, stale: false }]);
  });

  it('grades several entries at once, in config order', () => {
    expect(staleness([BUNDLE, API], ['app/x.ts'])).toEqual([{ ...BUNDLE, stale: false }, { ...API, stale: true }]);
    expect(staleness([BUNDLE, API], ['lib/x.ts'])).toEqual([{ ...BUNDLE, stale: true }, { ...API, stale: true }]);
  });

  it('has nothing to grade without entries', () => {
    expect(staleness([], ['lib/x.ts'])).toEqual([]);
  });
});
