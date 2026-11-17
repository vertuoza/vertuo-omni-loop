import type { ComponentMeta } from './meta.ts';

export const TABS_SIZES = ['md', 'sm'] as const;

export const tabsMeta = {
  name: 'Tabs',
  variants: { size: TABS_SIZES },
  accessibility: [
    'A nav landmark named by `label`, holding one link per tab; the current tab carries aria-current="page".',
    'Each tab is a link: it takes focus and Enter, and works without script; given the app\'s router link (`link`), it switches without a full page load.',
    'The current tab is shown by a strong underline and weight, never by colour alone.',
  ],
  replaces: ['dossier-tabs', 'dossier-tab'],
  example: '<Tabs label="PRD sections" current="spec" items={[{ id: "spec", label: "Spec", href: "?tab=spec" }]} />',
} satisfies ComponentMeta;
