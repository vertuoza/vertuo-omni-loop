import { z } from 'zod';
import type { JevDecisionEntry } from './entry';
import { noulAtThreshold } from './noul';

// `law-worth` (PRD 1342 s3): whether a decision the harvest calls a rule or an invariant, with no test
// proving it yet, is worth a law (an executable test that fails when it is broken), as a Noul. At or
// above the decision's threshold it is worth a law (true): the knowledge PR writes it `Enforced by:
// pending #<issue>` and its law issue is opened; under it, not (false): it stays in its PRD's
// settled.md. Jev reads the statement, its `Why`, the principle it serves, its domain and its PRD's
// title. Today's answer is the classifier's own `worthALaw`. Asked two ways: by the App's harvest
// through `POST /api/laws/judge` (./law-judge-route.ts), signed under LAW_JUDGE_SECRET, and from a
// terminal through `omni decide law-worth` (its `terminal`).

export interface LawWorthInput {
  statement: string;
  why: string | null;
  /** The principle it serves, as the register writes it (`principle#3: …`), or null. */
  principle: string | null;
  domain: string | null;
  prdTitle: string | null;
}

const optional = (max: number) => z.string().trim().min(1).max(max).nullable().default(null);

const STATE = z.object({
  statement: z.string().trim().min(1).max(2000),
  why: optional(8000),
  principle: optional(2000),
  domain: optional(200),
  prdTitle: optional(300),
}).strict();

/** The state a caller sent, as the decision reads it, or null when it is not one. */
export function lawWorthInput(state: unknown): LawWorthInput | null {
  const read = STATE.safeParse(state);
  return read.success ? read.data : null;
}

/** The classifier's own answer as sent (`"true"` worth a law, `"false"` not), or null. */
export const lawWorthOld = (text: unknown): boolean | null => (text === 'true' ? true : text === 'false' ? false : null);

export const lawWorth: JevDecisionEntry<LawWorthInput, boolean> = {
  name: 'law-worth',
  question: {
    type: 'noul',
    statement:
      'This decision about a software product is worth a law, an executable test that fails when it is ' +
      'broken: breaking it would hurt the product or the people who rely on it, it holds for a long ' +
      'time, and code can check it; it is not a one-off choice, a taste, or a fact no test can see.',
  },
  state: (input) =>
    [
      `Statement: ${input.statement}`,
      ...(input.why ? [`Why: ${input.why}`] : []),
      ...(input.principle ? [`Serves: ${input.principle}`] : []),
      ...(input.domain ? [`Domain: ${input.domain}`] : []),
      ...(input.prdTitle ? [`PRD: ${input.prdTitle}`] : []),
    ].join('\n'),
  value: noulAtThreshold,
  show: (value) => String(value),
  terminal: { input: lawWorthInput, old: lawWorthOld },
};
