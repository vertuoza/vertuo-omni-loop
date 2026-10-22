// The arcade's cost guards (bugs 1868, 2152) compare what one frame costs with another's, on the same
// machine. They read the CPU time the test's process spent drawing, not the wall clock: beside a full
// `pnpm test`, the scheduler hands the CPU to another worker in the middle of a frame, and the wall
// clock counts that wait as the frame's own, on one side of the comparison only. The CPU time counts
// the drawing alone, so the guards keep their ratios and stop failing on a busy machine. A worker of
// vitest's forks pool is a process that runs one test file at a time, so no other test's work counts.
import { cpuUsage } from 'node:process';
import { sure } from './sure';

/** The milliseconds of CPU time this process spent running `work`. */
export function cpuMs(work: () => void): number {
  const start = cpuUsage();
  work();
  const { user, system } = cpuUsage(start);
  return (user + system) / 1000;
}

/** The middle value of `values`, the upper one of two. */
export const median = (values: readonly number[]): number => sure([...values].sort((a, b) => a - b)[Math.floor(values.length / 2)], 'a median');
