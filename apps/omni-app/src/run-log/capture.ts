// For tests: a structured logger writing to an array, on a clock the test moves, and one every call of
// which throws (PRD 1723 s6).
import { createLogger, type Logger } from 'vertuo-omni-plan/kit/lib/log/log.ts';

/** A logger whose lines a test reads back, parsed; `advance` moves its clock. */
export function capture() {
  const lines: string[] = [];
  let now = 0;
  const logger = createLogger({ sink: (line) => lines.push(line), clock: () => now });
  return {
    logger,
    advance: (ms: number) => {
      now += ms;
    },
    lines: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

const fail = (): never => {
  throw new Error('the log is down');
};

/** A logger every call of which throws. */
export const throwing: Logger = { info: fail, warn: fail, error: fail, timer: fail };
