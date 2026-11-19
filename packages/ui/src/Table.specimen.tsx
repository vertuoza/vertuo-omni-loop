import { Table } from './Table.tsx';
import { TABLE_ALIGNS, TABLE_DENSITIES, TABLE_STRIPES } from './Table.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Table at each density, striped or not, with its last column at each alignment. */
export const tableSpecimen: Specimen = (prop, value) => (
  <Table
    caption="Slices of the plan"
    columns={[
      { id: 'slice', label: 'Slice' },
      { id: 'state', label: 'State' },
      { id: 'tests', label: 'Tests', align: prop === 'align' ? one(TABLE_ALIGNS, value) : 'start' },
    ]}
    rows={[
      { id: 's1', cells: { slice: 's1', state: 'Merged', tests: '12' } },
      { id: 's2', cells: { slice: 's2', state: 'Building', tests: '4' } },
      { id: 's3', cells: { slice: 's3', state: 'Waiting', tests: '0' } },
    ]}
    {...(prop === 'density' ? { density: one(TABLE_DENSITIES, value) } : {})}
    {...(prop === 'striped' ? { striped: one(TABLE_STRIPES, value) } : {})}
  />
);
