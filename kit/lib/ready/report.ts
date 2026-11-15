// PRD 2898, s1: the acceptance report — what proved each `AC-<n>` of a spec on one commit. CI's test
// job writes the `test` results from the tests titled `AC-<n>: …`, the e2e job (or a runner) adds the
// `e2e` ones, and the `acceptance` check run on the head commit carries the report; the ready rule's
// check 3 reads it. One format, here, so the writers and the reader never drift.
import { z } from 'zod';
import { KIT_MESSAGES } from '../schema/messages.ts';
import { messageOf } from '../narrow.ts';
import { AC_KINDS, acNumberOfTitle } from './criteria.ts';

/** The report's format, written in every report: a reader refuses any other. */
export const ACCEPTANCE_REPORT_FORMAT = 'omni-acceptance/1';

/** The check run CI (or the App, from a runner's result) writes on the head commit with the report. */
export const ACCEPTANCE_CHECK_NAME = 'acceptance';

/** How one proof ended: `pending` is a proof not run yet, `why` says what it waits on. */
const RESULT_STATES = ['passed', 'failed', 'skipped', 'pending'] as const;

const ResultSchema = z
  .object({
    ac: z.number().int().positive(),
    kind: z.enum(AC_KINDS),
    state: z.enum(RESULT_STATES),
    /** The test's title, `AC-<n>: …`. */
    title: z.string().min(1),
    /** Where the proof lives: the test file, or the e2e run's report. */
    proof: z.string().min(1).nullable().default(null),
    why: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((result, issues) => {
    const proves = acNumberOfTitle(result.title);
    if (proves !== result.ac) {
      const says = proves === null ? 'names no criterion as AC-<n>: …' : `proves AC-${proves}, not AC-${result.ac}`;
      issues.addIssue({ code: 'custom', path: ['title'], message: `${result.title} ${says}` });
    }
  });

const ReportSchema = z
  .object({
    format: z.literal(ACCEPTANCE_REPORT_FORMAT),
    commit: z.string().regex(/^[0-9a-f]{7,40}$/, 'the commit the proofs ran on, as a hexadecimal sha'),
    results: z.array(ResultSchema),
  })
  .strict();

/** The report of one commit. */
export type AcceptanceReport = z.infer<typeof ReportSchema>;

/** The report a text holds, or why it holds none. */
export function parseAcceptanceReport(text: string): { ok: true; report: AcceptanceReport } | { ok: false; why: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, why: `the acceptance report is not JSON (${messageOf(error).split('\n')[0]})` };
  }
  const read = ReportSchema.safeParse(raw, { error: KIT_MESSAGES });
  if (read.success) return { ok: true, report: read.data };
  const [issue] = read.error.issues;
  const path = issue?.path.join('.') || '(report)';
  const keys = issue?.code === 'unrecognized_keys' ? ` (${issue.keys.join(', ')})` : '';
  return { ok: false, why: `the acceptance report is malformed: ${path}: ${issue?.message ?? 'invalid'}${keys}` };
}

/** The report as its writers write it: JSON, two-space indented, one trailing newline. */
export function renderAcceptanceReport(report: AcceptanceReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
