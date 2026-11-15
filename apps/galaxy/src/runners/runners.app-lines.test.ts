// The App's own runner lines (PRD 2898 s8): `/omni:acceptance <prd> --pr <n> --sha <sha>`, the e2e fallback the Omni App
// queues for a gated feature PR's commit. A runner receives it as any job, the kit's runner runs it, and a person's Send
// never queues it: it is no skill of the plugin, so Send's list, and the Runners guide's, stay the skills a person sends.
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { APP_SKILLS as KIT_APP_SKILLS, checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import { acceptanceLine } from 'omni-loop/kit/lib/runner/acceptance-line.ts';
import { describe, expect, it } from 'vitest';
import { APP_RUNNER_SKILLS, checkLine, checkLineShape, isAppLine, RunnerJobSchema } from './runners.contract';

const LINE = acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: 'e5'.repeat(20) });
const JOB = { id: '00000000-0000-4000-8000-000028980008', line: LINE, repo: 'acme/widgets', sentBy: null, allowedSkills: [], sentByKey: null, github: null };

describe('the App\'s own runner lines', () => {
  it('are the kit\'s', () => {
    expect([...APP_RUNNER_SKILLS]).toEqual([...KIT_APP_SKILLS]);
  });

  it('reach the runner that claims the job, and the runner takes them', () => {
    expect(isAppLine(LINE)).toBe(true);
    expect(RunnerJobSchema.parse(JOB)).toEqual(JOB);
    expect(checkRunnerLine(LINE).ok).toBe(true);
  });

  it('are never sent by a person: Send refuses them as no skill a runner runs', () => {
    expect(checkLine(LINE).ok).toBe(false);
    expect(checkLineShape(LINE).ok).toBe(false);
  });

  it('keep the shape any line keeps: 200 characters at most, the arguments checked', () => {
    expect(isAppLine(`/omni:acceptance ${'1'.repeat(184)}`)).toBe(false);
    expect(isAppLine('/omni:acceptance 2898; rm -rf /')).toBe(false);
    expect(isAppLine('/omni:yolo 2898')).toBe(false);
    expect(RunnerJobSchema.safeParse({ ...JOB, line: '/omni:acceptance 2898; rm' }).success).toBe(false);
  });
});
