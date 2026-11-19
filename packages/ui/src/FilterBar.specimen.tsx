import { FilterBar } from './FilterBar.tsx';
import { FILTER_BAR_CONTROLS } from './FilterBar.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const repos = [
  { value: 'all', label: 'All repositories' },
  { value: 'app', label: 'app' },
  { value: 'kit', label: 'kit' },
];
const states = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
];

/** The bar with all its controls, or with the search alone. */
export const filterBarSpecimen: Specimen = (_prop, value) =>
  one(FILTER_BAR_CONTROLS, value) === 'all'
    ? <FilterBar label="Filter PRDs" search={{ label: 'Search', placeholder: 'Title or number' }} selects={[{ label: 'Repository', name: 'repo', options: repos }]} segments={{ label: 'State', options: states, defaultValue: 'all' }} />
    : <FilterBar label="Filter PRDs" search={{ label: 'Search', placeholder: 'Title or number' }} />;
