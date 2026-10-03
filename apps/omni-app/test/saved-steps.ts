// Test support: a run of an Inngest function whose every step value comes back as Inngest saves it
// (PRD 1030, s19-01 of PRD 976). `@inngest/test` hands a step's value back as the function made it;
// Inngest itself saves it as JSON and reads that back on every replay. `savingSteps` puts each value a
// step returns through JSON and back, as Inngest does, before the function reads it, and keeps the id
// of every step that did, so a test proves each saved value still parses.
import { mockCtx } from '@inngest/test';
import { asSaved } from '../src/saved-step.ts';

type Ctx = Parameters<typeof mockCtx>[0];
type Run = (id: string, fn: () => unknown, ...rest: unknown[]) => Promise<unknown>;

type Alter = (id: string, value: unknown) => unknown;

/**
 * The context with each `step.run` value saved as JSON and read back, its id added to `saved`.
 * `alter` changes a saved value before the function reads it, as a deploy between two replays would.
 */
export function savingRun(ctx: Ctx, saved: string[], alter: Alter = (_id, value) => value): Ctx {
  const run = ctx.step.run as unknown as Run;
  const saving: Run = (id, fn, ...rest) =>
    run(
      id,
      async () => {
        const value = alter(id, asSaved(await fn()));
        saved.push(id);
        return value;
      },
      ...rest,
    );
  return { ...ctx, step: { ...ctx.step, run: saving as unknown as Ctx['step']['run'] } };
}

/** A `transformCtx` for `InngestTestEngine`: `savingRun`, then the step tools mocked as `mockCtx` mocks them. */
export function savingSteps(saved: string[], alter?: Alter) {
  return (ctx: Ctx): ReturnType<typeof mockCtx> => mockCtx(savingRun(ctx, saved, alter));
}
