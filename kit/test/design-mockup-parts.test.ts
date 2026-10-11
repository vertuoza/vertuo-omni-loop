// PRD 1559, s6: mockups build from the list. With design on and a DESIGN.md, every mockup a kit skill
// draws (`mock`'s library mockups, the marked screens of brainstorm's Pixel perfect part, the
// visual-fix variations, the think-big cards and prototypes) is drawn only from DESIGN.md's listed
// parts and semantic tokens, each part tagged `data-part`; `mock`'s Standing in takes the faces from
// DESIGN.md's typography; `omni design parts --check` runs beside the word pass before anyone sees the
// page, its untagged findings are fixed, and an off-list part is named outside the marked screen. A
// Functional part, and a page that says `Pixel perfect: no screen changes`, draws no part. With design
// off or no DESIGN.md, each skill draws as it does today. A text check, in its own file, so
// kit/test/plugin.test.ts, a law's proof, stays as it is.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILLS = new URL('../plugin/skills/', import.meta.url);

/** A file of the plugin's skills, as text, its whitespace folded to one space so a wrapped line still matches. */
const read = (path: string) => readFileSync(new URL(path, SKILLS), 'utf8').replace(/\s+/g, ' ');

/** The paragraph of `text` (folded) that starts with `start`, up to the next bold lead-in or heading. */
function paragraph(path: string, start: string) {
  const text = read(path);
  const from = text.indexOf(start);
  if (from < 0) return '';
  const rest = text.slice(from + start.length);
  const end = rest.search(/ (?:- )?\*\*[A-Z][^*]*[.,:]\*\*| #+ /);
  return start + (end < 0 ? rest : rest.slice(0, end));
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

const PARTS = '**The parts,**';
const DRAWING = [
  { skill: 'pixel-perfect/mock.md', page: 'the mockup' },
  { skill: 'brainstorm/SKILL.md', page: 'the Pixel perfect part' },
  { skill: 'visual-fix/SKILL.md', page: 'today and each variation' },
  { skill: 'think-big/SKILL.md', page: 'every card and prototype' },
];

describe('mockups build from the list (PRD 1559)', () => {
  for (const { skill, page } of DRAWING) {
    describe(skill, () => {
      const parts = () => paragraph(skill, PARTS);

      it('has a parts paragraph that runs only with design on and a DESIGN.md, and draws as it does today without one', () => {
        expect(parts()).not.toBe('');
        expect(parts()).toMatch(/with the design flag on and a DESIGN\.md/);
        expect(inOrder(parts(), ['omni.mjs config design.system', 'omni.mjs design parts'])).toEqual([]);
        expect(parts()).toContain('`parts: no DESIGN.md`');
        expect(parts()).toMatch(/draws as it does today/);
      });

      it(`draws ${page} only from listed parts and semantic tokens, each part tagged data-part`, () => {
        expect(parts()).toMatch(/only from the parts it lists and semantic tokens/);
        expect(parts()).toMatch(/never a hex value/);
        expect(parts()).toContain('`data-part="<name>"`');
        expect(parts()).toMatch(/beside `data-screen` and `data-primary`/);
      });

      it('runs the parts check beside the word pass before the page is shown, fixes untagged, names an off-list part outside the marked screen', () => {
        expect(parts()).toMatch(/`node \.omni-loop\/bin\/omni\.mjs design parts --check <[^>]+>[^`]*`[^.]*beside the word pass/);
        expect(parts()).toMatch(/exits 0 whatever it finds/);
        expect(parts()).toMatch(/`untagged:` finding is fixed/);
        expect(parts()).toMatch(/`off-list:` part stays only when the design needs a new part/);
        expect(parts()).toMatch(/names it outside the marked screen/);
        expect(parts()).toMatch(/proposed, never invented/);
      });
    });
  }

  it('with design off, each skill that reads the flag in its step 0 says it runs no parts check', () => {
    for (const skill of ['brainstorm/SKILL.md', 'visual-fix/SKILL.md', 'think-big/SKILL.md']) {
      const text = read(skill);
      const off = text.slice(text.indexOf('means design craft is off here'), text.indexOf('means design craft is off here') + 700);
      expect(off, skill).toMatch(/no parts check/);
    }
  });

  it('mock\'s Standing in takes the faces from DESIGN.md\'s typography tokens', () => {
    const fonts = paragraph('pixel-perfect/mock.md', '**Fonts:**');
    expect(fonts).toMatch(/DESIGN\.md's `typography` tokens/);
    expect(fonts).toMatch(/first in each `font-family`/);
    expect(fonts).toMatch(/never load a font/);
  });

  it('mock runs the parts check at its word pass step, before it sets mock', () => {
    const text = read('pixel-perfect/mock.md');
    expect(inOrder(text, ['**The word pass.**', 'omni.mjs design parts --check <screen>.html', '**Set `mock`.**'])).toEqual([]);
  });

  it('brainstorm: the Functional part, and a page that says Pixel perfect: no screen changes, draws no part and is not checked', () => {
    const parts = paragraph('brainstorm/SKILL.md', PARTS);
    expect(parts).toMatch(/Functional part[^.]*draws no part and is not checked/);
    expect(parts).toContain('`Pixel perfect: no screen changes`');
  });

  it('brainstorm: the draft screens keep the data-part tags', () => {
    const drafts = paragraph('brainstorm/SKILL.md', '**The draft screens,**');
    expect(drafts).toMatch(/marks kept, `data-part` included/);
  });

  it('visual-fix: the draft screen keeps the data-part tags', () => {
    expect(read('visual-fix/SKILL.md')).toMatch(/`data-screen`, `data-primary` and `data-part` kept/);
  });

  it('think-big: the moderator gives the list to each artist and prototyper, and the parts check goes back to them', () => {
    const parts = paragraph('think-big/SKILL.md', PARTS);
    expect(parts).toMatch(/moderator gives the list/);
    expect(parts).toMatch(/artist or the prototype's prototyper/);
    expect(parts).toMatch(/A concept that leaves the list/);
  });

  it('think-big: the fuel sheet copies the parts list under the id parts', () => {
    expect(read('think-big/SKILL.md')).toMatch(/under the id `parts`/);
  });
});
