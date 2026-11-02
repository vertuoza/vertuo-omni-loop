import { describe, expect, it } from 'vitest';
import { FLOW_POINTS, flowPoint } from './points.ts';

describe('the catalog of flow points', () => {
  it('lists the points of the spec, in order', () => {
    expect(FLOW_POINTS.map(({ point }) => point)).toEqual([
      'plan.slice', 'plan.done', 'do-work.start', 'do-work.test', 'do-work.review', 'do-work.ready', 'pr.open', 'wave.merge', 'bug-fix.reproduce', 'bug-fix.review', 'bug-fix.proof', 'yolo.ready',
    ]);
  });

  it('allows replace at do-work.test, pr.open, wave.merge and bug-fix.proof only, each naming what it must produce', () => {
    const replaceable = FLOW_POINTS.filter(({ modes }) => modes.includes('replace'));
    expect(replaceable.map(({ point }) => point)).toEqual(['do-work.test', 'pr.open', 'wave.merge', 'bug-fix.proof']);
    for (const { outputs } of replaceable) expect(outputs.length).toBeGreaterThan(0);
    for (const { modes, outputs } of FLOW_POINTS.filter(({ modes }) => !modes.includes('replace'))) {
      expect(modes).toEqual(['before', 'after']);
      expect(outputs).toEqual([]);
    }
  });

  it('lists each point with its skills, the ultra and mega variants beside their base skill, and its inputs', () => {
    expect(Object.fromEntries(FLOW_POINTS.map(({ point, skills }) => [point, skills]))).toEqual({
      'plan.slice': ['plan', 'mega-brainstorm'],
      'plan.done': ['plan'],
      'do-work.start': ['do-work'],
      'do-work.test': ['do-work'],
      'do-work.review': ['do-work'],
      'do-work.ready': ['do-work'],
      'pr.open': ['pr'],
      'wave.merge': ['wave', 'ultra-wave'],
      'bug-fix.reproduce': ['bug-fix', 'mega-bug-fix'],
      'bug-fix.review': ['bug-fix', 'mega-bug-fix'],
      'bug-fix.proof': ['bug-fix'],
      'yolo.ready': ['yolo', 'ultra-yolo'],
    });
    for (const { inputs } of FLOW_POINTS) expect(inputs.length).toBeGreaterThan(0);
  });

  it('hands bug-fix.reproduce and bug-fix.review their inputs, before and after only', () => {
    expect(flowPoint('bug-fix.reproduce')).toMatchObject({ modes: ['before', 'after'], inputs: ['issue', 'branch', 'suspect', 'boundary'] });
    expect(flowPoint('bug-fix.review')).toMatchObject({ modes: ['before', 'after'], inputs: ['issue', 'branch', 'base'] });
  });

  it('hands bug-fix.proof its inputs, before, after and replace, a replace giving back the two recordings, the env: line and the verdict (PRD 2578)', () => {
    expect(flowPoint('bug-fix.proof')).toMatchObject({
      skills: ['bug-fix'],
      modes: ['before', 'after', 'replace'],
      inputs: ['issue', 'base', 'head', 'pr', 'targets', 'reproduction', 'out'],
    });
    const outputs = flowPoint('bug-fix.proof')?.outputs.join(' · ') ?? '';
    expect(outputs).toContain('before.*');
    expect(outputs).toContain('after.*');
    expect(outputs).toContain('env:');
    expect(outputs).toContain('the verdict line');
  });

  it('finds a point by its name, and nothing for an unknown one', () => {
    expect(flowPoint('pr.open')?.outputs[0]).toMatch(/URL/);
    expect(flowPoint('pr.close')).toBeUndefined();
  });
});
