import { describe, expect, it } from 'vitest';
import {
  CODEOWNERS_FILES,
  exactPattern,
  isOwnedBy,
  isPersonOwner,
  lawCodeowners,
  ownerHandle,
  ownersBlock,
  ownersBlockIn,
  ownersOf,
  parseCodeowners,
  patternMatcher,
  readCodeowners,
  withOwnersBlock,
} from './codeowners.ts';

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

describe('the block omni kb owners writes (PRD 1726, s4)', () => {
  const PATHS = [
    { path: 'k/product/thesis.md', why: 'The registers.' },
    { path: 'k/product/rules.md', why: 'The registers.' },
    { path: 'a.test.ts', why: 'law BR-X-1: its test.' },
    { path: 'k/product/rules.md', why: 'law BR-X-2: its test.' },
  ];
  const BLOCK = ownersBlock(PATHS, ['pierrederval', 'acme/keepers']);

  it('writes a line per path, once, under its first reason, each owned by every owner, between its markers', () => {
    expect(BLOCK.split('\n')).toEqual([
      '# BEGIN omni kb owners',
      '# Written by `omni kb owners` from laws.owners and the locked laws (PRD 1726): run it again, never edit these lines.',
      '# The registers.',
      '/k/product/thesis.md @pierrederval @acme/keepers',
      '/k/product/rules.md @pierrederval @acme/keepers',
      '# law BR-X-1: its test.',
      '/a.test.ts @pierrederval @acme/keepers',
      '# END omni kb owners',
    ]);
  });

  it('each line owns exactly its path, as GitHub reads it', () => {
    const rules = parseCodeowners(BLOCK);
    expect(ownersOf({ rules }, 'a.test.ts')).toEqual(['@pierrederval', '@acme/keepers']);
    expect(ownersOf({ rules }, 'x/a.test.ts')).toEqual([]);
    expect(ownersOf({ rules }, 'k/product/rules.md')).toEqual(['@pierrederval', '@acme/keepers']);
  });

  it('anchors a path at the root and escapes what GitHub would read as a pattern or a comment', () => {
    expect(exactPattern('kit/a.test.ts')).toBe('/kit/a.test.ts');
    expect(exactPattern('/kit/a b#[1]*?!.ts')).toBe('/kit/a\\ b\\#\\[1\\]\\*\\?\\!.ts');
    expect(ownerHandle(' pierrederval ')).toBe('@pierrederval');
    expect(ownerHandle('@acme/keepers')).toBe('@acme/keepers');
    expect(ownerHandle('a@b.co')).toBe('a@b.co');
  });

  it('appends the block to a file that has none, after a blank line, and writes a new file whole', () => {
    expect(withOwnersBlock(null, BLOCK)).toBe(`${BLOCK}\n`);
    expect(withOwnersBlock('', BLOCK)).toBe(`${BLOCK}\n`);
    expect(withOwnersBlock('* @a', BLOCK)).toBe(`* @a\n\n${BLOCK}\n`);
    expect(withOwnersBlock('* @a\n', BLOCK)).toBe(`* @a\n\n${BLOCK}\n`);
  });

  it('replaces only its own block, every line outside the markers kept byte for byte', () => {
    const before = '# top\r\n* @a\n';
    const after = '\n/z @b  # tail\r\n';
    const old = '# BEGIN omni kb owners\r\n/old @x\n  # END omni kb owners  ';
    const next = withOwnersBlock(`${before}${old}${after}`, BLOCK);
    expect(next).toBe(`${before}${BLOCK}${after}`);
    expect(ownersBlockIn(next)).toBe(BLOCK);
    expect(withOwnersBlock(next, BLOCK)).toBe(next);
  });

  it('reads the block, carriage returns dropped, and none from a file without markers', () => {
    expect(ownersBlockIn('* @a\n')).toBeNull();
    expect(ownersBlockIn('# BEGIN omni kb owners\r\n/a @x\r\n# END omni kb owners\r\n')).toBe('# BEGIN omni kb owners\n/a @x\n# END omni kb owners');
  });

  it('refuses markers that do not pair up: one alone, either twice, or the end first', () => {
    const unpaired = /lines do not pair up/;
    for (const text of [
      '# BEGIN omni kb owners\n',
      '# END omni kb owners\n',
      '# BEGIN omni kb owners\n# END omni kb owners\n# BEGIN omni kb owners\n# END omni kb owners\n',
      '# BEGIN omni kb owners\n# END omni kb owners\n# END omni kb owners\n',
      '# END omni kb owners\n# BEGIN omni kb owners\n',
    ]) {
      expect(() => ownersBlockIn(text), text).toThrow(unpaired);
      expect(() => withOwnersBlock(text, BLOCK), text).toThrow(unpaired);
    }
  });
});

describe('delegates in the block, never leadership (PRD 1794, s1)', () => {
  const PATHS = [{ path: 'k/product/rules.md', why: 'The registers.' }];

  it('writes each owner, then its delegate, on every line', () => {
    const block = ownersBlock(PATHS, [{ login: 'pierrederval', delegate: 'jdoe' }, 'acme/platform']);
    expect(block.split('\n')).toContain('/k/product/rules.md @pierrederval @jdoe @acme/platform');
    expect(ownersOf({ rules: parseCodeowners(block) }, 'k/product/rules.md')).toEqual(['@pierrederval', '@jdoe', '@acme/platform']);
  });

  it('writes a block with no delegate exactly as before', () => {
    expect(ownersBlock(PATHS, ['pierrederval', 'acme/keepers'])).toBe(
      ['# BEGIN omni kb owners', '# Written by `omni kb owners` from laws.owners and the locked laws (PRD 1726): run it again, never edit these lines.', '# The registers.', '/k/product/rules.md @pierrederval @acme/keepers', '# END omni kb owners'].join('\n'),
    );
  });

  it('names a person once, whatever its case, when a delegate is also an owner', () => {
    expect(lawCodeowners([{ login: 'ann', delegate: 'Bob' }, { login: 'bob', delegate: 'ann' }, 'carl'])).toEqual(['ann', 'Bob', 'carl']);
    expect(lawCodeowners([])).toEqual([]);
  });
});
