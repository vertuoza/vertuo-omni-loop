// A kept lesson's outcome (PRD 2338): every lesson a retro keeps ends in one of two, which a person
// approves by merging the retro PR. It **became** a playbook rule, `playbook/<form>#<slot>`, the slot
// the rule was appended to; or it **stays here**, with the reason why (a rule already says it, or it is
// not about how to work here). The names follow a settled outbox entry's `Became:` and `Stays here:`.
//
// `retro.json` keeps a run's outcomes beside its `issues`, by the same key: the id of the finding the
// judge kept, whose retro issue carries the lesson (`outcomes: { "<finding>": { "became": "…" } }`).
// Optional: a run from before PRD 2338 has none. `omni retro outcome` writes one, the retro app
// renders each with `outcomeLine`, and `omni check retro` refuses one `outcomeProblem` finds unsound.
import { z } from 'zod';
import type { Context } from '../context.ts';
import { resolvePlaybookId } from '../playbook/forms.ts';

/** A kept lesson's outcome: the slot it became, or the reason it stays here. Exactly one of the two. */
export const LessonOutcomeSchema = z.union([z.object({ became: z.string() }).strict(), z.object({ staysHere: z.string() }).strict()]);
export type LessonOutcome = z.infer<typeof LessonOutcomeSchema>;

/** A run's outcomes, by the id of the finding each kept lesson was kept for. */
export const LessonOutcomesSchema = z.record(z.string(), LessonOutcomeSchema);

/** The one line an outcome renders as, under its lesson: `- **Became:** \`<id>\`` or `- **Stays here:** <why>`. */
export function outcomeLine(outcome: LessonOutcome): string {
  if ('became' in outcome) return `- **Became:** \`${outcome.became}\``;
  return `- **Stays here:** ${outcome.staysHere.trim().split(/\s+/).join(' ')}`;
}

/**
 * What makes `value` no sound outcome, in words a person can act on; `null` when it is one. A
 * `became` must name a playbook slot that resolves and is filled (`resolvePlaybookId`): a law, a blank
 * slot, a missing slot or form is refused. A `staysHere` must give a reason.
 */
export function outcomeProblem(value: unknown, { ctx }: { ctx: Pick<Context, 'root' | 'layout'> }): string | null {
  const parsed = LessonOutcomeSchema.safeParse(value);
  if (!parsed.success) return 'the outcome is neither { became } nor { staysHere }';
  const outcome = parsed.data;
  if ('staysHere' in outcome) return outcome.staysHere.trim() ? null : 'stays here with no reason';
  if (!outcome.became) return 'became names no playbook slot';
  const resolved = resolvePlaybookId(outcome.became, { ctx });
  return resolved.ok ? null : `became ${outcome.became} does not resolve — ${resolved.reason}`;
}
