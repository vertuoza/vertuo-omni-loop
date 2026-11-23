// PRD omni-loop-21, slice s4: `/omni:ultra-yolo --base-of <owner/repo>=<branch>,…`, which a mission above `with-you`
// sends, opens each named target's feature PR into that branch instead of its default branch, and its finish and its
// gate read that base; a target the flag does not name keeps its default branch. Each point of the slice's "done when"
// is read here against the skills' SKILL.md text. The refusal line is the one `../lib/ultra/base-of.ts` writes, so
// the prose cannot drift from it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_OF_FLAG, refusalLine } from '../lib/ultra/base-of.ts';

const read = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(text: string, start: string) {
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

/** Every `gh pr create` command of a text, each written on one line. */
const prCreates = (text: string) => (text.match(/gh pr create [^`\n]*/g) ?? []).map((line) => line.trim());

const YOLO = read('ultra-yolo');
const WAVE = read('ultra-wave');
const INPUT = flat(section(YOLO, 'Input'));

describe('/omni:ultra-yolo --base-of (PRD omni-loop-21)', () => {
  it('AC-2: takes the flag, says so in its description, and names who sends it', () => {
    const description = /^description: (.*)$/m.exec(YOLO)?.[1] ?? '';
    expect(description).toContain(`${BASE_OF_FLAG} <owner/repo>=<branch>`);
    expect(INPUT).toContain('**`--base-of <owner/repo>=<branch>,…`** (PRD omni-loop-21) is added by a mission job above `with-you`');
  });

  it('AC-2: names the target base, the named branch or else the default branch, and keeps an unnamed one', () => {
    expect(INPUT).toContain('**The target base** (`<target base>` below) is the branch the flag names for that target, else the target\'s default branch');
    expect(INPUT).toContain('A target the flag does not name keeps its default branch, as before.');
    expect(INPUT).toContain('Without it, every target keeps its default branch, as before.');
  });

  it('refuses a value it cannot read in the line base-of.ts writes, before any branch, clone or pull request', () => {
    expect(INPUT).toContain(`\`${refusalLine('<value>', '<why>')}\``);
    expect(INPUT).toMatch(/before any branch, clone or pull request/);
    expect(flat(section(YOLO, 'Step 0'))).toContain('`--base-of`, when given, is read first (**Input**)');
  });

  it('holds a target whose named branch is not on its remote, and never cuts one', () => {
    expect(INPUT).toContain('git -C <clone> ls-remote --exit-code --heads <clone remote> <target base>');
    expect(INPUT).toContain('`<slug>: base <target base> not found on <clone remote>`');
    expect(INPUT).toContain("a mission branch is the mission's to cut, never this skill's");
    expect(INPUT).toContain('`--base-of names <slug>, which is no target of PRD <n>: left out`');
  });

  it('AC-2: cuts each feature branch from the target base and opens each target PR into it', () => {
    const targets = flat(section(YOLO, '2. The targets'));
    expect(targets).toContain('Its **base**, `<target base>`, is the branch `--base-of` names for it, else that default branch');
    expect(targets).toContain('cut it from `<clone remote>/<target base>`');
    expect(targets).toContain('landing 1 from `<target base>`');
    expect(prCreates(section(YOLO, '2. The targets'))).toEqual([
      'gh pr create --repo <slug> --draft --base <target base> --head <feature branch> --body-file <file>',
    ]);
  });

  it('AC-2: opens a product PRD\'s target PR into the target base, the line it spells kept', () => {
    const product = flat(section(YOLO, 'From a product'));
    expect(prCreates(section(YOLO, 'From a product'))).toEqual([
      'gh pr create --repo <slug> --draft --base <target default branch> --head <feature branch> --body-file <file>',
    ]);
    expect(product).toContain("Under `--base-of`, a named target's opens with `--base <target base>` in place of `--base <target default branch>`");
  });

  it('AC-2: retargets a target PR already open against another base', () => {
    const targets = flat(section(YOLO, '2. The targets'));
    expect(targets).toContain('--json number,isDraft,body,baseRefName');
    expect(targets).toContain('gh pr edit <n> --repo <slug> --base <target base>');
  });

  it('AC-2: finishes each target against its base', () => {
    const finish = flat(section(YOLO, '4. Finish each target'));
    expect(finish).toContain('**Meet its base,**');
    expect(finish).toContain('`git merge <clone remote>/<target base>`');
    expect(finish).toContain("`<target base>` once it has merged");
  });

  it('AC-2: its gate reads each target PR into its base before any target PR is marked ready', () => {
    const gate = flat(section(YOLO, '5. One gate'));
    expect(gate).toContain('**The gate reads each target PR\'s base.**');
    expect(gate).toContain('gh pr view <n> --repo <slug> --json baseRefName --jq .baseRefName');
    expect(gate).toContain('must print `<target base>`');
    expect(gate).toContain('BR-PRODUCT-145');
    expect(flat(section(YOLO, 'From a product'))).toContain('**The gate reads each target PR\'s base**');
  });

  it('passes the flag on to /omni:ultra-wave, and never merges into a base-of branch', () => {
    expect(INPUT).toContain('Pass `--base-of` on to `/omni:ultra-wave`');
    expect(flat(section(YOLO, '3. Loop the waves'))).toContain('`/omni:ultra-wave <n>` in place of `/omni:wave <n>`, `--base-of` passed on when given');
    expect(flat(section(YOLO, 'Guardrails'))).toContain('nor into a `--base-of` branch');
  });

  it('keeps the plan PR on the plan repository\'s default branch', () => {
    expect(INPUT).toContain("The plan PR keeps the plan repository's default branch");
  });
});

describe('/omni:ultra-wave under --base-of (PRD omni-loop-21)', () => {
  it('reads the flag as ultra-yolo passes it, and changes only its base check', () => {
    expect(flat(section(WAVE, 'Input'))).toContain('With `--base-of <owner/repo>=<branch>,…`, passed on by `/omni:ultra-yolo`');
  });

  it('never merges a sub-PR whose base is a target\'s default branch or its base-of branch', () => {
    expect(flat(section(WAVE, '4. Merge'))).toContain(
      "**Never merge a PR whose base is the target's default branch,** or the branch `--base-of` names for it",
    );
    expect(flat(section(WAVE, 'Guardrails'))).toContain('never into any repository\'s default branch or a `--base-of` branch');
  });
});
