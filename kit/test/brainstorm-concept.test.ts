// @ts-nocheck
// PRD 686, slice s3: `/omni:brainstorm --concept <n> <area>` starts a PRD from one area of a concept
// that `/omni:think-big` recorded and a person merged into the inbox. Each point of the slice's "done
// when" is read here against the brainstorm's SKILL.md text; `kit/test/plugin.test.ts` keeps its own
// assertions on the brainstorm, untouched. The concept's sections, its Areas table and its folder are
// read from the parser and the layout, so the prose cannot drift from what `omni concept` proves.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AREA_COLUMNS, CONCEPT_SECTIONS } from '../lib/concept/parse.ts';
import { foldersLayout } from '../lib/layout.ts';

const TEXT = readFileSync(new URL('../plugin/skills/brainstorm/SKILL.md', import.meta.url), 'utf8');
const CONCEPTS = foldersLayout('/nowhere', { delivery: '<paths.delivery>', playbook: '<paths.playbook>' }).dirs.concepts;

/** The `## ` headings of a text, outside fenced blocks, in order. */
function headings(text) {
  let fenced = false;
  const out = [];
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) out.push(line.slice(3));
  }
  return out;
}

/** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(text, start) {
  const lines = text.split('\n');
  let fenced = false;
  let from = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) {
      if (from >= 0) return lines.slice(from, index).join('\n');
      if (line.startsWith(`## ${start}`)) from = index;
    }
  }
  return from < 0 ? '' : lines.slice(from).join('\n');
}

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text) => text.replace(/\s+/g, ' ');

/** The blank-line-separated paragraphs of a text. */
const paragraphs = (text) => text.split(/\n\s*\n/);

/** The first paragraph of `text` holding `phrase`, flattened, or '' when none does. */
const paragraphWith = (text, phrase) => paragraphs(text).map(flat).find((p) => p.includes(phrase)) ?? '';

// What only a run from a concept reads or writes.
const CONCEPT_ONLY = /concept\.md|vision\.html|<concept>|<concept folder>|<area>/;

