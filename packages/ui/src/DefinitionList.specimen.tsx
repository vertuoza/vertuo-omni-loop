import { DefinitionList } from './DefinitionList.tsx';
import { DEFINITION_LIST_DENSITIES } from './DefinitionList.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A DefinitionList at each density, one fact left out for its empty value. */
export const definitionListSpecimen: Specimen = (_prop, value) => (
  <DefinitionList
    density={one(DEFINITION_LIST_DENSITIES, value)}
    facts={[
      { id: 'owner', label: 'Owner', value: 'pierrederval' },
      { id: 'repo', label: 'Repository', value: 'vertuoza/vertuo-omni-loop' },
      { id: 'roadmap', label: 'Roadmap', value: '' },
      { id: 'asof', label: 'As of', value: '20 Nov 2026' },
    ]}
  />
);
