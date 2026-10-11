// PRD 1550, s4: the skills of design memory, round 2. /omni:pixel-perfect mock draws a screen's
// mockup (self-contained, marked, its `mock` set, a draft amendment and the high item on a locked
// screen); review reports `mock may be stale` as a note; the drawing skills keep the page's
// explanation outside every marked screen; every screen-writing skill states the one rule that
// splits `implements` from `reads`; do-work reads a screen's `reads` for context. A text check, in
// its own file, so kit/test/plugin.test.ts, a law's proof, stays as it is.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILLS = new URL('../plugin/skills/', import.meta.url);
const PORTING = new URL('../porting/', import.meta.url);

/** A file of the plugin's skills, as text, its whitespace folded to one space so a wrapped line still matches. */
const read = (path: string) => readFileSync(new URL(path, SKILLS), 'utf8').replace(/\s+/g, ' ');
const skill = (name: string) => read(`${name}/SKILL.md`);

/** The `## <heading>` section of a Markdown file whose heading starts with `start`, up to the next one. */
function section(path: string, start: string) {
  const lines = readFileSync(new URL(path, SKILLS), 'utf8').split('\n');
  const from = lines.findIndex((line) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line, index) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n').replace(/\s+/g, ' ');
}

/** The mentions `text` lacks, read in order: `[]` when each follows the one before. */
function inOrder(text: string, mentions: string[]) {
  let from = 0;
  return mentions.filter((mention) => {
    const at = text.indexOf(mention, from);
    if (at < 0) return true;
    from = at + mention.length;
    return false;
  });
}

const RULE = 'a file whose change can change what a person sees on this screen goes in `implements`; a file the screen only depends on goes in `reads`.';
const MOCK = 'pixel-perfect/mock.md';

