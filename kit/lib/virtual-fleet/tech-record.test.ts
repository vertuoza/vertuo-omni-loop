// The Architect's tech review (PRD omni-loop-26): the `/omni:tech-review <key>-<n> --mission <m>` job line, the `omni tech:` record
// line it ends on, and its reader.
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from '../ids.ts';
import { checkRunnerLine, missionRefusal } from '../runner/line.ts';
import { LINE_CUT, stepLine } from '../runner/steps.ts';
import { POINT_MAX, POINTS_MAX, techJobLine, techLine, techRecordOf, type TechRecord } from './tech-record.ts';

const PRD = parseProductPrdId('omni-loop-31');
const record = (over: Partial<TechRecord> = {}): TechRecord => ({ v: 1, prd: PRD, plan: 'a'.repeat(64), settled: ['s2 owns the migration'], open: [], outcome: 'approved', ...over });
const NOW = new Date(2026, 10, 24, 12, 0, 0);
const point = (n: number): string => `${String(n)}: ${'the slice keeps its migration additive and its decisions append-only, '.repeat(6)}`.slice(0, POINT_MAX).trimEnd();

describe('techRecordOf', () => {
  it('reads the last whole record of its PRD, approved or escalated', () => {
    const escalated = record({ open: ['who owns the plan column'], outcome: 'escalated' });
    const log = [`12:00:00 ${techLine(record())}`, techLine(escalated), techLine(record({ prd: parseProductPrdId('omni-loop-32') }))].join('\n');
    expect(techRecordOf(log, PRD)).toEqual(escalated);
  });

  it('reads a full-length record whole once the runner kept it, and none once it is cut', () => {
    const full = record({ settled: Array.from({ length: POINTS_MAX }, (_, n) => point(n)), open: Array.from({ length: POINTS_MAX }, (_, n) => point(n + POINTS_MAX)), outcome: 'escalated' });
    const line = techLine(full);
    expect(line.length).toBeGreaterThan(LINE_CUT);
    const result = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 30, total_cost_usd: 2, duration_ms: 600_000, result: `Reviewed.\n\n${line}` });
    expect(techRecordOf(stepLine(result, { now: NOW }).join('\n'), PRD)).toEqual(full);
    expect(techRecordOf(line.slice(0, LINE_CUT), PRD)).toBeNull();
  });

  it('reads none from an approval that leaves an open point, too many points, a point on two lines, or a PRD number', () => {
    for (const bad of [
      { open: ['one left'], outcome: 'approved' },
      { settled: Array.from({ length: POINTS_MAX + 1 }, () => 'x') },
      { settled: ['two\nlines'] },
      { settled: ['x'.repeat(POINT_MAX + 1)] },
      { prd: 31 },
      { outcome: 'carried' },
    ]) expect(techRecordOf(`omni tech: ${JSON.stringify({ ...record(), ...bad })}`, PRD), JSON.stringify(bad).slice(0, 80)).toBeNull();
    expect(techRecordOf('omni tech: {not json', PRD)).toBeNull();
  });
});

describe('techJobLine', () => {
  it('is the Architect\'s line, which a runner takes for a mission at alone only', () => {
    const line = techJobLine(PRD, 12);
    expect(line).toBe('/omni:tech-review omni-loop-31 --mission 12');
    expect(checkRunnerLine(line)).toEqual({ ok: true, kind: 'omni', skill: 'tech-review', args: 'omni-loop-31 --mission 12' });
    expect(missionRefusal('tech-review', { level: 'alone' })).toBeNull();
  });
});
