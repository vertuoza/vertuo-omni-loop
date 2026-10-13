// The runner's own check of a line (PRD 1830): the same cases the app's route is tested on.
import { describe, expect, it } from 'vitest';
import { checkLine, LINE_MAX, RUNNABLE_SKILLS } from './line.ts';

describe('checkLine', () => {
  it('takes every listed skill, with and without arguments', () => {
    for (const skill of RUNNABLE_SKILLS) {
      expect(checkLine(`/omni:${skill} 1717`)).toEqual({ ok: true, skill, args: '1717' });
      expect(checkLine(`/omni:${skill}`)).toEqual({ ok: true, skill, args: '' });
    }
    expect(checkLine('/omni:do-work 1830 s2 --in-wave')).toEqual({ ok: true, skill: 'do-work', args: '1830 s2 --in-wave' });
    expect(checkLine('/omni:bug-fix #12 fix/a.b:c')).toMatchObject({ ok: true });
  });

  it('refuses an unlisted skill, a conversational one and /omni:drive', () => {
    for (const skill of ['brainstorm', 'think-big', 'drive', 'ask', 'unknown']) {
      expect(checkLine(`/omni:${skill} 1`)).toEqual({ ok: false, reason: `/omni:${skill} does not run on a runner` });
    }
  });

  it('refuses shell characters and anything that is not an /omni: line', () => {
    for (const args of ['1; rm -rf ~', '1 && echo', '$(id)', '`id`', '1 | cat', "1 'a'", '1 > f', '1\nrm', '1é']) {
      expect(checkLine(`/omni:yolo ${args}`)).toMatchObject({ ok: false });
    }
    expect(checkLine('yolo 1717')).toMatchObject({ ok: false, reason: 'the line does not read /omni:<skill> <arguments>' });
    expect(checkLine(' /omni:yolo 1')).toMatchObject({ ok: false });
    expect(checkLine('/omni:Yolo 1')).toMatchObject({ ok: false });
  });

  it(`takes ${String(LINE_MAX)} characters and refuses ${String(LINE_MAX + 1)}`, () => {
    const head = '/omni:yolo ';
    expect(checkLine(head + 'a'.repeat(LINE_MAX - head.length))).toMatchObject({ ok: true });
    expect(checkLine(head + 'a'.repeat(LINE_MAX + 1 - head.length))).toEqual({ ok: false, reason: `the line is over ${String(LINE_MAX)} characters` });
  });
});
