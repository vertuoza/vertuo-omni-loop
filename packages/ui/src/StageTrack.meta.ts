import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const STAGE_TRACK_LAYOUTS = ['horizontal', 'vertical'] as const;
/** Who the current stage waits on: agents at work (the accent), or the viewer (the signal). */
export const STAGE_TRACK_TONES = ['working', 'waiting'] as const;
/** The stages of the loop, in order: the folder is the status. */
export const STAGES = ['Idea', 'PRD', 'Inbox', 'Building', 'Outbox', 'Shipped', 'Retro'] as const;
/** The stages of a fix (a bug fix or a visual fix), in order. */
export const FIX_STAGES = ['Asked', 'Picked', 'Approved', 'Merged', 'Released'] as const;

export const stageTrackMeta = {
  name: 'StageTrack',
  variants: { layout: STAGE_TRACK_LAYOUTS, tone: STAGE_TRACK_TONES },
  usage: 'Where an item with a life cycle stands, said once: a PRD (Idea to Retro) or a fix (Asked to Released). The passed stages are done, the current one is named in bold with its progress (Building · 3 of 7 slices), the later ones are quiet; hovering a stage gives its time.',
  do: [
    'Say the stage here and nowhere else on the page: no stage pill, badge or "Stage:" line beside it.',
    'Give the current stage its progress in words, and the `waiting` tone only while it waits on the person reading.',
    'Give each stage its time as hover text, worded by `stageSince`: "Building since 17 Nov 09:40 UTC · 10.2 h".',
    'Use the horizontal layout in a header and the vertical one in a narrow column.',
  ],
  dont: [
    'Use it for steps that are not a life cycle\'s stages: that is a Timeline.',
    'Use the waiting tone while agents work: yellow means the viewer acts.',
    'Rely on the colour alone to say where the item is.',
  ],
  contrast: {
    base: [
      ...onSurfaces('text-tertiary'),
      ...onSurfaces('accent'),
      ...onSurfaces('success', { edge: true }),
      ...onSurfaces('border-strong', { edge: true }),
    ],
    'tone=waiting': [...onSurfaces('signal')],
  },
  accessibility: [
    'An ordered list named by `label`: a screen reader counts the stages and reads them in order.',
    'Each stage says its state in words ("done", "current", "pending") to a screen reader, and to the eye by its bar\'s shape (filled, filled to its share, a dashed outline) and the current one\'s weight, never by colour alone; the current stage carries aria-current="step".',
    'A stage\'s time is its title, a hover text: it adds to what the stage says, and nothing is told by it alone.',
  ],
  replaces: ['stage-track', 'stage-stepper'],
  example: '<StageTrack stage="Building" progress="3 of 7 slices" share={3 / 7} times={{ Building: stageSince("Building", since, now) }} />',
} satisfies ComponentMeta;
