import { describe, expect, it } from 'vitest';
import { FLOW_POINTS, flowPoint } from './points.ts';

describe('the catalog of flow points', () => {
  it('lists the nine points of the spec, in order', () => {
    expect(FLOW_POINTS.map(({ point }) => point)).toEqual([
      'plan.slice', 'plan.done', 'do-work.start', 'do-work.test', 'do-work.review', 'do-work.ready', 'pr.open', 'wave.merge', 'yolo.ready',
    ]);
  });

  it('allows replace at do-work.test, pr.open and wave.merge only, each naming what it must produce', () => {
    const replaceable = FLOW_POINTS.filter(({ modes }) => modes.includes('replace'));
    expect(replaceable.map(({ point }) => point)).toEqual(['do-work.test', 'pr.open', 'wave.merge']);
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
      'yolo.ready': ['yolo', 'ultra-yolo'],
    });
    for (const { inputs } of FLOW_POINTS) expect(inputs.length).toBeGreaterThan(0);
  });

  it('finds a point by its name, and nothing for an unknown one', () => {
    expect(flowPoint('pr.open')?.outputs[0]).toMatch(/URL/);
    expect(flowPoint('pr.close')).toBeUndefined();
  });
});
