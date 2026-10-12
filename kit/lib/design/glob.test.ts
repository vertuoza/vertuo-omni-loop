// PRD 1369: the globs `design.paths` holds, matched against repository paths.
import { describe, expect, it } from 'vitest';
import { matchesGlob } from './glob.ts';

describe('matchesGlob', () => {
  it('matches * within one segment only', () => {
    expect(matchesGlob('src/*.css', 'src/app.css')).toBe(true);
    expect(matchesGlob('src/*.css', 'src/ui/app.css')).toBe(false);
    expect(matchesGlob('src/*.css', 'src/app.ts')).toBe(false);
  });

  it('matches ** across any number of segments, none included', () => {
    expect(matchesGlob('src/ui/**', 'src/ui/Button.tsx')).toBe(true);
    expect(matchesGlob('src/ui/**', 'src/ui/forms/Field.tsx')).toBe(true);
    expect(matchesGlob('src/ui/**', 'src/api/route.ts')).toBe(false);
    expect(matchesGlob('**/*.css', 'styles.css')).toBe(true);
    expect(matchesGlob('**/*.css', 'apps/web/src/global.css')).toBe(true);
    expect(matchesGlob('apps/**/components/*.tsx', 'apps/components/A.tsx')).toBe(true);
    expect(matchesGlob('apps/**/components/*.tsx', 'apps/web/src/components/A.tsx')).toBe(true);
    expect(matchesGlob('apps/**/components/*.tsx', 'apps/web/src/components/sub/A.tsx')).toBe(false);
  });

  it('matches ? as one character, and {a,b} as either', () => {
    expect(matchesGlob('src/v?.css', 'src/v2.css')).toBe(true);
    expect(matchesGlob('src/v?.css', 'src/v10.css')).toBe(false);
    expect(matchesGlob('**/*.{css,scss}', 'a/b.scss')).toBe(true);
    expect(matchesGlob('**/*.{css,scss}', 'a/b.less')).toBe(false);
  });

  it('reads a pattern ending in / or with no wildcard as a folder: everything under it', () => {
    expect(matchesGlob('src/ui/', 'src/ui/Button.tsx')).toBe(true);
    expect(matchesGlob('src/ui', 'src/ui/forms/Field.tsx')).toBe(true);
    expect(matchesGlob('src/ui', 'src/ui')).toBe(true);
    expect(matchesGlob('src/ui', 'src/uikit/Button.tsx')).toBe(false);
    expect(matchesGlob('tailwind.config.ts', 'tailwind.config.ts')).toBe(true);
    expect(matchesGlob('tailwind.config.ts', 'tailwind.config.tsx')).toBe(false);
  });

  it('takes every other character literally', () => {
    expect(matchesGlob('src/(app)/page.tsx', 'src/(app)/page.tsx')).toBe(true);
    expect(matchesGlob('src/a+b.css', 'src/aab.css')).toBe(false);
    expect(matchesGlob('src/[id]/*.tsx', 'src/[id]/page.tsx')).toBe(true);
    expect(matchesGlob('src/[id]/*.tsx', 'src/i/page.tsx')).toBe(false);
  });

  it('ignores a leading ./ on the pattern', () => {
    expect(matchesGlob('./src/ui/**', 'src/ui/Button.tsx')).toBe(true);
  });
});
