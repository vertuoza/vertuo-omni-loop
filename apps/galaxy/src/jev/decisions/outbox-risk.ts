import { z } from 'zod';
import type { JevDecisionEntry } from './entry';
import { noulAtThreshold } from './noul';

// `outbox-risk` (PRD 812 s3): whether a decision a slice took alone is hard to revert, as a Noul. Jev
// answers only `hardToRevert` (decision 5): the kit still computes the item's rank, and its law floor
// and other flags stay the agent's. A Noul at or above the decision's threshold is `true`, under it
// `false`. Jev reads the item's decision text, its options, the slice's title and the paths the slice
// touches (decision 10), which the agent writes to the state file of `omni decide outbox-risk`; its
// own `hardToRevert` is the old answer. The state file's `slice` key holds the slice and its title
// (`s3: sessions`), no slice id: the skill writes that key, so the file keeps it, and it is read here
// as `sliceLabel`, named by what it holds (ADR-0056).

export interface OutboxRiskInput {
  decision: string;
  options: string[];
  sliceLabel: string | null;
  paths: string[];
}

const TEXT = z.string().trim().min(1).max(4000);
/** A slice and its title, as the agent writes them: `s3: sessions`. */
const SLICE_LABEL = z.string().max(300);
const STATE = z.object({
  decision: TEXT,
  options: z.array(TEXT).max(8).default([]),
  slice: SLICE_LABEL.nullable().default(null),
  paths: z.array(z.string().min(1).max(500)).max(200).default([]),
}).strict().transform(({ slice, ...rest }): OutboxRiskInput => ({ ...rest, sliceLabel: slice }));

/** A Noul's answer as a yes or no: at or above `threshold` is true; anything but a number from 0 to 1 is null. */
export const noulAt = (answer: string | number, threshold: number): boolean | null =>
  typeof answer === 'number' && Number.isFinite(answer) && answer >= 0 && answer <= 1 ? answer >= threshold : null;

const lines = (heading: string, items: string[]) => (items.length ? [heading, ...items.map((i) => `- ${i}`)] : []);

export const outboxRisk: JevDecisionEntry<OutboxRiskInput, boolean> = {
  name: 'outbox-risk',
  question: {
    type: 'noul',
    statement:
      'This decision, taken by a coding agent without asking a person, is hard to revert: choosing ' +
      'differently later would cost a migration, a data change, a published contract or work people ' +
      'already rely on, not just a changed constant.',
  },
  state: (input) =>
    [
      `Decision: ${input.decision}`,
      ...lines('Options:', input.options),
      ...(input.sliceLabel ? [`Slice: ${input.sliceLabel}`] : []),
      ...lines('Paths the slice touches:', input.paths),
    ].join('\n'),
  value: noulAtThreshold,
  show: (value) => String(value),
  terminal: {
    input: (state) => {
      const read = STATE.safeParse(state);
      return read.success ? read.data : null;
    },
    old: (text) => (text === 'true' ? true : text === 'false' ? false : null),
  },
};
