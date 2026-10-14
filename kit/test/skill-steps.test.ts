// PRD 1858, s1: rewording a skill never drops a step. Each skill's `omni` commands and guard phrases
// are compared with the snapshot taken before the rewording; only step 0's swap is allowed.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lostSteps, skillSteps, stepsOf } from './skill-steps.ts';
import type { StepsSnapshot } from './skill-steps.ts';

const SKILLS = fileURLToPath(new URL('../plugin/skills', import.meta.url));
const SNAPSHOT = JSON.parse(readFileSync(new URL('./skill-steps.snapshot.json', import.meta.url), 'utf8')) as StepsSnapshot;

/** A skills folder holding one skill, `plan`, whose SKILL.md says `text`. */
function skillsFolder(text: string): string {
  const root = mkdtempSync(join(tmpdir(), 'omni-skill-steps-'));
  mkdirSync(join(root, 'plan'));
  writeFileSync(join(root, 'plan', 'SKILL.md'), text);
  return root;
}

const PLAN = [
  '## Step 0',
  '',
  'Run `node .omni-loop/bin/omni.mjs kb show briefing`.',
  '',
  'Then run `node .omni-loop/bin/omni.mjs plan check <n>` until it is green. Never merge.',
].join('\n');

describe('skill steps', () => {
  it('every skill keeps every command and guard of its snapshot', () => {
    expect(Object.keys(SNAPSHOT).length).toBeGreaterThan(30);
    expect(lostSteps(SNAPSHOT, skillSteps(SKILLS))).toEqual([]);
  });

  it('fails on a skill that drops `omni plan check`, naming the skill and the command', () => {
    const before = skillSteps(skillsFolder(PLAN));
    const after = skillSteps(skillsFolder(PLAN.replace('`node .omni-loop/bin/omni.mjs plan check <n>`', 'the plan check')));
    expect(lostSteps(before, after)).toEqual(['plan: lost `omni plan`', 'plan: lost "omni plan check"']);
  });

  it('reads step 0\'s `kb show briefing` and `session start` as the same step', () => {
    const before = skillSteps(skillsFolder(PLAN));
    const swapped = skillSteps(skillsFolder(PLAN.replace('kb show briefing', 'session start')));
    expect(lostSteps(before, swapped)).toEqual([]);
    const dropped = skillSteps(skillsFolder(PLAN.replace('Run `node .omni-loop/bin/omni.mjs kb show briefing`.', 'Read the rules.')));
    expect(lostSteps(before, dropped)).toEqual(['plan: lost `omni kb`', 'plan: lost "omni kb show briefing"']);
  });

  it('names a skill that is gone, and ignores a skill the snapshot never had', () => {
    expect(lostSteps({ plan: stepsOf(PLAN) }, { wave: stepsOf(PLAN) })).toEqual(['plan: the skill is gone']);
    expect(lostSteps({}, { wave: stepsOf(PLAN) })).toEqual([]);
  });

  it('reads guard phrases without regard to case, and every spelling of the command as `omni`', () => {
    expect(stepsOf('NEVER MERGE. Leave it Draft; `omni ship`, then `node x/.omni-loop/bin/omni.mjs status`.')).toEqual({
      commands: ['ship', 'status'],
      guards: ['omni ship', 'omni status', 'never merge', 'draft'],
    });
  });
});
