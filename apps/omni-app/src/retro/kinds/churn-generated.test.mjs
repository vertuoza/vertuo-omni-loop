import { describe, expect, it } from 'vitest';
import { LOCKFILES, isLockfile, leftOutAs, linguistGenerated } from './churn-generated.mjs';

describe('linguistGenerated', () => {
  it('marks the paths a `.gitattributes` gives `linguist-generated`, as this repository’s does', () => {
    const generated = linguistGenerated('kit/dist/** linguist-generated\n');
    expect(generated('kit/dist/omni.mjs')).toBe(true);
    expect(generated('kit/dist/deep/er.mjs')).toBe(true);
    expect(generated('kit/lib/config.mjs')).toBe(false);
    expect(generated('other/kit/dist/omni.mjs')).toBe(false);
  });

  it('reads a pattern without a slash at any depth, and one with a slash from the root', () => {
    const generated = linguistGenerated(['*.min.js linguist-generated=true', '/api/schema.ts linguist-generated'].join('\n'));
    expect(generated('app.min.js')).toBe(true);
    expect(generated('web/static/app.min.js')).toBe(true);
    expect(generated('web/static/app.js')).toBe(false);
    expect(generated('api/schema.ts')).toBe(true);
    expect(generated('web/api/schema.ts')).toBe(false);
  });

  it('reads `**/`, `?` and a character class as git does', () => {
    const generated = linguistGenerated('**/gen/*.ts linguist-generated\nsnap-?.[jt]s linguist-generated\n');
    expect(generated('gen/a.ts')).toBe(true);
    expect(generated('src/deep/gen/a.ts')).toBe(true);
    expect(generated('src/gen/sub/a.ts')).toBe(false);
    expect(generated('snap-1.js')).toBe(true);
    expect(generated('snap-1.ts')).toBe(true);
    expect(generated('snap-12.ts')).toBe(false);
    expect(generated('snap-1.cs')).toBe(false);
  });

  it('lets a later line unset what an earlier one set', () => {
    const generated = linguistGenerated('dist/** linguist-generated\ndist/keep.js -linguist-generated\ndist/also.js linguist-generated=false\n');
    expect(generated('dist/bundle.js')).toBe(true);
    expect(generated('dist/keep.js')).toBe(false);
    expect(generated('dist/also.js')).toBe(false);
  });

  it('ignores comments, other attributes, and a pattern with a trailing slash, which git never matches to a file', () => {
    const generated = linguistGenerated('# a comment\n*.png binary\nbuild/ linguist-generated\n\n');
    expect(generated('logo.png')).toBe(false);
    expect(generated('build/out.js')).toBe(false);
  });

  it('marks nothing without a `.gitattributes`', () => {
    expect(linguistGenerated(null)('kit/dist/omni.mjs')).toBe(false);
  });
});

describe('lockfiles', () => {
  it('knows a lockfile by its name, at any depth', () => {
    expect(isLockfile('pnpm-lock.yaml')).toBe(true);
    expect(isLockfile('apps/web/package-lock.json')).toBe(true);
    expect(isLockfile('yarn.lock')).toBe(true);
    expect(isLockfile('Cargo.lock')).toBe(true);
    expect(isLockfile('go.sum')).toBe(true);
    expect(isLockfile('docs/pnpm-lock.yaml.md')).toBe(false);
    expect(isLockfile('src/lock.js')).toBe(false);
  });

  it('lists each name once', () => {
    expect(new Set(LOCKFILES).size).toBe(LOCKFILES.length);
  });
});

describe('leftOutAs', () => {
  it('names why a path is left out of churn: generated first, then a lockfile, else null', () => {
    const leftOut = leftOutAs('pnpm-lock.yaml linguist-generated\ndist/** linguist-generated\n');
    expect(leftOut('dist/bundle.js')).toBe('generated');
    expect(leftOut('pnpm-lock.yaml')).toBe('generated');
    expect(leftOut('yarn.lock')).toBe('lockfile');
    expect(leftOut('src/cart.ts')).toBeNull();
  });
});
