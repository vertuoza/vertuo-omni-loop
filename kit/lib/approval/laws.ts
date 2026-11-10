// A PRD's business laws verdict, as the terminal reads it (bug #2696): the approval route's `laws`, where a
// product PRD's latest spec stands with the business laws of its law home. `pending` while the spec has no
// verdict yet; else the verdict, a red with each finding: the law, the spec's words and what the judge found
// broken. Read leniently: a reply with no `laws`, or one out of shape, reads as none, never as a failure.
import { z } from 'zod';

const text = z.string().min(1);

const FindingSchema = z.object({ law: text, statement: z.string().optional(), quote: text, broken: z.string().optional() });

const LawsSchema = z.union([
  z.object({ state: z.literal('pending') }),
  z.object({ state: z.enum(['green', 'red', 'neutral']), reason: text, judgedAt: z.string().optional(), findings: z.array(FindingSchema).catch([]) }),
]);

/** Where a spec stands with its business laws. */
export type Laws = z.infer<typeof LawsSchema>;

/** The `laws` of an approval route's reply, or null when it carries none it can read. */
export function parseLaws(value: unknown): Laws | null {
  const parsed = LawsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Words on one line: every run of whitespace as one space. */
const oneLine = (words: string) => words.replace(/\s+/g, ' ').trim();

/** The lines that say `laws`: its state and, for a red, each law, the spec's words and the judge's why. */
export function lawsLines(laws: Laws): string[] {
  if (laws.state === 'pending') return ['laws: not judged yet'];
  if (laws.state === 'neutral') return [`laws: not judged · ${laws.reason}`];
  if (laws.state === 'green') return [`laws: green · ${laws.reason}`];
  return [
    `laws: red · ${laws.reason}`,
    ...laws.findings.flatMap((finding) => [
      `  ${finding.law} · "${oneLine(finding.quote)}"`,
      `    why: ${finding.broken ? oneLine(finding.broken) : 'not kept'}`,
    ]),
  ];
}