/** Each paragraph from step 1 on that names what only a concept run touches, without saying `--concept`. */
function unconditionalParagraphs(text) {
  const from = text.search(/^## 1\. /m);
  return paragraphs(text.slice(from)).filter((p) => CONCEPT_ONLY.test(p) && !p.includes('--concept'));
}

describe('/omni:brainstorm --concept <n> <area> (PRD 686)', () => {
  it('takes the input, says so in its description, and keeps a plain run as it is', () => {
    const description = /^description: (.*)$/m.exec(TEXT)?.[1] ?? '';
    expect(description).toContain('--concept <n> <area>');
    const inputs = flat(section(TEXT, 'Inputs'));
    expect(inputs).toContain('`--concept <n> <area>`');
    expect(inputs).toContain('the brainstorm runs as it always has');
  });

  it('reads the concept from the default branch, after the briefing and before the dossier opens', () => {
    expect(headings(TEXT).slice(0, 4)).toEqual(['Inputs', 'Step 0', 'From a concept', '1. Brainstorm the design']);
    const step0 = flat(section(TEXT, 'Step 0'));
    const briefing = step0.indexOf('kb show briefing');
    const read = step0.indexOf('**From a concept**');
    expect(briefing).toBeGreaterThan(-1);
    expect(read).toBeGreaterThan(briefing);
    expect(step0.indexOf('/omni:dossier-open')).toBeGreaterThan(read);
    expect(paragraphWith(step0, '**From a concept**')).toContain('before the dossier opens');

    const from = flat(section(TEXT, 'From a concept'));
    expect(from).toContain('git fetch <remote>');
    expect(from).toContain(`git ls-tree --name-only <remote>/<repo.defaultBranch> ${CONCEPTS}/`);
    expect(from).toContain('git show <remote>/<repo.defaultBranch>:<concept folder>/concept.md');
    expect(from).toContain('git show <remote>/<repo.defaultBranch>:<concept folder>/vision.html');
  });

  it('stops with a line of its own on a concept not in the inbox, an unknown area and an area with a PRD', () => {
    const from = flat(section(TEXT, 'From a concept'));
    expect(from).toContain('`concept #<concept> is not in the inbox yet: merge its PR first`');
    expect(from).toContain('`concept #<concept> has no area <area>: its areas are <id>, <id>, …`');
    expect(from).toContain('`area <area> of concept #<concept> already has its PRD: #<prd>`');
    expect(from).toContain('write nothing');
  });

  it('reads the sections and the columns a concept.md has', () => {
    const from = flat(section(TEXT, 'From a concept'));
    for (const name of ['The vision', 'Why this one', 'Areas']) {
      expect(CONCEPT_SECTIONS).toContain(name);
      expect(from, name).toContain(`**${name}**`);
    }
    expect(from).toContain(`\`| ${AREA_COLUMNS.join(' | ')} |\``);
    expect(from).toContain('the wedge first');
  });

  it("step 1 writes back the area's brief, the vision and the verdict before its first question", () => {
    const step1 = flat(section(TEXT, '1.'));
    const concept = paragraphWith(step1, '**With `--concept`');
    for (const words of ['Before your first question', "the area's brief", 'the vision', 'the verdict', 'leaves open']) {
      expect(concept, words).toContain(words);
    }
    expect(step1.indexOf(concept)).toBeLessThan(step1.indexOf('**Classify before your first question,**'));
  });

  it('a plain brainstorm that flags several independent subsystems offers the /omni:think-big line', () => {
    const door = paragraphWith(section(TEXT, '1.'), 'several independent subsystems');
    expect(door).toContain("`/omni:think-big '<line>'`");
    expect(door).toContain('Without `--concept`');
  });

  it("step 2's issue paragraph names the concept and the area", () => {
    expect(paragraphWith(section(TEXT, '2.'), 'With `--concept`')).toContain('`concept #<concept>, area <area>`');
  });

  it("step 5 starts the after from the area's screens in vision.html, as static mockups", () => {
    const after = paragraphWith(section(TEXT, '5.'), 'With `--concept`');
    for (const words of ['"after"', "the area's screens", '`vision.html`', 'static mockup']) expect(after, words).toContain(words);
  });

  it("step 7 fills the area's PRD cell in the same commit as the PRD's folder", () => {
    const step7 = flat(section(TEXT, '7.'));
    const fill = paragraphWith(step7, 'With `--concept`');
    for (const words of ['`PRD` cell', '`#<n>`', '`<concept folder>/concept.md`', 'same commit']) expect(fill, words).toContain(words);
    expect(step7.indexOf(fill)).toBeLessThan(step7.indexOf('`docs(prd): <topic>`'));
  });

  it("step 9 carries the concept's concept.md into the phase-0 PR", () => {
    const step9 = section(TEXT, '9.');
    const checkout = step9.split('\n').find((line) => line.trim().startsWith('git checkout <remote>/<feature branch> --'));
    expect(checkout).toContain("<the concept's concept.md, with --concept>");
    const carried = paragraphWith(step9, 'With `--concept`, that last path');
    expect(carried).toContain('`<concept folder>/concept.md`');
    expect(carried).toContain('`omni phase0`');
  });

  it("the hand-off names the area's cell, and a concept's files change only there", () => {
    expect(paragraphWith(section(TEXT, '10.'), 'With `--concept`')).toContain('`PRD` cell');
    expect(flat(section(TEXT, 'Guardrails'))).toContain("never change a concept's files beyond the area's `PRD` cell");
  });

  it('says --concept wherever a step reads or writes what only a concept run has', () => {
    expect(unconditionalParagraphs(TEXT)).toEqual([]);
    const plain = '## 1. Design\n\nRead `vision.html` first.\n\nWith `--concept`, read `concept.md`.\n';
    expect(unconditionalParagraphs(plain)).toEqual(['Read `vision.html` first.']);
  });
});
