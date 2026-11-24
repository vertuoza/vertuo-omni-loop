// The runner's own check of a line (PRD 1830): the same cases the app's route is tested on. A
// repository's own skills (PRD 2313): `/<name> <args>`, when the job's allowed skills name it; the app
// runs the shared table through both checks (apps/galaxy/src/runners/runners.contract.test.ts).
import { describe, expect, it } from 'vitest';
import { checkRunnerLine, FLEET_SKILLS, LINE_MAX, missionRefusal, PM_SKILLS, prdOfRunnerLine, RESUMABLE_SKILLS, RUNNABLE_SKILLS, SKILL_NAME_MAX } from './line.ts';

describe('RESUMABLE_SKILLS (PRD 2809)', () => {
  it('names the skills that pick up from what GitHub holds, and no other', () => {
    expect([...RESUMABLE_SKILLS]).toEqual(['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix']);
  });

  it('is a subset of the skills a runner runs: a resume never runs a line no runner takes', () => {
    for (const skill of RESUMABLE_SKILLS) expect(RUNNABLE_SKILLS, skill).toContain(skill);
    expect(new Set(RESUMABLE_SKILLS).size).toBe(RESUMABLE_SKILLS.length);
  });

  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(RESUMABLE_SKILLS)).toBe(true);
  });
});

