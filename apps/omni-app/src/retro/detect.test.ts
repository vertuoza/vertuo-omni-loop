import { describe, expect, it } from 'vitest';
import { detect } from './detect.ts';
import { KINDS, kindsFor, type Kind } from './kinds/index.ts';
import { RULES_VERSION } from './rules.ts';
import type { Config, DetectContext, FeaturePull, Finding, PrdFacts } from './retro.types.ts';

const pr = { number: 12, title: 'feat: widgets', url: 'https://x/pull/12', openedAt: 'a', mergedAt: 'b', mergeSha: 'merge1', headRef: 'feat/widget' } as FeaturePull;
const prd = { number: 7, title: 'Widgets', topic: 'widget', state: 'shipped', folder: '.omni-loop/delivery/shipped/0007-widget', plan: '', settled: null, problem: 'p' } as PrdFacts;
const config = {} as Config;

const finding = (id: string, kind: string): Finding => ({ id, kind, title: id, happened: `${id} happened.`, evidence: [] });
const fakeKind = (id: string, findings: Finding[], facts: object = { id }): Kind => ({
  id,
  section: id,
  runs: ['merge'],
  gather: () => Promise.resolve(null),
  detect: (records: unknown, context: DetectContext) => ({ facts: { ...facts, records, prNumber: context.pr.number }, findings }),
  describe: () => null,
});

describe('detect — the fact sheet', () => {
  it('runs each kind’s detector on its own records, keeping its facts under its id', () => {
    const sheet = detect({
      run: 'merge',
      pr,
      prd,
      config,
      pulls: [],
      records: { a: { seen: 1 } },
      kinds: [fakeKind('a', []), fakeKind('b', [])],
    });
    expect(sheet.kinds).toEqual({
      a: { id: 'a', records: { seen: 1 }, prNumber: 12 },
      b: { id: 'b', records: null, prNumber: 12 },
    });
  });

  it('ranks every kind’s findings by the rules’ order, then by kind, then as found, numbering them F1, F2…', () => {
    const sheet = detect({
      run: 'merge',
      pr,
      prd,
      config,
      pulls: [],
      records: {},
      kinds: [
        fakeKind('timeline', [finding('slow-slice:s3', 'slow-slice')]),
        fakeKind('ci', [finding('flaky:e2e', 'flaky'), finding('failing-test:t', 'failing-test'), finding('repeated-red:lint', 'repeated-red')]),
        fakeKind('delivery', [finding('drift:s1-01', 'drift'), finding('drift:s1-01', 'drift')]),
      ],
    });
    expect(sheet.findings.map((f) => [f.ref, f.id, f.source])).toEqual([
      ['F1', 'drift:s1-01', 'delivery'],
      ['F2', 'flaky:e2e', 'ci'],
      ['F3', 'repeated-red:lint', 'ci'],
      ['F4', 'failing-test:t', 'ci'],
      ['F5', 'slow-slice:s3', 'timeline'],
    ]);
  });

  it('records the run, the rules it used, the PRD and the feature PR', () => {
    const sheet = detect({ run: 'merge', pr, prd, config, pulls: [], records: {}, kinds: [] });
    expect(sheet.run).toBe('merge');
    expect(sheet.rules.version).toBe(RULES_VERSION);
    expect(sheet.prd).toEqual({ number: 7, title: 'Widgets', topic: 'widget', state: 'shipped', folder: prd.folder });
    expect(sheet.featurePr).toEqual({ number: 12, title: 'feat: widgets', url: 'https://x/pull/12', openedAt: 'a', mergedAt: 'b', mergeSha: 'merge1' });
    expect(sheet.findings).toEqual([]);
  });

  it('is the same sheet for the same records: nothing in it depends on the clock', () => {
    const input = { run: 'merge' as const, pr, prd, config, pulls: [], records: {}, kinds: [fakeKind('a', [finding('churn:x', 'churn')])] };
    expect(detect(input)).toEqual(detect(input));
  });
});

describe('the kind registry', () => {
  it('names the five kinds, in the order their sections appear', () => {
    expect(KINDS.map((kind) => [kind.id, kind.section, [...kind.runs]])).toEqual([
      ['timeline', 'Timeline', ['merge']],
      ['delivery', 'Decisions', ['merge']],
      ['ci', 'Checks', ['merge']],
      ['churn', 'Churn', ['merge']],
      ['after-merge', 'After merge', ['day-14']],
    ]);
    expect(kindsFor('merge').map((kind) => kind.id)).toEqual(['timeline', 'delivery', 'ci', 'churn']);
    expect(kindsFor('day-14').map((kind) => kind.id)).toEqual(['after-merge']);
  });

  it('gives every kind the same shape', () => {
    for (const kind of KINDS) {
      expect(typeof kind.gather).toBe('function');
      expect(typeof kind.detect).toBe('function');
      expect(typeof kind.describe).toBe('function');
    }
  });

  it('holds kinds that, until they are built, gather nothing, find nothing and leave their section out', async () => {
    for (const kind of KINDS.filter((k) => !['timeline', 'delivery'].includes(k.id))) {
      expect(await kind.gather({ request: () => { throw new Error('no GitHub'); } }, {} as never)).toBeNull();
      expect(kind.detect(null, { pr, prd, config, pulls: [] })).toEqual({ facts: null, findings: [] });
      expect(kind.describe(null)).toBeNull();
    }
  });
});
