import { InngestTestEngine, mockCtx } from '@inngest/test';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { inngest } from '../inngest-client.ts';
import { savingRun } from '../../test/saved-steps.ts';
import { JUDGE_ENV, SUB_PULLS, judge, mergeFiles, widgetScenario } from '../../test/retro-scenario.ts';
import { DAY_14, FIX_PULLS, ISSUES, afterMergeRecording } from './kinds/after-merge.fixtures/day-14.ts';
import { GITATTRIBUTES, UNMERGED, churnRecording } from './kinds/churn.fixtures/delivery.ts';
import { KINDS } from './kinds/index.ts';
import { ChurnAtMergeSchema } from './kinds/records.ts';
import { ModelReplySchema } from './narrate.ts';
import { CLOCK_STEP, DAY_EVENT, FOLLOW_UP_STEP, createRetro } from './retro.ts';
import {
  ClockSchema,
  CommentedSchema,
  FactSheetSchema,
  GuardedSchema,
  IssueLinksSchema,
  KnownSchema,
  NarratedSchema,
  PublishedSchema,
  PullsIntoSchema,
  QualifiedSchema,
  RunRecordSchema,
} from './retro.schema.ts';

/** Every value a retro's steps saved, by step id, as Inngest reads them back: JSON, and back. */
type Saved = Map<string, unknown>;

/** A run of the retro, both its runs, every step's value kept as it was saved. */
async function savedValues({ env = JUDGE_ENV }: { env?: Record<string, string | undefined> } = {}): Promise<Saved> {
  const scenario = widgetScenario({
    files: { ...mergeFiles(), '.gitattributes': GITATTRIBUTES },
    subPulls: [UNMERGED, ...SUB_PULLS, ...FIX_PULLS],
    recording: [...churnRecording(), ...afterMergeRecording()],
  });
  scenario.github.state.issues.push(...structuredClone(ISSUES));
  const values: Saved = new Map();
  const keep = (id: string, value: unknown) => (values.set(id, value), value);
  const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, env, fetch: judge(), followUp: true });
  // A wait, if the clock asks for one, ends on the tick of the fourteenth day.
  const tick = { name: DAY_EVENT, data: {}, id: 'tick', ts: Date.parse(DAY_14) };
  const transformCtx = (ctx: Parameters<typeof mockCtx>[0]) => {
    const mocked = mockCtx(savingRun(ctx, [], keep));
    const waitForEvent = mocked.step.waitForEvent as unknown as { mockImplementation(fn: (id: string) => Promise<unknown>): void };
    waitForEvent.mockImplementation((id) => (id.startsWith(FOLLOW_UP_STEP) ? Promise.resolve(tick) : Promise.reject(new Error(id))));
    return mocked;
  };
  const engine = new InngestTestEngine({ function: fn, events: [scenario.event], transformCtx });
  const { error } = await engine.execute();
  expect(error).toBeUndefined();
  return values;
}

/** The value step `id` saved: the test fails when the step did not run. */
function valueOf(saved: Saved, id: string): unknown {
  expect(saved.has(id), `the step ${id} ran`).toBe(true);
  return saved.get(id);
}

/** A copy of the object `value`, `key` set to `to`, or left out when `to` is `undefined`. */
function changed(value: unknown, key: string, to: unknown): Record<string, unknown> {
  const entries = Object.entries(z.record(z.string(), z.unknown()).parse(value)).filter(([name]) => name !== key);
  return Object.fromEntries(to === undefined ? entries : [...entries, [key, to]]);
}

/** `schema` parses `value`, and refuses it without `key`, with `key` of another type, and with `key` null. */
function expectStrict(schema: z.ZodType, value: unknown, key: string, wrongType: unknown) {
  expect(schema.safeParse(value).error?.issues ?? []).toEqual([]);
  expect(schema.safeParse(changed(value, key, undefined)).success, `${key} missing`).toBe(false);
  expect(schema.safeParse(changed(value, key, wrongType)).success, `${key} of another type`).toBe(false);
  expect(schema.safeParse(changed(value, key, null)).success, `${key} null`).toBe(false);
}

