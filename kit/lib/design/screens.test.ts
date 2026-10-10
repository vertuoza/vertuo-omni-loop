// PRD 1407: the screen library — one Markdown file per screen, its front matter and its sections.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatScreens, parseScreen, readScreens } from './screens.ts';

const LOCKED = `---
screen: quote-editor
status: locked            # draft | locked | superseded
locked-by: "@login"
locked-on: 2026-10-10
quote: "this is the editor, build it"
mock: quote-editor.html
implements: [src/quotes/editor/]
routes: [/quotes/:id]
supersedes: null
---

> Amended 2026-11-02 · @login · "a total line": the footer shows the total

## Purpose
Edit one quote.

## Regions
- Header: the quote's number, from the quote.

## States
## Words
## Refusals
## Open questions
- Does it autosave?
`;

const DRAFT = `---
screen: quote-list
status: draft
locked-on: null
routes: [/quotes, /quotes/archived]
---

## Purpose
Every quote.
`;

describe('parseScreen', () => {
  it('reads every front-matter field, the amendments and the sections of a locked screen', () => {
    expect(parseScreen(LOCKED, 'quote-editor.md')).toEqual({
      ok: true,
      screen: {
        file: 'quote-editor.md',
        screen: 'quote-editor',
        status: 'locked',
        lockedBy: '@login',
        lockedOn: '2026-10-10',
        quote: 'this is the editor, build it',
        mock: 'quote-editor.html',
        implements: ['src/quotes/editor/'],
        routes: ['/quotes/:id'],
        supersedes: null,
        amendments: ['> Amended 2026-11-02 · @login · "a total line": the footer shows the total'],
        sections: {
          Purpose: 'Edit one quote.',
          Regions: "- Header: the quote's number, from the quote.",
          States: '',
          Words: '',
          Refusals: '',
          'Open questions': '- Does it autosave?',
        },
      },
    });
  });

  it('gives a draft the fields it leaves out as null or empty', () => {
    const read = parseScreen(DRAFT, 'quote-list.md');
    expect(read).toMatchObject({
      ok: true,
      screen: { screen: 'quote-list', status: 'draft', lockedBy: null, lockedOn: null, quote: null, mock: null, implements: [], routes: ['/quotes', '/quotes/archived'], supersedes: null, amendments: [], sections: { Purpose: 'Every quote.' } },
    });
  });

  it('names a file with no front matter, front matter that is not YAML, or a field it refuses', () => {
    const problem = (text: string) => {
      const read = parseScreen(text, 'x.md');
      return read.ok ? null : read.problem;
    };
    expect(problem('## Purpose\n')).toBe('x.md: no front matter — a screen starts with a --- block');
    expect(problem('---\nscreen: [a\n---\n')).toMatch(/^x\.md: front matter is not YAML/);
    expect(problem('---\n- a\n---\n')).toMatch(/^x\.md: front matter is not YAML/);
    expect(problem('---\nstatus: draft\n---\n')).toMatch(/^x\.md: screen/);
    expect(problem('---\nscreen: a\nstatus: done\n---\n')).toMatch(/^x\.md: status must be one of: draft, locked, superseded/);
    expect(problem('---\nscreen: a\nstatus: draft\nowner: me\n---\n')).toMatch(/^x\.md: .*owner/);
    expect(problem('---\nscreen: a\nstatus: draft\nroutes: /a\n---\n')).toMatch(/^x\.md: routes/);
    expect(problem('---\nscreen: a\nstatus: draft\nlocked-on: 10/10/2026\n---\n')).toMatch(/^x\.md: locked-on must be a YYYY-MM-DD date/);
  });

  it('refuses a locked screen that does not say who locked it, when, and in which words', () => {
    const read = parseScreen('---\nscreen: a\nstatus: locked\nlocked-by: "@me"\n---\n', 'a.md');
    expect(read).toEqual({ ok: false, problem: 'a.md: a locked screen needs locked-by, locked-on and quote — missing locked-on, quote' });
  });
});

function library(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'omni-screens-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

describe('readScreens', () => {
  it('reads every .md file of the folder, sorted by screen name, skipping mockups and sub-folders', () => {
    const dir = library({ 'b.md': LOCKED, 'a.md': DRAFT, 'quote-editor.html': '<main></main>', 'old/c.md': DRAFT });
    const { screens, problems } = readScreens(dir);
    expect(screens.map((s) => [s.file, s.screen])).toEqual([
      ['b.md', 'quote-editor'],
      ['a.md', 'quote-list'],
    ]);
    expect(problems).toEqual([]);
  });

  it('names each file that does not read, and still reads the others', () => {
    const dir = library({ 'a.md': DRAFT, 'z.md': 'no front matter' });
    const { screens, problems } = readScreens(dir);
    expect(screens.map((s) => s.screen)).toEqual(['quote-list']);
    expect(problems).toEqual(['z.md: no front matter — a screen starts with a --- block']);
  });

  it('reads a folder that does not exist as an empty library', () => {
    expect(readScreens(join(tmpdir(), 'omni-no-such-library'))).toEqual({ screens: [], problems: [] });
  });
});

describe('formatScreens', () => {
  it('lists name, status, locker, date and routes, one aligned line each, then the files that do not read', () => {
    const dir = library({ 'a.md': DRAFT, 'b.md': LOCKED, 'z.md': 'nope' });
    expect(formatScreens(readScreens(dir), 'kb/design/screens/')).toEqual([
      'quote-editor  locked  @login 2026-10-10  /quotes/:id',
      'quote-list    draft   —                  /quotes, /quotes/archived',
      'does not read: kb/design/screens/z.md: no front matter — a screen starts with a --- block',
    ]);
  });

  it('says so when the library is empty, naming its folder', () => {
    expect(formatScreens({ screens: [], problems: [] }, 'kb/design/screens/')).toEqual(['screens: none in kb/design/screens/']);
  });
});
