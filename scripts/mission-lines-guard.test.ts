// The guard of bug #3339 (and #3277 before it): every line a mission can send reaches the runner that claims its job. The app answers
// a runner's `next` with the job read through `RunnerJobSchema`; a line it refuses fails that whole call (500), the job ends `runner
// lost` and the mission sends it again, so a new mission line the contract does not know takes the runners down. Each line here is
// built by the mission's own code (apps/omni-app/src/missions, kit/lib/virtual-fleet), so a new shape there fails this test first.
// It lives under scripts/ because only a repository tool may import both the GitHub App and the arcade.
import { IssueNumberSchema, PrdNumberSchema, parseProductPrdId } from '../kit/lib/ids.ts';
import { checkRunnerLine } from '../kit/lib/runner/line.ts';
import { planJobLine, pmJobLine, type PmSkill } from '../kit/lib/virtual-fleet/pm.ts';
import { techJobLine } from '../kit/lib/virtual-fleet/tech-record.ts';
import { askLine } from '../apps/omni-app/src/missions/answers.ts';
import { bugFixLine } from '../apps/omni-app/src/missions/bug-team.ts';
import { approveLine } from '../apps/omni-app/src/missions/committee.ts';
import { careLine } from '../apps/omni-app/src/missions/keep-up.ts';
import { retroSkillLine } from '../apps/omni-app/src/missions/milestone.ts';
import { outsideFixLine } from '../apps/omni-app/src/missions/outside-bug.ts';
import { fixLine } from '../apps/omni-app/src/missions/qa.ts';
import { repairSkillLine } from '../apps/omni-app/src/missions/repair.ts';
import { stuckSkillLine } from '../apps/omni-app/src/missions/stuck.ts';
import { basesOf, lineOf, missionBranch } from '../apps/omni-app/src/missions/supervisor.ts';
import { RunnerJobSchema } from '../apps/galaxy/src/runners/runners.contract.ts';
import { describe, expect, it } from 'vitest';

const PRD = PrdNumberSchema.parse(12);
const PRODUCT_PRD = parseProductPrdId('shop-30');
const ISSUE = IssueNumberSchema.parse(612);
const MISSION = 3319;
const BRANCH = missionBranch(MISSION, 'Settings that are easy to use, fast and enjoyable');
const JOB_ID = '00000000-0000-4000-8000-000033390002';
/** The PM's writing skills (kit/lib/runner/line.ts › PM_SKILLS). */
const PM_SKILLS: readonly PmSkill[] = ['brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap'];
const ONE = basesOf(['demo-org/shop'], BRANCH);
const TWO = basesOf(['demo-org/shop', 'demo-org/api'], missionBranch(7, 'Checkout'));

/** Every line a mission sends, by what sends it. */
const LINES: readonly (readonly [string, string])[] = [
  ['a PRD\'s build', lineOf(PRD, 'build', 'yolo', BRANCH)],
  ['a PRD\'s build at with-you', lineOf(PRD, 'build')],
  ['a PRD\'s fix for review', lineOf(PRD, 'fix:1', 'yolo', BRANCH)],
  ['the Reviewer', lineOf(PRD, 'review:1', 'yolo', BRANCH)],
  ['a plan repository\'s build', lineOf(PRD, 'build', 'ultra-yolo')],
  ['a plan repository\'s fix', lineOf(PRD, 'fix:1', 'ultra-yolo')],
  ['QA, round 1', lineOf(PRD, 'qa:1', 'yolo', BRANCH)],
  ['QA, round 2', lineOf(PRD, 'qa:2', 'yolo', BRANCH)],
  ['the Engineer\'s fix of a QA bug', fixLine({ issue: ISSUE, branch: `feat/${String(PRD)}-settings` })],
  ['a product PRD\'s build, one repository', lineOf(PRODUCT_PRD, 'build', 'ultra-yolo', ONE)],
  ['a product PRD\'s build, two repositories', lineOf(PRODUCT_PRD, 'build', 'ultra-yolo', TWO)],
  ['a product PRD\'s build at with-you', lineOf(PRODUCT_PRD, 'build', 'ultra-yolo', null)],
  ['a product PRD\'s fix for review', lineOf(PRODUCT_PRD, 'fix:1', 'ultra-yolo', TWO)],
  ['a product PRD\'s Reviewer', lineOf(PRODUCT_PRD, 'review:1', 'ultra-yolo', ONE)],
  ['the committee, on an item', askLine(PRD, 's1-01-keep-the-total', 2)],
  ['the committee, on a product PRD\'s item', askLine(PRODUCT_PRD, 's1-02-parts-live-in-omni-ui', 0.6)],
  ['the committee, approving', approveLine(PRD)],
  ['the committee, approving a PM\'s PRD', approveLine(PRD, 'pm')],
  ['a bug team\'s fix', bugFixLine(ISSUE)],
  ['an outside bug\'s fix', outsideFixLine(ISSUE, BRANCH)],
  ['a feature branch\'s care', careLine(PRD, BRANCH)],
  ['a roadmap\'s retro', retroSkillLine(MISSION, '7')],
  ['the mission\'s retro', retroSkillLine(MISSION, 'mission')],
  ['a repair of a PRD\'s step', repairSkillLine(MISSION, PRD, JOB_ID)],
  ['a repair of a product PRD\'s step', repairSkillLine(MISSION, PRODUCT_PRD, JOB_ID)],
  ['a stuck repair', stuckSkillLine(MISSION, [1, 2, 3, 4, 5].map((k) => `0000000${String(k)}-0000-4000-8000-000033390000`))],
  ...PM_SKILLS.map((skill): readonly [string, string] => [`the PM's ${skill}`, pmJobLine(skill, MISSION, 3)]),
  ...PM_SKILLS.map((skill): readonly [string, string] => [`the PM's ${skill} for a product`, pmJobLine(skill, MISSION, 3, 'shop')]),
  ['the PM\'s plan', planJobLine(PRD, 'plan')],
  ['the PM\'s replan', planJobLine(PRD, 'replan')],
  ['the PM\'s plan of a product PRD', planJobLine(PRODUCT_PRD, 'plan', MISSION)],
  ['the PM\'s replan of a product PRD', planJobLine(PRODUCT_PRD, 'replan', MISSION)],
  ['the Architect\'s review', techJobLine(PRODUCT_PRD, MISSION)],
];

const job = (line: string) => ({ id: JOB_ID, line, repo: 'demo-org/shop', sentBy: null, allowedSkills: [], sentByKey: null, github: null, mission: { level: 'alone' } });

describe('every line a mission sends reaches the runner that claims its job (bug #3339)', () => {
  it.each(LINES)('%s: %s', (_, line) => {
    expect(checkRunnerLine(line)).toMatchObject({ ok: true });
    expect(RunnerJobSchema.safeParse(job(line)).error?.issues).toBeUndefined();
  });
});
