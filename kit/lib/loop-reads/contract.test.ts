import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LoopChangeDetailSchema, LoopChangesSchema, LoopCommentsSchema, LoopIssueDetailSchema, LoopIssuesSchema, LoopErrorSchema } from './contract.ts';

// The loop's contract, from the kit's side (PRD 1665, s3): the page's own examples, read by their path
// (settled item s2-03), each parse here unchanged, so the kit reads what the page sends.

const EXAMPLES = JSON.parse(readFileSync(new URL('../../../apps/galaxy/src/loop/fixtures/contract.json', import.meta.url), 'utf8')) as Record<string, unknown>;

describe("the page's examples, read by the kit", () => {
  it.each([
    ['changes', LoopChangesSchema],
    ['change', LoopChangeDetailSchema],
    ['comments', LoopCommentsSchema],
    ['issues', LoopIssuesSchema],
    ['issue', LoopIssueDetailSchema],
    ['refusal', LoopErrorSchema],
  ] as const)('%s parses unchanged', (name, schema) => {
    expect(schema.parse(EXAMPLES[name])).toEqual(EXAMPLES[name]);
  });

  it('refuses a change in a state the loop has no word for', () => {
    const [first] = (EXAMPLES.changes as { changes: Record<string, unknown>[] }).changes;
    expect(LoopChangesSchema.safeParse({ changes: [{ ...first, state: 'OPEN' }] }).success).toBe(false);
  });

  it('refuses a check in a state the loop has no word for', () => {
    const change = EXAMPLES.change as { review: Record<string, unknown> };
    expect(LoopChangeDetailSchema.safeParse({ ...change, review: { ...change.review, checks: [{ name: 'ci', state: 'cancelled' }] } }).success).toBe(false);
  });
});
