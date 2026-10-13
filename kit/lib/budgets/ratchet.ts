// The ratchet (PRD 1679): one pure function that gives each measured target its verdict, from the
// base's ceilings, the head's ceilings, the head's measures and the raises a person said yes to.
//
// | at the head                                                                  | verdict      |
// |------------------------------------------------------------------------------|--------------|
// | measure ≤ ceiling, ceiling not raised                                        | `green`      |
// | ceiling lowered                                                              | `green`      |
// | ceiling raised, or a first ceiling, with a settled raise for that target and that ceiling | `green` |
// | ceiling raised, or a first ceiling, without one                              | `needs-yes`  |
// | measure > ceiling                                                            | `over-budget`|
// | the target could not be measured                                            | `neutral`    |
//
// A base with no ceilings file at all (`base: null`) is an install: its first ceilings raise nothing
// (D8, installing never turns a repository red). A target with no ceiling at the head and none at
// the base has no budget, and is green. Removing a ceiling the base had is a raise no item can
// match. Shaped for any `budgets.<name>`: it reads ceilings and measures, never what was measured.
import type { Ceilings } from './ceilings.ts';
import type { Measure } from './measure.ts';

/** A raise a person said yes to: the item that asked, the target and the ceiling it named. */
export type Raise = { id: string; target: string; ceiling: number };

/** One target's verdict. `bytes` is `null` when it could not be measured, `ceiling` when it has none. */
export type TargetVerdict = {
  target: string;
  verdict: 'green' | 'over-budget' | 'needs-yes' | 'neutral';
  bytes: number | null;
  ceiling: number | null;
  baseCeiling: number | null;
  /** The ceiling went up against the base: a first one, a higher one, or one removed. */
  raised: boolean;
  /** The settled raise that let a raised ceiling through. */
  raise: string | null;
  /** Why a target could not be measured. */
  error: string | null;
};

/** What the ratchet reads. */
export type RatchetInput = {
  base: Ceilings | null;
  head: Ceilings;
  measures: readonly Measure[];
  raises: readonly Raise[];
};

const ceilingOf = (ceilings: Ceilings | null, target: string): number | null =>
  ceilings !== null && Object.hasOwn(ceilings, target) ? (ceilings[target] ?? null) : null;

/** Whether `head` went up against `base`: a first ceiling, a higher one, or one removed. */
function isRaised(base: Ceilings | null, target: string, head: number | null): boolean {
  if (base === null) return false;
  const before = ceilingOf(base, target);
  if (head === null) return before !== null;
  return before === null || head > before;
}

/** The id of the settled raise for `target` at exactly `ceiling`; none for a target with no ceiling. */
function matchingRaise(raises: readonly Raise[], target: string, ceiling: number | null): string | null {
  return raises.find((one) => one.target === target && one.ceiling === ceiling)?.id ?? null;
}

/** The verdict of a target measured at `bytes`. */
function measuredVerdict(bytes: number, ceiling: number | null, unmatchedRaise: boolean): TargetVerdict['verdict'] {
  if (ceiling !== null && bytes > ceiling) return 'over-budget';
  return unmatchedRaise ? 'needs-yes' : 'green';
}

/** One measured target's verdict. */
function judge(measure: Measure, { base, head, raises }: RatchetInput): TargetVerdict {
  const { target } = measure;
  const ceiling = ceilingOf(head, target);
  const raised = isRaised(base, target, ceiling);
  const raise = raised ? matchingRaise(raises, target, ceiling) : null;
  const shared = { target, ceiling, baseCeiling: ceilingOf(base, target), raised, raise };
  if ('error' in measure) return { ...shared, verdict: 'neutral', bytes: null, error: measure.error };
  return { ...shared, verdict: measuredVerdict(measure.bytes, ceiling, raised && raise === null), bytes: measure.bytes, error: null };
}

/** Every measured target's verdict, in the measure's order. */
export function ratchet(input: RatchetInput): TargetVerdict[] {
  return input.measures.map((measure) => judge(measure, input));
}

/** The whole check's verdict: red when a target is, else neutral when one could not be measured. */
export function overall(verdicts: readonly TargetVerdict[]): 'green' | 'red' | 'neutral' {
  if (verdicts.some(({ verdict }) => verdict === 'over-budget' || verdict === 'needs-yes')) return 'red';
  return verdicts.some(({ verdict }) => verdict === 'neutral') ? 'neutral' : 'green';
}

/** The line a raise item carries so the ratchet can match it: the target and the new ceiling. */
export function raiseLine(target: string, ceiling: number): string {
  return `Budget raise: \`${target}\` to ${ceiling} bytes`;
}

const RAISE_LINE = /budget raise:\s*`([^`\s]+)`\s+to\s+(\d+)\s+bytes/gi;

/** A settled outbox entry, as a store lists it: its id, its latest verdict and the item's text. */
export type SettledRaiseEntry = { id: string; verdict: string | undefined; itemText: string };

/**
 * The raises a person said yes to: every raise line of a settled entry whose verdict is `agreed`.
 * An entry adopted (no one answered) or drifted (the answer said no) raises nothing.
 */
export function settledRaises(entries: readonly SettledRaiseEntry[]): Raise[] {
  return entries
    .filter((entry) => entry.verdict === 'agreed')
    .flatMap(({ id, itemText }) => [...itemText.matchAll(RAISE_LINE)].map((match) => ({ id, target: match[1] ?? '', ceiling: Number(match[2]) })));
}
