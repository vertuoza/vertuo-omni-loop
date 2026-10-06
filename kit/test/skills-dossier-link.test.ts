// PRD 413, Decision 8: every skill that reports on a PRD prints its page, from `omni dossier link <n>`,
// beside the PRD's number, or its issue when it has no page. This text check fails as soon as one
// of those skills stops naming the command or the fallback.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILLS = ['plan', 'wave', 'yolo', 'yolo-fix', 'status', 'brainstorm'];

/** A skill's SKILL.md, as text. */
const skillText = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');

// The command, run as a Bash step (`omni.mjs dossier link <n>`) or named in prose (`omni dossier link <n>`).
const RUNS_LINK = /omni(?:\.mjs)?\s+dossier\s+link\s+<n>/;
// The fallback: the PRD's issue, when the command prints no page.
const FALLS_BACK = /issues\/<n>/;

/** What `text` lacks of the rule: `[]` when it runs the command and names the fallback. */
function linkRuleGaps(text: string) {
  const gaps = [];
  if (!RUNS_LINK.test(text)) gaps.push('does not run omni dossier link <n>');
  if (!FALLS_BACK.test(text)) gaps.push('gives no issue link when there is no page');
  return gaps;
}

describe('the skills that report on a PRD print its link (PRD 413, Decision 8)', () => {
  for (const name of SKILLS) {
    it(`${name}: runs omni dossier link <n>, and falls back to the issue`, () => {
      expect(linkRuleGaps(skillText(name))).toEqual([]);
    });
  }

  it('the check fails on a skill that names neither', () => {
    expect(linkRuleGaps('## Hand off\n\nPrint the feature PR.\n')).toEqual([
      'does not run omni dossier link <n>',
      'gives no issue link when there is no page',
    ]);
  });

  it('the check fails on a skill that runs the command but gives no fallback', () => {
    expect(linkRuleGaps('Run `node .omni-loop/bin/omni.mjs dossier link <n>`.')).toEqual(['gives no issue link when there is no page']);
  });
});
