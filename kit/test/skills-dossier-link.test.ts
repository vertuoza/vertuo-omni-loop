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

// PRD 1272: a concept is a dossier kind. `/omni:think-big` sends the concept to its page right after
// opening the concept PR, and its hand-off names that page, from `omni dossier link <n> --kind concept`,
// or the concept's issue when it has no page.
describe('/omni:think-big pushes the concept and names its page (PRD 1272)', () => {
  const TEXT = skillText('think-big');

  /** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
  function section(start: string) {
    const lines = TEXT.split('\n');
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
  const flat = (text: string) => text.replace(/\s+/g, ' ');

  it('step 6 follows /omni:dossier-push <n> --kind concept right after opening the concept PR, and carries on', () => {
    const record = flat(section('6.'));
    const opens = record.indexOf('**Open the PR through `/omni:pr`**');
    const push = record.indexOf('/omni:dossier-push <n> --kind concept');
    expect(opens).toBeGreaterThan(-1);
    expect(push).toBeGreaterThan(opens);
    expect(record.slice(push)).toMatch(/Whatever it prints, carry on/);
    expect(record.indexOf('**A person merges it;**')).toBeGreaterThan(push);
  });

  it("the hand-off names the concept's page from omni dossier link <n> --kind concept, and falls back to the issue", () => {
    const handOff = flat(section('7.'));
    expect(handOff).toContain('omni.mjs dossier link <n> --kind concept');
    expect(handOff).toMatch(/issues\/<n>/);
    expect(handOff).toContain("the concept's page");
  });

  it('keeps the step-0 draft a draft: the concept goes to a page of its own', () => {
    expect(flat(section('Step 0'))).toMatch(/The draft stays a draft; no step below pushes to it/);
  });
});
