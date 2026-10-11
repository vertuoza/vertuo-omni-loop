// PRD 1559, s5: with a DESIGN.md, /omni:pixel-perfect review looks in up to three rounds of
// screenshot, critique against DESIGN.md and the reference screen's mockup, and fix, stopping on a
// clean round, each round holding only on what the diff changed; it runs the parts check on the
// slice's diff and raises one medium outbox item per off-list part, never blocking; its Design
// review section gains the Rounds and Parts lines. /omni:plan names the parts and the reference
// screen on each `ui: yes` slice, and /omni:do-work reads DESIGN.md and that screen before writing
// the slice. With design off or no DESIGN.md, each reads nothing new. A text check, in its own file,
// so kit/test/plugin.test.ts, a law's proof, stays as it is.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILLS = new URL('../plugin/skills/', import.meta.url);

/** A file of the plugin's skills, as text. */
const raw = (path: string) => readFileSync(new URL(path, SKILLS), 'utf8');
/** The same file, its whitespace folded to one space so a wrapped line still matches. */
const read = (path: string) => raw(path).replace(/\s+/g, ' ');

/** The `## <heading>` section of a Markdown file whose heading starts with `start`, up to the next one, folded. */
function section(text: string, start: string) {
  const lines = text.split('\n');
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

const REVIEW = 'pixel-perfect/reference/review.md';
const DO_WORK = 'do-work/SKILL.md';
const PLAN = 'plan/SKILL.md';

describe('review: up to three rounds with a DESIGN.md (PRD 1559)', () => {
  it('the Bounded line is at most three rounds, stopping on a clean round; without a DESIGN.md it is one look as before', () => {
    const text = read(REVIEW);
    expect(text).toMatch(/\*\*Bounded:\*\* with a DESIGN\.md \(the file `design\.system` names\), at most \*\*three rounds\*\*/);
    expect(text).toMatch(/stops when a round finds nothing, or after round three/);
    expect(text).toMatch(/Without one[^.]*one look, one batch of fixes, at most one confirming look/);
  });

  it('reads the system first: design.system, then omni design parts, and no DESIGN.md runs no round', () => {
    const steps = section(raw(REVIEW), 'Steps');
    expect(inOrder(steps, ['omni.mjs config design.system', 'omni.mjs design parts', 'omni.mjs design touched'])).toEqual([]);
    expect(steps).toContain('parts: no DESIGN.md (run /omni:pixel-perfect init)');
    expect(steps).toMatch(/runs no round/);
  });

  it('each round is a screenshot at the widths, a critique against DESIGN.md and the reference screen\'s mockup, and one batch of fixes inside the territory', () => {
    const rounds = section(raw(REVIEW), 'Rounds');
    expect(inOrder(rounds, ['**Screenshot**', '**Critique**', 'DESIGN.md', "the reference screen's mockup", '**Fix**', 'inside the territory'])).toEqual([]);
    expect(rounds).toMatch(/390 and 1440/);
    expect(rounds).toMatch(/at most three/);
    expect(rounds).toMatch(/stops when a round finds nothing/);
  });

  it('every round holds only on what the diff changed; a fault in an untouched part stays under Seen, not touched, never in the next round', () => {
    const rounds = section(raw(REVIEW), 'Rounds');
    expect(rounds).toMatch(/fixes only what the diff changed/);
    expect(rounds).toMatch(/Seen, not touched/);
    expect(rounds).toMatch(/in round one or round three alike/);
    expect(rounds).toMatch(/never carried into the next round/);
  });

  it('what is left after round three becomes outbox items, as before', () => {
    const rounds = section(raw(REVIEW), 'Rounds');
    expect(rounds).toMatch(/left after round three[^.]*outbox item/);
  });

  it('with no browser it says Screens: not seen here, runs no round and reports nothing as seen', () => {
    const rounds = section(raw(REVIEW), 'Rounds');
    expect(rounds).toContain('— Screens: not seen here');
    expect(rounds).toMatch(/runs no round/);
    expect(rounds).toMatch(/nothing is reported as seen/);
  });
});

describe('review: the parts check on the diff (PRD 1559)', () => {
  it('runs omni design parts --check on the base', () => {
    const parts = section(raw(REVIEW), 'The parts check');
    expect(parts).toContain('omni.mjs design parts --check <base>');
  });

  it('raises exactly one medium outbox item per off-list part the diff adds, with the DESIGN.md entry it would add, and never blocks', () => {
    const parts = section(raw(REVIEW), 'The parts check');
    expect(parts).toMatch(/\*\*one medium outbox item per part\*\*/);
    expect(parts).toContain('add `<part>` to DESIGN.md?');
    expect(parts).toMatch(/the entry it would add/);
    expect(parts).toMatch(/never blocks/);
    expect(parts).toMatch(/`hardToRevert`, `breaksNamedLaw` and `needsHumanAction` all false/);
  });

  it('parts: unknown is said, never guessed', () => {
    const parts = section(raw(REVIEW), 'The parts check');
    expect(parts).toMatch(/`parts: unknown` \([^)]*\) is said[^.]*the review never guesses/);
  });

  it('the Design review section gains the Rounds and Parts lines', () => {
    // The section's example holds a `## Design review` heading, so the whole file is read here.
    const report = read(REVIEW).slice(read(REVIEW).indexOf('## What it reports'));
    expect(report).toContain('Rounds — 2 of 3');
    expect(report).toContain('Parts — all listed');
    expect(report).toMatch(/`Rounds — <n> of 3`/);
  });
});

describe('plan names the parts and the reference screen on a ui: yes slice (PRD 1559)', () => {
  it('reads design.system and omni design parts in step 0 only with design on', () => {
    const step0 = section(raw(PLAN), 'Step 0');
    expect(inOrder(step0, ['omni.mjs config design.enabled', 'omni.mjs design parts'])).toEqual([]);
  });

  it('writes the parts and the reference screen under each ui: yes heading, and nothing with no DESIGN.md', () => {
    const text = read(PLAN);
    expect(text).toContain('- Parts: <the listed parts it uses>');
    expect(text).toContain('- Reference screen: <the reference screen it copies>');
    expect(text).toMatch(/no DESIGN\.md[^.]*writes neither line/);
  });
});

describe('do-work reads DESIGN.md and the reference screen before building (PRD 1559)', () => {
  it("step 1 reads omni design parts, DESIGN.md and the reference screen's file and mockup, before the first line", () => {
    const step1 = section(raw(DO_WORK), '1.');
    expect(inOrder(step1, ['**The design system,**', 'omni.mjs design parts', 'DESIGN.md', 'reference screen', 'its file and its mockup'])).toEqual([]);
    expect(step1).toMatch(/before the first line of the slice is written/);
  });

  it('with no DESIGN.md it reads nothing new', () => {
    const step1 = section(raw(DO_WORK), '1.');
    expect(step1).toMatch(/`parts: no DESIGN\.md[^`]*`[^.]*nothing more is read/);
  });

  it('step 2 builds from listed parts and semantic tokens; a new part is proposed, never invented', () => {
    const step2 = section(raw(DO_WORK), '2.');
    expect(step2).toMatch(/listed parts and semantic tokens/);
    expect(step2).toMatch(/proposed, never invented/);
  });

  it("step 4's review raises one medium item per off-list part through step 3, never a stop, and its section carries the Rounds and Parts lines", () => {
    const step4 = section(raw(DO_WORK), '4.');
    expect(step4).toMatch(/one medium item per off-list part/);
    expect(step4).toContain('`Rounds — <n> of 3`');
    expect(step4).toContain('`Parts — …`');
  });
});