describe('checkRunnerLine', () => {
  it('takes every listed skill, with and without arguments', () => {
    for (const skill of RUNNABLE_SKILLS.filter((one) => one !== 'mission')) {
      expect(checkRunnerLine(`/omni:${skill} 1717`)).toEqual({ ok: true, kind: 'omni', skill, args: '1717' });
      expect(checkRunnerLine(`/omni:${skill}`)).toEqual({ ok: true, kind: 'omni', skill, args: '' });
    }
    expect(checkRunnerLine('/omni:do-work 1830 s2 --in-wave')).toEqual({ ok: true, kind: 'omni', skill: 'do-work', args: '1830 s2 --in-wave' });
    expect(checkRunnerLine('/omni:retro-apply --retro 2360')).toEqual({ ok: true, kind: 'omni', skill: 'retro-apply', args: '--retro 2360' });
    expect(checkRunnerLine('/omni:rewind 2410')).toEqual({ ok: true, kind: 'omni', skill: 'rewind', args: '2410' });
    expect(checkRunnerLine('/omni:review 2871')).toEqual({ ok: true, kind: 'omni', skill: 'review', args: '2871' });
    expect(checkRunnerLine('/omni:committee 2896 --approve')).toEqual({ ok: true, kind: 'omni', skill: 'committee', args: '2896 --approve' });
    expect(checkRunnerLine('/omni:committee 2896 --approve --author pm')).toMatchObject({ ok: true, skill: 'committee' });
    expect(checkRunnerLine('/omni:knowledge-add add the glossary term main watch')).toMatchObject({ ok: true, kind: 'omni', skill: 'knowledge-add' });
    expect(checkRunnerLine('/omni:rewind-apply 2498 3f2a9c1e-5b7d-4e8f-a1b2-c3d4e5f60718'))
      .toEqual({ ok: true, kind: 'omni', skill: 'rewind-apply', args: '2498 3f2a9c1e-5b7d-4e8f-a1b2-c3d4e5f60718' });
    expect(checkRunnerLine('/omni:bug-fix #12 fix/a.b:c')).toMatchObject({ ok: true });
    expect(checkRunnerLine('/omni:mega-bug-fix https://github.com/acme/plan/issues/612'))
      .toEqual({ ok: true, kind: 'omni', skill: 'mega-bug-fix', args: 'https://github.com/acme/plan/issues/612' });
  });

  it('takes the mission\'s /omni:mission-retro (PRD 3065)', () => {
    expect(RUNNABLE_SKILLS).toContain('mission-retro');
    expect(checkRunnerLine('/omni:mission-retro --mission 12 --milestone 2950')).toEqual({ ok: true, kind: 'omni', skill: 'mission-retro', args: '--mission 12 --milestone 2950' });
    expect(checkRunnerLine('/omni:mission-retro --mission 12 --milestone mission')).toEqual({ ok: true, kind: 'omni', skill: 'mission-retro', args: '--mission 12 --milestone mission' });
  });

  it('AC-5: takes /omni:mission from the New mission box only, with --request <uuid> (PRD omni-loop-24)', () => {
    const uuid = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';
    expect(RUNNABLE_SKILLS.at(-1)).toBe('mission');
    expect(checkRunnerLine(`/omni:mission --request ${uuid}`)).toEqual({ ok: true, kind: 'omni', skill: 'mission', args: `--request ${uuid}` });
    const refusal = '/omni:mission runs on a runner from the New mission box only';
    for (const line of ['/omni:mission', '/omni:mission --goal dark-mode', '/omni:mission --request', '/omni:mission --request nope', `/omni:mission --request ${uuid} --goal x`, `/omni:mission --request ${uuid.toUpperCase()}`, `/omni:mission  --request ${uuid}`, '/omni:mission 1']) {
      expect(checkRunnerLine(line), line).toEqual({ ok: false, reason: refusal });
    }
    expect(checkRunnerLine('/omni:mission --goal a;b')).toEqual({ ok: false, reason: 'the arguments hold a character other than letters, digits, spaces and ._/:#-' });
  });

  it('takes QA\'s /omni:qa, round 1 and round 2 (PRD 3001)', () => {
    expect(checkRunnerLine('/omni:qa 3001')).toEqual({ ok: true, kind: 'omni', skill: 'qa', args: '3001' });
    expect(checkRunnerLine('/omni:qa 3001 --round 2')).toEqual({ ok: true, kind: 'omni', skill: 'qa', args: '3001 --round 2' });
    expect(checkRunnerLine('/qa 3001', ['qa'])).toEqual({ ok: false, reason: '/qa is the loop\'s own skill: send /omni:qa' });
  });

  it('refuses an unlisted skill, a conversational one and /omni:drive', () => {
    for (const skill of ['think-big', 'drive', 'ask', 'unknown']) {
      expect(checkRunnerLine(`/omni:${skill} 1`)).toEqual({ ok: false, reason: `/omni:${skill} does not run on a runner` });
    }
  });

  it('refuses shell characters and anything that is not a skill\'s line', () => {
    for (const args of ['1; rm -rf ~', '1 && echo', '$(id)', '`id`', '1 | cat', "1 'a'", '1 > f', '1\nrm', '1é']) {
      expect(checkRunnerLine(`/omni:yolo ${args}`)).toMatchObject({ ok: false });
      expect(checkRunnerLine(`/validate-prd ${args}`, ['validate-prd'])).toMatchObject({ ok: false });
    }
    expect(checkRunnerLine('yolo 1717')).toMatchObject({ ok: false, reason: 'the line does not read /omni:<skill> <arguments> or /<skill> <arguments>' });
    expect(checkRunnerLine(' /omni:yolo 1')).toMatchObject({ ok: false });
    expect(checkRunnerLine('/omni:Yolo 1')).toMatchObject({ ok: false });
  });

  it(`takes ${String(LINE_MAX)} characters and refuses ${String(LINE_MAX + 1)}`, () => {
    const head = '/omni:yolo ';
    expect(checkRunnerLine(head + 'a'.repeat(LINE_MAX - head.length))).toMatchObject({ ok: true });
    expect(checkRunnerLine(head + 'a'.repeat(LINE_MAX + 1 - head.length))).toEqual({ ok: false, reason: `the line is over ${String(LINE_MAX)} characters` });
    const own = '/validate-prd ';
    expect(checkRunnerLine(own + 'a'.repeat(LINE_MAX - own.length), ['validate-prd'])).toMatchObject({ ok: true });
    expect(checkRunnerLine(own + 'a'.repeat(LINE_MAX + 1 - own.length), ['validate-prd'])).toEqual({ ok: false, reason: `the line is over ${String(LINE_MAX)} characters` });
  });
});

