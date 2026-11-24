// The PM's plan approval (PRD omni-loop-26): the `omni plan:` record line a mission's plan job ends on, and its reader.
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from '../ids.ts';
import { stepLine } from '../runner/steps.ts';
import { planLine, planRecordOf, type PlanRecord } from './plan-record.ts';

const PRD = parseProductPrdId('omni-loop-31');
const record = (over: Partial<PlanRecord> = {}): PlanRecord => ({ v: 1, prd: PRD, plan: 'a'.repeat(64), outcome: 'approved', ...over });
const NOW = new Date(2026, 10, 24, 12, 0, 0);

describe('planRecordOf', () => {
  it('reads the last whole record of its PRD, a time stamp before it or not', () => {
    const other = parseProductPrdId('omni-loop-32');
    const log = [`12:00:00 ${planLine(record({ plan: 'b'.repeat(64) }))}`, planLine(record()), planLine(record({ prd: other }))].join('\n');
    expect(planRecordOf(log, PRD)).toEqual(record());
    expect(planRecordOf(log, other)?.prd).toBe('omni-loop-32');
  });

  it('reads a record line the runner kept from the job\'s result', () => {
    const result = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 3, total_cost_usd: 0.1, duration_ms: 9000, result: `Planned.\n\n${planLine(record())}` });
    expect(planRecordOf(stepLine(result, { now: NOW }).join('\n'), PRD)).toEqual(record());
  });

  it('reads none from a cut line, another shape, a PRD number or a hash that does not read', () => {
    const line = planLine(record());
    expect(planRecordOf(line.slice(0, -2), PRD)).toBeNull();
    expect(planRecordOf('nothing here', PRD)).toBeNull();
    for (const bad of [{ prd: 31 }, { plan: 'A'.repeat(64) }, { plan: 'a'.repeat(63) }, { outcome: 'escalated' }, { v: 2 }]) {
      expect(planRecordOf(`omni plan: ${JSON.stringify({ ...record(), ...bad })}`, PRD), JSON.stringify(bad)).toBeNull();
    }
  });
});
