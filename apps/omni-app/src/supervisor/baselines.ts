// The steps' usual times (PRD omni-loop-34 s2, spec "2. The checks"): "the step's usual time is the median of that
// step's last 9 durations on the workspace's runners, kept by the seat in long-term memory and sent to the check".
// The seat writes one long-term note per step, in the one shape below; the silent-job check (./checks.ts) reads the
// newest note of each step. A step is a job's skill (`wave`, `do-work`). A note in any other shape is not a baseline.
// Pure.

/** A baseline note: `Baseline wave: 2.5 min (median of the last 9)`; the words after the minutes are free. */
const BASELINE = /^Baseline ([a-z][a-z0-9-]*): (\d+(?:\.\d+)?) min\b/;

/** Each step's usual time in minutes, from long-term notes given newest first: the newest note of a step wins. */
export function baselinesOf(notesNewestFirst: readonly string[]): Record<string, number> {
  const pairs = notesNewestFirst.flatMap((note) => {
    const [, step = '', usual = '0'] = BASELINE.exec(note) ?? [];
    return step !== '' && Number(usual) > 0 ? [[step, Number(usual)] as const] : [];
  });
  // The newest first: an older note of the same step is laid under it.
  return Object.fromEntries(pairs.reverse());
}
