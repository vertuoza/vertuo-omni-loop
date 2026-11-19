// PRD omni-loop-13, s6: the three UI skills read the design manifest before UI work — `omni design
// components` first, `omni design component <name>` on demand, and the form's System prose only
// when the repository has no manifest. A text check, in its own file, so kit/test/plugin.test.ts and
// kit/test/design-skills.test.ts stay as they are.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILLS = new URL('../plugin/skills/', import.meta.url);
const PORTING = new URL('../porting/', import.meta.url);
const GUIDE = new URL('../../docs/guide/design.md', import.meta.url);

/** A file, as text, its whitespace folded to one space so a wrapped line still matches. */
const read = (url: URL) => readFileSync(url, 'utf8').replace(/\s+/g, ' ');

const SKILL_FILES = ['do-work/SKILL.md', 'visual-fix/SKILL.md', 'pixel-perfect/SKILL.md'];

describe('the UI skills read the design manifest first (PRD omni-loop-13, s6)', () => {
  for (const path of SKILL_FILES) {
    it(`${path} runs omni design components, then component on demand`, () => {
      const text = read(new URL(path, SKILLS));
      expect(text).toContain('omni.mjs design components');
      expect(text).toContain('omni.mjs design component <name>');
      expect(text.indexOf('omni.mjs design components')).toBeLessThan(text.indexOf('omni.mjs design component <name>'));
    });

    it(`${path} falls back to the form's System prose when there is no design manifest`, () => {
      const text = read(new URL(path, SKILLS));
      expect(text).toMatch(/has no design manifest[^.]*read the `system` section/);
    });
  }
});

describe('the porting notes record the slice (PRD omni-loop-13, s6)', () => {
  for (const note of ['plugin--do-work.md', 'plugin--pixel-perfect.md']) {
    it(note, () => {
      expect(readFileSync(new URL(note, PORTING), 'utf8')).toContain('PRD omni-loop-13, slice s6');
    });
  }
});

describe('the user guide says what the manifest is and how to read it (PRD omni-loop-13, s6)', () => {
  const guide = () => read(GUIDE);

  it('names the manifest file, its config key and how it is built', () => {
    const text = guide();
    expect(text).toContain('packages/design/design-system.json');
    expect(text).toContain('design.manifest');
    expect(text).toContain('omni-design');
  });

  it('lists the four commands', () => {
    const text = guide();
    for (const command of ['omni design components', 'omni design component <name>', 'omni design tokens', 'omni design pattern <name>']) {
      expect(text, command).toContain(command);
    }
  });
});
