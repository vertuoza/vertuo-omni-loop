// The runner's own check of a line (PRD 1830): the same cases the app's route is tested on. A
// repository's own skills (PRD 2313): `/<name> <args>`, when the job's allowed skills name it; the app
// runs the shared table through both checks (apps/galaxy/src/runners/runners.contract.test.ts).
import { describe, expect, it } from 'vitest';
import { checkRunnerLine, LINE_MAX, RUNNABLE_SKILLS, SKILL_NAME_MAX } from './line.ts';

describe('checkRunnerLine', () => {
  it('takes every listed skill, with and without arguments', () => {
    for (const skill of RUNNABLE_SKILLS) {
      expect(checkRunnerLine(`/omni:${skill} 1717`)).toEqual({ ok: true, kind: 'omni', skill, args: '1717' });
      expect(checkRunnerLine(`/omni:${skill}`)).toEqual({ ok: true, kind: 'omni', skill, args: '' });
    }
    expect(checkRunnerLine('/omni:do-work 1830 s2 --in-wave')).toEqual({ ok: true, kind: 'omni', skill: 'do-work', args: '1830 s2 --in-wave' });
    expect(checkRunnerLine('/omni:retro-apply --retro 2360')).toEqual({ ok: true, kind: 'omni', skill: 'retro-apply', args: '--retro 2360' });
    expect(checkRunnerLine('/omni:rewind 2410')).toEqual({ ok: true, kind: 'omni', skill: 'rewind', args: '2410' });
    expect(checkRunnerLine('/omni:knowledge-add add the glossary term main watch')).toMatchObject({ ok: true, kind: 'omni', skill: 'knowledge-add' });
    expect(checkRunnerLine('/omni:rewind-apply 2498 3f2a9c1e-5b7d-4e8f-a1b2-c3d4e5f60718'))
      .toEqual({ ok: true, kind: 'omni', skill: 'rewind-apply', args: '2498 3f2a9c1e-5b7d-4e8f-a1b2-c3d4e5f60718' });
    expect(checkRunnerLine('/omni:bug-fix #12 fix/a.b:c')).toMatchObject({ ok: true });
    expect(checkRunnerLine('/omni:mega-bug-fix https://github.com/acme/plan/issues/612'))
      .toEqual({ ok: true, kind: 'omni', skill: 'mega-bug-fix', args: 'https://github.com/acme/plan/issues/612' });
  });

  it('refuses an unlisted skill, a conversational one and /omni:drive', () => {
    for (const skill of ['brainstorm', 'think-big', 'drive', 'ask', 'unknown']) {
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
