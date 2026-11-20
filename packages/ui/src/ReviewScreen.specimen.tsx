import { Button } from './Button.tsx';
import { ReviewScreen } from './ReviewScreen.tsx';
import { REVIEW_SCREEN_LENGTHS } from './ReviewScreen.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const sections = [
  { title: 'What changed', children: 'The spec changed in two places since you last read it.' },
  { title: 'Business laws', children: 'No law is broken by this spec.' },
  { title: 'What you approve', children: 'The problem, the solution and the plan, as pinned.' },
] as const;

/** How many specimens were drawn: /design shows one per variant and theme, and each step list needs its own name. */
let drawn = 0;

/** A review screen with two or three sections, its step list and its decision bar. */
export const reviewScreenSpecimen: Specimen = (_prop, value) => {
  drawn += 1;
  return (
    <ReviewScreen
      title="Review and approve"
      stepsLabel={`Steps ${String(drawn)}`}
      eyebrow="omni-loop-20 · Product PRD"
      lede="You approve the spec and plan."
      sections={sections.slice(0, Number(one(REVIEW_SCREEN_LENGTHS, value)))}
      question="Approve this spec and plan?"
      detail="Your approval covers exactly the files you read here."
      secondary={<Button variant="secondary">Back to the PRD</Button>}
      decision={<Button variant="primary">Approve</Button>}
    />
  );
};