describe('/omni:pixel-perfect mock (PRD 1550)', () => {
  it('has its own command file, and the skill names it in its inputs, its commands and its triggers', () => {
    expect(existsSync(new URL(MOCK, SKILLS))).toBe(true);
    const text = skill('pixel-perfect');
    expect(text).toContain('| `mock <screen>` | `/omni:pixel-perfect mock quote-editor` |');
    expect(text).toMatch(/\| `mock <screen>` \| the library's \|[^\n]*\[mock\.md\]\(mock\.md\) \|/);
    expect(text).toContain('"/omni:pixel-perfect mock"');
  });

  it("reads the screen's file, its implements and reads, and the design form, then looks at it when the app runs", () => {
    const steps = section(MOCK, 'Steps');
    expect(inOrder(steps, ['**Find it.**', 'omni.mjs config design.screens', '**Read what it is drawn from.**', 'Its `implements`', 'Its `reads`', 'omni.mjs kb show design', '**Look at it, when the app runs.**', '`review` section'])).toEqual([]);
    expect(steps).toMatch(/draw from the source, and say so/);
  });

  it('writes <screen>.html beside the screen, self-contained, marked with data-screen and data-primary', () => {
    const steps = section(MOCK, 'Steps');
    expect(steps).toContain('**one self-contained HTML file**, `<screen>.html`, beside `<screen>.md`');
    for (const rule of ['inline CSS and inline SVG', '**no script**', 'no remote asset', '**no base64 raster image**']) expect(steps, rule).toContain(rule);
    expect(steps).toContain('`data-screen="<screen>"`');
    expect(steps).toContain('`data-primary`');
    expect(steps).toMatch(/explanation of the mockup[^.]*sits outside the marked screen/);
  });

  it('runs the word pass, sets mock, and checks the library', () => {
    const steps = section(MOCK, 'Steps');
    expect(inOrder(steps, ['**The word pass.**', 'omni.mjs design words <screen>.html', 'never silenced', '**Set `mock`.**', '`mock: <screen>.html`', '**Check it.**', 'omni.mjs check design'])).toEqual([]);
  });

  it('on a locked screen never overwrites the mockup: a draft amendment, and the high item', () => {
    const locked = section(MOCK, 'A locked screen');
    expect(locked).toMatch(/\*\*never overwrites\*\* a locked screen's mockup/);
    expect(inOrder(locked, ['**draft amendment**', '`<screen>-next.md`', '`status: draft`', 'who locked it', '**high** outbox item'])).toEqual([]);
    expect(locked).not.toMatch(/status: locked/);
  });

  it('commits signed, typed by a person, and pushes nothing', () => {
    const commit = section(MOCK, 'Steps');
    expect(inOrder(commit, ['**Commit,** typed by a person', 'never on the default branch', 'omni.mjs sign trailer', 'pushes nothing'])).toEqual([]);
  });
});

describe("pixel-perfect's review and lock (PRD 1550)", () => {
  it('review reports mock may be stale as a note, never a block, and reads a reads entry for context', () => {
    const review = read('pixel-perfect/reference/review.md');
    expect(review).toMatch(/`mock may be stale: <screen>` line[^.]*: it is a \*\*note\*\* for the report[^.]*never a block/);
    expect(review).toMatch(/- — Mock may be stale: /);
    expect(review).toMatch(/`reads <screen>`[^.]*\. read it for context|`reads <screen>`[^.]*: read it for context/);
    expect(review).toMatch(/never trips its lock/);
  });

  it("the skill's step 0 says what each list is", () => {
    const step0 = section('pixel-perfect/SKILL.md', 'Step 0');
    expect(step0).toMatch(/Its `implements` names the files it is drawn from; its `reads`[^.]*never trips a lock/);
  });
});

describe('the drawing skills keep the explanation outside every marked screen (PRD 1550)', () => {
  const MARKS = {
    'visual-fix': ['**The word pass,**', '`data-screen`', '`data-primary`', 'sits outside every marked screen', 'omni.mjs design words <page>'],
    brainstorm: ['**The marks and the word pass,**', '`data-screen`', '`data-primary`', 'sits outside every marked screen', 'omni.mjs design words <folder>/before-after.html'],
    'think-big': ['**The marks and the word pass,**', '`data-screen`', '`data-primary`', 'sits outside every marked screen', 'omni.mjs design words <page>'],
  } as const;
  for (const [name, mentions] of Object.entries(MARKS)) {
    it(`${name} marks each screen and each primary action, and says the word pass skips a page with none`, () => {
      const text = skill(name);
      expect(inOrder(text, [...mentions])).toEqual([]);
      expect(text).toContain('the word pass reads only marked screens, and skips a page with none');
    });
  }
});

describe('every screen-writing skill states the implements/reads rule (PRD 1550)', () => {
  const WRITERS = ['visual-fix/SKILL.md', 'brainstorm/SKILL.md', 'think-big/SKILL.md', 'invade/SKILL.md', 'pixel-perfect/reference/lock.md', MOCK];
  for (const path of WRITERS) {
    it(`${path} states the rule`, () => {
      expect(read(path)).toContain(RULE);
    });
  }

  it("each draft screen's front matter carries reads beside implements", () => {
    for (const name of ['visual-fix', 'brainstorm', 'think-big', 'invade']) {
      expect(skill(name), name).toMatch(/implements: \[[^\]]*\] reads: \[[^\]]*\] routes:/);
    }
  });

  it('a whole folder never goes in implements', () => {
    for (const name of ['visual-fix', 'brainstorm', 'invade']) expect(skill(name), name).toMatch(/never a whole folder in `implements`/i);
  });
});

describe("do-work reads a screen's reads for context (PRD 1550)", () => {
  it("step 1's design memory reads it, and a change there never trips a lock", () => {
    const step1 = section('do-work/SKILL.md', '1.');
    expect(step1).toMatch(/Read its `reads` too[^.]*read for context/);
    expect(step1).toMatch(/never trips its lock/);
  });
});

describe('the porting notes record the slice (PRD 1550)', () => {
  for (const note of ['plugin--pixel-perfect.md', 'plugin--brainstorm.md', 'plugin--do-work.md']) {
    it(note, () => {
      expect(readFileSync(new URL(note, PORTING), 'utf8')).toContain('PRD #1550, slice s4');
    });
  }
});
