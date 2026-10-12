// The App's run lines (PRD 1723 s6): every GitHub webhook delivery, `server-event` call and Inngest
// function run, its failure handler's included, writes exactly one `kit/lib/log` line at its end, with
// its `event`, `outcome`, `ms` and its ids. What was thrown is logged as `failed` and rethrown
// unchanged, so Vercel's 5xx answers and Inngest's retries and failure handlers behave as before; a
// logger that throws changes nothing either.
//
// Beside the run lines, the App's other sentences (a stage event not forwarded, a budget waited on…)
// go through `noteTo`: one `note` line at `warn`, the sentence as `message`, the module that said it as
// `fn`. So the App's whole output is JSON lines.
import type { Inngest } from 'inngest';
import { log, type LogEntry, type Logger, type LogOutcome } from 'vertuo-omni-plan/kit/lib/log/log.ts';

/** The ids a run line may carry, beside its event, outcome and duration. */
export type RunFields = Pick<LogEntry, 'repo' | 'prd' | 'deliveryId' | 'runId' | 'fn' | 'status'>;

/** Adds ids to the run's line, as the run learns them. */
export type Note = (fields: RunFields) => void;

/** How an HTTP answer reads in a run line: below 400 `ok`, below 500 `refused`, else `failed`. */
export function outcomeOfStatus(status: number): LogOutcome {
  if (status < 400) return 'ok';
  return status < 500 ? 'refused' : 'failed';
}

/** Writes one line at the level its outcome reads at; a logger that throws is ignored. */
function write(logger: Logger, entry: LogEntry & { outcome: LogOutcome }): void {
  try {
    if (entry.outcome === 'ok') logger.info(entry);
    else if (entry.outcome === 'refused') logger.warn(entry);
    else logger.error(entry);
  } catch {
    // A log line never changes a run.
  }
}

/** A stopwatch on the logger's clock that never throws: `undefined` when the logger cannot time. */
function stopwatch(logger: Logger): () => number | undefined {
  try {
    const elapsed = logger.timer();
    return () => {
      try {
        return elapsed();
      } catch {
        return undefined;
      }
    };
  } catch {
    return () => undefined;
  }
}

/**
 * Runs `run`, then writes its one line: the outcome `outcomeOf` reads from what it returned, or
 * `failed` with the error when it threw, which is rethrown unchanged.
 */
export async function loggedRun<T>(
  logger: Logger,
  event: string,
  run: (note: Note) => Promise<T>,
  outcomeOf: (value: T) => LogOutcome,
): Promise<T> {
  const elapsed = stopwatch(logger);
  const fields: RunFields = {};
  const note: Note = (more) => {
    Object.assign(fields, more);
  };
  let value: T;
  try {
    value = await run(note);
  } catch (error) {
    write(logger, { event, outcome: 'failed', ms: elapsed(), ...fields, error });
    throw error;
  }
  let outcome: LogOutcome;
  try {
    outcome = outcomeOf(value);
  } catch {
    outcome = 'ok';
  }
  write(logger, { event, outcome, ms: elapsed(), ...fields });
  return value;
}

/** A web-standard handler whose every request writes one `event` line, with the status it answered. */
export function loggedHandler(
  logger: Logger,
  event: string,
  handler: (request: Request, note: Note) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  return (request) =>
    loggedRun(
      logger,
      event,
      async (note) => {
        const response = await handler(request, note);
        note({ status: response.status });
        return response;
      },
      (response) => outcomeOfStatus(response.status),
    );
}

/** One sentence of a module, as a `note` line at `warn`: the sentence in `message`, the module in `fn`. */
export function noteTo(fn: string, logger: Logger = log): (line: string) => void {
  return (line) => {
    try {
      logger.warn({ event: 'note', fn, message: line });
    } catch {
      // A log line never changes a run.
    }
  };
}

/** What a function's handler, or its failure handler, is handed: only what a run line reads. */
type RunContext = { runId?: unknown };
type AnyHandler = (ctx: RunContext, ...rest: unknown[]) => unknown;
type AnyOptions = { id?: unknown; onFailure?: unknown };
type CreateFunction = (options: AnyOptions, handler: AnyHandler) => unknown;

/** `handler`, its every run that ends writing one `inngest` line naming `fn` and the run. */
function loggedFunctionHandler(logger: Logger, fn: string, handler: AnyHandler): AnyHandler {
  return (ctx, ...rest) =>
    loggedRun(
      logger,
      'inngest',
      async (note) => {
        note({ fn, runId: typeof ctx.runId === 'string' ? ctx.runId : undefined });
        return await handler(ctx, ...rest);
      },
      () => 'ok',
    );
}

/**
 * `client`, whose `createFunction` makes functions whose every run writes one `inngest` line: the
 * function's id in `fn`, the run id, `ok` or `failed`. A failure handler's run writes its own line, its
 * function's id with Inngest's `-failure` suffix in `fn`. Every option, retries and failure handler
 * included, reaches Inngest as given; anything else of the client is the client's own.
 */
export function loggedClient<C extends Inngest.Any>(client: C, logger: Logger = log): C {
  const create = client.createFunction as unknown as CreateFunction;
  const createLogged: CreateFunction = (options, handler) => {
    const fn = typeof options.id === 'string' ? options.id : 'unknown';
    const onFailure = typeof options.onFailure === 'function' ? (options.onFailure as AnyHandler) : undefined;
    return create(
      onFailure ? { ...options, onFailure: loggedFunctionHandler(logger, `${fn}-failure`, onFailure) } : options,
      loggedFunctionHandler(logger, fn, handler),
    );
  };
  return new Proxy(client, {
    get: (target, property, receiver): unknown => (property === 'createFunction' ? createLogged : Reflect.get(target, property, receiver)),
  });
}
