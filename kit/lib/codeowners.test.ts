import { describe, expect, it } from 'vitest';
import { CODEOWNERS_FILES, isOwnedBy, isPersonOwner, ownersOf, parseCodeowners, patternMatcher, readCodeowners } from './codeowners.ts';

/** Whether `pattern` owns each path, in order. */
const owns = (pattern: string, paths: string[]) => paths.map(patternMatcher(pattern));

describe('patternMatcher — GitHub’s dialect', () => {
  it('an unanchored name matches at any depth, and everything under a folder of that name', () => {
    expect(owns('widget.test.ts', ['widget.test.ts', 'src/widget.test.ts', 'src/widget.test.tsx', 'xwidget.test.ts'])).toEqual([true, true, false, false]);
    expect(owns('apps', ['apps', 'apps/a.ts', 'x/apps/b/c.ts', 'apps2/a.ts'])).toEqual([true, true, true, false]);
  });

  it('a leading slash or an inner slash anchors at the root', () => {
    expect(owns('/src/a.ts', ['src/a.ts', 'lib/src/a.ts'])).toEqual([true, false]);
    expect(owns('src/a.ts', ['src/a.ts', 'lib/src/a.ts'])).toEqual([true, false]);
  });

  it('a trailing slash owns only what sits under the folder', () => {
    expect(owns('docs/', ['docs', 'docs/a.md', 'docs/b/c.md', 'x/docs/a.md'])).toEqual([false, true, true, true]);
    expect(owns('/docs/', ['docs/a.md', 'x/docs/a.md'])).toEqual([true, false]);
  });

  it('`*` stays in one segment: `docs/*` owns docs’ own files only, `*.js` any .js', () => {
    expect(owns('docs/*', ['docs/a.md', 'docs/b/c.md'])).toEqual([true, false]);
    expect(owns('*.js', ['a.js', 'x/y/a.js', 'a.jsx', 'a.ts'])).toEqual([true, true, false, false]);
    expect(owns('*', ['a', 'x/y/z.ts'])).toEqual([true, true]);
  });

  it('`?` is one character of a segment, never a slash', () => {
    expect(owns('a?.ts', ['ab.ts', 'a/.ts', 'abc.ts'])).toEqual([true, false, false]);
  });

  it('`**` crosses folders, at the start, in the middle and at the end', () => {
    expect(owns('**/logs', ['logs', 'a/logs', 'a/b/logs/x.txt'])).toEqual([true, true, true]);
    expect(owns('docs/**/x.md', ['docs/x.md', 'docs/a/b/x.md', 'other/x.md'])).toEqual([true, true, false]);
    expect(owns('docs/**', ['docs/a', 'docs/a/b.md', 'doc/a'])).toEqual([true, true, false]);
  });

  it('dots and other regex characters are literal', () => {
    expect(owns('a.ts', ['abts'])).toEqual([false]);
    expect(owns('a+(b).ts', ['a+(b).ts', 'aa(b).ts'])).toEqual([true, false]);
  });
});

describe('parseCodeowners', () => {
  it('reads each line as a pattern and its owners, leaving comments and blank lines out', () => {
    const rules = parseCodeowners(['# owners', '', '  src/a.ts  @ann   @acme/core  # the core', '*.md docs@acme.com', 'unowned'].join('\n'));
    expect(rules.map(({ pattern, owners }) => ({ pattern, owners }))).toEqual([
      { pattern: 'src/a.ts', owners: ['@ann', '@acme/core'] },
      { pattern: '*.md', owners: ['docs@acme.com'] },
      { pattern: 'unowned', owners: [] },
    ]);
  });
});

describe('readCodeowners', () => {
  it('reads the first file GitHub looks for, in its order', () => {
    expect(CODEOWNERS_FILES).toEqual(['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']);
    const texts: Record<string, string> = { CODEOWNERS: '* @root', 'docs/CODEOWNERS': '* @docs' };
    const read = readCodeowners((file) => texts[file] ?? null);
    expect(read.file).toBe('CODEOWNERS');
    expect(ownersOf(read, 'a.ts')).toEqual(['@root']);
    expect(readCodeowners((file) => (file === '.github/CODEOWNERS' ? '' : '* @x')).file).toBe('.github/CODEOWNERS');
  });

  it('no file: none read, no rule', () => {
    expect(readCodeowners(() => null)).toEqual({ file: null, rules: [] });
  });
});

describe('ownersOf', () => {
  const codeowners = { rules: parseCodeowners(['* @all', 'src/ @src', 'src/open.ts', 'lib/'].join('\n')) };

  it('the last matching line wins', () => {
    expect(ownersOf(codeowners, 'README.md')).toEqual(['@all']);
    expect(ownersOf(codeowners, 'src/a.ts')).toEqual(['@src']);
  });

  it('a matching line with no owner leaves the path unowned, and no match owns nothing', () => {
    expect(ownersOf(codeowners, 'src/open.ts')).toEqual([]);
    expect(ownersOf(codeowners, 'lib/a.ts')).toEqual([]);
    expect(ownersOf({ rules: [] }, 'a.ts')).toEqual([]);
  });
});

describe('isOwnedBy — only a person matches a review', () => {
  it('matches @login without case', () => {
    expect(isOwnedBy(['@Ann'], 'ann')).toBe(true);
    expect(isOwnedBy(['@ann'], 'bob')).toBe(false);
    expect(isOwnedBy(['@annie'], 'ann')).toBe(false);
  });

  it('a team or an e-mail is no person', () => {
    expect(isOwnedBy(['@acme/ann'], 'acme/ann')).toBe(false);
    expect(isOwnedBy(['ann@acme.com'], 'ann@acme.com')).toBe(false);
    expect(isPersonOwner('@ann')).toBe(true);
    expect(['@acme/core', 'ann@acme.com', '@', 'ann', '@a b'].map(isPersonOwner)).toEqual([false, false, false, false, false]);
  });
});
