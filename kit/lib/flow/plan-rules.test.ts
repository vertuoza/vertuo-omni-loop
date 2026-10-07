import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { parseWorkSliceId } from '../ids.ts';
import type { Slice } from '../types.ts';
import { planRuleViolations } from './plan-rules.ts';
import { resolveFlow } from './resolve.ts';

const flowOf = (yaml: string) => resolveFlow(parseConfig(`kit: 1\n${yaml}`));

const KERNEL = flowOf(`flow:
  areas:
    kernel:
      paths: ['^src/kernel/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 3 }
          - wave: first
          - blocks: all
`);

const MIGRATIONS = flowOf(`flow:
  areas:
    migrations:
      paths: ['^database/migrations/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 1 }
          - landing: alone
`);

type Row = [id: string, territory: string[], blockedBy?: string[], wave?: number | null, landing?: number];
const slices = (rows: Row[]): Slice[] =>
  rows.map(([id, territory, blockedBy = [], wave = 1, landing = 1]) => ({
    id: parseWorkSliceId(id),
    repo: null,
    title: id,
    territory,
    blockedBy: blockedBy.map(parseWorkSliceId),
    wave,
    landing,
  }));

describe('planRuleViolations — no flow', () => {
  it('refuses nothing', () => {
    expect(planRuleViolations(slices([['s1', ['a/', 'b/']], ['s2', ['a/']]]), flowOf(''))).toEqual([]);
  });
});

describe('planRuleViolations — slice alone', () => {
  it('refuses a slice touching its area and a path outside it, naming the slice, the area and the rule', () => {
    expect(planRuleViolations(slices([['s1', ['database/migrations/x.sql', 'src/Invoice.php']]]), MIGRATIONS)).toEqual([
      expect.stringMatching(/^flow: s1 touches database\/migrations\/x\.sql \(area migrations\) and also src\/Invoice\.php — migrations: slice alone/),
      'flow: s1 touches 2 paths — migrations: slice maxFiles 1, at most 1 path in a slice of this area.',
      expect.stringMatching(/^landing: s1 \(landing 1\) touches database\/migrations\/x\.sql, which lands alone \(area migrations\), and also src\/Invoice\.php — /),
    ]);
  });

  it('accepts a slice inside its area', () => {
    expect(planRuleViolations(slices([['s1', ['database/migrations/x.sql']]]), MIGRATIONS)).toEqual([]);
  });
});

describe('planRuleViolations — slice maxFiles', () => {
  it('refuses a territory over the strictest limit, naming the area that sets it', () => {
    expect(planRuleViolations(slices([['s1', ['src/kernel/a', 'src/kernel/b', 'src/kernel/c', 'src/kernel/d']]]), KERNEL)).toEqual([
      'flow: s1 touches 4 paths — kernel: slice maxFiles 3, at most 3 paths in a slice of this area.',
    ]);
  });

  it('accepts a territory at the limit', () => {
    expect(planRuleViolations(slices([['s1', ['src/kernel/a', 'src/kernel/b', 'src/kernel/c']]]), KERNEL)).toEqual([]);
  });

  it('applies the default area limit to every slice, an inheriting area keeping the stricter one', () => {
    const flow = flowOf("flow:\n  rules:\n    plan:\n      - slice: { maxFiles: 2 }\n  areas:\n    ui:\n      paths: ['^ui/']\n");
    expect(planRuleViolations(slices([['s1', ['a', 'b', 'c']], ['s2', ['ui/a', 'ui/b']]]), flow)).toEqual([
      'flow: s1 touches 3 paths — default: slice maxFiles 2, at most 2 paths in a slice of this area.',
    ]);
  });
});

describe('planRuleViolations — wave first', () => {
  it('refuses a kernel slice in wave 2 behind a slice outside the area in wave 1', () => {
    expect(planRuleViolations(slices([['s1', ['src/app/']], ['s2', ['src/kernel/'], [], 2]]), KERNEL)).toContainEqual(
      'flow: s2 (wave 2) touches area kernel and does not sit before s1 (wave 1), which does not — kernel: wave first, the area\'s slices sit in a wave before every other slice.',
    );
  });

  it('refuses an area slice sharing a wave with a slice outside it', () => {
    expect(planRuleViolations(slices([['s1', ['src/kernel/']], ['s2', ['src/app/'], ['s1'], 1]]), KERNEL)).toContainEqual(
      expect.stringMatching(/^flow: s1 \(wave 1\) touches area kernel and does not sit before s2 \(wave 1\)/),
    );
  });

  it('accepts the area slices in the first wave, and counts a later landing as after', () => {
    expect(planRuleViolations(slices([['s1', ['src/kernel/']], ['s2', ['src/app/'], ['s1'], 2]]), KERNEL)).toEqual([]);
    expect(planRuleViolations(slices([['s1', ['src/kernel/'], [], 2, 1], ['s2', ['src/app/'], [], 1, 2]]), KERNEL)).toEqual([]);
  });
});

