// A saved step, read back through its schema (PRD 1030, s19-01 of PRD 976). Inngest memoises each
// `step.run`: the value a step returned is saved as JSON, and every later replay of the run reads it
// back from there, not from the function that made it. A deploy between two replays (the retro's
// merge run and its day-14 run are fourteen days apart) can change what a step returns, so the value
// read back is parsed with the schema of what the step returns today: a saved value of another shape
// fails, naming the step and the field, and Inngest retries the run, then fails it.
//
// On the job ledger (PRD omni-loop-4 s1, spec "What the ledger gains"), `jobSteps` keeps the same contract
// for a job the worker runs: its steps are saved in background_job_steps under the job's claim, so a retry, a
// replay or a run after a wait carries on from the last saved step, and a step that has a saved value is not
// run again. The claim is renewed after each saved step, and every minute while a step runs, so a long run is
// never claimed twice; a claim taken over stops the run before its next step. `savedStep` is unchanged: it
// reads a step from Inngest's step or from the ledger's alike.
import type { z } from 'zod';
import { parseOrThrow } from 'omni-loop/kit/lib/schema/parse-or-throw.ts';
import type { Held, StepLedger } from './jobs/ledger.ts';

/**
 * The part of Inngest's step tools a function runs a unit with: memoised, retried, its output saved
 * as JSON and read back as JSON. Inngest's own step satisfies it, and so does a test's stand-in.
 */
export type StepRun = { run(id: string, fn: () => unknown): Promise<unknown> };

/** How often a step that runs long renews its job's claim. */
export const RENEW_EVERY_MS = 60_000;

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

/**
 * The steps of `job`, held under its claim, saved on the ledger: a step with a saved value gives it back
 * without running; any other runs, its value saved as JSON, then the claim is renewed for `leaseSeconds` (the
 * ledger's 5 minutes when not given). The saved steps are read once, at the first step. A claim that is no
 * longer the job's throws, naming the job and the step; a renew that fails while a step runs is logged.
 */
export function jobSteps({
  ledger,
  job,
  leaseSeconds,
  renewEveryMs = RENEW_EVERY_MS,
  log = () => undefined,
}: {
  ledger: StepLedger;
  job: Held;
  leaseSeconds?: number;
  renewEveryMs?: number;
  log?: (line: string) => void;
}): StepRun {
  const name = `job ${job.id}`;
  const held = leaseSeconds === undefined ? job : { ...job, leaseSeconds };
  let saved: Promise<Map<string, unknown>> | null = null;

  const read = async (id: string) => {
    const steps = await ledger.stepsOf(job);
    if (steps === 'stale') throw new Error(`${name}: its claim was taken over before the step "${id}"`);
    return new Map(steps);
  };

  /** Runs `fn`, renewing the claim every `renewEveryMs` until it ends. */
  const renewing = async (id: string, fn: () => unknown): Promise<unknown> => {
    const timer = setInterval(() => {
      void ledger.renew(held).then(
        (answer) => {
          if (answer === 'stale') log(`${name}: its claim was taken over while the step "${id}" ran`);
        },
        (error: unknown) => {
          log(`${name}: its claim was not renewed: ${firstLine(error)}`);
        },
      );
    }, renewEveryMs);
    try {
      return await fn();
    } finally {
      clearInterval(timer);
    }
  };

  return {
    run: async (id, fn) => {
      saved ??= read(id);
      const steps = await saved;
      if (steps.has(id)) return steps.get(id);
      const value = asSaved(await renewing(id, fn));
      if ((await ledger.save({ ...job, step: id, value })) === 'stale') throw new Error(`${name}: its claim was taken over before the step "${id}" was saved`);
      steps.set(id, value);
      if ((await ledger.renew(held)) === 'stale') throw new Error(`${name}: its claim was taken over after the step "${id}" was saved`);
      return value;
    },
  };
}

/** Steps kept for one run only, as JSON: a job run with no ledger to save them on (a test's). */
export function memorySteps(): StepRun {
  const steps = new Map<string, unknown>();
  return {
    run: async (id, fn) => {
      if (!steps.has(id)) steps.set(id, asSaved(await fn()));
      return steps.get(id);
    },
  };
}

/** An error's first line, as a log keeps it. */
function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0]?.trim() ?? '';
}
