import { Tabs } from './Tabs.tsx';
import { TABS_SIZES } from './Tabs.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** Short enough to fit a specimen's frame: a count, one waiting on the viewer, an empty one. */
const items = [
  { id: 'spec', label: 'Spec', href: '#spec', count: '3/7' },
  { id: 'outbox', label: 'Outbox', href: '#outbox', count: '2 open', attention: true },
  { id: 'retro', label: 'Retro', href: '#retro', empty: 'Written when the feature PR merges' },
];

/** How many specimens were drawn: /design shows one per variant and theme, and each navigation landmark needs its own name (axe landmark-unique). */
let drawn = 0;

/** Tabs at each size: counts as pills, one waiting on the viewer, an empty one dimmed, Spec current. */
export const tabsSpecimen: Specimen = (_prop, value) => {
  drawn += 1;
  return <Tabs label={`PRD sections ${String(drawn)}`} items={items} current="spec" size={one(TABS_SIZES, value)} />;
};
