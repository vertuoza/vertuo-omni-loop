// PRD 262, slice s1: the release note's parser and its six rules, on valid and invalid texts.
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_MAX, gradeReleaseNote, INITIAL_VERSION, parseReleaseNote, RELEASE_NOTE_FILE, TITLE_MAX } from './note.mjs';

const TITLE = 'Jump between work and play in one tap';
const DESCRIPTION =
  'A Game mode button on every app page and an App mode switch in the arcade move you between the\n' +
  'reading pages and the game, with a confirmation before each switch. The app gets its own home page.';

/** A note's text: front matter in the order given (a key set to `undefined` is left out), then the body. */
function note({ fields = {}, body = DESCRIPTION } = {}) {
  const front = { prd: 238, title: TITLE, ...fields };
  const lines = Object.entries(front)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);
  return ['---', ...lines, '---', body, ''].join('\n');
}

const grade = (text, prd = 238) => gradeReleaseNote(text, { prd });

describe('the note file', () => {
  it('is release.md, beside spec.md, and the initial release is 0.0.1', () => {
    expect(RELEASE_NOTE_FILE).toBe('release.md');
    expect(INITIAL_VERSION).toBe('0.0.1');
    expect([TITLE_MAX, DESCRIPTION_MAX]).toEqual([60, 280]);
  });
});

describe('parseReleaseNote', () => {
  it('reads prd, title and the one-paragraph description, joining a wrapped paragraph into one line', () => {
    expect(parseReleaseNote(note())).toEqual({
      ok: true,
      note: {
        prd: 238,
        title: TITLE,
        version: null,
        description:
          'A Game mode button on every app page and an App mode switch in the arcade move you between the ' +
          'reading pages and the game, with a confirmation before each switch. The app gets its own home page.',
      },
    });
  });

  it('reads the optional version as written, and a quoted value without its quotes', () => {
    const parsed = parseReleaseNote(note({ fields: { title: '"Set up Omni Loop with one line"', version: '0.0.1' } }));
    expect(parsed.ok).toBe(true);
    expect(parsed.note).toMatchObject({ title: 'Set up Omni Loop with one line', version: '0.0.1' });
  });

  it('keeps a colon inside the title', () => {
    expect(parseReleaseNote(note({ fields: { title: 'Ask mode: answer on a page' } })).note.title).toBe('Ask mode: answer on a page');
  });

  it('reads a blank line before the body as nothing, and CRLF line ends as LF', () => {
    const text = ['---', 'prd: 238', `title: ${TITLE}`, '---', '', 'One line.', ''].join('\r\n');
    expect(parseReleaseNote(text).note).toMatchObject({ prd: 238, title: TITLE, description: 'One line.' });
  });

  it('keeps a title continued on a second line, so the check can refuse it', () => {
    const text = ['---', 'prd: 238', 'title: Jump between work', '  and play in one tap', '---', 'One line.', ''].join('\n');
    expect(parseReleaseNote(text).note.title).toBe('Jump between work\nand play in one tap');
  });

  it('refuses a text with no front matter', () => {
    expect(parseReleaseNote('Just a paragraph.\n')).toEqual({
      ok: false,
      errors: ['no front matter — a release note opens with a "---" fenced header holding prd and title'],
    });
  });

  it('refuses any front-matter field but prd, title and version, by name', () => {
    for (const field of ['status', 'date', 'description', 'release']) {
      expect(parseReleaseNote(note({ fields: { [field]: 'x' } })), field).toEqual({
        ok: false,
        errors: [`front matter holds ${field}, which a release note never carries — only prd, title and, optionally, version`],
      });
    }
  });

  it('refuses a note missing prd or title, naming the field', () => {
    expect(parseReleaseNote(note({ fields: { prd: undefined } })).errors).toEqual(['front matter lacks prd']);
    expect(parseReleaseNote(note({ fields: { title: undefined } })).errors).toEqual(['front matter lacks title']);
  });

  it('refuses a field given twice, a prd that is not a number, and a line that is not key: value', () => {
    expect(parseReleaseNote(['---', 'prd: 238', 'prd: 239', `title: ${TITLE}`, '---', 'x', ''].join('\n')).errors).toEqual([
      'front matter holds prd twice',
    ]);
    expect(parseReleaseNote(note({ fields: { prd: 'two' } })).errors).toEqual(['prd "two" is not a PRD number']);
    expect(parseReleaseNote(['---', '  stray', 'prd: 238', `title: ${TITLE}`, '---', 'x', ''].join('\n')).errors).toEqual([
      'front matter line is not "key: value": "  stray"',
    ]);
  });
});

