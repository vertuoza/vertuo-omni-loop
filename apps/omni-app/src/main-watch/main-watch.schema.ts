// What each step of the main watch returns (PRD 2410), read back through these schemas (`savedStep`,
// ../saved-step.ts): Inngest saves a step's value as JSON, and the watch reads its values back for
// seven days, maybe after a deploy that changed what a step returns.
import { z } from 'zod';

const text = z.string().min(1);

/** A signal that broke a lane (./signals.ts `Break`). */
const BreakSchema = z.object({
  kind: z.enum(['ci-red', 'revert', 'regression']),
  source: text,
  url: text,
  title: text,
  parent: z.enum(['green', 'red', 'unknown']).nullable(),
  at: text,
});

/** A step "read-<turn>-<lane>": one look at one lane. */
export const ReadSchema = z.object({ breaks: z.array(BreakSchema), unread: z.array(z.enum(['ci', 'reverts', 'regressions'])) });

/** The step "open": the workspace the watch was opened in, or why none, and the rows it opened. */
export const OpenedSchema = z.object({ workspace: text.nullable(), reason: text.nullable(), opened: z.number().int().min(0) });

/** A step "record-<turn>": the breaks it added that the store did not hold yet. */
export const RecordedSchema = z.object({ added: z.number().int().min(0) });

/** A step "close-<lane>": whether the lane was still watching, and is now clean. */
export const ClosedSchema = z.object({ closed: z.boolean() });

/** What a wait reads of the tick that ended it, if one did: its time. */
export const TickSchema = z.looseObject({ ts: z.number().exactOptional() }).nullable();