describe('planRuleViolations — blocks all', () => {
  it('refuses a slice outside the area blocked by none of its slices', () => {
    expect(planRuleViolations(slices([['s1', ['src/kernel/']], ['s2', ['src/app/'], [], 2]]), KERNEL)).toEqual([
      'flow: s2 is blocked by no slice of area kernel (s1), directly or through another — kernel: blocks all.',
    ]);
  });

  it('accepts a blocker reached through another slice, and a slice in a later landing', () => {
    const plan = slices([['s1', ['src/kernel/']], ['s2', ['src/app/'], ['s1'], 2], ['s3', ['src/ui/'], ['s2'], 3], ['s4', ['src/web/'], [], 1, 2]]);
    expect(planRuleViolations(plan, KERNEL)).toEqual([]);
  });

  it('asks nothing of a plan with no slice in the area', () => {
    expect(planRuleViolations(slices([['s1', ['src/app/']], ['s2', ['src/ui/']]]), KERNEL)).toEqual([]);
  });
});

describe('planRuleViolations — merge and replace conflicts', () => {
  const flow = flowOf(`flow:
  rules:
    subPr: { merge: squash }
  areas:
    kernel:
      paths: ['^src/kernel/']
      rules:
        subPr: { merge: rebase }
      hooks:
        do-work.test: { replace: hooks/kernel.md }
    ui:
      paths: ['^ui/']
      hooks:
        do-work.test: { replace: hooks/ui.md }
`);

  it('refuses two merge methods on one slice, naming both areas', () => {
    expect(planRuleViolations(slices([['s1', ['src/kernel/', 'lib/']]]), flow)).toEqual([
      'flow: s1 meets more than one merge method (default: merge squash, kernel: merge rebase) — split the slice so each part merges one way.',
    ]);
  });

  it('refuses two replace hooks at one point on one slice, naming both', () => {
    expect(planRuleViolations(slices([['s1', ['src/kernel/', 'ui/']]]), flow)).toEqual([
      'flow: s1 meets more than one merge method (kernel: merge rebase, ui: merge squash) — split the slice so each part merges one way.',
      'flow: s1 meets more than one replace hook at do-work.test (kernel: hooks/kernel.md, ui: hooks/ui.md) — split the slice so one hook replaces the step.',
    ]);
  });

  it('accepts a slice in one area', () => {
    expect(planRuleViolations(slices([['s1', ['src/kernel/']], ['s2', ['ui/']]]), flow)).toEqual([]);
  });
});

describe('planRuleViolations — landing alone', () => {
  const ALIAS = resolveFlow(parseConfig("kit: 1\nlandings:\n  alone: ['^database/migrations/']\n"));
  const AREA = flowOf("flow:\n  areas:\n    migrations:\n      paths: ['^database/migrations/']\n      rules:\n        plan:\n          - landing: alone\n");
  const ids = (lines: string[]) => lines.map((line) => line.match(/^landing: (s\d|landing \d)/)?.[1]);

  it.each([
    ['a slice mixing the two', [['s1', ['database/migrations/', 'src/']]] as Row[]],
    ['a landing mixing the two', [['s1', ['database/migrations/']], ['s2', ['src/']]] as Row[]],
    ['a plan that keeps them apart', [['s1', ['database/migrations/'], [], 1, 1], ['s2', ['src/'], [], 1, 2]] as Row[]],
  ])('landings.alone and landing: alone grade %s the same way', (_, rows) => {
    expect(ids(planRuleViolations(slices(rows), AREA))).toEqual(ids(planRuleViolations(slices(rows), ALIAS)));
  });

  it('keeps the landings.alone wording, and names the area of landing: alone', () => {
    const rows: Row[] = [['s1', ['database/migrations/', 'src/']]];
    expect(planRuleViolations(slices(rows), ALIAS)[0]).toMatch(/touches database\/migrations\/, which lands alone, and also src\//);
    expect(planRuleViolations(slices(rows), AREA)[0]).toMatch(/touches database\/migrations\/, which lands alone \(area migrations\), and also src\//);
  });
});