describe('gradeReleaseNote — the six rules', () => {
  it('passes a good note, pinned or not', () => {
    expect(grade(note())).toEqual([]);
    expect(grade(note({ fields: { version: '0.0.1' } }))).toEqual([]);
  });

  it('passes the initial release’s longest lines as written in the spec', () => {
    const lines = [
      [7, 'Brainstorm, build and ship with three commands', 'The omni plugin for Claude Code gives the loop its commands: /omni:brainstorm turns an idea into a reviewed PRD, /omni:yolo builds it in parallel slices, and /omni:yolo-fix reworks what a reviewer disagreed with.'],
      [144, 'No answer is ever lost again', 'Every question Claude asks is kept for good, with its repository, branch, PRD, cost, category and who answered. The whole workspace can browse the history, and a live question can be shared with a teammate.'],
      [215, 'A signature that links back home', 'Pull requests and issues made by the loop end with "Omni-man by Omni Loop ©", linking to the Omni Loop home page. The hero\'s name and the link are set once in the configuration.'],
    ];
    for (const [prd, title, description] of lines) {
      expect(grade(note({ fields: { prd, title, version: '0.0.1' }, body: description }), prd), title).toEqual([]);
    }
  });

  it('rule 1: hands on the parser’s refusals', () => {
    expect(grade(note({ fields: { status: 'shipped' } }))).toEqual([
      'front matter holds status, which a release note never carries — only prd, title and, optionally, version',
    ]);
    expect(grade('no front matter\n')).toHaveLength(1);
  });

  it("rule 2: prd is the folder's number", () => {
    expect(grade(note({ fields: { prd: 12 } }), 42)).toEqual(["prd 12 is not its folder's number, 42"]);
  });

  it('rule 3: a version, when present, is 0.0.1', () => {
    expect(grade(note({ fields: { version: '0.0.2' } }))).toEqual([
      "version 0.0.2 is not 0.0.1 — only the initial release's notes carry a version",
    ]);
    expect(grade(note({ fields: { version: '' } }))).toEqual([`version "" is not 0.0.1 — only the initial release's notes carry a version`]);
  });

  it('rule 4: the title is 1 to 60 characters, one line, no final full stop, no PRD number', () => {
    const sixty = 'A'.repeat(60);
    expect(grade(note({ fields: { title: sixty } }))).toEqual([]);
    expect(grade(note({ fields: { title: `${sixty}B` } }))).toEqual(['title is 61 characters — 60 at most']);
    expect(grade(note({ fields: { title: '' } }))).toEqual(['title is empty — 1 to 60 characters']);
    expect(grade(note({ fields: { title: 'Jump between work and play.' } }))).toEqual(['title ends with a full stop']);
    expect(grade(note({ fields: { title: 'What PRD 12 brought' } }))).toEqual(['title names a PRD number ("PRD 12")']);
    expect(grade(note({ fields: { title: 'What prd 7 brought' } }))).toEqual(['title names a PRD number ("prd 7")']);
    expect(grade(note({ fields: { title: 'What PRD12 brought' } }))).toEqual(['title names a PRD number ("PRD12")']);
    expect(grade(note({ fields: { title: 'Products and PRDs, side by side' } }))).toEqual([]);
    const twoLines = ['---', 'prd: 238', 'title: Jump between work', '  and play', '---', 'One line.', ''].join('\n');
    expect(grade(twoLines)).toEqual(['title spans more than one line — one line']);
  });

  it('rule 4 counts characters, not UTF-16 units', () => {
    expect(grade(note({ fields: { title: `${'é'.repeat(58)} ©` } }))).toEqual([]);
    expect(grade(note({ fields: { title: `${'A'.repeat(59)}🦸` } }))).toEqual([]);
  });

  it('rule 5: the description is one paragraph of 1 to 280 characters', () => {
    const max = 'a'.repeat(280);
    expect(grade(note({ body: max }))).toEqual([]);
    expect(grade(note({ body: `${max}b` }))).toEqual(['description is 281 characters — 280 at most']);
    expect(grade(note({ body: '' }))).toEqual(['description is empty — one paragraph of 1 to 280 characters']);
    expect(grade(note({ body: 'One paragraph.\n\nAnother one.' }))).toEqual(['description holds a blank line — one paragraph']);
    expect(grade(note({ body: '## What changed\nThe page moved.' }))).toEqual(['description holds a heading ("## What changed") — one paragraph of prose']);
    for (const item of ['- a point', '* a point', '+ a point', '1. a point', '2) a point']) {
      expect(grade(note({ body: `It changed:\n${item}` })), item).toEqual([`description holds a list item ("${item}") — one paragraph of prose`]);
    }
  });

  it('rule 5 counts a wrapped paragraph as the one line it reads as', () => {
    expect(grade(note({ body: `${'a'.repeat(140)}\n${'b'.repeat(139)}` }))).toEqual([]);
    expect(grade(note({ body: `${'a'.repeat(140)}\n${'b'.repeat(140)}` }))).toEqual(['description is 281 characters — 280 at most']);
  });

  it('rule 6: neither holds a URL, a #<digit> reference, a backtick, or a path under the kit’s folder', () => {
    const refused = [
      ['See https://example.com', 'a URL ("https://")'],
      ['See http://example.com', 'a URL ("http://")'],
      ['See www.example.com', 'a URL ("www.")'],
      ['Fixes #12', 'a reference ("#12")'],
      ['Runs `omni ship`', 'a backtick'],
      ['Lives in .omni-loop/delivery', 'a path under .omni-loop/'],
    ];
    for (const [text, what] of refused) {
      expect(grade(note({ fields: { title: text } })), text).toEqual([`title holds ${what}`]);
      expect(grade(note({ body: `${text}, for everyone.` })), text).toEqual([`description holds ${what}`]);
    }
    expect(grade(note({ fields: { title: 'C# made simple' }, body: 'Ask mode #1 fan? No: one hash, no digit after it # here.' }))).toEqual([
      'description holds a reference ("#1")',
    ]);
  });

  it('names every rule a note breaks, title first', () => {
    expect(grade(note({ fields: { prd: 9, version: '1.0.0', title: 'See PRD 9.' }, body: 'Visit https://x.io\n\nNow.' }))).toEqual([
      "prd 9 is not its folder's number, 238",
      "version 1.0.0 is not 0.0.1 — only the initial release's notes carry a version",
      'title ends with a full stop',
      'title names a PRD number ("PRD 9")',
      'description holds a blank line — one paragraph',
      'description holds a URL ("https://")',
    ]);
  });
});
