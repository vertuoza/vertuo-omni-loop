import { z } from 'zod';
import type { JevDecisionEntry } from './entry';
import { noulAtThreshold } from './noul';

// `constituent-break` (PRD 871 s4): whether a phase-0 spec breaks its product's Statement or one of its
// Never lines, as a Noul. The App's canon gate asks it through `POST /api/constituents/judge`
// (./judge-route.ts), signed by the App, never from a terminal: it has no `terminal`. Jev reads the spec,
// the product's live constituents and today's verdict (the gate's own model, with the findings it kept),
// which the App sends as the state; today's `broken` is the old answer. A Noul at or above the
// decision's threshold is `true` (broken), under it `false`. Jev writes no text, so it answers only
// broken or not: the quotes a red check names stay today's verdict's.

export interface ConstituentBreakInput {
  spec: string;
  statement: string | null;
  never: { id: string; text: string }[];
  verdict: { broken: boolean; findings: { quote: string; constituents: string[]; why: string }[] } | null;
}

/** The most characters of the spec Jev reads: the canon gate's own cap (CANON_SPEC_LIMIT). */
const CONSTITUENT_SPEC_LIMIT = 40_000;

const NEVER_ID = /^never#[1-9]\d*$/;
const CITED = z.union([z.literal('statement'), z.string().regex(NEVER_ID)]);

const STATE = z.object({
  spec: z.string().trim().min(1).max(CONSTITUENT_SPEC_LIMIT),
  statement: z.string().trim().min(1).max(400).nullable().default(null),
  never: z.array(z.object({ id: z.string().regex(NEVER_ID), text: z.string().trim().min(1).max(200) }).strict()).max(200).default([]),
  verdict: z.object({
    broken: z.boolean(),
    findings: z.array(z.object({
      quote: z.string().trim().min(1).max(300),
      constituents: z.array(CITED).min(1).max(50),
      why: z.string().max(500).default(''),
    }).strict()).max(50).default([]),
  }).strict().nullable().default(null),
}).strict().refine((s) => s.statement !== null || s.never.length > 0, 'a Statement or a Never line to judge by');

/** The state the App sent, as the decision reads it, or null when it is not one. */
export function constituentBreakInput(state: unknown): ConstituentBreakInput | null {
  const read = STATE.safeParse(state);
  return read.success ? read.data : null;
}

/** Today's answer as the App sent it (`"true"` broken, `"false"` not), or null. */
export const constituentBreakOld = (text: unknown): boolean | null => (text === 'true' ? true : text === 'false' ? false : null);

function verdictLines(verdict: ConstituentBreakInput['verdict']): string[] {
  if (!verdict) return [];
  return [
    '',
    `Today's verdict: ${verdict.broken ? 'broken' : 'not broken'}`,
    ...verdict.findings.map((f) => `- ${f.constituents.join(', ')}: "${f.quote}"${f.why ? ` (${f.why})` : ''}`),
  ];
}

export const constituentBreak: JevDecisionEntry<ConstituentBreakInput, boolean> = {
  name: 'constituent-break',
  question: {
    type: 'noul',
    statement:
      'This product spec breaks the product’s Statement or one of its Never lines: what it designs, in ' +
      'its own words, is something the product must never become or do, or is not the product the ' +
      'Statement describes.',
  },
  state: (input) =>
    [
      ...(input.statement ? [`Statement: ${input.statement}`] : []),
      ...(input.never.length ? ['Never:', ...input.never.map((line) => `- ${line.id}: ${line.text}`)] : []),
      ...verdictLines(input.verdict),
      '',
      'The spec:',
      '"""',
      input.spec,
      '"""',
    ].join('\n'),
  value: noulAtThreshold,
  show: (value) => String(value),
};
