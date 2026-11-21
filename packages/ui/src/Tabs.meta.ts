import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const TABS_SIZES = ['md', 'sm'] as const;

export const tabsMeta = {
  name: 'Tabs',
  variants: { size: TABS_SIZES },
  usage: 'One row of links to the sections of one page, right under its header, the current one marked: Brainstorm, Specifications, Outbox. A tab may carry a count as a small mono pill, yellow only when it waits on the viewer; a tab with nothing yet stays, dimmed, with why on hover.',
  do: [
    'Name each tab with one or two words, and keep the same tabs in the same order on every item of a kind.',
    'Give a count as a short mono pill (`3/7`, `v2`, `5`), and `attention` only when the tab waits on the person reading.',
    'Keep an empty tab in the row with its reason (`empty`), rather than hiding it.',
    'Give the app\'s router link, so a tab switches without a full page load.',
  ],
  dont: [
    'Use tabs to go to other pages: that is navigation.',
    'Put a second row of tabs inside a tab: sub-views, filters and versions are a SegmentedControl.',
    'Write a count as "(2)" or a bare coloured number, or turn a pill yellow for something the viewer does not do.',
    'Show one tab alone.',
  ],
  contrast: {
    base: [
      ...onSurfaces('text-secondary'),
      ...onSurfaces('text-primary'),
      ...onSurfaces('text-tertiary'),
      ...onSurfaces('border-strong', { edge: true }),
      ...onSurfaces('focus-ring', { edge: true }),
      { text: 'text-secondary', on: 'raised' },
      { text: 'signal', on: 'signal-soft' },
    ],
  },
  accessibility: [
    'A nav landmark named by `label`, holding one link per tab; the current tab carries aria-current="page".',
    'Each tab is a link: it takes focus and Enter, and works without script; given the app\'s router link (`link`), it switches without a full page load.',
    'An empty tab is no link and takes no focus: it carries aria-disabled="true" and its reason as its title. The current tab stays a link even when empty.',
    'A count is text inside the tab\'s name ("Outbox 2 open"); the yellow of `attention` adds to it, never says it alone.',
    'One row: tabs that do not fit scroll sideways, never wrap.',
    'The current tab is shown by a strong underline and weight, never by colour alone.',
  ],
  replaces: ['dossier-tabs', 'dossier-tab'],
  example: '<Tabs label="PRD sections" current="spec" items={[{ id: "spec", label: "Specifications", href: "?tab=spec", count: "3/7" }, { id: "outbox", label: "Outbox", href: "?tab=outbox", count: "2 open", attention: true }, { id: "retro", label: "Retro", href: "?tab=retro", empty: "Written when the feature PR merges" }]} />',
} satisfies ComponentMeta;
