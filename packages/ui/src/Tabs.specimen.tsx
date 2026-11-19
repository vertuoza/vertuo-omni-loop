import { Tabs } from './Tabs.tsx';
import { TABS_SIZES } from './Tabs.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const items = [
  { id: 'spec', label: 'Spec', href: '#spec' },
  { id: 'plan', label: 'Plan', href: '#plan' },
  { id: 'outbox', label: 'Outbox', href: '#outbox' },
];

/** How many specimens were drawn: /design shows one per variant and theme, and each navigation landmark needs its own name (axe landmark-unique). */
let drawn = 0;

/** Tabs at each size, the second one current. */
export const tabsSpecimen: Specimen = (_prop, value) => {
  drawn += 1;
  return <Tabs label={`PRD sections ${String(drawn)}`} items={items} current="plan" size={one(TABS_SIZES, value)} />;
};
