// A saved step, read back through its schema (PRD 1030, s19-01 of PRD 976). Inngest memoises each
// `step.run`: the value a step returned is saved as JSON, and every later replay of the run reads it
// back from there, not from the function that made it. A deploy between two replays (the retro's
// merge run and its day-14 run are fourteen days apart) can change what a step returns, so the value
// read back is parsed with the schema of what the step returns today: a saved value of another shape
// fails, naming the step and the field, and Inngest retries the run, then fails it.
import type { z } from 'zod';
import { parseOrThrow } from 'vertuo-omni-plan/kit/lib/schema/parse-or-throw.ts';

/**
 * The part of Inngest's step tools a function runs a unit with: memoised, retried, its output saved
 * as JSON and read back as JSON. Inngest's own step satisfies it, and so does a test's stand-in.
 */
export type StepRun = { run(id: string, fn: () => unknown): Promise<unknown> };

/**
 * The step `id` run with `fn`, its saved value parsed by `schema`; else an error naming the step and
 * the first field that is wrong: `The step "facts" came back in an unexpected shape: run: …`.
 */
export async function savedStep<T>(step: StepRun, id: string, schema: z.ZodType<T>, fn: () => NoInfer<T> | Promise<NoInfer<T>>): Promise<T> {
  return parseSaved(schema, await step.run(id, fn), id);
}

/** A value read back from the saved step `id`, parsed by `schema`. */
export function parseSaved<T>(schema: z.ZodType<T>, value: unknown, id: string): T {
  return parseOrThrow(schema, value, `The step "${id}" came back in an unexpected shape`);
}

/** What Inngest does to a step's value when it saves it: JSON, and back. Tests use it to stand in for a replay. */
export function asSaved(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}
