/**
 * **The prerequisites runner** (PRD 1218, slice s2): runs a roadmap's `## Prerequisites` rows, one
 * after the other in table order, and says of each whether it holds.
 *
 * - A `person` row runs nothing: it is `ticked` once a person ticked it, and `waits` until then.
 * - Any other row runs its check, within a time limit (30 s by default). A check that times out,
 *   throws or rejects is **not ok**, never passed: a false green would stall the loop later.
 * - With `fix`, an `agent` row whose check fails runs its fix once (within its own, longer limit),
 *   then its check again: `fixed` when it now holds. No other row ever runs a fix.
 * - A row that is not ok, fixed or ticked `waits` (on a person), with one line saying why.
 *
 * What a row's check and fix are is the caller's (`probes`): the base catalog's, a shell command, or
 * a test's fake. A tick never frees a row a check verifies.
 */
import type { RoadmapPrerequisite } from '../parse.ts';

/** A row's state once run. */
export const PREREQUISITE_STATES = ['ok', 'fixed', 'waits', 'ticked'] as const;
export type PrerequisiteState = (typeof PREREQUISITE_STATES)[number];

/** What a check or a fix answered: it holds (or worked), or why not. */
export type Outcome = { ok: true } | { ok: false; detail: string };

/** A check or a fix, run once. */
export type Probe = () => Promise<Outcome>;

/** A row's check and fix; `null` when it has none. */
export type Probes = { check: Probe | null; fix: Probe | null };

/** One row, run. `detail` says why it waits; `null` otherwise. */
export type PrerequisiteResult = { prerequisite: RoadmapPrerequisite; state: PrerequisiteState; detail: string | null };

/** How long a check may run. */
export const CHECK_LIMIT_MS = 30_000;

/** How long a fix may run: an install takes longer than a check. */
export const FIX_LIMIT_MS = 10 * 60_000;

export type RunOptions = {
  /** Each row's check and fix. */
  probes: (prerequisite: RoadmapPrerequisite) => Probes;
  /** The ids a person ticked on the roadmap issue. */
  ticks: ReadonlySet<string>;
  /** Whether the agent rows' fixes run (`--fix`). */
  fix: boolean;
  limitMs?: number;
  fixLimitMs?: number;
  /** Resolves once `ms` have gone by; a test's stands in for the clock. */
  timer?: (ms: number) => Promise<void>;
};

/** Whether a row in `state` no longer holds anything up. */
export function isMet(state: PrerequisiteState): boolean {
  return state !== 'waits';
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Runs `probe` within `ms`: a timeout, a throw or a rejection is an outcome that is not ok. */
async function within(probe: Probe, ms: number, timer: (ms: number) => Promise<void>): Promise<Outcome> {
  const timeout = timer(ms).then((): Outcome => ({ ok: false, detail: `timed out after ${ms / 1000} s` }));
  try {
    return await Promise.race([Promise.resolve().then(probe), timeout]);
  } catch (error) {
    return { ok: false, detail: `crashed: ${message(error)}` };
  }
}

const waits = (prerequisite: RoadmapPrerequisite, detail: string): PrerequisiteResult => ({ prerequisite, state: 'waits', detail });

/** The fix a failed check may run: an agent row's, and only with `fix`. */
function fixToRun(prerequisite: RoadmapPrerequisite, fix: Probe | null, options: RunOptions): Probe | null {
  return options.fix && prerequisite.who === 'agent' ? fix : null;
}

/** Runs `fix`, then `check` again: `fixed` when it now holds. */
async function fixThenCheck(prerequisite: RoadmapPrerequisite, fix: Probe, check: () => Promise<Outcome>, options: RunOptions): Promise<PrerequisiteResult> {
  const fixed = await within(fix, options.fixLimitMs ?? FIX_LIMIT_MS, options.timer ?? sleep);
  if (!fixed.ok) return waits(prerequisite, `the fix did not work: ${fixed.detail}`);
  const again = await check();
  return again.ok ? { prerequisite, state: 'fixed', detail: null } : waits(prerequisite, `still not ok after the fix: ${again.detail}`);
}

/** One row that is not a `person` row, run. */
async function runChecked(prerequisite: RoadmapPrerequisite, options: RunOptions): Promise<PrerequisiteResult> {
  const probes = options.probes(prerequisite);
  const { check } = probes;
  if (check === null) return waits(prerequisite, 'nothing checks it');
  const runCheck = () => within(check, options.limitMs ?? CHECK_LIMIT_MS, options.timer ?? sleep);
  const first = await runCheck();
  if (first.ok) return { prerequisite, state: 'ok', detail: null };
  const fix = fixToRun(prerequisite, probes.fix, options);
  return fix === null ? waits(prerequisite, first.detail) : fixThenCheck(prerequisite, fix, runCheck, options);
}

/** Runs every row, in table order, one at a time. */
export async function runPrerequisites(prerequisites: readonly RoadmapPrerequisite[], options: RunOptions): Promise<PrerequisiteResult[]> {
  const results: PrerequisiteResult[] = [];
  for (const prerequisite of prerequisites) {
    if (prerequisite.who === 'person') {
      results.push(options.ticks.has(prerequisite.id) ? { prerequisite, state: 'ticked', detail: null } : waits(prerequisite, 'nobody has marked it done'));
      continue;
    }
    results.push(await runChecked(prerequisite, options));
  }
  return results;
}
