// The ultra skills on a runner's own check (PRD 2873 s1): `/omni:ultra-yolo`, `/omni:ultra-wave` and `/omni:ultra-yolo-fix` pass it
// and name their PRD, so `omni runner follow` follows their job. Kept apart from ./line.test.ts, which proves N-PRODUCT-19.
import { describe, expect, it } from 'vitest';
import { checkRunnerLine, prdOfRunnerLine, RUNNABLE_SKILLS } from './line.ts';

const ULTRA = ['ultra-yolo', 'ultra-wave', 'ultra-yolo-fix'] as const;

describe('the ultra skills on a runner', () => {
  it.each(ULTRA)('/omni:%s is a skill a runner runs, and never a repository\'s own', (skill) => {
    expect(RUNNABLE_SKILLS).toContain(skill);
    expect(checkRunnerLine(`/omni:${skill} 12`)).toEqual({ ok: true, kind: 'omni', skill, args: '12' });
    expect(checkRunnerLine(`/${skill} 12`, [skill])).toEqual({ ok: false, reason: `/${skill} is the loop's own skill: send /omni:${skill}` });
  });

  it('names the PRD an ultra line names first, and none for a product PRD\'s id', () => {
    expect(prdOfRunnerLine('/omni:ultra-yolo 12')).toBe(12);
    expect(prdOfRunnerLine('/omni:ultra-wave 12 3')).toBe(12);
    expect(prdOfRunnerLine('/omni:ultra-yolo-fix 12')).toBe(12);
    expect(prdOfRunnerLine('/omni:ultra-yolo mobile-12')).toBeNull();
  });
});
