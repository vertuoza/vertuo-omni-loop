import { DataList } from './DataList.tsx';
import { DATA_LIST_DENSITIES, DATA_LIST_LAYOUTS } from './DataList.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const items = [
  { id: 'owner', term: 'Owner', detail: 'Pierre' },
  { id: 'state', term: 'State', detail: 'Building' },
  { id: 'date', term: 'Opened', detail: '2026-11-17' },
];

/** A DataList in each layout, at each density. */
export const dataListSpecimen: Specimen = (prop, value) => (
  <DataList
    items={items}
    {...(prop === 'layout' ? { layout: one(DATA_LIST_LAYOUTS, value) } : {})}
    {...(prop === 'density' ? { density: one(DATA_LIST_DENSITIES, value) } : {})}
  />
);
