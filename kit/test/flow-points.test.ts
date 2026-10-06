// PRD 1089, s7: every skill the flow catalog lists follows its points. For each point of
// `kit/lib/flow/points.ts`, each skill it names (ultra and mega variants included) calls
// `omni flow show <point>` and hands a hook's output to `omni flow verdict`; `/omni:wave` and
// `/omni:ultra-wave` merge a sub-PR only with the command `omni flow check merge` prints, never with a
// hard-coded `gh pr merge --squash`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FLOW_POINTS, type FlowPoint } from '../lib/flow/points.ts';

const SKILLS = fileURLToPath(new URL('../plugin/skills/', import.meta.url));
const readSkill = (skill: string): string => readFileSync(join(SKILLS, skill, 'SKILL.md'), 'utf8');

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `text` calls `omni flow show <point>`, the point named whole. */
const callsShow = (text: string, point: string) => new RegExp(`\\bflow show ${escape(point)}(?![\\w.-])`).test(text);

/** Each skill of `points` that does not follow a point it is listed for, as `<skill>: <what is missing>`. */
function unwired(points: readonly FlowPoint[], read: (skill: string) => string): string[] {
  const out: string[] = [];
  for (const { point, skills } of points) {
    for (const skill of skills) {
      const text = read(skill);
      if (!callsShow(text, point)) out.push(`${skill}: no omni flow show ${point}`);
      if (!/\bflow verdict\b/.test(text)) out.push(`${skill}: no omni flow verdict for ${point}`);
    }
  }
  return out;
}

/** The skills that merge a sub-PR: they merge only through `omni flow check merge`. */
const MERGERS = ['wave', 'ultra-wave', 'pr'];
const HARD_CODED_MERGE = /\bgh pr merge\b[^\n]*--squash/;

describe('the flow points, as the skills follow them', () => {
  it('lists the ultra and mega variants beside their base skill', () => {
    const skillsOf = (name: string) => FLOW_POINTS.find(({ point }) => point === name)?.skills ?? [];
    expect(skillsOf('plan.slice')).toContain('mega-brainstorm');
    expect(skillsOf('wave.merge')).toContain('ultra-wave');
    expect(skillsOf('yolo.ready')).toContain('ultra-yolo');
  });

  it('every skill the catalog lists calls omni flow show at each of its points, and passes hooks to omni flow verdict', () => {
    expect(unwired(FLOW_POINTS, readSkill)).toEqual([]);
  });

  it('names the skill and the point when a listed skill does not call it', () => {
    const read = (skill: string) => (skill === 'ultra-wave' ? 'Merge it. Pass the output to omni flow verdict.' : readSkill(skill));
    expect(unwired(FLOW_POINTS, read)).toEqual(['ultra-wave: no omni flow show wave.merge']);
    expect(unwired([{ point: 'do-work.test', skills: ['x'], modes: [], inputs: [], outputs: [] }], () => 'omni flow show do-work.testing')).toEqual([
      'x: no omni flow show do-work.test',
      'x: no omni flow verdict for do-work.test',
    ]);
  });

  it('/omni:wave and /omni:ultra-wave merge only through omni flow check merge, and leave a not ok sub-PR open', () => {
    for (const skill of MERGERS) {
      const text = readSkill(skill);
      expect(text, skill).toMatch(/\bflow check merge --pr <n>/);
      expect(text, skill).not.toMatch(HARD_CODED_MERGE);
    }
    for (const skill of ['wave', 'ultra-wave']) expect(readSkill(skill), skill).toMatch(/`not ok`[^\n]*\n?[^\n]*open/);
  });

  it('says how a point runs: every before, then the kit step or the replace hook, then every after', () => {
    for (const skill of ['plan', 'do-work', 'pr', 'wave', 'yolo']) {
      const text = readSkill(skill);
      expect(text, skill).toMatch(/every `before`\s+hook,\s+then\s+the\s+kit's\s+step/);
      expect(text, skill).toMatch(/then\s+every\s+`after`\s+hook/);
      expect(text, skill).toMatch(/`not ok`\s+stops\s+the\s+point/);
    }
  });

  it("follows a target's hooks only in its worktree, never from the imported copy", () => {
    for (const skill of ['do-work', 'ultra-wave', 'ultra-yolo', 'pr']) {
      expect(readSkill(skill), skill).toMatch(/only\s+in\s+its\s+worktree/);
    }
  });
});