describe('the PM\'s four writing skills (PRD 2896 s12)', () => {
  it('are runnable, and are the PM\'s brainstorm, roadmap, mega-brainstorm and mega-roadmap', () => {
    expect([...PM_SKILLS]).toEqual(['brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap']);
    for (const skill of PM_SKILLS) expect(checkRunnerLine(`/omni:${skill} --mission 12 --cap 2`)).toMatchObject({ ok: true, kind: 'omni', skill });
  });

  it('run on a job of a mission at alone, and are refused on any other job, naming why', () => {
    for (const skill of PM_SKILLS) {
      expect(missionRefusal(skill, { level: 'alone' })).toBeNull();
      for (const mission of [null, { level: 'with-you' }, { level: 'own-branch' }]) {
        expect(missionRefusal(skill, mission), `${skill} ${JSON.stringify(mission)}`).toBe(`/omni:${skill} runs on a runner for a mission's PM only`);
      }
    }
  });

  it('leave every other skill as it was, on any job', () => {
    for (const skill of RUNNABLE_SKILLS.filter((one) => !PM_SKILLS.includes(one))) expect(missionRefusal(skill, null), skill).toBeNull();
  });
});

describe('checkRunnerLine on a repository\'s own skill (PRD 2313)', () => {
  it('takes /<name> <args> when the job\'s allowed skills name it, with and without arguments', () => {
    expect(checkRunnerLine('/validate-prd 347', ['validate-prd'])).toEqual({ ok: true, kind: 'repository', skill: 'validate-prd', args: '347' });
    expect(checkRunnerLine('/validate-prd', ['other', 'validate-prd'])).toEqual({ ok: true, kind: 'repository', skill: 'validate-prd', args: '' });
    expect(checkRunnerLine('/v2 a/b#1', ['v2'])).toEqual({ ok: true, kind: 'repository', skill: 'v2', args: 'a/b#1' });
  });

  it('refuses a name the job\'s allowed skills do not hold, and holds none by default', () => {
    expect(checkRunnerLine('/validate-prd 347')).toEqual({ ok: false, reason: '/validate-prd is not allowed on a runner for this repository' });
    expect(checkRunnerLine('/validate-prd 347', ['validate'])).toEqual({ ok: false, reason: '/validate-prd is not allowed on a runner for this repository' });
  });

  it('never takes a fixed skill\'s name, allowed or not, so /yolo never means /omni:yolo', () => {
    for (const skill of RUNNABLE_SKILLS) {
      expect(checkRunnerLine(`/${skill} 1`, [skill])).toEqual({ ok: false, reason: `/${skill} is the loop's own skill: send /omni:${skill}` });
    }
  });

  it('refuses a name that is not a skill\'s: capitals, an underscore, another plugin\'s, an /omni: name, too long', () => {
    expect(checkRunnerLine('/Bad_Name 1', ['Bad_Name'])).toEqual({ ok: false, reason: 'the line does not read /omni:<skill> <arguments> or /<skill> <arguments>' });
    expect(checkRunnerLine('/vercel:deploy prod', ['vercel', 'vercel:deploy'])).toMatchObject({ ok: false });
    expect(checkRunnerLine('/omni:validate-prd 347', ['validate-prd'])).toEqual({ ok: false, reason: '/omni:validate-prd does not run on a runner' });
    expect(checkRunnerLine('/1st 1', ['1st'])).toMatchObject({ ok: false });
    const longest = `a${'b'.repeat(SKILL_NAME_MAX - 1)}`;
    expect(checkRunnerLine(`/${longest} 1`, [longest])).toMatchObject({ ok: true, kind: 'repository' });
    expect(checkRunnerLine(`/${longest}b 1`, [`${longest}b`])).toEqual({ ok: false, reason: `a skill's name is ${String(SKILL_NAME_MAX)} characters at most` });
  });
});

