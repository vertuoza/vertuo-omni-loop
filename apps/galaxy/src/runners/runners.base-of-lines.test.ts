// A mission's product build reaches its runner (bug #3339): `/omni:ultra-yolo <key>-<n> --base-of <owner/repo>=<branch>,…`, the
// line a mission above `with-you` sends a product PRD (PRD omni-loop-21 s7). The kit's runner takes it; a line the job contract
// refuses fails the runner's whole `next` call (500), the job ends `runner lost`, and the mission sends it again, round after round.
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import { describe, expect, it } from 'vitest';
import { RunnerJobSchema } from './runners.contract';

const BRANCH = 'mission/3319-settings-that-are-easy-to-use-fast-and-e';
const job = (line: string) => ({ id: '00000000-0000-4000-8000-000033390001', line, repo: 'demo-org/shop', sentBy: null, allowedSkills: [], sentByKey: null, github: null, mission: { level: 'alone' } });

describe('a mission\'s product lines with --base-of (bug #3339)', () => {
  it.each([
    ['the build, into one repository\'s mission branch', `/omni:ultra-yolo shop-30 --base-of demo-org/shop=${BRANCH}`],
    ['the build, into two repositories\' mission branches', '/omni:ultra-yolo shop-30 --base-of demo-org/shop=mission/7-checkout,demo-org/api=mission/7-checkout'],
    ['the fix sent for review', `/omni:ultra-yolo-fix shop-30 --for-review --base-of demo-org/shop=${BRANCH}`],
  ])('reach the runner that claims the job: %s', (_, line) => {
    expect(checkRunnerLine(line).ok).toBe(true);
    expect(RunnerJobSchema.safeParse(job(line)).success).toBe(true);
  });
});
