import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const DEFINITION_LIST_DENSITIES = ['normal', 'compact'] as const;

export const definitionListMeta = {
  name: 'DefinitionList',
  variants: { density: DEFINITION_LIST_DENSITIES },
  usage: 'The facts about one thing, beside its main content: each label over its value. A fact with no value is left out.',
  do: ['Give every fact an id, a short label and its value.', 'Pass an empty value to leave a fact out: the list drops it.'],
  dont: ['Draw a dash for a fact that is missing.', 'Use it for a table of many rows: use DataList or a table.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-tertiary')] },
  accessibility: [
    'It is a `dl` of `dt` and `dd`, so a screen reader reads each label with its value.',
    'The label is tertiary text at 12 px and passes WCAG AA on every surface in the three themes.',
  ],
  replaces: ['dossier-fact', 'dossier-facts-strip'],
  example: '<DefinitionList facts={[{ id: \'owner\', label: \'Owner\', value: \'pierrederval\' }]} />',
} satisfies ComponentMeta;
