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

/** The rule that splits a screen's two lists, in its four lines (PRD 1584): each screen-writing skill states every one. */
const RULE_LINES = [
  'A file whose change can change what a person sees on this screen goes in `implements`, the data files that hold its words included.',
  'A file the screen only depends on goes in `reads`.',
  'Structure several pages share is a shared screen of its own (`kind: shared`); each page lists its files in `reads`.',
  'A view file two pages share, and that is not structure, goes in `reads` on each.',
];
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

const WRITERS = ['visual-fix/SKILL.md', 'brainstorm/SKILL.md', 'think-big/SKILL.md', 'invade/SKILL.md', 'pixel-perfect/reference/lock.md', MOCK];

describe('every screen-writing skill states the implements/reads rule (PRD 1550, its four lines PRD 1584)', () => {
  for (const path of WRITERS) {
    it(`${path} states the rule's four lines, in order`, () => {
      expect(inOrder(read(path), RULE_LINES)).toEqual([]);
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

// PRD 1584, s3: design memory, round 3 in the skills — only what a change touches holds it, a fault
// seen in an untouched part goes under `Seen, not touched`, a shared screen is a screen of its own,
// the mock skill's **Standing in**, and the before/after's Functional and Pixel perfect parts.

describe('review: only what the work touches can hold it (PRD 1584)', () => {
  const REVIEW = 'pixel-perfect/reference/review.md';

  it("a lock trips only on a change to the screen's own implements", () => {
    const touched = section(REVIEW, 'Only what the work touches');
    expect(touched).toMatch(/A lock trips only when the diff changes that screen's own `implements`/);
    expect(touched).toMatch(/never trips a page's lock/);
  });

  it('a fault in an untouched part goes under Seen, not touched: never against the work, never fixed, never an item, never a block, suggested as a bug', () => {
    const seen = section(REVIEW, 'Seen, not touched');
    expect(seen).not.toBe('');
    for (const rule of ['never a finding against the work', 'never fixed in the work', 'never an outbox item', 'never a block', 'names the screen it sits on', 'a bug of its own']) {
      expect(seen, rule).toContain(rule);
    }
    expect(seen).toMatch(/another screen's `implements`/);
    expect(seen).toMatch(/a shared screen the diff did not touch/);
  });

  it('reports Seen, not touched under its own heading, apart from the findings', () => {
    // Its example block holds a `## Design review` line, so the section is read to the file's end.
    const report = read(REVIEW).slice(read(REVIEW).indexOf('## What it reports'));
    expect(inOrder(report, ["apart from the work's findings", '### Seen, not touched', 'file it as a bug of its own'])).toEqual([]);
  });

  it('screenshots a touched shared screen in place, on one page it appears on, as well as on its own', () => {
    expect(section(REVIEW, 'Steps')).toMatch(
      /A shared screen \(`kind: shared`\) the work touched is screenshotted \*\*in place\*\*: on one page it appears on, as well as on its own/,
    );
  });
});

describe('lock and do-work write the touched-only rule down (PRD 1584)', () => {
  it('lock: a locked shared screen holds only a change to its own implements', () => {
    const text = read('pixel-perfect/reference/lock.md');
    expect(text).toMatch(/A lock trips only when a change touches that screen's own `implements`/);
    expect(text).toMatch(/locking a shared screen guards it alone/);
  });

  it("do-work: a lock trips only on the screen's own implements, and Seen, not touched is never an item of the slice", () => {
    const text = skill('do-work');
    expect(text).toMatch(/A lock trips only when the slice's diff changes that screen's own `implements`/);
    expect(text).toMatch(/`Seen, not touched`[^.]*never an outbox item of this slice/);
  });

  it('do-work runs no pixel-perfect work for a PRD whose before/after says Pixel perfect: no screen changes', () => {
    const review = section('do-work/SKILL.md', '4.');
    expect(review).toContain('`Pixel perfect: no screen changes`');
    expect(review).toMatch(/runs no pixel-perfect work/);
    expect(review).toContain('`— Design review: no screen changes (Pixel perfect: no screen changes)`');
  });
});

describe('the mock skill stands in for what a mockup cannot carry (PRD 1584)', () => {
  const standing = () => section(MOCK, 'Standing in');

  it('has a Standing in section with its six rules, in order', () => {
    expect(
      inOrder(standing(), ['**Fonts:**', '**Pixel art and images:**', '**Example data:**', '**No screenshot:**', '**No gallery yet:**', '**An undecided primary action:**']),
    ).toEqual([]);
  });

  it('names the product faces first and never loads a font; an image is a labelled inline SVG at its real size', () => {
    expect(standing()).toMatch(/product's faces first in each `font-family`[^.]*never load a font/);
    expect(standing()).toMatch(/inline SVG placeholder at the image's real size, labelled with what it stands for/);
  });

  it('example data is allowed and expected, realistic, from the demo data, inside data-content, said outside the mark', () => {
    const text = standing();
    for (const rule of ['allowed, and expected for a screen that shows data', 'demo data or fixtures', 'realistic', '`data-content`', 'outside the marked screen']) {
      expect(text, rule).toContain(rule);
    }
  });

  it('no screenshot, no gallery, and an undecided primary action', () => {
    const text = standing();
    expect(text).toMatch(/\*\*No screenshot:\*\* draw from the source and say so outside the mark/);
    expect(text).toMatch(/\*\*No gallery yet:\*\* open the `\.html` file directly/);
    expect(text).toMatch(
      /mark the one the screen's own words point to, say so outside the mark, and keep the question in the screen's \*\*Open questions\*\*/,
    );
  });

  it('the steps point at Standing in', () => {
    expect(section(MOCK, 'Steps')).toContain('**Standing in**');
  });
});

describe('the screen-writing skills know kind: shared (PRD 1584)', () => {
  for (const path of WRITERS) {
    it(`${path} names kind: shared`, () => {
      expect(read(path)).toContain('`kind: shared`');
    });
  }

  it("each draft screen's front matter carries kind before implements", () => {
    for (const name of ['visual-fix', 'brainstorm', 'think-big', 'invade']) {
      expect(skill(name), name).toMatch(/status: draft [^\n]*?kind: <[^>]*shared[^>]*> [^\n]*?implements: \[/);
    }
  });

  it('a shared screen names the pages it appears on in routes when it has none of its own', () => {
    for (const path of ['brainstorm/SKILL.md', 'invade/SKILL.md', MOCK]) {
      expect(read(path), path).toMatch(/names the pages it appears on in `routes` when it has none of its own/);
    }
  });

  it("pixel-perfect's step 0 says what a shared screen is", () => {
    expect(section('pixel-perfect/SKILL.md', 'Step 0')).toMatch(/A shared screen \(`kind: shared`\)/);
  });
});

describe('the before/after has a Functional part and a Pixel perfect part (PRD 1584)', () => {
  const page = () => section('brainstorm/SKILL.md', '5.');

  it('brainstorm, with design on, writes the Functional section, then the Pixel perfect section (PRD 2239)', () => {
    expect(
      inOrder(page(), ['**Two tabs,**', '**Functional** (`data-section="functional"`)', '**Pixel perfect** (`data-section="pixel-perfect"`)', 'screens: quote-list · app-shell', '`Pixel perfect: no screen changes`']),
    ).toEqual([]);
    expect(page()).toMatch(/the section review and the word pass read/);
    expect(page()).toMatch(/With the design flag off, the section is `na`/);
  });

  it('visual-fix keeps its page as the Pixel perfect part alone', () => {
    expect(skill('visual-fix')).toMatch(/the Pixel perfect part alone/);
  });

  it("/omni:pr's feature body carries a Pixel perfect line: the screens, or none", () => {
    // The body's example block holds `## Slices`, so the text is read from the heading on.
    const body = read('pr/SKILL.md').slice(read('pr/SKILL.md').indexOf('## The body'));
    expect(inOrder(body, ['**Pixel perfect,** only when `design.enabled` is `true`', '**Pixel perfect:** <the screens to look at closely, or `none`>', '`Pixel perfect: no screen changes`', 'gives `none`', '**Landing PR**'])).toEqual([]);
  });
});

describe('the porting notes record the slice (PRD 1584)', () => {
  for (const note of ['plugin--pixel-perfect.md', 'plugin--brainstorm.md', 'plugin--do-work.md', 'plugin--pr.md']) {
    it(note, () => {
      expect(readFileSync(new URL(note, PORTING), 'utf8')).toContain('PRD #1584, slice s3');
    });
  }
});
