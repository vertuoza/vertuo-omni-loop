// PRD 1559, s4: /omni:pixel-perfect init writes the repository's DESIGN.md — read from the design
// system a repository already has, each entry naming its file and a question where the files are
// silent, or picked from two or three rendered starter directions checked against the craft floor's
// refuse list — with its reference screens as draft library screens whose mockups `mock` draws, the
// design form's System slot pointing at it, and one docs-only pull request. It never locks and never
// writes code. The design form's System slot shows its `See:` line; /omni:invade gives the `init`
// line and never writes DESIGN.md. A text check, in its own file, so kit/test/plugin.test.ts, a
// law's proof, stays as it is.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILLS = new URL('../plugin/skills/', import.meta.url);
const TEMPLATES = new URL('../templates/playbook/', import.meta.url);

/** A file of the plugin's skills, as text, its whitespace folded to one space so a wrapped line still matches. */
const read = (path: string) => readFileSync(new URL(path, SKILLS), 'utf8').replace(/\s+/g, ' ');

/** The `## <heading>` section of a Markdown file whose heading starts with `start`, up to the next one. */
function section(text: string, start: string) {
  const lines = text.split('\n');
  const from = lines.findIndex((line) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line, index) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n').replace(/\s+/g, ' ');
}
const initSection = (start: string) => section(readFileSync(new URL(INIT, SKILLS), 'utf8'), start);

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

const INIT = 'pixel-perfect/init.md';
const RULE_LINES = [
  'A file whose change can change what a person sees on this screen goes in `implements`, the data files that hold its words included.',
  'A file the screen only depends on goes in `reads`.',
  'Structure several pages share is a shared screen of its own (`kind: shared`); each page lists its files in `reads`.',
  'A view file two pages share, and that is not structure, goes in `reads` on each.',
];

