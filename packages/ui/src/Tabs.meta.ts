import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const TABS_SIZES = ['md', 'sm'] as const;

export const tabsMeta = {
  name: 'Tabs',
  variants: { size: TABS_SIZES },
  usage: 'A row of links to the sections of one page, the current one marked: Spec, Plan, Outbox.',
  do: ['Name each tab with one or two words.', 'Give the app\'s router link, so a tab switches without a full page load.'],
  dont: ['Use tabs to go to other pages: that is navigation.', 'Show one tab alone.'],
  contrast: {
    base: [...onSurfaces('text-secondary'), ...onSurfaces('text-primary'), ...onSurfaces('border-strong', { edge: true }), ...onSurfaces('focus-ring', { edge: true })],
  },
  accessibility: [
    'A nav landmark named by `label`, holding one link per tab; the current tab carries aria-current="page".',
    'Each tab is a link: it takes focus and Enter, and works without script; given the app\'s router link (`link`), it switches without a full page load.',
    'The current tab is shown by a strong underline and weight, never by colour alone.',
  ],
  replaces: ['dossier-tabs', 'dossier-tab'],
  example: '<Tabs label="PRD sections" current="spec" items={[{ id: "spec", label: "Spec", href: "?tab=spec" }]} />',
} satisfies ComponentMeta;
