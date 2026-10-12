// For tests: a structured logger writing to an array, on a clock the test moves, and one every call of
// which throws (PRD 1723 s6).
import { vi } from 'vitest';
import { z } from 'zod';
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

const LineSchema = z.record(z.string(), z.unknown());

/**
 * The JSON lines `run` writes to stdout, parsed, stdout held meanwhile: what a module's default log
 * writes. A line that is not JSON, written by anything else, is left out.
 */
export async function stdoutLines(run: () => Promise<unknown>): Promise<Record<string, unknown>[]> {
  const written: string[] = [];
  const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    written.push(String(chunk));
    return true;
  });
  try {
    await run();
  } finally {
    write.mockRestore();
  }
  return written.flatMap((chunk) => {
    try {
      const line = LineSchema.safeParse(JSON.parse(chunk));
      return line.success ? [line.data] : [];
    } catch {
      return [];
    }
  });
}

const fail = (): never => {
  throw new Error('the log is down');
};

/** A logger every call of which throws. */
export const throwing: Logger = { info: fail, warn: fail, error: fail, timer: fail };
