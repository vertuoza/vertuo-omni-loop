import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const TIMELINE_DENSITIES = ['normal', 'compact'] as const;
export const TIMELINE_STATES = ['done', 'current', 'pending'] as const;

export const timelineMeta = {
  name: 'Timeline',
  variants: { density: TIMELINE_DENSITIES, state: TIMELINE_STATES },
  usage: 'What happened, and what comes next, in order: the steps of a PRD from idea to shipped.',
  do: ['Put the items in the order they happen, oldest first.', 'Mark at most one item as current.'],
  dont: ['Use it for a list with no order: use ListRow.', 'Rely on the marker alone to say a step is done.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), ...onSurfaces('border-strong', { edge: true })],
  },
  accessibility: [
    'An ordered list: a screen reader counts the steps and reads them in order.',
    'Each step says its state in words ("Done", "Current", "Pending") and by the marker\'s shape (filled, thick ring, dashed), never by colour alone; the current step carries aria-current="step".',
  ],
  replaces: ['dossier-timeline', 'history-list'],
  example: '<Timeline items={[{ id: "plan", title: "Plan written", time: "Nov 17", state: "done" }]} />',
} satisfies ComponentMeta;