describe('/omni:pixel-perfect init (PRD 1559)', () => {
  it('has its own command file beside SKILL.md, and the skill names it in its inputs, its commands and its triggers', () => {
    expect(existsSync(new URL(INIT, SKILLS))).toBe(true);
    expect(readdirSync(new URL('pixel-perfect/reference/', SKILLS))).not.toContain('init.md');
    const text = read('pixel-perfect/SKILL.md');
    expect(text).toContain('| `init` | `/omni:pixel-perfect init` |');
    expect(text).toMatch(/\| `init` \| the system's \|[^|]*\| \[init\.md\]\(init\.md\) \|/);
    expect(text).toContain('"/omni:pixel-perfect init"');
  });

  it('with design off prints the one design: off line and does nothing; it is typed by a person, never followed by a skill', () => {
    const text = read(INIT);
    expect(text).toContain('design: off — set design.enabled: true in .omni-loop/config.yml to turn design craft on');
    expect(text).toMatch(/nothing is read and nothing is written/);
    expect(text).toMatch(/Typed by a person, never followed by a skill/);
  });

  it('reads design.system for the path, and tells a repository with a system from one with none', () => {
    const steps = initSection('Steps');
    expect(inOrder(steps, ['omni.mjs config design.system', 'omni.mjs design parts', '**Which path.**', '**Reading**', '**Starters**'])).toEqual([]);
  });

  it('reading: each entry names the file it was read from, a TODO(human) where the files are silent, a tool linked never copied', () => {
    const reading = initSection('Reading');
    for (const source of ['tokens', 'theme', 'component folders', 'Storybook', '`components.json`', 'Figma']) expect(reading, source).toContain(source);
    expect(reading).toMatch(/each entry names the file it was read from/);
    expect(reading).toMatch(/`TODO\(human\)` question, never invented/);
    expect(reading).toMatch(/linked, never copied/);
  });

  it('starters: asks about the product, then two or three full directions on one rendered page, checked against the refuse list before shown', () => {
    const starters = initSection('Starters');
    expect(inOrder(starters, ['who uses it', 'on what screens', 'its voice', 'one product it admires'])).toEqual([]);
    expect(starters).toMatch(/\*\*two or three starter directions\*\*/);
    expect(starters).toMatch(/one self-contained HTML page/);
    expect(starters).toMatch(/about thirty semantic tokens, in light and dark/);
    expect(starters).toMatch(/eight to twelve components with every state/);
    expect(starters).toMatch(/two or three reference screens built only from them/);
    expect(starters).toMatch(/refuse list[^.]*before the page is shown/);
    expect(starters).toContain('reference/craft-floor.md');
    expect(starters).toMatch(/"another round"/);
    expect(starters).toMatch(/never picks for the person/);
  });

  it('writes DESIGN.md in Google\'s format with a closed list of parts and its reference screens', () => {
    const write = initSection('DESIGN.md');
    expect(inOrder(write, ['`colors`', '`typography`', '`rounded`', '`spacing`', '`components`'])).toEqual([]);
    expect(inOrder(write, ['Overview', 'Colors', 'Typography', 'Layout', 'Elevation & Depth', 'Shapes', 'Components', "Do's and Don'ts", 'Reference screens'])).toEqual([]);
    for (const line of ['Summary', 'Variants', 'States', 'Tokens', 'Accessibility', 'Do', "Don't", 'Code']) expect(write, line).toContain(`\`${line}\``);
    expect(write).toMatch(/Semantic tokens only/);
    expect(write).toMatch(/never a part/);
    expect(write).toContain('omni.mjs design parts');
  });

  it('keeps a DESIGN.md already there in another shape: proposes the missing sections, rewrites nothing a person wrote', () => {
    const write = initSection('DESIGN.md');
    expect(write).toMatch(/already there[^.]*is kept/);
    expect(write).toMatch(/proposes the missing sections/);
    expect(write).toMatch(/rewrites nothing a person wrote/);
  });

  it('drafts its reference screens in the library, each mockup drawn by mock, and states the rule that splits the two lists', () => {
    const screens = initSection('Reference screens');
    expect(inOrder(screens, ['omni.mjs config design.screens', '`status: draft`', '[mock.md](mock.md)'])).toEqual([]);
    for (const line of RULE_LINES) expect(screens, line).toContain(line);
    expect(screens).toMatch(/only a person locks, through `\/omni:pixel-perfect lock`/);
  });

  it('points the design form\'s System slot at it with the See: line, and leaves the other slots as they are', () => {
    const form = initSection('The design form');
    expect(form).toContain('`See: <design.system>`');
    expect(form).toMatch(/Product, Deliberate, Review and Language[^.]*stay as they are/);
  });

  it('ends on one docs-only pull request, signed, that a person merges: never a lock, never code, nothing outside DESIGN.md, the library and the form', () => {
    const pr = initSection('The pull request');
    expect(inOrder(pr, ['`branches.knowledge`', '`design-system`', 'omni.mjs check design', 'omni.mjs sign trailer', '/omni:pr', 'omni.mjs sign footer', 'A person merges it'])).toEqual([]);
    const rules = initSection('Never');
    expect(rules).toMatch(/Never locks/);
    expect(rules).toMatch(/Never writes code/);
    expect(rules).toMatch(/first ordinary slice/);
    expect(rules).toMatch(/only DESIGN\.md, the screen library and the design form/);
    expect(read(INIT)).not.toMatch(/status: locked/);
  });
});

describe('the design form\'s System slot (PRD 1559)', () => {
  it('shows the See: line that points at DESIGN.md, and names init, in a comment that keeps the slot a question', () => {
    const text = readFileSync(new URL('design.md', TEMPLATES), 'utf8');
    const system = text.slice(text.indexOf('## System'), text.indexOf('## Deliberate'));
    expect(system).toMatch(/^TODO\(human\): Where do the design tokens/m);
    const comment = /<!--(?![^>]*slot:)([\s\S]*?)-->/.exec(system)?.[1] ?? '';
    expect(comment).toContain('See: DESIGN.md');
    expect(comment).toContain('/omni:pixel-perfect init');
    expect(comment).toContain('design.system');
  });
});

describe('/omni:invade and DESIGN.md (PRD 1559)', () => {
  it('gives the init line where it finds screens and no DESIGN.md, and never writes DESIGN.md', () => {
    const text = read('invade/SKILL.md');
    expect(text).toContain('omni.mjs config design.system');
    expect(text).toMatch(/screens and no DESIGN\.md[^.]*`\/omni:pixel-perfect init`/);
    expect(text).toMatch(/Never writes DESIGN\.md/);
    const handOff = section(readFileSync(new URL('invade/SKILL.md', SKILLS), 'utf8'), 'Hand off');
    expect(handOff).toContain('/omni:pixel-perfect init');
  });
});
