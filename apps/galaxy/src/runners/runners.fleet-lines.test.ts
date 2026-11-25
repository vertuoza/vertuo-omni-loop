// The fleet's runner lines (PRD omni-loop-26, bug #3277): `/omni:tech-review <key>-<n> --mission <m>`, the Architect's review a
// mission at Works alone queues. A runner that claims the job must receive it: a line the job contract refuses fails the runner's
// whole next call (500), and the runner then takes no job at all. A person's Send never queues it.
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import { describe, expect, it } from 'vitest';
import { checkLine, RunnerJobSchema } from './runners.contract';

const LINE = '/omni:tech-review omni-loop-27 --mission 3270';
const JOB = { id: '00000000-0000-4000-8000-000032770001', line: LINE, repo: 'acme/widgets', sentBy: null, allowedSkills: [], sentByKey: null, github: null, mission: { level: 'alone' } };

describe('the fleet\'s runner lines (bug #3277)', () => {
  it('reach the runner that claims the job, as the kit\'s runner takes them', () => {
    expect(checkRunnerLine(LINE).ok).toBe(true);
    expect(RunnerJobSchema.safeParse(JOB).success).toBe(true);
  });

  it('are never sent by a person, and keep their one shape', () => {
    expect(checkLine(LINE).ok).toBe(false);
    expect(RunnerJobSchema.safeParse({ ...JOB, line: '/omni:tech-review omni-loop-27' }).success).toBe(false);
    expect(RunnerJobSchema.safeParse({ ...JOB, line: '/omni:tech-review omni-loop-27 --mission 3270; rm' }).success).toBe(false);
  });
});
