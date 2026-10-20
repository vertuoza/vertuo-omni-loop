// PRD 2275, s2: `/omni:bug-fix` proves a bug that only shows in a production build at the smoke level.
// A passing reproduction has three readings, the third moves up to `setup` then `commands.smoke`, stop
// rule 7 stops with no runnable smoke, a stop keeps the reproduction on a pushed branch, a critical stop
// opens with the alert, the guard is the smoke run by CI, and the record names its level. These tests
// live apart from the law proofs in `plugin.test.ts`, and change none of them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (skill: string) => readFileSync(new URL(`../plugin/skills/${skill}/SKILL.md`, import.meta.url), 'utf8');

/** The `## <heading>` section of a SKILL.md whose heading starts with `start`, up to the next one. */
function skillSection(text: string, start: string) {
  const lines = text.split('\n');
  const from = lines.findIndex((line: string) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line: string, index: number) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n');
}

const flat = (text: string) => text.replace(/\s+/g, ' ');

/** Each of `mentions` that `text` lacks, or lacks after the one before it: empty when all come in order. */
const gaps = (text: string, mentions: string[]) => {
  const out: string[] = [];
  const words = flat(text);
  let from = 0;
  mentions.forEach((mention: string, index: number) => {
    const at = words.indexOf(mention, from);
    if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
    else from = at + mention.length;
  });
  return out;
};

describe('the bug-fix skill proves a build-level bug at the smoke level', () => {
  const step7 = () => skillSection(read('bug-fix'), '7.');

  it('step 7 names three readings of a passing reproduction, in order, and when the third applies', () => {
    expect(gaps(step7(), [
      'three readings',
      '**it misses the bug**',
      '**the bug is already gone**',
      '**this level cannot see it**',
      'an error in production that the source cannot produce',
      'a regression range that changes the toolchain',
    ])).toEqual([]);
  });

  it('under the third reading it runs setup then commands.smoke with the case added, before any fix', () => {
    expect(gaps(step7(), [
      '**Move up to the smoke level.**',
      'one more case of what `commands.smoke` checks',
      'run `setup`, then `commands.smoke`, before any fix',
      '**Smoke fails:**',
      '**Smoke passes too:** stop rule 3',
      '**Smoke is set but cannot run in this session**',
      'the red is the CI run of `commands.smoke`',
      'stop rule 7',
      '**`commands.smoke` is null:** stop rule 7',
    ])).toEqual([]);
  });

  it('stop rule 7 is verbatim, and rule 3 says a unit-level pass alone never reaches it under the third reading', () => {
    const rules = skillSection(read('bug-fix'), 'Stop rules');
    expect(rules).toContain('7. The bug lives in the build and the repository commits no `commands.smoke` it can run: stop, keep the reproduction, comment on the issue with the suspect, the production evidence and the line to commit. Never fix without red.');
    expect(flat(rules)).toContain('a unit-level pass alone never reaches this rule while the third reading applies');
  });

  it('stops 3, 4 and 7 commit the reproduction and push the branch; rule 7 opens a draft labelled needsFix', () => {
    expect(gaps(step7(), [
      '**A stop keeps the reproduction.**',
      'stop rules 3, 4 and 7',
      'commit the reproduction alone on the fix branch and push the branch',
      'links the branch and names the reproduction\'s path',
      'Stop rule 7 also opens the fix PR as a draft, labelled `labels.needsFix`',
    ])).toEqual([]);
    expect(flat(skillSection(read('bug-fix'), 'Stop rules'))).toContain('For rules 3, 4 and 7, the reproduction is committed alone on the fix branch and the branch is pushed');
  });

  it('a critical stop starts with the CAUTION alert, mentions nobody, and the hand-off prints the line first', () => {
    expect(gaps(step7(), [
      'the triage\'s risk is `critical`',
      '`> [!CAUTION]`',
      '`> critical — nothing is fixed.`',
      'mentions nobody',
      'the hand-off prints that line first',
    ])).toEqual([]);
  });

  it('stop rule 7\'s comment names the suspect, the production line, the YAML to commit and the rerun command', () => {
    expect(gaps(step7(), [
      '**Stop rule 7\'s comment**',
      '`<file>:<line>`',
      '**Production**',
      '`commands.smoke: <a command that builds and checks the',
      'the command that reruns the fix',
    ])).toEqual([]);
  });

  it('step 9 holds both guard lines and says the skill never edits CI', () => {
    expect(gaps(skillSection(read('bug-fix'), '9.'), [
      '`Guard: <the case> in commands.smoke, run by CI`',
      '`Guard: none — <repository>\'s CI does not run commands.smoke`',
      'the PR body and a comment on the issue name the CI step to add',
      'The skill never edits CI',
    ])).toEqual([]);
  });

  it('the record\'s Reproduction holds the Level line', () => {
    // The record template holds `## ` headings of its own, so the step runs up to the next real one.
    const text = read('bug-fix');
    const record = text.slice(text.indexOf('## 11.'), text.indexOf('## A change to a law'));
    expect(record).toContain('- **Level:** <unit | acceptance | smoke>');
    expect(record.indexOf('## Reproduction')).toBeLessThan(record.indexOf('- **Level:**'));
    expect(record.indexOf('- **Level:**')).toBeLessThan(record.indexOf('## Fix'));
  });

  it('Never says the reproduction, its branch and its worktree are never deleted on a stop', () => {
    expect(skillSection(read('bug-fix'), 'Never')).toContain('**Never delete the reproduction, its branch or its worktree on a stop.**');
  });
});

describe('the bug-fixing form\'s kit default says the same', () => {
  const form = readFileSync(new URL('../templates/playbook/bug-fixing.md', import.meta.url), 'utf8');

  it('its Steps name the third reading and its Guard names the smoke run by CI', () => {
    expect(gaps(form, ['this level cannot see it', '`commands.smoke`', 'Guard', 'run by CI'])).toEqual([]);
  });
});
