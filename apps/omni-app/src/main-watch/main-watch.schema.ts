// What each step of the main watch returns (PRD 2410), read back through these schemas (`savedStep`,
// ../saved-step.ts): the ledger saves a step's value as JSON, and the watch reads its values back for
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

/**
 * What a `main-watch` job keeps between its runs (its `progress`, small): the number of the next look, the lanes done
 * with and the lanes that broke. A job with none has not looked yet: its first run only opens the watch.
 */
export const ProgressSchema = z.object({ turn: z.number().int().min(0), done: z.array(text), broke: z.array(text) });
export type Progress = z.infer<typeof ProgressSchema>;
