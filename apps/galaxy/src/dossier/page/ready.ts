import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';

// The Ready panel's view (PRD 2898 s9): the latest verdict the Omni App saved for a PRD's feature pull
// request (`public.ready_verdicts`), read as the member, turned into the words and links the panel draws.
// No rule lives here: the kit's rule decided, the App saved it; this only shows it (BL-GATE-1: a waiting or
// not judged check is never drawn as passed). The word "merged" is never a state.

const set = z.string().min(1);

const CheckSchema = z.object({
  id: set,
  title: set,
  state: z.enum(['pass', 'fail', 'not finished', 'not judged']),
  why: z.string(),
  evidence: z.string().nullable(),
  excused: z.array(z.object({ path: set, item: z.union([set, z.number()]) })).default([]),
});

const CriterionSchema = z.object({
  number: z.number().int().positive(),
  kind: z.enum(['test', 'e2e']),
  scenario: z.string().nullable(),
  lines: z.array(z.string()),
  proof: z.string().nullable(),
  state: z.enum(['passed', 'failed', 'skipped', 'pending']).nullable(),
});

/** One saved verdict, as the table answers it. */
export const ReadyRowSchema = z.object({
  repo: set,
  prd: PrdNumberSchema,
  pr_number: z.number().int().positive(),
  head_sha: set,
  state: z.enum(['ready', 'not ready', 'not finished']),
  passed: z.number().int().min(0).max(5),
  headline: set,
  checks: z.array(CheckSchema).length(5),
  criteria: z.array(CriterionSchema),
  decided_at: z.iso.datetime({ offset: true }),
});

export type ReadyRow = z.infer<typeof ReadyRowSchema>;

type Tone = 'pass' | 'fail' | 'wait';

type ReadyCriterionView = { id: string; kind: string; title: string | null; tone: Tone; state: string; proof: string | null; steps: { keyword: string; text: string }[] };
type ReadyCheckView = { name: string; tone: Tone; mark: string; state: string; evidence: string | null; note: string | null; criteria: ReadyCriterionView[] };

export type ReadyView = {
  tone: Tone;
  title: string;
  sign: string;
  /** The failing check, named at the top. */
  named: { name: string; why: string; excuse: string } | null;
  checks: ReadyCheckView[];
  /** The foot's lines, then its action. */
  foot: { lines: string[]; strong: boolean; action: { label: string; href: string } | null };
};

/** A link worth drawing: https only. */
const safe = (href: string | null): string | null => (href !== null && href.startsWith('https://') ? href : null);

const STEP = /^\s*(Given|When|Then|And|But)\s+(.*)$/;

const TONES = { pass: 'pass', fail: 'fail', 'not finished': 'wait', 'not judged': 'wait' } as const;
const MARKS = { pass: '✓', fail: '✗', wait: '…' } as const;

function stateWords(check: ReadyRow['checks'][number]): string {
  if (check.state === 'pass') return 'Pass';
  if (check.state === 'fail') return 'Fail';
  if (check.state === 'not finished') return 'Waiting';
  return check.why === '' ? 'Not judged' : `Not judged · ${check.why}`;
}

function criterionView(c: ReadyRow['criteria'][number]): ReadyCriterionView {
  const tone: Tone = c.state === 'passed' ? 'pass' : c.state === 'failed' || c.state === 'skipped' ? 'fail' : 'wait';
  const steps = c.lines.flatMap((line) => {
    const match = STEP.exec(line);
    return match?.[1] !== undefined && match[2] !== undefined ? [{ keyword: match[1], text: match[2] }] : [];
  });
  return { id: `AC-${String(c.number)}`, kind: c.kind, title: c.scenario, tone, state: tone === 'pass' ? 'Pass' : tone === 'fail' ? 'Fail' : 'Waiting', proof: safe(c.proof), steps };
}

function signOf(row: ReadyRow): string {
  const at = new Date(row.decided_at);
  const hhmm = `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`;
  return `Omni App · ${row.head_sha.slice(0, 7)} · ${hhmm} UTC`;
}

function footOf(row: ReadyRow, first: ReadyRow['checks'][number] | undefined): ReadyView['foot'] {
  if (row.state === 'ready') {
    const href = `https://github.com/${row.repo}/pull/${String(row.pr_number)}`;
    return { lines: ['Ready for review, not merged.', 'Only a person merges.'], strong: true, action: { label: `Review PR ${String(row.pr_number)}`, href } };
  }
  const evidence = safe(first?.evidence ?? null);
  if (row.state === 'not ready') return { lines: ['Stays a draft.', 'The Reviewer asked for changes.'], strong: false, action: evidence ? { label: 'Open the evidence', href: evidence } : null };
  return { lines: ['Stays a draft until all five pass.'], strong: false, action: evidence ? { label: 'Watch the run', href: evidence } : null };
}

/** The panel's view of a saved verdict; null with none, and then no panel is drawn. */
export function readyView(row: ReadyRow | null): ReadyView | null {
  if (row === null) return null;
  const failing = row.checks.find((check) => check.state === 'fail');
  const first = failing ?? row.checks.find((check) => check.state !== 'pass');
  const tone: Tone = row.state === 'ready' ? 'pass' : row.state === 'not ready' ? 'fail' : 'wait';
  const count = String(row.passed);
  const title = row.state === 'ready' ? `Ready for review · ${count} of 5` : row.state === 'not ready' ? `Not ready · ${count} of 5` : `Not finished · ${count} of 5 so far`;
  return {
    tone,
    title,
    sign: signOf(row),
    named: failing ? { name: failing.title, why: failing.why, excuse: failing.excused.length > 0 ? 'An answered question excuses part of it.' : 'No answered question excuses it.' } : null,
    checks: row.checks.map((check) => ({
      name: check.title,
      tone: TONES[check.state],
      mark: MARKS[TONES[check.state]],
      state: stateWords(check),
      evidence: safe(check.evidence),
      note: check.why === '' ? null : check.why,
      criteria: check.id === 'acceptance' ? row.criteria.map(criterionView) : [],
    })),
    foot: footOf(row, first),
  };
}
