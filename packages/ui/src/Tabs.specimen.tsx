import { Tabs } from './Tabs.tsx';
import { TABS_SIZES } from './Tabs.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const items = [
  { id: 'spec', label: 'Spec', href: '#spec' },
  { id: 'plan', label: 'Plan', href: '#plan' },
  { id: 'outbox', label: 'Outbox', href: '#outbox' },
];

/** Tabs at each size, the second one current. */
export const tabsSpecimen: Specimen = (_prop, value) => <Tabs label="PRD sections" items={items} current="plan" size={one(TABS_SIZES, value)} />;
