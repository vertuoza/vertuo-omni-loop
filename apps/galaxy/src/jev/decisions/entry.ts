import type { JevQuestion } from '../client';
import type { JevDecisionSettings } from '../store';

// One decision of the registry (PRD 812, decision 9): the question Jev is asked, the state it is given,
// and how its answer maps to the loop's value. Each decision owns its own, so tuning or rewording one
// cannot change another. The resolver (../resolve.ts) runs any entry the same way.

export interface JevDecisionEntry<Input, Value> {
  /** The decision's stored name (public.jev_decision_names()). */
  name: string;
  question: JevQuestion;
  /** What Jev reads, built from what today's path reads. Masked by the client before it is sent. */
  state(input: Input): unknown;
  /** Jev's answer as the loop's value, or null when it falls outside the question. */
  value(answer: string | number, tuning: Pick<JevDecisionSettings, 'threshold'>): Value | null;
  /** A value as the record keeps it, beside the old answer. */
  show(value: Value): string;
  /**
   * How a Claude session asks it through `POST /api/decide/<name>` (PRD 812 s3): the state it sends
   * read as the input, and its own answer read as the old one, each null when malformed. A decision
   * without it is made in Galaxy only, and a terminal that names it is refused.
   */
  terminal?: {
    input(state: unknown): Input | null;
    old(text: string): Value | null;
  };
}

/** A decision as Settings › Jev lists it: its name, what a person reads, and what it sends. */
export interface JevDecisionRow {
  name: string;
  title: string;
  /** What the decision is, in one sentence. */
  about: string;
  /** What it sends to TypeSafe (decision 10), in plain words. */
  sends: string;
}