describe('retro.schema — each step’s value, as Inngest saved it', () => {
  let judged: Saved;
  let notJudged: Saved;
  beforeAll(async () => {
    judged = await savedValues();
    notJudged = await savedValues({ env: {} });
  });

  it('qualify: the feature PR, its PRD and the config, strictly', () => {
    const qualified = valueOf(judged, 'qualify');
    expectStrict(QualifiedSchema, qualified, 'prd', 'PRD 7');
    expectStrict(QualifiedSchema, qualified, 'config', 'kit: 1');
    const pr = z.object({ pr: z.unknown() }).parse(qualified).pr;
    expect(QualifiedSchema.safeParse(changed(qualified, 'pr', changed(pr, 'mergeSha', null))).success).toBe(false);
    expect(QualifiedSchema.safeParse(changed(qualified, 'pr', changed(pr, 'number', '12'))).success).toBe(false);
    expect(QualifiedSchema.safeParse({ skip: '#12 was closed, not merged.' }).success).toBe(true);
  });

  it('gather-pulls: each sub-PR', () => {
    const pulls = z.array(z.unknown()).parse(valueOf(judged, 'gather-pulls'));
    expect(PullsIntoSchema.safeParse(pulls).success).toBe(true);
    expectStrict(PullsIntoSchema.element, pulls[0], 'headSha', 7);
  });

  it('gather-<kind>: each kind’s records, by the kind’s own schema', () => {
    for (const kind of KINDS) {
      const id = kind.runs.includes('merge') ? `gather-${kind.id}` : `gather-${kind.id}-day-14`;
      const records = valueOf(judged, id);
      expect(records, id).not.toBeNull();
      expect(kind.records.safeParse(records).success, id).toBe(true);
      const [key] = Object.keys(z.record(z.string(), z.unknown()).parse(records));
      assertDefined(key, `a field of ${id}`);
      expect(kind.records.safeParse(changed(records, key, undefined)).success, `${id} without ${key}`).toBe(false);
      expect(kind.records.safeParse(changed(records, key, true)).success, `${id} with ${key} of another type`).toBe(false);
    }
  });

  it('facts: the fact sheet, and the churn facts the day-14 run reads back from it', () => {
    const sheet = valueOf(judged, 'facts');
    expectStrict(FactSheetSchema, sheet, 'rules', 1);
    expectStrict(FactSheetSchema, sheet, 'findings', {});
    expect(FactSheetSchema.safeParse(changed(sheet, 'run', 'day-15')).success).toBe(false);
    const churn = FactSheetSchema.parse(sheet).kinds.churn;
    expect(ChurnAtMergeSchema.safeParse(churn).success).toBe(true);
    expect(ChurnAtMergeSchema.safeParse(changed(churn, 'ranges', [{ path: 'a.ts', from: '1', to: 2 }])).success).toBe(false);
  });

  it('gather-knowledge, narrate and guard: what the judge was given and what it said', () => {
    expectStrict(KnownSchema, valueOf(judged, 'gather-knowledge'), 'lessons', 'one lesson');
    const narrated = valueOf(judged, 'narrate');
    expect(NarratedSchema.safeParse(narrated).success).toBe(true);
    expect(NarratedSchema.safeParse(changed(narrated, 'reply', 'kept')).success).toBe(false);
    const reply = z.object({ reply: z.unknown() }).parse(narrated).reply;
    expectStrict(ModelReplySchema, reply, 'summary', 7);
    expect(ModelReplySchema.safeParse(changed(reply, 'verdict', { worthIt: 'yes', reason: 'r' })).success).toBe(false);
    expectStrict(GuardedSchema, valueOf(judged, 'guard'), 'dropped', {});
    expect(NarratedSchema.safeParse(valueOf(notJudged, 'narrate')).success).toBe(true);
  });

  it('publish-issues, publish and verdict: what the run left on GitHub', () => {
    const issues = z.record(z.string(), z.unknown()).parse(valueOf(judged, 'publish-issues'));
    const [first] = Object.values(issues);
    expect(IssueLinksSchema.safeParse(issues).success).toBe(true);
    expectStrict(IssueLinksSchema.valueType, first, 'state', true);
    expect(IssueLinksSchema.safeParse({ F1: changed(first, 'state', 'merged') }).success).toBe(false);
    expectStrict(PublishedSchema, valueOf(judged, 'publish'), 'commit', 1);
    expectStrict(CommentedSchema, valueOf(notJudged, 'verdict'), 'commentId', '1');
  });

  it('the clock, and the day-14 run’s steps, read back the same way', () => {
    expect(ClockSchema.safeParse(valueOf(judged, CLOCK_STEP)).success).toBe(true);
    expect(ClockSchema.safeParse(String(valueOf(judged, CLOCK_STEP))).success).toBe(false);
    expect(FactSheetSchema.safeParse(valueOf(judged, 'facts-day-14')).success).toBe(true);
    expect(PublishedSchema.safeParse(valueOf(judged, 'publish-day-14')).success).toBe(true);
  });
});

describe('RunRecordSchema — a run as retro.json keeps it', () => {
  it('parses a record of each run, and refuses one missing its fact sheet’s fields', async () => {
    const saved = await savedValues();
    const sheet = FactSheetSchema.parse(valueOf(saved, 'facts'));
    const record = { ...sheet, narration: { model: 'm', reason: null, dropped: [] }, verdict: null, lessons: [], issues: {} };
    expectStrict(RunRecordSchema, record, 'featurePr', 'PR 12');
    expect(RunRecordSchema.safeParse(changed(record, 'issues', { F1: { number: 1, url: 'u', state: 'merged' } })).success).toBe(false);
    expect(RunRecordSchema.safeParse(sheet).success).toBe(true);
  });
});