describe('prdOfRunnerLine (#2592)', () => {
  it('reads the PRD a PRD skill names first', () => {
    expect(prdOfRunnerLine('/omni:yolo 2251')).toBe(2251);
    expect(prdOfRunnerLine('/omni:pr-care 2537 --once')).toBe(2537);
    expect(prdOfRunnerLine('/omni:do-work 2270 s1')).toBe(2270);
    for (const skill of ['yolo-fix', 'wave', 'plan', 'pitch', 'prove']) expect(prdOfRunnerLine(`/omni:${skill} 7`), skill).toBe(7);
  });

  it('reads none from a skill that takes no PRD, a line with no number first, or a line no runner runs', () => {
    for (const line of ['/omni:bug-fix 612', '/omni:visual-fix 7', '/omni:retro-apply 7', '/validate-prd 347', '/omni:yolo', '/omni:yolo s1 7', '/omni:yolo 0', '/omni:yolo 7x', '/omni:brainstorm 7']) {
      expect(prdOfRunnerLine(line), line).toBeNull();
    }
  });
});

describe('the Architect\'s /omni:tech-review (PRD omni-loop-26)', () => {
  it('is taken as /omni:tech-review <key>-<n> --mission <m> only', () => {
    expect([...FLEET_SKILLS]).toEqual(['tech-review']);
    expect(checkRunnerLine('/omni:tech-review omni-loop-31 --mission 12')).toEqual({ ok: true, kind: 'omni', skill: 'tech-review', args: 'omni-loop-31 --mission 12' });
    const refusal = '/omni:tech-review runs on a runner for a mission\'s Architect only, as /omni:tech-review <key>-<n> --mission <m>';
    for (const line of ['/omni:tech-review omni-loop-31', '/omni:tech-review', '/omni:tech-review 2608 --mission 12', '/omni:tech-review omni-loop-31 --mission 0', '/omni:tech-review omni-loop-31 --mission 12 --cap 1', '/omni:tech-review --mission 12 omni-loop-31']) {
      expect(checkRunnerLine(line), line).toEqual({ ok: false, reason: refusal });
    }
  });

  it('runs on a job of a mission at alone only, and stays out of the runner\'s list a person\'s Send reads', () => {
    expect(RUNNABLE_SKILLS).not.toContain('tech-review');
    expect(missionRefusal('tech-review', { level: 'alone' })).toBeNull();
    for (const mission of [null, { level: 'with-you' }]) expect(missionRefusal('tech-review', mission)).toBe('/omni:tech-review runs on a runner for a mission\'s Architect only');
  });

  it('is never a repository\'s own skill\'s name', () => {
    expect(checkRunnerLine('/tech-review omni-loop-31', ['tech-review'])).toEqual({ ok: false, reason: '/tech-review is the loop\'s own skill: send /omni:tech-review' });
  });
});

describe('a mission\'s build line with --base-of (PRD omni-loop-26, item s6-01)', () => {
  it('takes /omni:ultra-yolo and /omni:ultra-wave with --base-of <owner/repo>=<branch>, one target or several', () => {
    expect(checkRunnerLine('/omni:ultra-yolo omni-loop-31 --base-of acme/widgets=mission/12-settings').ok).toBe(true);
    expect(checkRunnerLine('/omni:ultra-wave omni-loop-31 --base-of acme/widgets=mission/12-settings,acme/api=mission/12-settings').ok).toBe(true);
    expect(checkRunnerLine('/omni:ultra-yolo-fix omni-loop-31 --base-of acme/widgets=mission/12-settings').ok).toBe(true);
  });

  it('still refuses = anywhere else, and on any other skill', () => {
    expect(checkRunnerLine('/omni:ultra-yolo omni-loop-31 a=b').ok).toBe(false);
    expect(checkRunnerLine('/omni:yolo 12 --base-of acme/widgets=mission/12').ok).toBe(false);
    expect(checkRunnerLine('/omni:ultra-yolo omni-loop-31 --base-of acme/widgets=mission/12;rm').ok).toBe(false);
    expect(checkRunnerLine('/omni:ultra-yolo omni-loop-31 --base-of widgets=mission/12').ok).toBe(false);
  });
});
