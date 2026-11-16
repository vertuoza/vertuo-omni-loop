// PRD 2898, s1: the acceptance report, the one format CI writes and the ready rule reads.
import { describe, expect, it } from 'vitest';
import { ACCEPTANCE_REPORT_FORMAT, parseAcceptanceReport, renderAcceptanceReport } from './report.ts';
import type { AcceptanceReport } from './report.ts';

const SHA = 'a'.repeat(40);

const REPORT: AcceptanceReport = {
  format: ACCEPTANCE_REPORT_FORMAT,
  commit: SHA,
  results: [
    { ac: 1, kind: 'test', state: 'passed', title: 'AC-1: Five passing checks', proof: 'kit/bin/ready.test.ts' },
    { ac: 9, kind: 'e2e', state: 'pending', title: 'AC-9: The PRD page', proof: null, why: 'no runner has run the e2e scenarios yet' },
  ],
};

describe('the acceptance report (PRD 2898)', () => {
  it('reads back what it writes, byte for byte the same report', () => {
    const text = renderAcceptanceReport(REPORT);
    expect(parseAcceptanceReport(text)).toEqual({ ok: true, report: REPORT });
    expect(text.endsWith('\n')).toBe(true);
  });

  it('fills a result with no proof as null', () => {
    const text = JSON.stringify({ format: ACCEPTANCE_REPORT_FORMAT, commit: SHA, results: [{ ac: 2, kind: 'test', state: 'failed', title: 'AC-2: x' }] });
    const read = parseAcceptanceReport(text);
    expect(read.ok && read.report.results[0]?.proof).toBeNull();
  });

  it('refuses text that is not JSON, naming why', () => {
    const read = parseAcceptanceReport('not json');
    expect(read.ok).toBe(false);
    expect(!read.ok && read.why).toMatch(/^the acceptance report is not JSON/);
  });

  it('refuses another format, an unknown state or kind, a title that proves another criterion, and an unknown key, naming the field', () => {
    const bad = (patch: Record<string, unknown>, result: Record<string, unknown> = {}) =>
      parseAcceptanceReport(JSON.stringify({ format: ACCEPTANCE_REPORT_FORMAT, commit: SHA, results: [{ ac: 1, kind: 'test', state: 'passed', title: 'AC-1: x', ...result }], ...patch }));
    const why = (read: ReturnType<typeof parseAcceptanceReport>) => (read.ok ? 'read' : read.why);
    expect(why(bad({ format: 'omni-acceptance/2' }))).toMatch(/format/);
    expect(why(bad({ commit: 'main' }))).toMatch(/commit/);
    expect(why(bad({}, { state: 'green' }))).toMatch(/results\.0\.state/);
    expect(why(bad({}, { kind: 'unit' }))).toMatch(/results\.0\.kind/);
    expect(why(bad({}, { title: 'AC-2: x' }))).toMatch(/results\.0\.title: AC-2: x proves AC-2, not AC-1/);
    expect(why(bad({ extra: 1 }))).toMatch(/extra/);
  });
});
