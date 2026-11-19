import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const STAGE_TRACK_LAYOUTS = ['horizontal', 'vertical'] as const;
/** The stages of the loop, in order: the folder is the status. */
export const STAGES = ['Idea', 'PRD', 'Inbox', 'Building', 'Outbox', 'Shipped', 'Retro'] as const;

export const stageTrackMeta = {
  name: 'StageTrack',
  variants: { layout: STAGE_TRACK_LAYOUTS },
  usage: 'Where a PRD stands in the loop: idea, PRD, inbox, building, outbox, shipped, retro, with the stages behind it done and the ones ahead pending.',
  do: ['Give the stage the PRD is in: the ones before it read as done.', 'Use the horizontal layout in a header and the vertical one in a narrow column.'],
  dont: ['Use it for steps that are not the loop\'s stages: that is a Timeline.', 'Rely on the marker alone to say where the PRD is.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), ...onSurfaces('border-strong', { edge: true })],
  },
  accessibility: [
    'An ordered list: a screen reader counts the stages and reads them in order.',
    'Each stage says its state in words ("done", "current", "pending") and by the marker\'s shape (filled, thick ring, dashed), never by colour alone; the current stage carries aria-current="step".',
  ],
  replaces: ['stage-track', 'stage-stepper'],
  example: '<StageTrack stage="Building" />',
} satisfies ComponentMeta;
