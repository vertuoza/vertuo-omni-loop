// Test support: a run of an Inngest function whose every step value comes back as Inngest saves it
// (PRD 1030, s19-01 of PRD 976). `@inngest/test` hands a step's value back as the function made it;
// Inngest itself saves it as JSON and reads that back on every replay. `savingSteps` puts each value a
// step returns through JSON and back, as Inngest does, before the function reads it, and keeps the id
// of every step that did, so a test proves each saved value still parses.
import { mockCtx } from '@inngest/test';
import { asSaved } from '../src/saved-step.ts';

type Ctx = Parameters<typeof mockCtx>[0];
type Run = (id: string, fn: () => unknown, ...rest: unknown[]) => Promise<unknown>;

/**
 * A `transformCtx` for `InngestTestEngine`: the step tools mocked as `mockCtx` mocks them, each
 * `step.run` value saved as JSON and read back, its id added to `saved`. `then` transforms the context
 * after, as a test's own `transformCtx` would.
 */
export function savingSteps(saved: string[], then: (ctx: ReturnType<typeof mockCtx>) => ReturnType<typeof mockCtx> = (ctx) => ctx) {
  return (ctx: Ctx): ReturnType<typeof mockCtx> => {
    const run = ctx.step.run as unknown as Run;
    const saving: Run = (id, fn, ...rest) =>
      run(
        id,
        async () => {
          const value = asSaved(await fn());
          saved.push(id);
          return value;
        },
        ...rest,
      );
    return then(mockCtx({ ...ctx, step: { ...ctx.step, run: saving as unknown as Ctx['step']['run'] } }));
  };
}
